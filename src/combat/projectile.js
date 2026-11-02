/**
 * src/combat/projectile.js
 *
 * Pure functions for projectile creation, movement, and hit detection.
 *
 * Covers:
 *   R3 — player weapon / projectile lifecycle
 *   R1 — arena wall destruction
 *   R4 — enemy projectile spawn (same factory, different owner/damage)
 *
 * All functions are pure; no I/O or side-effects.
 *
 * Exports:
 *   createProjectile(cfg)                  → Projectile
 *   stepProjectile(proj, dt, arena)        → Projectile  (dead=true at wall)
 *   hitTestCircle(proj, target, targRad)   → boolean
 */

import { PROJECTILE_SPEED, PROJECTILE_RADIUS } from './config.js';

// ── createProjectile ──────────────────────────────────────────────────────────

/**
 * Spawn a new projectile.
 *
 * @param {{
 *   id:     string,
 *   x:      number,            // world-space origin x
 *   y:      number,            // world-space origin y
 *   angle:  number,            // radians — direction of travel
 *   damage: number,            // HP to subtract on hit
 *   owner:  'player'|'enemy',  // used for damage routing
 *   speed?: number,            // defaults to PROJECTILE_SPEED
 * }} cfg
 * @returns {Projectile}
 */
export function createProjectile(cfg) {
  const speed = cfg.speed ?? PROJECTILE_SPEED;
  return {
    id:     cfg.id,
    x:      cfg.x,
    y:      cfg.y,
    vx:     Math.cos(cfg.angle) * speed,
    vy:     Math.sin(cfg.angle) * speed,
    damage: cfg.damage,
    owner:  cfg.owner,
    dead:   false,
  };
}

// ── stepProjectile ────────────────────────────────────────────────────────────

/**
 * Advance a projectile by `dt` seconds.
 * Marks it dead if its centre exits the arena bounds (R1).
 *
 * @param {Projectile}                       proj
 * @param {number}                           dt    - seconds
 * @param {{ width: number, height: number}} arena
 * @returns {Projectile}  - New object; original is not mutated.
 */
export function stepProjectile(proj, dt, arena) {
  if (proj.dead) return proj;

  const nx = proj.x + proj.vx * dt;
  const ny = proj.y + proj.vy * dt;

  // Destroy when the centre leaves the arena rectangle (R1).
  const dead =
    nx < 0 || nx > arena.width ||
    ny < 0 || ny > arena.height;

  return { ...proj, x: nx, y: ny, dead };
}

// ── hitTestCircle ─────────────────────────────────────────────────────────────

/**
 * Circle–circle overlap test between a projectile and a target entity.
 *
 * Uses combined radius = PROJECTILE_RADIUS + targetRadius so there is no
 * need for the caller to know the projectile's own radius.
 *
 * @param {Projectile}               proj
 * @param {{ x: number, y: number }} target
 * @param {number}                   targetRadius  - e.g. MECH_RADIUS
 * @returns {boolean}
 */
export function hitTestCircle(proj, target, targetRadius) {
  if (proj.dead) return false;
  const dx = proj.x - target.x;
  const dy = proj.y - target.y;
  const combinedRadius = PROJECTILE_RADIUS + targetRadius;
  return (dx * dx + dy * dy) < (combinedRadius * combinedRadius);
}
