/**
 * tests/combat/balanceCore.mjs
 *
 * Shared core for the headless AI-vs-AI combat balance tester.
 *
 * HARD SCOPE: tests / CI only. This module never touches the DOM, Canvas,
 * Web Audio, or any renderer — it drives the pure arena simulation
 * (src/combat/arena.js) with a scripted, deterministic player policy against
 * the built-in enemy AI and aggregates duel outcomes.
 *
 * Nothing here retunes combat numbers; it is a read-only measurement harness.
 *
 * Exports:
 *   mulberry32(seed)                      → () => float in [0,1)
 *   leadAim(shooter, target, vel, speed)  → { x, y }   (constant-speed intercept)
 *   enumerateLoadouts()                   → Build[]   (legal builds, ≤115% load)
 *   runFight(build, seed, opts?)          → FightResult
 *   runMatrix({ seeds, maxSeconds })      → { results, builds }
 *   aggregate(results)                    → BuildStat[]  (per-build, flagged)
 *   buildReport(agg, meta)                → string (markdown)
 *   WIN_RATE_FLAG, DUEL_TARGET_LOW/HIGH, FIXED_DT
 *
 * A "Build" is:
 *   { key, label, loadout, totals }
 * where `totals` is the loadout derived stats fed to createArena().
 */

import { PARTS_BY_ID } from '../../src/data/parts.js';
import { PRESET_DRIFTER } from '../../src/data/presets.js';
import { totals as loadoutTotals } from '../../src/mech/loadout.js';
import { speedPenalty, canDeploy } from '../../src/mech/weight.js';
import { overdrawPenaltyPct } from '../../src/ui/garage.js';
import { createArena, updateArena } from '../../src/combat/arena.js';
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  PROJECTILE_SPEED,
  ENEMY_STRAFE_SPEED,
} from '../../src/combat/config.js';

// ── Tunables for the harness (NOT combat tuning) ───────────────────────────────

/** Fixed timestep used by the sim — matches the engine loop (60 Hz). */
export const FIXED_DT = 1 / 60;

/** Builds with win rate above this are flagged as potential outliers. */
export const WIN_RATE_FLAG = 0.60;

/** Duel-length design target (seconds) from the feel 11/5 feel pass. */
export const DUEL_TARGET_LOW = 60;
export const DUEL_TARGET_HIGH = 120;

/** Hard cap on simulated match length (seconds). */
export const DEFAULT_MAX_SECONDS = 180;

// ── RNG: mulberry32 ────────────────────────────────────────────────────────────

/**
 * mulberry32 — tiny, fast, deterministic 32-bit PRNG.
 * Returns a function producing floats in [0, 1). Same seed ⇒ same stream.
 *
 * @param {number} seed  - unsigned 32-bit integer seed
 * @returns {() => number}
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Loadout enumeration ────────────────────────────────────────────────────────

/**
 * Enumerate a spread of legal loadouts by varying legs × core × arms around
 * the PRESET_DRIFTER baseline. Back/head stay at the preset so the matrix
 * stays small (~8–12 builds) and the varied slots dominate the signal.
 *
 * Illegal builds (load% > 115, canDeploy false) are skipped per R-weight.
 *
 * @returns {Array<{ key:string, label:string, loadout:object, totals:object }>}
 */
export function enumerateLoadouts() {
  const legsOpts = ['legs-runner', 'legs-siege'];
  const coreOpts = ['core-pulse', 'core-furnace'];
  const armROpts = ['armR-hatchet', 'armR-lancer'];
  const armLOpts = ['armL-spotter', 'armL-buckler'];

  const builds = [];

  for (const legs of legsOpts) {
    for (const core of coreOpts) {
      for (const armR of armROpts) {
        for (const armL of armLOpts) {
          const loadout = {
            ...PRESET_DRIFTER,
            legs,
            core,
            armR,
            armL,
          };

          const t = loadoutTotals(loadout, PARTS_BY_ID);

          // Skip illegal (too heavy to walk) builds — R weight cap.
          if (!canDeploy(t.loadPct)) continue;

          // Derive the combat stats createArena consumes. speedPenalty comes
          // from the weight curve; power fields drive the overdraw stutter.
          const combatTotals = {
            speedPenalty: speedPenalty(t.loadPct),
            loadPct: t.loadPct,
            powerOut: t.powerOut,
            powerDraw: t.powerDraw,
            balance: t.balance,
          };

          const key = `${legs}|${core}|${armR}|${armL}`;
          const label = [
            PARTS_BY_ID[legs].name,
            PARTS_BY_ID[core].name,
            PARTS_BY_ID[armR].name,
            PARTS_BY_ID[armL].name,
          ].join(' / ');

          builds.push({ key, label, loadout, totals: combatTotals });
        }
      }
    }
  }

  return builds;
}

