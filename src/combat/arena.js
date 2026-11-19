/**
 * src/combat/arena.js
 *
 * Pure functions for the arena combat scene.
 *
 * createArena(loadoutTotals, stats)  → ArenaState
 * updateArena(state, actions, dt)    → ArenaState
 *
 * ArenaState is a plain object; nothing here touches the DOM, Canvas,
 * or Web Audio.  The renderer and input adapter live elsewhere.
 *
 * Covers:
 *   R1 — arena bounds / wall collision
 *   R2 — player movement (delegates to mech.js)
 *   R3 — player fire, 300 ms cooldown, projectile lifecycle
 *   R4 — enemy bot (delegates to enemy.js)
 *   R5 — HP / damage routing
 *   R6 — win / lose phase transitions
 */

import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  PLAYER_MAX_HP,
  PLAYER_PROJECTILE_DAMAGE,
  PROJECTILE_SPEED,
  MECH_RADIUS,
  FIRE_COOLDOWN_MS,
  PLAYER_START_X,
  PLAYER_START_Y,
  DASH_DURATION_MS,
  DASH_SPEED_MULT,
  DASH_BUFFER_MS,
  SEVER_WALL_MIN_LV,
  dashCooldownForLoad,
} from './config.js';
import { wallForLevel } from './obstacle.js';
import { createMech, moveMech, aimMech } from './mech.js';
import { createEnemy, stepEnemy }        from './enemy.js';
import { createProjectile, stepProjectile, hitTestCircle } from './projectile.js';
import { applyDamage }                   from './damage.js';
import { overdrawPenaltyPct }            from '../ui/garage.js';
import {
  createFlash,
  stepFlash,
  flashActive,
  maybeCreateFlash,
  createFloatingNumber,
  stepFloatingNumber,
} from './hitFeedback.js';
import {
  createGhostPerk,
  maybeSpawnGhost,
  tryGrabGhost,
} from './ghostPerk.js';

// ── Internal ID counter ───────────────────────────────────────────────────────

// We keep a module-level counter that is reset by createArena so tests get
// deterministic IDs.  It is the only piece of mutable state in this module.
let _nextId = 0;

function nextId(prefix) {
  return `${prefix}-${_nextId++}`;
}

// ── createArena ───────────────────────────────────────────────────────────────

/**
 * Build the initial ArenaState for a new match.
 *
 * @param {{
 *   speedPenalty?: number,  // 0–0.45 from 02-mech-builder weight curve
 * }} [loadoutTotals]  - derived stats from the player's garage build
 *
 * @param {{
 *   playerHp?: number,      // override starting HP (for tests / presets)
 * }} [stats]
 *
 * @returns {ArenaState}
 */
