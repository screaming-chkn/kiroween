/**
 * src/combat/obstacle.js
 *
 * Cover walls: mixed-size segments on HAUNT LV 2+. LV1 stays an open floor.
 * Pure functions. A wall is { x1, y1, x2, y2, thickness } (a thick segment).
 *
 *   wallsForLevel(lv)                          -> wall[]
 *   wallForLevel(lv)                           -> wall | null  (first wall; compat)
 *   circleHitsWall(wall, x, y, r)              -> boolean
 *   circleHitsWalls(walls, x, y, r)            -> boolean
 *   resolveWallMove(wall, from, to, r, opt)    -> { x, y, bumped }
 *   resolveWallsMove(walls, from, to, r, opt)  -> { x, y, bumped }
 */

import {
  SEVER_WALL_X,
  SEVER_WALL_Y,
  SEVER_WALL_LENGTH,
  SEVER_WALL_THICKNESS,
} from './config.js';

/** First HAUNT LV that has cover walls. LV1 stays open. */
export const WALLS_MIN_LV = 2;

/** Plan-view lengths (world units). Short ≈ 1.25 tank widths. */
export const WALL_SHORT = 100;
export const WALL_MEDIUM = 200;
export const WALL_LONG = 320;
/** Square block side; stored as a short thick segment. */
export const WALL_BLOCK = 64;

const T = SEVER_WALL_THICKNESS;
const MX = SEVER_WALL_X;
const MY = SEVER_WALL_Y;

/** Horizontal segment centred on (cx, cy). */
export function wallH(cx, cy, length, thickness = T) {
  const half = length / 2;
  return { x1: cx - half, y1: cy, x2: cx + half, y2: cy, thickness };
}

/** Vertical segment centred on (cx, cy). */
export function wallV(cx, cy, length, thickness = T) {
  const half = length / 2;
  return { x1: cx, y1: cy - half, x2: cx, y2: cy + half, thickness };
}

/** Axis-aligned block centred on (cx, cy). */
export function wallBlock(cx, cy, size = WALL_BLOCK) {
  return wallV(cx, cy, size, size);
}

/**
 * Layouts are mirror-fair about mid-X by construction.
 * Mid-lane (y ≈ 450) stays open on LV2 so spawn-to-spawn shots still fly.
 * Mid vertical "Sever Wall" returns on LV3+ (same geometry as before on LV3).
 * Corridors around every wall stay wide enough for a mech to slide past.
 */
const LAYOUTS = {
  2: () => [
    wallH(MX, 230, WALL_SHORT),
    wallH(MX, 700, WALL_MEDIUM),
  ],
  3: () => [
    wallV(MX, MY, SEVER_WALL_LENGTH),
    wallH(MX - 260, 220, WALL_MEDIUM),
    wallH(MX + 260, 220, WALL_MEDIUM),
  ],
  4: () => [
    wallV(MX, MY, WALL_MEDIUM),
    wallH(MX, 180, WALL_LONG),
    wallH(MX - 260, 740, WALL_SHORT),
    wallH(MX + 260, 740, WALL_SHORT),
  ],
  5: () => [
    wallV(MX, MY, 280),
    wallBlock(MX - 200, 200),
    wallBlock(MX + 200, 200),
    wallH(MX, 760, WALL_MEDIUM),
  ],
};

/** All cover walls for a HAUNT level. Empty for LV1 / missing lv. */
export function wallsForLevel(lv) {
  const n = Math.floor(Number(lv));
  if (!Number.isFinite(n) || n < WALLS_MIN_LV) return [];
  const make = LAYOUTS[Math.min(5, n)] ?? LAYOUTS[5];
  return make();
}

/** First wall for a level, or null. Prefer wallsForLevel for the full set. */
export function wallForLevel(lv) {
  return wallsForLevel(lv)[0] ?? null;
}

/** Normalize arena.walls, a raw array, or a single wall object. */
export function normalizeWalls(walls) {
  if (!walls) return [];
  if (Array.isArray(walls)) return walls.filter(Boolean);
  if (typeof walls === 'object' && Number.isFinite(walls.x1)) return [walls];
  return [];
}

/** Walls listed on an arena state (walls array, else legacy .wall). */
export function wallsOf(arena) {
  if (!arena) return [];
  if (Array.isArray(arena.walls)) return arena.walls;
  return arena.wall ? [arena.wall] : [];
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

/** True when the circle overlaps any wall in the list. */
export function circleHitsWalls(walls, x, y, r = 0) {
  return normalizeWalls(walls).some((w) => circleHitsWall(w, x, y, r));
}

/**
 * Resolve a move from -> to against one wall. If the target overlaps, the
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

/**
 * Resolve a move against every wall. A couple of passes so a slide along one
 * segment does not land inside another; if still overlapping, stay put.
 */
export function resolveWallsMove(walls, from, to, r, opts = {}) {
  const list = normalizeWalls(walls);
  if (!list.length) return { x: to.x, y: to.y, bumped: false };
  if (list.length === 1) return resolveWallMove(list[0], from, to, r, opts);

  let x = to.x;
  let y = to.y;
  let bumped = false;
  for (let pass = 0; pass < 3; pass++) {
    let hit = false;
    for (const w of list) {
      const res = resolveWallMove(w, from, { x, y }, r, opts);
      if (res.bumped) {
        bumped = true;
        hit = true;
        x = res.x;
        y = res.y;
      }
    }
    if (!hit) break;
  }
  if (list.some((w) => circleHitsWall(w, x, y, r))) {
    return { x: from.x, y: from.y, bumped: true };
  }
  return { x, y, bumped };
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

