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
 *   armShotAgainstWalls(proj, arena, o, m) → Projectile  (spawn centre→muzzle)
 *   hitTestCircle(proj, target, targRad)   → boolean
 */

import {
  PROJECTILE_SPEED,
  PROJECTILE_RADIUS,
  PLAYER_PROJECTILE_RADIUS,
  ENEMY_PROJECTILE_RADIUS,
} from './config.js';
import { firstWallHit, wallsOf } from './obstacle.js';

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

  // Destroy when the swept path hits a wall or the centre leaves the arena.
  // Swept test (prev→next) so a fast step cannot tunnel through a thin wall.
  // Tag deadReason so sfxEvents can play a metallic wall-hit (not a tank hit).
  const walls = wallsOf(arena);
  const hit = firstWallHit(walls, proj.x, proj.y, nx, ny, PROJECTILE_RADIUS);
  if (hit) return { ...proj, x: hit.x, y: hit.y, dead: true, deadReason: 'wall' };
  const outOfBounds =
    nx < 0 || nx > arena.width ||
    ny < 0 || ny > arena.height;
  if (outOfBounds) return { ...proj, x: nx, y: ny, dead: true, deadReason: 'bounds' };
  return { ...proj, x: nx, y: ny, dead: false, deadReason: undefined };
}

/**
 * If the segment from tank centre to muzzle is blocked, the shot dies on the
 * wall and never appears past it. Clear paths are unchanged (spawn stays at
 * the given origin so travel time / balance stay the same).
 *
 * @param {Projectile} proj
 * @param {{ width?: number, walls?: object[], wall?: object }} arena
 * @param {{ x:number, y:number }} origin   tank centre
 * @param {{ x:number, y:number }} muzzle   visual muzzle tip
 * @returns {Projectile}
 */
export function armShotAgainstWalls(proj, arena, origin, muzzle) {
  if (!proj || proj.dead) return proj;
  const walls = wallsOf(arena);
  if (!walls.length || !origin || !muzzle) return proj;
  const hit = firstWallHit(walls, origin.x, origin.y, muzzle.x, muzzle.y, PROJECTILE_RADIUS);
  if (!hit) return proj;
  return { ...proj, x: hit.x, y: hit.y, dead: true, deadReason: 'wall' };
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

// ── projectileDrawRadius ───────────────────────────────────────────────────────

/**
 * Visual draw radius for a projectile, keyed on its owner (R10).
 * Enemy projectiles are strictly larger than the player's so incoming fire
 * reads as a heavier threat. This is a render concern only — collision still
 * uses PROJECTILE_RADIUS via hitTestCircle.
 *
 * @param {'player'|'enemy'} owner
 * @returns {number} world-unit draw radius
 */
export function projectileDrawRadius(owner) {
  return owner === 'enemy' ? ENEMY_PROJECTILE_RADIUS : PLAYER_PROJECTILE_RADIUS;
}

// ── projectileTrail ─────────────────────────────────────────────────────────────

/**
 * Compute a short trail for a projectile as a list of points behind it, derived
 * from its velocity (R10 — "short trail"). Point 0 is the segment nearest the
 * projectile; later points are further back. Pure: no state is kept between
 * frames, so trails never desync from the live projectile position.
 *
 * @param {{ x:number, y:number, vx:number, vy:number }} proj
 * @param {number} [segments=3]   number of trailing points
 * @param {number} [spacing=0.012] seconds of travel between points
 * @returns {Array<{ x:number, y:number }>} trailing points, newest first
 */
export function projectileTrail(proj, segments = 3, spacing = 0.012) {
  const points = [];
  for (let i = 1; i <= segments; i++) {
    const t = spacing * i;
    points.push({ x: proj.x - proj.vx * t, y: proj.y - proj.vy * t });
  }
  return points;
}
