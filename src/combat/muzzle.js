/**
 * src/combat/muzzle.js
 *
 * World-space muzzle tip and solid barrel collision. Visual barrel length
 * (style + TANK_DRAW_SCALE) so spawn checks and physics line up with the draw.
 * Pure: no I/O. Hitboxes / TANK_SPECS are unchanged.
 */

import { visualSpecs, TANK_DRAW_SCALE, TANK_STYLE, updateHullHeading } from '../ui/tankWire.js';

/** Re-export so combat sim and the renderer share one heading rule. */
export { updateHullHeading as stepHullHeading };
import { segmentHitsWalls } from './obstacle.js';

/** Collision radius of the barrel centre-line (world units). */
export const BARREL_COLLIDE_R = 5;

function barrelOffsets(kind, turretAngle, hullHeading) {
  const s = visualSpecs(kind);
  const scale = TANK_DRAW_SCALE;
  const wheeled = TANK_STYLE === 'wheeled' && s.base === 'wheels';
  const turOff = wheeled ? -s.hull.L * 0.14 : 0;
  const hfx = Math.cos(hullHeading);
  const hfy = Math.sin(hullHeading);
  const fx = Math.cos(turretAngle);
  const fy = Math.sin(turretAngle);
  const rootAlong = (s.turret.L / 2) * scale;
  const tipAlong = (s.turret.L / 2 + s.barrelLen) * scale;
  const ox = hfx * turOff * scale;
  const oy = hfy * turOff * scale;
  return { ox, oy, fx, fy, rootAlong, tipAlong };
}

/**
 * World position of the barrel tip (centre-line, unprojected).
 *
 * @param {'player'|'enemy'} kind
 * @param {number} x
 * @param {number} y
 * @param {number} turretAngle
 * @param {number} [hullHeading=turretAngle]
 * @returns {{ x:number, y:number }}
 */
export function muzzleWorld(kind, x, y, turretAngle, hullHeading = turretAngle) {
  const o = barrelOffsets(kind, turretAngle, hullHeading);
  return {
    x: x + o.ox + o.fx * o.tipAlong,
    y: y + o.oy + o.fy * o.tipAlong,
  };
}

/** World position of the barrel root (turret face). */
export function barrelRoot(kind, x, y, turretAngle, hullHeading = turretAngle) {
  const o = barrelOffsets(kind, turretAngle, hullHeading);
  return {
    x: x + o.ox + o.fx * o.rootAlong,
    y: y + o.oy + o.fy * o.rootAlong,
  };
}

/** True when the barrel centre-line overlaps any wall. */
export function barrelHitsWalls(walls, kind, x, y, angle, hullHeading = angle) {
  if (!walls || !walls.length) return false;
  const a = barrelRoot(kind, x, y, angle, hullHeading);
  const b = muzzleWorld(kind, x, y, angle, hullHeading);
  return segmentHitsWalls(walls, a.x, a.y, b.x, b.y, BARREL_COLLIDE_R);
}

function angNorm(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Clamp a proposed aim so the barrel stays out of walls.
 * If `fromAngle` is already clear, returns the last clear angle toward `toAngle`.
 */
export function resolveBarrelAim(walls, kind, x, y, fromAngle, toAngle, hullHeading = toAngle) {
  if (!walls || !walls.length) return toAngle;
  if (!barrelHitsWalls(walls, kind, x, y, toAngle, hullHeading)) return toAngle;
  const fromClear = !barrelHitsWalls(walls, kind, x, y, fromAngle, hullHeading);
  if (!fromClear) {
    for (const sign of [1, -1]) {
      for (let i = 1; i <= 24; i++) {
        const a = fromAngle + sign * (i / 24) * Math.PI;
        if (!barrelHitsWalls(walls, kind, x, y, a, hullHeading)) return a;
      }
    }
    return fromAngle;
  }
  let lo = 0;
  let hi = 1;
  const span = angNorm(toAngle - fromAngle);
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    const a = fromAngle + span * mid;
    if (barrelHitsWalls(walls, kind, x, y, a, hullHeading)) hi = mid;
    else lo = mid;
  }
  return fromAngle + span * lo;
}

/**
 * Keep a mech's barrel out of walls: clamp aim first, then stop short of
 * a move that would drive the barrel in, then back up if already overlapping.
 *
 * @param {'player'|'enemy'} kind
 * @param {{x:number,y:number,angle?:number}} from
 * @param {{x:number,y:number,angle:number}} to
 * @param {object[]} walls
 * @param {number} [hullHeading]
 * @param {{ preferMove?: boolean }} [opts]  enemy pathing: keep the move, clamp the gun
 * @returns {{ x:number, y:number, angle:number }}
 */
