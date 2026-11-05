/**
 * src/combat/enemy.js
 *
 * Pure state-machine for the enemy bot.
 *
 * R4 — two-state machine: CHASE (move toward player) and SHOOT (fire on
 *       cooldown when within fire range).  Hysteresis prevents rapid toggling.
 *
 * Exports:
 *   createEnemy(cfg)                → Enemy  (initial state)
 *   stepEnemy(enemy, player, dt)    → { enemy, projectile | null }
 */

import {
  ENEMY_BASE_SPEED,
  ENEMY_FIRE_RANGE,
  ENEMY_HYSTERESIS,
  ENEMY_PROJECTILE_DAMAGE,
  ENEMY_MAX_HP,
  ENEMY_STRAFE_SPEED,
  ENEMY_START_X,
  ENEMY_START_Y,
  MECH_RADIUS,
  ENEMY_FIRE_COOLDOWN_MS,
  ENEMY_SHOT_WINDUP_MS,
  PROJECTILE_SPEED,
  ARENA_WIDTH,
  ARENA_HEIGHT,
} from './config.js';
import { createProjectile } from './projectile.js';

// ── Constants ────────────────────────────────────────────────────────────────

export const STATE_CHASE = 'CHASE';
export const STATE_SHOOT = 'SHOOT';

// ── leadAimAngle ───────────────────────────────────────────────────────────────

/**
 * Compute the fire angle that LEADS a moving target (feel GO, 11/5).
 *
 * A projectile fired now travels for roughly `flightTime = dist / speed` before
 * reaching the target's current position. If the target is moving, aiming at
 * where it *will be* (position + velocity × flightTime) lands the shot on a
 * steady strafe. `leadFrac` scales how far ahead we lead: 1.0 is a perfect
 * intercept estimate, 0.8 leads ~80% so a steady strafe gets clipped but a
 * player who breaks their velocity (dash) during the windup escapes the lock.
 *
 * Pure: no state, no I/O. When the target is stationary (pvx = pvy = 0) this
 * returns exactly the direct aim angle atan2(py-ey, px-ex).
 *
 * @param {number} ex       shooter x
 * @param {number} ey       shooter y
 * @param {number} px       target x
 * @param {number} py       target y
 * @param {number} pvx      target velocity x (world units / second)
 * @param {number} pvy      target velocity y (world units / second)
 * @param {number} speed    projectile speed (world units / second)
 * @param {number} [leadFrac=0.8]  fraction of the lead to apply
 * @returns {number} fire angle in radians
 */
export function leadAimAngle(ex, ey, px, py, pvx, pvy, speed, leadFrac = 0.8) {
  const dist = Math.hypot(px - ex, py - ey);
  const flightTime = speed > 0 ? dist / speed : 0;
  const aimX = px + leadFrac * (pvx ?? 0) * flightTime;
  const aimY = py + leadFrac * (pvy ?? 0) * flightTime;
  return Math.atan2(aimY - ey, aimX - ex);
}

// ── leadAimPoint ───────────────────────────────────────────────────────────────

/**
 * Compute the predicted AIM POINT (world x/y) that LEADS a moving target
 * (feel 11/5 bug fix).
 *
 * This is the point-valued twin of {@link leadAimAngle}. We LOCK a world
 * point — not an angle — at windup start, so the fire angle can be recomputed
 * from the enemy's CURRENT position when the shot actually spawns. Because the
 * enemy keeps strafing during the 0.45 s windup, locking an angle from the
 * lock-time position made shots fly off-target from the new spawn position
 * (sim2 M1: 34 shots / 1 hit on a stationary player). Locking the point fixes
 * that: wherever the enemy ends up, the shot still heads at the predicted point.
 *
 * `flightTime` uses the enemy→player distance at lock time
 * (`hypot(px-ex, py-ey)/speed`). `leadFrac` scales how far ahead we lead: 1.0
 * is a perfect intercept estimate, 0.8 leads ~80% so a steady strafe gets
 * clipped but a player who breaks velocity (dash) during the windup escapes.
 *
 * Pure: no state, no I/O. When the target is stationary (pvx = pvy = 0) this
 * returns exactly the target's current position { x: px, y: py }.
 *
 * @param {number} ex       shooter x (at lock time)
 * @param {number} ey       shooter y (at lock time)
 * @param {number} px       target x
 * @param {number} py       target y
 * @param {number} pvx      target velocity x (world units / second)
 * @param {number} pvy      target velocity y (world units / second)
 * @param {number} speed    projectile speed (world units / second)
 * @param {number} [leadFrac=0.8]  fraction of the lead to apply
 * @returns {{ x: number, y: number }} predicted world aim point
 */