// ── Lead-the-shot helper ───────────────────────────────────────────────────────

/**
 * Compute the world-space aim point that leads a moving target so a projectile
 * fired now (at PROJECTILE_SPEED) arrives where the target *will be*.
 *
 * The player's shot originates at the shooter and travels in a straight line at
 * a fixed speed; the enemy keeps moving while it is in flight. Aiming at the
 * enemy's *current* position therefore misses almost every strafing shot — the
 * root cause of the 180 s timeouts. We instead solve the classic constant-speed
 * intercept: find the lead time `t` such that the target, advancing at its
 * estimated velocity, is exactly `PROJECTILE_SPEED · t` away from the shooter,
 * then aim at that predicted point.
 *
 * Solved as a quadratic in `t` from
 *     |P + V·t − S|² = (projSpeed · t)²
 * where P = target pos, V = target velocity, S = shooter pos. We take the
 * smallest positive root (earliest interception). If there is no positive
 * real root (target outrunning the shot — impossible here since
 * ENEMY_STRAFE_SPEED ≪ PROJECTILE_SPEED, but handled for safety) we fall back
 * to the target's current position.
 *
 * Pure and deterministic: output depends only on the numeric inputs.
 *
 * @param {{ x:number, y:number }} shooter   - projectile origin
 * @param {{ x:number, y:number }} target    - current target position
 * @param {{ x:number, y:number }} targetVel - estimated target velocity (wu/s)
 * @param {number} projSpeed                  - projectile speed (wu/s)
 * @returns {{ x:number, y:number }}          - world-space aim point
 */
export function leadAim(shooter, target, targetVel, projSpeed) {
  const rx = target.x - shooter.x;
  const ry = target.y - shooter.y;
  const vx = targetVel.x;
  const vy = targetVel.y;

  // Quadratic a·t² + b·t + c = 0 for interception time t.
  const a = vx * vx + vy * vy - projSpeed * projSpeed;
  const b = 2 * (rx * vx + ry * vy);
  const c = rx * rx + ry * ry;

  let t = 0;

  if (Math.abs(a) < 1e-9) {
    // Target speed ≈ projectile speed: linear equation b·t + c = 0.
    if (Math.abs(b) > 1e-9) t = -c / b;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      const t1 = (-b - sq) / (2 * a);
      const t2 = (-b + sq) / (2 * a);
      // Smallest strictly-positive root is the earliest interception.
      const cand = [t1, t2].filter((v) => v > 0);
      if (cand.length) t = Math.min(...cand);
    }
  }

  if (!(t > 0) || !Number.isFinite(t)) {
    // No valid lead — aim at the current position.
    return { x: target.x, y: target.y };
  }

  return { x: target.x + vx * t, y: target.y + vy * t };
}

// ── Scripted player policy ─────────────────────────────────────────────────────

