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
import { applyHauntPressure } from '../../src/ui/hauntLevel.js';
import { combatModsFor } from '../../src/combat/loadoutEffects.js';

// ── Tunables for the harness (NOT combat tuning) ───────────────────────────────

/** Fixed timestep used by the sim — matches the engine loop (60 Hz). */
export const FIXED_DT = 1 / 60;

/** Builds with win rate above this are flagged as potential outliers. */
export const WIN_RATE_FLAG = 0.60;

/** Duel-length design target (seconds) from the Feel pass 11/5 feel pass. */
export const DUEL_TARGET_LOW = 60;
export const DUEL_TARGET_HIGH = 120;

/** Hard cap on simulated match length (seconds). */
export const DEFAULT_MAX_SECONDS = 180;

/**
 * Aim-noise sigma (world units) for the scripted player policy (LEVER 2,
 * harness-only). After the perfect-lead intercept point is computed, the policy
 * adds a seeded Gaussian offset *perpendicular* to the shot direction, so a
 * fraction of shots miss a strafing enemy. This is a property of the measuring
 * harness, NOT of combat: it models an imperfect human aim so perfect lead is
 * not god-mode. At the enemy's ~90 wu/s strafe and a 20 wu hit radius, a ~60 wu
 * lateral sigma makes a substantial minority of shots whiff — enough that the
 * enemy finishes some fights and win rates are no longer universally 100%.
 *
 * LEVER mix retune (11/5): sigma=60 overshot (near-all 180 s timeouts, 0–6%
 * wins); sigma=32/42 gave in-window medians but a 100% win rate. Paired with
 * ENEMY_MAX_HP 4200 → 3600 (shorter baseline TTK) and small seeded player-policy
 * lapses (skip-fire / large-offset shots, below), we take sigma=36 — enough
 * lateral error that a strafing enemy occasionally survives a volley, but not so
 * much that fights stall. The lapses supply the losses; the shorter TTK keeps
 * medians under 120 s. Deterministic: the offset is drawn from the same seeded
 * RNG stream, so a given (build, seed) still replays identically.
 */
export const AIM_NOISE_SIGMA = 36;

/**
 * Policy-lapse chance per tick (LEVER mix retune 11/5b, harness-only, NOT combat).
 *
 * Even with aim noise, a perfect-lead player that *always* fires on cooldown
 * never lets a shorter-HP enemy finish a kill — win rates pin at 100%. To model
 * an imperfect human we give the scripted policy a seeded chance each tick to
 * begin a "lapse": a *sustained* window (LAPSE_TICKS, below) during which the
 * player either stops firing entirely or holds a badly-aimed shot. A single-tick
 * lapse barely cost the player anything (one missed/skipped shot, immediately
 * back to perfect lead) so win rates stayed at 100%; a lapse that *sticks* for
 * ~0.4–0.7 s opens a real window — the player's DPS drops out for that stretch,
 * the duel lengthens slightly, and the enemy accumulates several more shot
 * attempts (and some landing shots) before the player closes the kill. That is
 * what finally lets the enemy win some seeds.
 *
 * Why sticky beats one-shot for producing losses: the enemy fires on a slow
 * windup+cooldown cycle (~1.95 s/shot) with no lead, so its per-shot hit chance
 * against a strafing player is modest. An isolated skipped player shot does not
 * move the needle. But a 0.4–0.7 s no-fire window both (a) removes ~2 player
 * volleys — extending enemy survival so the fight runs longer and the enemy gets
 * more total shot attempts — and (b) does so repeatedly over the duel. In
 * aggregate the fight lengthens just enough for the enemy's accumulated hits to
 * reach the player's 300 HP on a meaningful share of seeds, while the shorter
 * baseline TTK (ENEMY_MAX_HP 3600) keeps most medians under 120 s.
 *
 * ~0.10–0.12 as a *lapse-start* roll, evaluated only on ticks where the player
 * would otherwise take a shot (fire cooldown ready, ≈ every 300 ms / 18 ticks)
 * and only when not already lapsing, lands a handful of multi-tick lapses per
 * duel. Gating the start on a fire-ready tick is what keeps a 0.11 per-roll
 * chance from saturating: a naive per-*tick* 0.11 roll would start a new lapse
 * within ~9 ticks of the last one ending, leaving the player lapsing ~¾ of the
 * duel and stalling fights into 180 s timeouts (the sigma=60 failure mode). At
 * one start-opportunity per ~18 ticks the lapse-active fraction instead settles
 * near ~15% — enough no-fire/bad-aim windows to cost the player some seeds while
 * the ~54 s baseline TTK keeps medians inside 60–120 s. Deterministic: the
 * start roll and the which-kind roll are drawn from the same seeded mulberry32
 * stream EVERY tick (so draw count per tick is fixed), and the lapse length is
 * a constant, so a given (build, seed) replays identically.
 */
