/**
 * src/combat/obstacle.js
 *
 * Sever Wall: one short vertical wall at mid arena, HAUNT LV 3+ only.
 * Pure functions. A wall is { x1, y1, x2, y2, thickness } (a thick segment).
 *
 *   wallForLevel(lv)                         -> wall | null
 *   circleHitsWall(wall, x, y, r)            -> boolean
 *   resolveWallMove(wall, from, to, r, opt)  -> { x, y, bumped }
 */

import {
  SEVER_WALL_MIN_LV,
  SEVER_WALL_X,
  SEVER_WALL_Y,
  SEVER_WALL_LENGTH,
  SEVER_WALL_THICKNESS,
} from './config.js';

/** The Sever Wall for a HAUNT level, or null below LV 3. */
export function wallForLevel(lv) {
  if (!(lv >= SEVER_WALL_MIN_LV)) return null;
  const half = SEVER_WALL_LENGTH / 2;
  return {
    x1: SEVER_WALL_X, y1: SEVER_WALL_Y - half,
    x2: SEVER_WALL_X, y2: SEVER_WALL_Y + half,
    thickness: SEVER_WALL_THICKNESS,
  };
}

/** Distance from point (px,py) to the wall's centre segment. */
function distToSegment(wall, px, py) {
  const sx = wall.x2 - wall.x1;
  const sy = wall.y2 - wall.y1;
  const len2 = sx * sx + sy * sy;
  let t = len2 > 0 ? ((px - wall.x1) * sx + (py - wall.y1) * sy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (wall.x1 + t * sx), py - (wall.y1 + t * sy));
}

/** True when a circle of radius r at (x,y) overlaps the thick wall. */
export function circleHitsWall(wall, x, y, r = 0) {
  if (!wall) return false;
  return distToSegment(wall, x, y) < r + wall.thickness / 2;
}

/**
 * Resolve a move from -> to against the wall. If the target overlaps, the
 * player slides along the wall (tangent part of the move) or stops. With
 * opts.slide (bot only) the mech instead steps along the wall toward the end
 * nearest to it, so a head-on chase goes around.
 *
 * @param {object|null} wall
 * @param {{x:number,y:number}} from
 * @param {{x:number,y:number}} to
 * @param {number} r      mech radius
 * @param {{ slide?: boolean }} [opts]
 * @returns {{ x:number, y:number, bumped:boolean }}
 */
export function resolveWallMove(wall, from, to, r, opts = {}) {
  if (!wall || !circleHitsWall(wall, to.x, to.y, r)) {
    return { x: to.x, y: to.y, bumped: false };
  }
  const sx = wall.x2 - wall.x1;
  const sy = wall.y2 - wall.y1;
  const len = Math.hypot(sx, sy) || 1;
  const tx = sx / len;
  const ty = sy / len;
  const mx = to.x - from.x;
  const my = to.y - from.y;
  const proj = mx * tx + my * ty;

  if (opts.slide) {
    // Bot: always slide toward the end of the wall nearest to it, so it never
    // dithers at the midpoint.
    const side = ((from.x - wall.x1) * tx + (from.y - (wall.y1 + wall.y2) / 2) * ty) || 1;
    const step = Math.hypot(mx, my) * (side < 0 ? -1 : 1);
    const cx = from.x + tx * step;
    const cy = from.y + ty * step;
    if (!circleHitsWall(wall, cx, cy, r)) return { x: cx, y: cy, bumped: true };
  } else if (Math.abs(proj) > 1e-6) {
    const cx = from.x + tx * proj;
    const cy = from.y + ty * proj;
    if (!circleHitsWall(wall, cx, cy, r)) return { x: cx, y: cy, bumped: true };
  }
  return { x: from.x, y: from.y, bumped: true };
}

/** How long the spawn label *would* stay up (ms). Kept for tests / callers; C9b draws no label. */
export const SEVER_WALL_LABEL_MS = 3500;

/**
 * Pure label for the Sever Wall spawn callout.
 * C9b: always empty — wall geometry stays, name removed.
 * @param {number} elapsedMs
 * @param {object|null|undefined} wall
 * @returns {string}
 */
export function severWallLabelText(elapsedMs, wall) {
  void elapsedMs; void wall;
  return '';
}