/**
 * Deterministic player policy for one tick.
 *
 * Behaviour (all derived from state + a seeded RNG, no wall-clock):
 *   • Aim: LEADS the shot. We estimate the enemy's velocity (preferring the
 *     measured delta from last tick's position in `ctx.prevEnemy`, falling back
 *     to the known perpendicular strafe at ENEMY_STRAFE_SPEED on the first tick)
 *     and aim at the intercept point for a projectile fired now. Aiming at the
 *     enemy's current position made strafing shots miss and timed duels out at
 *     the 180 s cap — leading is the whole point of this harness fix.
 *   • Move: strafe perpendicular to the player→enemy axis, flipping direction
 *     on a slow timer; drift slightly toward the enemy when far, away when very
 *     close — keeps the duel inside fire range without hugging.
 *   • Fire: always held (the arena enforces the cooldown).
 *   • Dash: occasional, gated by the RNG (~ roll < DASH_CHANCE per tick) so
 *     the arena dash buffer/cooldown path is exercised deterministically.
 *
 * @param {object} state   - current ArenaState
 * @param {() => number} rng
 * @param {{ tick:number, prevEnemy?:{x:number,y:number}, dt?:number }} ctx
 * @returns {{ move:{dx:number,dy:number}, aim:{x:number,y:number}, fire:boolean, dash:boolean }}
 */
export function playerPolicy(state, rng, ctx) {
  const { player, enemy } = state;

  const dx = enemy.x - player.x;
  const dy = enemy.y - player.y;
  const dist = Math.hypot(dx, dy) || 1;

  // Unit vector toward the enemy and its perpendicular (for strafing).
  const tx = dx / dist;
  const ty = dy / dist;
  const px = -ty;
  const py = tx;

  // ── Estimate enemy velocity for the lead ──────────────────────────────────
  // Preferred: finite difference from last tick's recorded position, which
  // captures whatever the enemy actually did (strafe, chase, wall-bounce flip).
  // Fallback (first tick, no history): assume perpendicular strafe at the
  // known ENEMY_STRAFE_SPEED so the very first shots still lead sensibly.
  const dt = ctx.dt ?? FIXED_DT;
  let enemyVel;
  if (ctx.prevEnemy && dt > 0) {
    enemyVel = {
      x: (enemy.x - ctx.prevEnemy.x) / dt,
      y: (enemy.y - ctx.prevEnemy.y) / dt,
    };
  } else {
    // Perpendicular strafe assumption (direction is unknown on tick 0; pick +).
    enemyVel = { x: px * ENEMY_STRAFE_SPEED, y: py * ENEMY_STRAFE_SPEED };
  }

  // Aim at the intercept point so the projectile meets the strafing enemy.
  const aim = leadAim(
    { x: player.x, y: player.y },
    { x: enemy.x, y: enemy.y },
    enemyVel,
    PROJECTILE_SPEED,
  );

  // Strafe direction flips every ~0.75 s (45 ticks) for readable side-stepping.
  const strafeDir = Math.floor(ctx.tick / 45) % 2 === 0 ? 1 : -1;

  // Range keeping: close in when far, back off when too close. The enemy
  // enters SHOOT at 350 wu, so we aim to sit a little inside that band.
  let radial = 0;
  if (dist > 320) radial = 1;       // approach
  else if (dist < 220) radial = -1; // retreat

  const moveX = px * strafeDir + tx * radial * 0.6;
  const moveY = py * strafeDir + ty * radial * 0.6;

  // Occasional dash — seeded so it is deterministic for a given (build, seed).
  const DASH_CHANCE = 0.015;
  const dash = rng() < DASH_CHANCE;

  return {
    move: { dx: moveX, dy: moveY },
    aim,
    fire: true,
    dash,
  };
}

// ── runFight ───────────────────────────────────────────────────────────────────

/**
 * Simulate one seeded, deterministic duel: scripted player vs built-in enemy.
 *
 * @param {{ totals:object }} build
 * @param {number} seed
 * @param {{ maxSeconds?:number }} [opts]
 * @returns {{
 *   phase:'win'|'lose'|'timeout',
 *   elapsedMs:number,
 *   durationSec:number,
 *   playerHp:number,
 *   enemyHp:number,
 *   seed:number,
 * }}
 */