export const LAPSE_CHANCE = 0.11;

/**
 * Lapse duration in ticks (harness-only). When a lapse starts it is held for
 * this many ticks via `ctx.lapseTicksRemaining`, so the player's no-fire /
 * bad-aim window lasts ~LAPSE_TICKS / 60 s rather than a single tick.
 *
 * LEVER 4 retune (11/5d, LAST pass): 30 → 55. 30 ticks ≈ 0.5 s froze the
 * player long enough for the enemy to *attempt* a shot or two, but at the old
 * 15 dmg the enemy could not finish — win rates stayed 100%. Paired with the
 * ENEMY_PROJECTILE_DAMAGE 15 → 35 bump, a longer ~0.9 s freeze (55 / 60 s) is a
 * bigger sitting-duck window: the slow enemy (~1.95 s/shot cycle) can now land
 * ~2–3 shots during a single lapse, and at 35 dmg that is enough to close out a
 * 300 HP player over a handful of lapses — producing a real loss share. 55
 * ticks is still short enough (and the ENEMY_MAX_HP 3300 → 2900 trim keeps TTK
 * down) that player-side medians stay near/under 120 s rather than stalling
 * into 180 s timeouts.
 */
export const LAPSE_TICKS = 55;

/**
 * Lateral aim offset (world units) applied on a "bad-aim" lapse — far larger
 * than AIM_NOISE_SIGMA so the shot clearly whiffs a strafing enemy.
 */