export function constrainBarrel(kind, from, to, walls, hullHeading, opts = {}) {
  if (!to) return to;
  if (!walls || !walls.length) return { x: to.x, y: to.y, angle: to.angle };
  const desired = to.angle;
  const heading = hullHeading ?? desired;
  const prevA = from?.angle ?? desired;
  const fx0 = from?.x ?? to.x;
  const fy0 = from?.y ?? to.y;
  if (!barrelHitsWalls(walls, kind, to.x, to.y, desired, heading)) {
    return { x: to.x, y: to.y, angle: desired };
  }
  // Bots: keep the slid/strafed position and swing the gun along the wall
  // so a head-on chase can still go around.
  if (opts.preferMove) {
    const aAtTo = resolveBarrelAim(walls, kind, to.x, to.y, prevA, desired, heading);
    if (!barrelHitsWalls(walls, kind, to.x, to.y, aAtTo, heading)) {
      return { x: to.x, y: to.y, angle: aAtTo };
    }
  }
  let lo = 0;
  let hi = 1;
  const fromDesiredClear = !barrelHitsWalls(walls, kind, fx0, fy0, desired, heading);
  if (fromDesiredClear) {
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2;
      const x = fx0 + (to.x - fx0) * mid;
      const y = fy0 + (to.y - fy0) * mid;
      if (barrelHitsWalls(walls, kind, x, y, desired, heading)) hi = mid;
      else lo = mid;
    }
    const x = fx0 + (to.x - fx0) * lo;
    const y = fy0 + (to.y - fy0) * lo;
    if (!barrelHitsWalls(walls, kind, x, y, desired, heading)) {
      return { x, y, angle: desired };
    }
  }
  // Already overlapping at this pose with the desired aim (rotating in place,
  // or starting inside): clamp the turret, and back up if still overlapping.
  const aAtTo = resolveBarrelAim(walls, kind, to.x, to.y, prevA, desired, heading);
  if (!barrelHitsWalls(walls, kind, to.x, to.y, aAtTo, heading)) {
    return { x: to.x, y: to.y, angle: aAtTo };
  }
  const aAtFrom = resolveBarrelAim(walls, kind, fx0, fy0, prevA, desired, heading);
  if (!barrelHitsWalls(walls, kind, fx0, fy0, aAtFrom, heading)) {
    return { x: fx0, y: fy0, angle: aAtFrom };
  }
  const bx = Math.cos(desired);
  const by = Math.sin(desired);
  for (let s = 4; s <= 80; s += 4) {
    const x2 = fx0 - bx * s;
    const y2 = fy0 - by * s;
    const a = resolveBarrelAim(walls, kind, x2, y2, prevA, desired, heading);
    if (!barrelHitsWalls(walls, kind, x2, y2, a, heading)) {
      return { x: x2, y: y2, angle: a };
    }
  }
  // Ring search: never leave the barrel in a wall if a nearby pose is clear.
  // Tests always use the same hull heading that will be stored (movement
  // heading), not the turret angle — wheeled tanks offset the gun along the hull.
  const origins = [{ x: to.x, y: to.y }, { x: fx0, y: fy0 }];
  for (const o of origins) {
    for (let s = 4; s <= 120; s += 4) {
      for (let k = 0; k < 16; k++) {
        const rad = (k * Math.PI) / 8;
        const x = o.x + Math.cos(rad) * s;
        const y = o.y + Math.sin(rad) * s;
        const a = resolveBarrelAim(walls, kind, x, y, prevA, desired, heading);
        if (!barrelHitsWalls(walls, kind, x, y, a, heading)) {
          return { x, y, angle: a };
        }
      }
    }
  }
  if (!barrelHitsWalls(walls, kind, fx0, fy0, prevA, heading)) {
    return { x: fx0, y: fy0, angle: prevA };
  }
  // Last ditch: any angle at the previous position.
  for (let i = 0; i < 32; i++) {
    const a = prevA + (i / 32) * Math.PI * 2;
    if (!barrelHitsWalls(walls, kind, fx0, fy0, a, heading)) {
      return { x: fx0, y: fy0, angle: a };
    }
  }
  return { x: fx0, y: fy0, angle: prevA };
}
