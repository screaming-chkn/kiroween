/**
 * src/combat/mech.js
 *
 * Pure functions for mech creation and per-frame update.
 *
 * R2: movement uses BASE_SPEED × (1 − speedPenalty) where speedPenalty
 *     comes from src/mech/weight.js so the 02-mech-builder weight curve
 *     flows directly into combat.
 *
 * All functions are pure (no side-effects, no I/O).
 *
 * Exports:
 *   createMech(cfg)                            → Mech
 *   moveMech(mech, dir, dt, arena)             → Mech   (wall-clamped)
 *   aimMech(mech, worldTarget)                 → Mech
 *   clampMechToArena(mech, arena)              → Mech
 */

import { BASE_SPEED, MECH_RADIUS, MECH_CORNER_MARGIN } from './config.js';

// ── createMech ────────────────────────────────────────────────────────────────

/**
 * Create a new mech object.
 *
 * @param {{
 *   id:           string,
 *   x:            number,
 *   y:            number,
 *   hp:           number,
 *   maxHp:        number,
 *   speedPenalty: number,   // 0–0.45 from weight curve
 *   owner:        'player' | 'enemy',
 *   angle?:       number,   // radians; defaults to 0
 *   fireCooldown?:number,   // ms remaining; defaults to 0
 * }} cfg
 * @returns {Mech}
 */
export function createMech(cfg) {
  return {
    id:           cfg.id,
    x:            cfg.x,
    y:            cfg.y,
    angle:        cfg.angle        ?? 0,
    hp:           cfg.hp,
    maxHp:        cfg.maxHp,
    speedPenalty: cfg.speedPenalty ?? 0,
    fireCooldown: cfg.fireCooldown ?? 0,
    owner:        cfg.owner,
  };
}

// ── moveMech ──────────────────────────────────────────────────────────────────

/**
 * Move a mech by a direction vector, clamping to arena bounds.
 *
 * The direction vector {dx, dy} is normalised internally so diagonal movement
 * has the same speed as cardinal movement.
 *
 * Effective speed = BASE_SPEED × (1 − speedPenalty)   (R2)
 *
 * @param {Mech}   mech    - Current mech state (not mutated).
 * @param {{ dx: number, dy: number }} dir
 *                         - Direction vector; may be un-normalised or zero.
 * @param {number} dt      - Delta time in seconds.
 * @param {{ width: number, height: number }} arena
 * @param {number} [speedMult=1] - Extra multiplier (e.g. dash burst at 3×).
 * @returns {Mech}         - New mech at updated position.
 */
export function moveMech(mech, dir, dt, arena, speedMult = 1) {
  const { dx, dy } = dir;
  const len = Math.hypot(dx, dy);

  if (len === 0) {
    // No movement key held — stop immediately (no momentum, MVP).
    return mech;
  }

  const ndx = dx / len;
  const ndy = dy / len;

  const effectiveSpeed = BASE_SPEED * (1 - mech.speedPenalty) * speedMult;
  const nx = mech.x + ndx * effectiveSpeed * dt;
  const ny = mech.y + ndy * effectiveSpeed * dt;

  // Clamp to arena using MECH_CORNER_MARGIN (R11): the HP bar (±80 wu) and
  // aim barrel (50 wu) must not protrude past the wall at corners.
  // MECH_CORNER_MARGIN ≥ MECH_RADIUS so the collision circle is also inside.
  const cx = Math.max(MECH_CORNER_MARGIN, Math.min(arena.width  - MECH_CORNER_MARGIN, nx));
  const cy = Math.max(MECH_CORNER_MARGIN, Math.min(arena.height - MECH_CORNER_MARGIN, ny));

  return { ...mech, x: cx, y: cy };
}

// ── aimMech ───────────────────────────────────────────────────────────────────

/**
 * Rotate a mech to face a world-space target point (aim-to-mouse, R2).
 *
 * @param {Mech} mech
 * @param {{ x: number, y: number }} worldTarget
 * @returns {Mech}
 */
export function aimMech(mech, worldTarget) {
  const angle = Math.atan2(worldTarget.y - mech.y, worldTarget.x - mech.x);
  return { ...mech, angle };
}

// ── clampMechToArena ──────────────────────────────────────────────────────────

/**
 * Clamp a mech's position to stay within the arena walls.
 * Useful after any direct position assignment (e.g. spawn).
 *
 * Uses MECH_CORNER_MARGIN (R11) so the HP bar and aim barrel never protrude
 * past the wall, even at corners.  This is larger than MECH_RADIUS so the
 * collision body is always inside the bounds too.
 *
 * @param {Mech} mech
 * @param {{ width: number, height: number }} arena
 * @returns {Mech}
 */
export function clampMechToArena(mech, arena) {
  const x = Math.max(MECH_CORNER_MARGIN, Math.min(arena.width  - MECH_CORNER_MARGIN, mech.x));
  const y = Math.max(MECH_CORNER_MARGIN, Math.min(arena.height - MECH_CORNER_MARGIN, mech.y));
  return { ...mech, x, y };
}