export const LAPSE_AIM_OFFSET_WU = 120;

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
          // M4.5: only present when FEATURES.loadoutEffects is on.
          const combatMods = combatModsFor(loadout);
          if (combatMods) combatTotals.combatMods = combatMods;

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
 *     and aim at the intercept point for a projectile fired now, then add a
 *     seeded perpendicular Gaussian offset (AIM_NOISE_SIGMA, LEVER 2) so a
 *     fraction of shots miss — perfect lead must not be god-mode. Aiming at the
 *     enemy's current position made strafing shots miss and timed duels out at
 *     the 180 s cap — leading is the whole point of this harness fix.
 *   • Move: strafe perpendicular to the player→enemy axis, flipping direction
 *     on a slow timer; drift slightly toward the enemy when far, away when very
 *     close — keeps the duel inside fire range without hugging. DURING an active
 *     sticky lapse movement is FROZEN (dx/dy = 0) so the player stops dodging
 *     and the slow enemy can land the shots that produce some losses.
 *   • Fire: held by default, but a seeded per-tick chance (LAPSE_CHANCE) *starts*
 *     a sustained "lapse" — a window of LAPSE_TICKS (~0.5 s), tracked on
 *     `ctx.lapseTicksRemaining`/`ctx.lapseKind`, during which the player either
 *     stops firing or holds a badly-aimed shot (large lateral LAPSE_AIM_OFFSET_WU
 *     offset). The sticky window (vs a single-tick blip) drops the player's DPS
 *     out long enough for the slow enemy to accumulate finishing shots on some
 *     seeds, so win rates are not universally 100%. The arena still enforces the
 *     cooldown on the ticks that do fire.
 *   • Dash: occasional, gated by the RNG (~ roll < DASH_CHANCE per tick) so
 *     the arena dash buffer/cooldown path is exercised deterministically.
 *
 * @param {object} state   - current ArenaState
 * @param {() => number} rng
 * @param {{ tick:number, prevEnemy?:{x:number,y:number}, dt?:number,
 *           lapseTicksRemaining?:number, lapseKind?:number }} ctx
 *   Persistent scratch carried across ticks by runFight. `lapseTicksRemaining`
 *   and `lapseKind` hold the sticky-lapse state; playerPolicy reads and writes
 *   them so a lapse persists for its whole window.
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
  const aimLead = leadAim(
    { x: player.x, y: player.y },
    { x: enemy.x, y: enemy.y },
    enemyVel,
    // M4.5: lead with the build's real shot speed (Lancer flies faster); with
    // no loadout effects projectileSpeedMult is unset and this is unchanged.
    PROJECTILE_SPEED * (player.projectileSpeedMult ?? 1),
  );

  // ── Seeded aim noise (LEVER 2, harness-only) ──────────────────────────────
  // Perfect lead with zero error is god-mode: every strafing shot lands and the
  // duel resolves in a flat ~HP/DPS time at a 100% win rate. To model an
  // imperfect human aim we perturb the aim point *perpendicular* to the shot
  // direction by a seeded Gaussian offset (AIM_NOISE_SIGMA world units). A
  // perpendicular (not radial) offset is what actually turns a hit into a miss
  // against a laterally strafing target, while leaving the lead distance intact.
  // Box–Muller turns two uniform RNG draws into one standard-normal sample;
  // because it consumes the same seeded stream the result stays deterministic.
  const adx = aimLead.x - player.x;
  const ady = aimLead.y - player.y;
  const alen = Math.hypot(adx, ady) || 1;
  // Unit vector perpendicular to the aim direction.
  const apx = -ady / alen;
  const apy = adx / alen;
  // Standard normal via Box–Muller (guard u1 away from 0 for log()).
  const u1 = Math.max(rng(), 1e-9);
  const u2 = rng();
  const gauss = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const offset = gauss * AIM_NOISE_SIGMA;
  let aim = {
    x: aimLead.x + apx * offset,
    y: aimLead.y + apy * offset,
  };

  // ── Policy lapses (LEVER mix retune 11/5b, harness-only) ──────────────────
  // A seeded chance each tick to *begin* a sustained lapse: a window of
  // LAPSE_TICKS (~0.5 s) during which the scripted player either stops firing
  // or holds a badly-aimed shot. The lapse state lives on `ctx`
  // (ctx.lapseTicksRemaining + ctx.lapseKind), which runFight threads across
  // ticks, so once a lapse starts it *sticks* for the whole window instead of
  // flickering for a single tick. A single-tick lapse barely cost the player
  // anything and left win rates at 100%; a multi-tick window drops the player's
  // DPS out long enough for the enemy to accumulate finishing shots on some
  // seeds. Deterministic: two seeded draws (start-gate, then which-kind) are
  // consumed EVERY tick — the start-gate always rolls, and the which-kind roll
  // is only *used* when a new lapse starts — so a given (build, seed) consumes
  // the same number of draws per tick and replays identically. Rolls happen
  // AFTER the aim-noise draws so the existing noise stream is unchanged.
  let fire = true;

  let lapseTicksRemaining = ctx.lapseTicksRemaining ?? 0;
  let lapseKind = ctx.lapseKind ?? 0;

  const lapseStartRoll = rng();
  const lapseKindRoll = rng();

  // Start a fresh lapse only on a tick where the player would otherwise take a
  // shot (fire cooldown ready) and is not already lapsing. Gating on fire-ready
  // (≈ every 18 ticks) is what keeps the 0.11 per-roll chance from saturating
  // the duel with lapses — see LAPSE_CHANCE doc. `fireReady` is true when the
  // cooldown has elapsed (defensively treats a missing field as ready).
  const fireReady = (player.fireCooldown ?? 0) <= 0;
  if (lapseTicksRemaining <= 0 && fireReady && lapseStartRoll < LAPSE_CHANCE) {
    // Begin a fresh multi-tick lapse. Pick its kind now and hold it.
    lapseTicksRemaining = LAPSE_TICKS;
    lapseKind = lapseKindRoll;
  }

  // True on every tick the lapse is active (this tick included), used below to
  // freeze movement so the enemy can actually land shots during the window.
  const lapseActive = lapseTicksRemaining > 0;

  if (lapseTicksRemaining > 0) {
    if (lapseKind < 0.5) {
      // No-fire window — the player hesitates for the whole lapse. This both
      // whiffs the player's own volleys AND lengthens the fight, giving the
      // slow enemy more shot attempts to land.
      fire = false;
    } else {
      // Bad-aim window: a large lateral offset clearly misses a strafing enemy
      // for the duration — the player keeps firing but the shots whiff.
      const badOffset = (lapseKind < 0.75 ? 1 : -1) * LAPSE_AIM_OFFSET_WU;
      aim = {
        x: aimLead.x + apx * badOffset,
        y: aimLead.y + apy * badOffset,
      };
    }
    lapseTicksRemaining -= 1;
  }

  // Persist the (possibly decremented) lapse state back onto ctx so runFight
  // carries it into the next tick. This is the whole point of the sticky lapse.
  ctx.lapseTicksRemaining = lapseTicksRemaining;
  ctx.lapseKind = lapseKind;

  // Strafe direction flips every ~0.75 s (45 ticks) for readable side-stepping.
  const strafeDir = Math.floor(ctx.tick / 45) % 2 === 0 ? 1 : -1;

  // Range keeping: close in when far, back off when too close. The enemy
  // enters SHOOT at 350 wu, so we aim to sit a little inside that band.
  let radial = 0;
  if (dist > 320) radial = 1;       // approach
  else if (dist < 220) radial = -1; // retreat

  // During an active sticky lapse, FREEZE movement (dx/dy = 0) as well as the
  // fire-skip / wild-aim above. Strafing during the no-fire/bad-aim window let
  // the player dodge the slow enemy's shots, so the enemy almost never landed
  // the finishing hits and win rates pinned at 100% (player ending ~180–300
  // HP). Standing still for the ~0.5 s lapse lets the enemy actually connect,
  // which is what finally produces a real share of losses.
  const moveX = lapseActive ? 0 : px * strafeDir + tx * radial * 0.6;
  const moveY = lapseActive ? 0 : py * strafeDir + ty * radial * 0.6;

  // Occasional dash — seeded so it is deterministic for a given (build, seed).
  const DASH_CHANCE = 0.015;
  const dash = rng() < DASH_CHANCE;

  return {
    move: { dx: moveX, dy: moveY },
    aim,
    fire,
    dash,
  };
}