export function runFight(build, seed, opts = {}) {
  const maxSeconds = opts.maxSeconds ?? DEFAULT_MAX_SECONDS;
  const maxTicks = Math.ceil(maxSeconds / FIXED_DT);

  const rng = mulberry32(seed);
  let state = createArena(build.totals, {});

  let tick = 0;
  // Last tick's enemy position, so the policy can estimate enemy velocity by
  // finite difference and lead its shots. Undefined on tick 0 (the policy
  // falls back to the known perpendicular-strafe assumption there).
  let prevEnemy;
  while (state.phase === 'playing' && tick < maxTicks) {
    const actions = playerPolicy(state, rng, { tick, prevEnemy, dt: FIXED_DT });
    prevEnemy = { x: state.enemy.x, y: state.enemy.y };
    state = updateArena(state, actions, FIXED_DT);
    tick++;
  }

  const timedOut = state.phase === 'playing';
  const phase = timedOut ? 'timeout' : state.phase;

  return {
    phase,
    elapsedMs: state.elapsedMs,
    durationSec: state.elapsedMs / 1000,
    playerHp: Math.max(0, state.player.hp),
    enemyHp: Math.max(0, state.enemy.hp),
    seed,
  };
}

// ── runMatrix ──────────────────────────────────────────────────────────────────

/**
 * Run every enumerated build against every seed.
 *
 * @param {{ seeds:number[], maxSeconds?:number }} cfg
 * @returns {{ builds:object[], results:Array<{ build:object } & object> }}
 */
export function runMatrix(cfg) {
  const { seeds, maxSeconds } = cfg;
  const builds = enumerateLoadouts();
  const results = [];

  for (const build of builds) {
    for (const seed of seeds) {
      const r = runFight(build, seed, { maxSeconds });
      results.push({ build, ...r });
    }
  }

  return { builds, results };
}

// ── Aggregation ────────────────────────────────────────────────────────────────

/** Median of a numeric array (sorted copy). Returns 0 for empty input. */
export function median(nums) {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

/** Mean of a numeric array. Returns 0 for empty input. */
export function mean(nums) {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Aggregate raw fight results into per-build stats and flag outliers.
 *
 * A player "win" means the enemy died (phase === 'win'). Losses count both
 * explicit 'lose' and 'timeout' (the player failed to close the kill in time).
 *
 * @param {Array<{ build:object, phase:string, durationSec:number }>} results
 * @returns {Array<{
 *   key:string, label:string, fights:number, wins:number, losses:number,
 *   timeouts:number, winRate:number, meanDurationSec:number,
 *   medianDurationSec:number, flagged:boolean, totals:object,
 * }>}
 */
export function aggregate(results) {
  const byKey = new Map();

  for (const r of results) {
    const key = r.build.key;
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        label: r.build.label,
        totals: r.build.totals,
        durations: [],
        wins: 0,
        losses: 0,
        timeouts: 0,
      });
    }
    const b = byKey.get(key);
    b.durations.push(r.durationSec);
    if (r.phase === 'win') b.wins++;
    else if (r.phase === 'timeout') { b.losses++; b.timeouts++; }
    else b.losses++;
  }

  const out = [];
  for (const b of byKey.values()) {
    const fights = b.wins + b.losses;
    const winRate = fights > 0 ? b.wins / fights : 0;
    out.push({
      key: b.key,
      label: b.label,
      fights,
      wins: b.wins,
      losses: b.losses,
      timeouts: b.timeouts,
      winRate,
      meanDurationSec: mean(b.durations),
      medianDurationSec: median(b.durations),
      flagged: winRate > WIN_RATE_FLAG,
      totals: b.totals,
    });
  }

  // Stable, useful ordering: highest win rate first.
  out.sort((a, b) => b.winRate - a.winRate);
  return out;
}

// ── Report writer ──────────────────────────────────────────────────────────────

function fmtPct(x) {
  return `${(x * 100).toFixed(1)}%`;
}
function fmtSec(x) {
  return `${x.toFixed(1)}s`;
}

/**
 * Build the markdown balance report.
 *
 * @param {ReturnType<typeof aggregate>} agg
 * @param {{
 *   totalFights:number, buildCount:number, seedCount:number,
 *   maxSeconds:number, generatedAt?:string,
 * }} meta
 * @returns {string}
 */