export function leadAimPoint(ex, ey, px, py, pvx, pvy, speed, leadFrac = 0.8) {
  const dist = Math.hypot(px - ex, py - ey);
  const flightTime = speed > 0 ? dist / speed : 0;
  return {
    x: px + leadFrac * (pvx ?? 0) * flightTime,
    y: py + leadFrac * (pvy ?? 0) * flightTime,
  };
}

// ── createEnemy ───────────────────────────────────────────────────────────────

/**
 * Create the initial enemy state.
 *
 * @param {{
 *   id?:          string,
 *   x?:           number,
 *   y?:           number,
 *   hp?:          number,
 *   maxHp?:       number,
 *   speedPenalty?: number,
 * }} [cfg]
 * @returns {Enemy}
 */
export function createEnemy(cfg = {}) {
  return {
    id:           cfg.id           ?? 'enemy',
    x:            cfg.x            ?? ENEMY_START_X,
    y:            cfg.y            ?? ENEMY_START_Y,
    angle:        0,
    hp:           cfg.hp           ?? ENEMY_MAX_HP,
    maxHp:        cfg.maxHp        ?? ENEMY_MAX_HP,
    speedPenalty: cfg.speedPenalty ?? 0,
    fireCooldown: 0,               // ms — starts ready to shoot
    windupRemainingMs: 0,          // ms — shot telegraph; >0 means winding up
    lockedAim:    null,            // {x,y} world point — lead-aim point locked at windup start
    aiState:      STATE_CHASE,
    strafeDir:    1,               // +1 or -1 — flips on arena wall bounce
    owner:        'enemy',
  };
}

// ── stepEnemy ─────────────────────────────────────────────────────────────────

/**
 * Advance the enemy one simulation step.
 *
 * Returns the updated enemy and — if a projectile is fired this step — the
 * new projectile object (null otherwise).  Caller is responsible for adding
 * the projectile to the game state list.
 *
 * @param {Enemy}                              enemy
 * @param {{ x: number, y: number, hp: number, vx?: number, vy?: number }} player
 *        - read-only snapshot. vx/vy (world units/sec) are the player's
 *          current velocity; used to LEAD the locked fire angle at windup
 *          start. Absent/0 velocity → the lock equals the direct aim angle.
 * @param {number}                             dt          - seconds
 * @param {{ width: number, height: number }}  [arena]     - for future use
 * @param {number}                             [projIdSeed] - monotonic counter for unique IDs
 * @returns {{ enemy: Enemy, projectile: Projectile | null }}
 */