// ── Policy wrapper ─────────────────────────────────────────────────────────────

/**
 * How far inside the arena walls the camp-corner target sits (world units).
 * Keeps the mech visibly inside the playfield.
 */
const MECH_CORNER_MARGIN = 60;

/**
 * 'reactive' policy dash window (ms): the player dashes only while the enemy's
 * shot windup has 0 < windupRemainingMs <= this value, i.e. it reads the tell
 * and dodges at the last moment. Harness-only, NOT combat tuning.
 */
export const REACTIVE_DASH_WINDOW_MS = 150;

/**
 * Dispatch a tick's actions for the requested policy.
 *
 * All four policies call playerPolicy (and consume the same seeded RNG draws
 * per tick) so a given (build, seed) produces an identical RNG stream regardless
 * of policy — meaning per-level seeds stay comparable across policies.
 *
 * 'baseline'  — playerPolicy as-is.
 * 'dashSpam'  — baseline, but dash overridden to true every tick.
 * 'camp'      — baseline aim/fire/lapse RNG consumed identically, but movement
 *   replaced: the player walks toward the arena corner nearest their starting
 *   position and stands still (move {dx:0,dy:0}) once within 20 wu of it.
 * 'reactive'  — baseline, but dash is true exactly when the enemy windup has
 *   0 < windupRemainingMs <= REACTIVE_DASH_WINDOW_MS (reads the tell).
 *
 * @param {'baseline'|'dashSpam'|'camp'|'reactive'} policy
 * @param {object} state
 * @param {() => number} rng
 * @param {object} ctx  - persistent scratch (same shape as playerPolicy expects)
 * @returns {{ move:{dx:number,dy:number}, aim:{x:number,y:number}, fire:boolean, dash:boolean }}
 */