export function createArena(loadoutTotals = {}, stats = {}) {
  // Reset the projectile ID counter so each arena starts at 0 (helps tests).
  _nextId = 0;

  const arena = { width: ARENA_WIDTH, height: ARENA_HEIGHT };
  // Sever Wall: HAUNT LV 3+ only. stats.severWall (true/false) overrides for
  // test harnesses; otherwise stats.hauntLv decides. Absent -> open field.
  const wall = stats.severWall === false ? null
    : stats.severWall === true ? wallForLevel(SEVER_WALL_MIN_LV)
    : wallForLevel(stats.hauntLv);
  if (wall) arena.wall = wall;

  const player = createMech({
    id:           'player',
    x:            PLAYER_START_X,
    y:            PLAYER_START_Y,
    hp:           stats.playerHp ?? PLAYER_MAX_HP,
    maxHp:        PLAYER_MAX_HP,
    speedPenalty: loadoutTotals.speedPenalty ?? 0,
    owner:        'player',
  });

  // ── Energy / power readout for the fixed HUD (R9) ──────────────────────────
  // EN tracks the core's energy output (powerOut) against the loadout's draw
  // (powerDraw); POWER reads STUTTER when the balance is negative (Overdraw).
  // These are display-only here — no combat mechanic consumes energy yet, so
  // EN starts full. Fields default to 0 so callers without power totals (tests)
  // simply show EN 0/0 / POWER OK.
  player.maxEnergy    = loadoutTotals.powerOut ?? 0;
  player.energy       = stats.playerEnergy ?? player.maxEnergy;
  player.powerBalance = loadoutTotals.balance ?? 0;

  // ── Dash state (Feel pass 11/5 feel pass, R2) ──────────────────────────────────
  // dashRemainingMs > 0 → mid-burst (3× speed). dashCooldownMs > 0 → on
  // cooldown. dashBufferMs holds a recent DASH press so a slightly-early tap
  // still fires the instant the cooldown clears. dashCooldownBaseMs is the
  // full cooldown for this build's weight class (light/mid/heavy by loadPct).
  player.dashRemainingMs   = 0;
  player.dashCooldownMs    = 0;
  player.dashBufferMs      = 0;
  player.dashCooldownBaseMs = dashCooldownForLoad(loadoutTotals.loadPct ?? 0);

  // ── Overdraw fire-rate penalty (Feel pass 11/5 feel pass, R4) ──────────────────
  // When the build is overdrawn (powerDraw > powerOut) weapons stutter: the
  // player fire cooldown is multiplied by (1 + penalty) where penalty matches
  // the garage readout overdrawPenaltyPct / 100. Stored once at match start.
  const _penaltyPct = overdrawPenaltyPct(
    loadoutTotals.powerOut ?? 0,
    loadoutTotals.powerDraw ?? 0,
  );
  player.fireCooldownMult = 1 + _penaltyPct / 100;

  // ── Loadout effects (M4.5, R8) ─────────────────────────────────────────────
  // Applied only when the caller passes combatMods (FEATURES.loadoutEffects on).
  // No field → none of this runs, so behaviour is exactly the pre-M4.5 sim.
  const mods = loadoutTotals.combatMods;
  if (mods) {
    player.maxHp += mods.maxHpBonus;
    player.hp    += mods.maxHpBonus;
    player.dashCooldownBaseMs = Math.round(player.dashCooldownBaseMs * mods.dashCooldownMult);
    player.fireCooldownMult  *= mods.fireCooldownMult;
    player.shotDamage          = mods.shotDamage;
    player.projectileSpeedMult = mods.projectileSpeedMult;
    player.incomingDamageMult  = mods.incomingDamageMult;
  }

  const enemy = createEnemy({
    speedPenalty: loadoutTotals.enemySpeedPenalty ?? 0,
  });

  return {
    arena,
    player,
    enemy,
    projectiles: [],
    // R10 hit feedback: transient mech flashes + rising damage numbers.
    // `flash` is a short timer stored on the player/enemy entities; the
    // renderer reads it to tint the sprite. `floaters` is a culled list of
    // rising/fading damage numbers in world space.
    floaters: [],
    // Preview C: opt-in so goldens / flag-off fights stay stable.
    ghostPerk: stats.enableGhostPerk ? createGhostPerk() : null,
    phase: 'playing',   // 'playing' | 'win' | 'lose'
    elapsedMs: 0,       // time survived so far (R8 end card)
    wallHitsThisTick: 0, // C9b: projectile → Sever Wall / arena bound deaths
  };
}

// ── updateArena ───────────────────────────────────────────────────────────────

/**
 * Advance the arena by one fixed-timestep tick.
 *
 * This function is pure: it takes the current state plus the player's
 * intentions for this frame and returns the next state.  No mutations.
 *
 * @param {ArenaState} state
 *
 * @param {{
 *   move?:  { dx: number, dy: number },  // normalised direction (WASD)
 *   aim?:   { x: number, y: number },    // world-space mouse position
 *   fire?:  boolean,                     // LMB held
 * }} actions  - player intentions for this tick
 *
 * @param {number} dt  - seconds (fixed timestep, e.g. 1/60)
 *
 * @returns {ArenaState}
 */