export function stepEnemy(enemy, player, dt, arena, projIdSeed = 0) {
  // Tick down fire cooldown (convert dt seconds → ms).
  const cooldown = Math.max(0, enemy.fireCooldown - dt * 1000);

  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy);

  // ── State transitions (R4) ───────────────────────────────────────────────
  let aiState = enemy.aiState;

  if (aiState === STATE_CHASE && dist <= ENEMY_FIRE_RANGE) {
    aiState = STATE_SHOOT;
  } else if (aiState === STATE_SHOOT && dist > ENEMY_FIRE_RANGE + ENEMY_HYSTERESIS) {
    aiState = STATE_CHASE;
  }

  // ── Angle always faces player ─────────────────────────────────────────────
  const angle = Math.atan2(dy, dx);

  // ── CHASE: move toward player ─────────────────────────────────────────────
  let ex = enemy.x;
  let ey = enemy.y;
  let strafeDir = enemy.strafeDir;

  if (aiState === STATE_CHASE && dist > 0) {
    const effectiveSpeed = ENEMY_BASE_SPEED * (1 - enemy.speedPenalty);
    const step = effectiveSpeed * dt;
    // Avoid overshooting when very close.
    const move = Math.min(step, dist);
    ex = enemy.x + (dx / dist) * move;
    ey = enemy.y + (dy / dist) * move;

    // Clamp to arena (R1 wall collision for enemy mech).
    if (arena) {
      ex = Math.max(MECH_RADIUS, Math.min(arena.width  - MECH_RADIUS, ex));
      ey = Math.max(MECH_RADIUS, Math.min(arena.height - MECH_RADIUS, ey));
    }
  }

  // ── SHOOT: strafe perpendicular to player while firing ───────────────────
  // The enemy side-steps along the axis perpendicular to the player→enemy
  // vector.  This causes some player shots to miss, stretching the round
  // toward the 30–60 s balance target.  The direction flips on arena walls.
  if (aiState === STATE_SHOOT) {
    // Perpendicular unit vector (rotate angle by 90°).
    const px = -Math.sin(angle);  // perpendicular x
    const py =  Math.cos(angle);  // perpendicular y

    const strafeStep = ENEMY_STRAFE_SPEED * dt;
    const nx = enemy.x + px * strafeStep * strafeDir;
    const ny = enemy.y + py * strafeStep * strafeDir;

    // Clamp and flip direction on wall contact.
    if (arena) {
      const clampedX = Math.max(MECH_RADIUS, Math.min(arena.width  - MECH_RADIUS, nx));
      const clampedY = Math.max(MECH_RADIUS, Math.min(arena.height - MECH_RADIUS, ny));

      // Flip strafe direction if we hit a horizontal or vertical wall.
      if (clampedX !== nx || clampedY !== ny) {
        strafeDir = -strafeDir;
      }

      ex = clampedX;
      ey = clampedY;
    } else {
      ex = nx;
      ey = ny;
    }
  }

  // ── SHOOT: windup → fire on cooldown (feel 11/5 feel pass) ──────────────
  // When in SHOOT with the fire cooldown ready, the enemy first spends
  // ENEMY_SHOT_WINDUP_MS "winding up": windupRemainingMs counts down and the
  // renderer reads it as a red telegraph glow. The projectile only spawns the
  // tick the windup completes, giving the player a readable tell. Leaving
  // SHOOT (or not yet ready) cancels any windup.
  //
  // feel GO (11/5): when the windup STARTS we LOCK a lead-aim POINT (world
  // x/y) that leads the player ~80% of the way to their projected position
  // (leadAimPoint). On fire we recompute the angle from the enemy's CURRENT
  // position toward that locked point — the enemy keeps strafing during the
  // 0.45 s windup, so locking an ANGLE from the lock-time position made shots
  // fly off-target from the new spawn position (sim2 M1: 34 shots / 1 hit on a
  // stationary player). Locking the POINT means wherever the enemy ends up,
  // the shot still heads at the predicted point. A steady strafe gets clipped;
  // dashing/breaking velocity during the windup escapes the lead because the
  // locked point no longer matches the player's new path. The facing sprite
  // still tracks the player (angle); only the SHOT uses the locked point.
  // Cancelling the windup clears the lock.
  let projectile = null;
  let nextCooldown = cooldown;
  let windup = enemy.windupRemainingMs ?? 0;
  let lockedAim = enemy.lockedAim ?? null;

  if (aiState === STATE_SHOOT) {
    if (windup > 0) {
      // Mid-windup: tick it down. Fire the instant it reaches 0.
      windup = Math.max(0, windup - dt * 1000);
      if (windup === 0) {
        // Recompute the angle from the CURRENT enemy pos (ex,ey) toward the
        // locked point so the shot actually flies at the predicted point even
        // though the enemy strafed during the windup. Fall back to the live
        // face-player angle if somehow no point was locked.
        const fireAngle = lockedAim
          ? Math.atan2(lockedAim.y - ey, lockedAim.x - ex)
          : angle;
        projectile = createProjectile({
          id:     `eproj-${projIdSeed}`,
          x:      ex,
          y:      ey,
          angle:  fireAngle,
          damage: ENEMY_PROJECTILE_DAMAGE,
          owner:  'enemy',
        });
        nextCooldown = ENEMY_FIRE_COOLDOWN_MS;
        lockedAim = null;          // consumed — clear the lock
      }
    } else if (cooldown === 0) {
      // Cooldown ready and not yet winding up → begin the telegraph AND lock
      // the lead-aim POINT from the player's velocity at windup start.
      windup = ENEMY_SHOT_WINDUP_MS;
      lockedAim = leadAimPoint(
        ex, ey,
        player.x, player.y,
        player.vx ?? 0, player.vy ?? 0,
        PROJECTILE_SPEED,
      );
    }
  } else {
    // Not in SHOOT — abort any pending windup and clear the lock.
    windup = 0;
    lockedAim = null;
  }

  const updatedEnemy = {
    ...enemy,
    x:                 ex,
    y:                 ey,
    angle,
    aiState,
    strafeDir,
    fireCooldown:      nextCooldown,
    windupRemainingMs: windup,
    lockedAim,
  };

  return { enemy: updatedEnemy, projectile };
}