export function policyActions(policy, state, rng, ctx) {
  const base = playerPolicy(state, rng, ctx);

  if (policy === 'baseline') return base;

  if (policy === 'dashSpam') {
    return { ...base, dash: true };
  }

  if (policy === 'reactive') {
    const w = state.enemy.windupRemainingMs;
    return { ...base, dash: w > 0 && w <= REACTIVE_DASH_WINDOW_MS };
  }

  if (policy === 'camp') {
    // The camp corner is MECH_CORNER_MARGIN inside the wall closest to player
    // start (200, 450 in a 1200×900 arena → top-left quadrant → corner (60,60)).
    const cornerX = MECH_CORNER_MARGIN;
    const cornerY = MECH_CORNER_MARGIN;

    const { player } = state;
    const toCx = cornerX - player.x;
    const toCy = cornerY - player.y;
    const dist = Math.hypot(toCx, toCy);

    let move;
    if (dist <= 20) {
      move = { dx: 0, dy: 0 };
    } else {
      // Unit vector toward corner — the arena clamps positions, so just walk
      // straight at it; magnitude doesn't need to be 1 (arena normalises).
      move = { dx: toCx / dist, dy: toCy / dist };
    }

    return { ...base, move };
  }

  // Unknown policy: fall back to baseline.
  return base;
}

// ── runFight ───────────────────────────────────────────────────────────────────

/**
 * Simulate one seeded, deterministic duel: scripted player vs built-in enemy.
 *
 * @param {{ totals:object }} build
 * @param {number} seed
 * @param {{ maxSeconds?:number, hauntLv?:number, policy?:'baseline'|'dashSpam'|'camp'|'reactive' }} [opts]
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
  const policy = opts.policy ?? 'baseline';

  const rng = mulberry32(seed);
  let state = createArena(build.totals, {});

  // Apply haunt pressure only when a numeric hauntLv is explicitly passed
  // (default 1 kept here matches live difficulty; callers that omit hauntLv
  // get unchanged behaviour).
  if (typeof opts.hauntLv === 'number') {
    state = { ...state, enemy: applyHauntPressure(state.enemy, opts.hauntLv) };
  }

  let tick = 0;
  let prevEnemy;
  const ctx = { tick: 0, prevEnemy: undefined, dt: FIXED_DT };
  while (state.phase === 'playing' && tick < maxTicks) {
    ctx.tick = tick;
    ctx.prevEnemy = prevEnemy;
    const actions = policyActions(policy, state, rng, ctx);
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

// ── runLevelMatrix ─────────────────────────────────────────────────────────────

/**
 * Run builds × seeds for each haunt level (and policy), returning per-level
 * aggregates. Replaces the flat runMatrix for balance work.
 *
 * @param {{
 *   seeds: number[],
 *   levels?: number[],
 *   policy?: 'baseline'|'dashSpam'|'camp'|'reactive',
 *   maxSeconds?: number,
 * }} cfg
 * @returns {Array<{
 *   level: number,
 *   policy: string,
 *   builds: ReturnType<typeof aggregate>,
 *   winRate: number,
 *   medianDurationSec: number,
 *   maxBuildDeviation: number,
 * }>}
 */
export function runLevelMatrix({ seeds, levels = [1, 2, 3, 4, 5], policy = 'baseline', maxSeconds } = {}) {
  const builds = enumerateLoadouts();
  const out = [];

  for (const level of levels) {
    const results = [];

    for (const build of builds) {
      for (const seed of seeds) {
        const r = runFight(build, seed, { hauntLv: level, policy, maxSeconds });
        results.push({ build, ...r });
      }
    }

    const buildStats = aggregate(results);

    // Level-wide win rate and median duration (across all fights, all builds).
    const allWins = results.filter((r) => r.phase === 'win').length;
    const winRate = results.length > 0 ? allWins / results.length : 0;
    const medianDurationSec = median(results.map((r) => r.durationSec));

    // Max |build.winRate − level winRate| in percentage points.
    const maxBuildDeviation = buildStats.length > 0
      ? Math.max(...buildStats.map((b) => Math.abs(b.winRate - winRate)))
      : 0;

    out.push({ level, policy, builds: buildStats, winRate, medianDurationSec, maxBuildDeviation });
  }

  return out;
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
