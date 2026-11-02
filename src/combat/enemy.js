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
  ENEMY_START_X,
  ENEMY_START_Y,
  MECH_RADIUS,
  FIRE_COOLDOWN_MS,
  ARENA_WIDTH,
  ARENA_HEIGHT,
} from './config.js';
import { createProjectile } from './projectile.js';

// ── Constants ────────────────────────────────────────────────────────────────

export const STATE_CHASE = 'CHASE';
export const STATE_SHOOT = 'SHOOT';

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
    aiState:      STATE_CHASE,
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
 * @param {{ x: number, y: number, hp: number }} player  - read-only snapshot
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

  // ── SHOOT: fire on cooldown ───────────────────────────────────────────────
  let projectile = null;
  let nextCooldown = cooldown;

  if (aiState === STATE_SHOOT && cooldown === 0) {
    projectile = createProjectile({
      id:     `eproj-${projIdSeed}`,
      x:      ex,
      y:      ey,
      angle,
      damage: ENEMY_PROJECTILE_DAMAGE,
      owner:  'enemy',
    });
    nextCooldown = FIRE_COOLDOWN_MS;
  }

  const updatedEnemy = {
    ...enemy,
    x:            ex,
    y:            ey,
    angle,
    aiState,
    fireCooldown: nextCooldown,
  };

  return { enemy: updatedEnemy, projectile };
}