export function buildReport(agg, meta) {
  const flagged = agg.filter((b) => b.flagged);
  const inTarget = agg.filter(
    (b) =>
      b.medianDurationSec >= DUEL_TARGET_LOW &&
      b.medianDurationSec <= DUEL_TARGET_HIGH,
  );

  const lines = [];

  lines.push('# HAUNT//HOUND — Combat Balance Report');
  lines.push('');
  lines.push(
    '> Headless AI-vs-AI balance tester. Scripted player policy (strafe + ' +
      'aim + fire + occasional dash) vs the built-in enemy AI, run over seeded ' +
      'deterministic duels. **Report only — no combat numbers were retuned.**',
  );
  lines.push('');
  lines.push(`- Generated: ${meta.generatedAt ?? new Date().toISOString()}`);
  lines.push(`- Builds: ${meta.buildCount}`);
  lines.push(`- Seeds per build: ${meta.seedCount}`);
  lines.push(`- Total fights: ${meta.totalFights}`);
  lines.push(`- Match cap: ${meta.maxSeconds}s (fixed ${FIXED_DT.toFixed(5)}s step)`);
  lines.push(`- Win-rate flag threshold: > ${fmtPct(WIN_RATE_FLAG)}`);
  lines.push(
    `- Duel-length target: ${DUEL_TARGET_LOW}–${DUEL_TARGET_HIGH}s (median)`,
  );
  lines.push('');

  // ── Summary table ──────────────────────────────────────────────────────────
  lines.push('## Summary (per build)');
  lines.push('');
  lines.push(
    '| Build | Load% | Pwr (out/draw) | Fights | Wins | Losses | Timeouts | Win rate | Mean dur | Median dur | Flag |',
  );
  lines.push(
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|:--:|',
  );
  for (const b of agg) {
    const t = b.totals;
    lines.push(
      `| ${b.label} | ${t.loadPct.toFixed(0)} | ${t.powerOut}/${t.powerDraw} | ` +
        `${b.fights} | ${b.wins} | ${b.losses} | ${b.timeouts} | ` +
        `${fmtPct(b.winRate)} | ${fmtSec(b.meanDurationSec)} | ` +
        `${fmtSec(b.medianDurationSec)} | ${b.flagged ? '⚠️' : ''} |`,
    );
  }
  lines.push('');

  // ── Flagged builds ───────────────────────────────────────────────────────── 
  lines.push('## Flagged builds (win rate > 60%)');
  lines.push('');
  if (flagged.length === 0) {
    lines.push('None — no build exceeded the 60% win-rate threshold.');
  } else {
    lines.push('| Build | Win rate | Median dur |');
    lines.push('|---|---:|---:|');
    for (const b of flagged) {
      lines.push(
        `| ${b.label} | ${fmtPct(b.winRate)} | ${fmtSec(b.medianDurationSec)} |`,
      );
    }
  }
  lines.push('');

  // ── Duel-length stats vs target ──────────────────────────────────────────── 
  lines.push('## Duel length vs 60–120s target');
  lines.push('');
  const allMedians = agg.map((b) => b.medianDurationSec);
  const allMeans = agg.map((b) => b.meanDurationSec);
  lines.push(
    `- Builds with median in target (${DUEL_TARGET_LOW}–${DUEL_TARGET_HIGH}s): ` +
      `${inTarget.length} / ${agg.length}`,
  );
  lines.push(`- Median of per-build medians: ${fmtSec(median(allMedians))}`);
  lines.push(`- Mean of per-build means: ${fmtSec(mean(allMeans))}`);
  lines.push('');
  lines.push('| Build | Median dur | In target? |');
  lines.push('|---|---:|:--:|');
  for (const b of agg) {
    const inRange =
      b.medianDurationSec >= DUEL_TARGET_LOW &&
      b.medianDurationSec <= DUEL_TARGET_HIGH;
    lines.push(
      `| ${b.label} | ${fmtSec(b.medianDurationSec)} | ${inRange ? '✅' : '—'} |`,
    );
  }
  lines.push('');

  return lines.join('\n');
}

export { ARENA_WIDTH, ARENA_HEIGHT };