export function updateArena(state, actions, dt) {
  // Once the match is over nothing updates (phase is sticky).
  if (state.phase !== 'playing') return state;

  const { arena } = state;
  const act = actions ?? {};

  // ── 0. Dash timers (Feel pass 11/5 feel pass, R2) ─────────────────────────────
  // Tick dash burst + cooldown, maintain the input buffer, and start a dash
  // the instant a buffered DASH press meets a ready cooldown. The burst then
  // multiplies move speed by DASH_SPEED_MULT for its duration.
  const prev = state.player;
  const dtMs = dt * 1000;

  let dashRemainingMs = Math.max(0, (prev.dashRemainingMs ?? 0) - dtMs);
  let dashCooldownMs  = Math.max(0, (prev.dashCooldownMs  ?? 0) - dtMs);
  const dashBaseMs    = prev.dashCooldownBaseMs ?? 0;

  // Input buffer: a fresh press refills it; otherwise it decays.
  let dashBufferMs = act.dash
    ? DASH_BUFFER_MS
    : Math.max(0, (prev.dashBufferMs ?? 0) - dtMs);

  // Start a dash when buffered + off cooldown + not already mid-burst.
  if (dashBufferMs > 0 && dashCooldownMs === 0 && dashRemainingMs === 0) {
    dashRemainingMs = DASH_DURATION_MS;
    dashCooldownMs  = dashBaseMs;
    dashBufferMs    = 0;
  }

  const dashing   = dashRemainingMs > 0;
  const speedMult = dashing ? DASH_SPEED_MULT : 1;

  // ── 1. Move player (R2) ───────────────────────────────────────────────────
  let player = act.move
    ? moveMech(state.player, act.move, dt, arena, speedMult)
    : state.player;

  // Sever Wall bump: cancel the rest of the dash (the dash cooldown keeps running).
  if (player.wallBump) {
    const { wallBump, ...rest } = player;
    player = rest;
    dashRemainingMs = 0;
  }

  // Carry the dash timers forward onto the (possibly moved) player object.
  player = {
    ...player,
    dashRemainingMs,
    dashCooldownMs,
    dashBufferMs,
    dashCooldownBaseMs: dashBaseMs,
  };

  // ── 2. Aim player (R2) ───────────────────────────────────────────────────
  if (act.aim) {
    player = aimMech(player, act.aim);
  }

  // ── 3. Player fire cooldown tick (R3) ────────────────────────────────────
  player = {
    ...player,
    fireCooldown: Math.max(0, player.fireCooldown - dt * 1000),
    // R10: decay any active hit-flash on the player. A fresh hit this tick
    // (step 7) replaces this with a full-duration flash.
    flash: player.flash ? stepFlash(player.flash, dt) : player.flash,
  };

  // ── 4. Player fire (R3): LMB + cooldown elapsed ───────────────────────────
  // Feel pass 11/5: an overdrawn build stutters — the fire cooldown is scaled by
  // player.fireCooldownMult (1 + overdrawPenaltyPct/100), so overdraw fires
  // strictly slower than a balanced build. Defaults to 1 when not overdrawn.
  let newProjectiles = [];
  if (act.fire && player.fireCooldown === 0) {
    const shot = {
      id:     nextId('pproj'),
      x:      player.x,
      y:      player.y,
      angle:  player.angle,
      damage: player.shotDamage ?? PLAYER_PROJECTILE_DAMAGE,
      owner:  'player',
    };
    // M4.5: only a build with a projectile-speed mod passes a speed.
    if (player.projectileSpeedMult) {
      shot.speed = PROJECTILE_SPEED * player.projectileSpeedMult;
    }
    newProjectiles.push(createProjectile(shot));
    const fireMult = player.fireCooldownMult ?? 1;
    player = { ...player, fireCooldown: FIRE_COOLDOWN_MS * fireMult };
  }

  // ── 5. Enemy AI tick (R4) ────────────────────────────────────────────────
  // Feel-pass GO (11/5): track the player's velocity by finite difference from
  // last tick's position (post-move this tick vs the previous state). The
  // enemy's windup locks a lead-aim angle from this velocity, so a steady
  // strafe gets clipped but dashing / breaking velocity during the windup
  // escapes the lock. dt>0 always here (fixed timestep); guard anyway.
  const invDt = dt > 0 ? 1 / dt : 0;
  const playerForAi = {
    ...player,
    vx: (player.x - prev.x) * invDt,
    vy: (player.y - prev.y) * invDt,
  };
  const { enemy: updatedEnemyRaw, projectile: enemyShot } =
    stepEnemy(state.enemy, playerForAi, dt, arena, _nextId);
  // R10: decay any active hit-flash on the enemy. A fresh hit this tick
  // (step 7) replaces this with a full-duration flash.
  const updatedEnemy = updatedEnemyRaw.flash
    ? { ...updatedEnemyRaw, flash: stepFlash(updatedEnemyRaw.flash, dt) }
    : updatedEnemyRaw;
  if (enemyShot) {
    _nextId++;   // consume the ID the enemy just used
    newProjectiles.push(enemyShot);
  }

  // ── 6. Step all projectiles (R1, R3) ────────────────────────────────────
  const steppedProjectiles = [
    ...state.projectiles,
    ...newProjectiles,
  ].map(p => stepProjectile(p, dt, arena));

  // ── 7. Hit detection + damage routing (R5) ───────────────────────────────
  let playerAfterHits = player;
  let enemyAfterHits  = updatedEnemy;

  // R10: collect new floating damage numbers spawned this tick.
  const newFloaters = [];

  // R10 flicker fix: flashes are rate-limited by start time. We stamp new
  // flashes with the match-clock time AT THE END of this tick so successive
  // hits inside FLASH_RETRIGGER_MS do not re-trigger createFlash (and strobe
  // the sprite). Floating damage numbers below are spawned on EVERY hit.
  const nowMs = (state.elapsedMs ?? 0) + dt * 1000;

  const survivingProjectiles = steppedProjectiles.map(proj => {
    // Already dead (wall) — skip.
    if (proj.dead) return proj;

    if (proj.owner === 'player') {
      // Player projectile vs enemy mech.
      if (hitTestCircle(proj, enemyAfterHits, MECH_RADIUS)) {
        enemyAfterHits = applyDamage(enemyAfterHits, proj.damage);
        // R10: flash the enemy (rate-limited) + always float a damage number.
        enemyAfterHits = {
          ...enemyAfterHits,
          flash: maybeCreateFlash(enemyAfterHits.flash, nowMs),
        };
        newFloaters.push(createFloatingNumber({
          x: enemyAfterHits.x,
          y: enemyAfterHits.y,
          amount: proj.damage,
        }));
        return { ...proj, dead: true };
      }
    } else {
      // Enemy projectile vs player mech.
      if (hitTestCircle(proj, playerAfterHits, MECH_RADIUS)) {
        // M4.5: incoming-damage multiplier only when the build has one.
        const inDmg = playerAfterHits.incomingDamageMult
          ? Math.round(proj.damage * playerAfterHits.incomingDamageMult)
          : proj.damage;
        playerAfterHits = applyDamage(playerAfterHits, inDmg);
        // R10: flash the player (rate-limited) + always float a damage number.
        playerAfterHits = {
          ...playerAfterHits,
          flash: maybeCreateFlash(playerAfterHits.flash, nowMs),
        };
        newFloaters.push(createFloatingNumber({
          x: playerAfterHits.x,
          y: playerAfterHits.y,
          amount: inDmg,
        }));
        return { ...proj, dead: true };
      }
    }

    return proj;
  });

  // ── 8. Cull dead projectiles ─────────────────────────────────────────────
  const liveProjectiles = survivingProjectiles.filter(p => !p.dead);

  // ── 8b. Step + cull floating damage numbers (R10) ─────────────────────────
  const floaters = [...(state.floaters ?? []), ...newFloaters]
    .map(f => stepFloatingNumber(f, dt))
    .filter(f => !f.dead);

  // Drop expired flashes so stale timers don't linger on the entities.
  if (playerAfterHits.flash && !flashActive(playerAfterHits.flash)) {
    playerAfterHits = { ...playerAfterHits, flash: null };
  }
  if (enemyAfterHits.flash && !flashActive(enemyAfterHits.flash)) {
    enemyAfterHits = { ...enemyAfterHits, flash: null };
  }

  // ── 8c. Ghost perk: mid-fight spawn + player-only grab (+10% maxHp heal)
  const elapsedNext = (state.elapsedMs ?? 0) + dt * 1000;
  let ghostPerk = state.ghostPerk;
  if (ghostPerk) {
    ghostPerk = maybeSpawnGhost(
      ghostPerk,
      elapsedNext,
      playerAfterHits,
      enemyAfterHits,
      arena,
    );
    ({ perk: ghostPerk, player: playerAfterHits } = tryGrabGhost(ghostPerk, playerAfterHits));
  }

  // ── 9. Phase transitions (R6) ────────────────────────────────────────────
  let phase = 'playing';
  if (enemyAfterHits.hp <= 0) {
    phase = 'win';
  } else if (playerAfterHits.hp <= 0) {
    phase = 'lose';
  }

  // C9b: count projectiles that died on Sever Wall or arena bounds this tick
  // (not tank hits). Culled below; sfxEvents reads wallHitsThisTick.
  const wallHitsThisTick = survivingProjectiles.filter(
    p => p.dead && (p.deadReason === 'wall' || p.deadReason === 'bounds'),
  ).length;

  return {
    arena,
    player:      playerAfterHits,
    enemy:       enemyAfterHits,
    projectiles: liveProjectiles,
    floaters,
    ghostPerk,
    phase,
    // Accumulate survived time (R8). dt is seconds → convert to ms.
    elapsedMs:   elapsedNext,
    wallHitsThisTick,
  };
}
