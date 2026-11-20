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
 *   segmentHitsWall(wall, x1, y1, x2, y2, r)   -> boolean
 *   segmentHitsWalls(walls, x1, y1, x2, y2, r) -> boolean
 *   firstWallHit(walls, x1, y1, x2, y2, r)     -> {x,y}|null
 *   clipSegmentAtWalls(walls, x1, y1, x2, y2)  -> {x1,y1,x2,y2,clipped}
 *   chipWallAt / chipWallsAt / applyWallChipHit -> remainder wall[]
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
  return { x1: cx - half, y1: cy, x2: cx + half, y2: cy, thickness, origLen: length };
}

/** Vertical segment centred on (cx, cy). */
export function wallV(cx, cy, length, thickness = T) {
  const half = length / 2;
  return { x1: cx, y1: cy - half, x2: cx, y2: cy + half, thickness, origLen: length };
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

/** Distance from point (px,py) to a finite segment. */
function distPointToSeg(px, py, x1, y1, x2, y2) {
  const sx = x2 - x1;
  const sy = y2 - y1;
  const len2 = sx * sx + sy * sy;
  let t = len2 > 0 ? ((px - x1) * sx + (py - y1) * sy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * sx), py - (y1 + t * sy));
}

function orientation(ax, ay, bx, by, cx, cy) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function onSeg(ax, ay, bx, by, px, py) {
  return (
    px >= Math.min(ax, bx) - 1e-9 && px <= Math.max(ax, bx) + 1e-9 &&
    py >= Math.min(ay, by) - 1e-9 && py <= Math.max(ay, by) + 1e-9
  );
}

/** True when two finite segments touch or cross. */
function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = orientation(ax, ay, bx, by, cx, cy);
  const d2 = orientation(ax, ay, bx, by, dx, dy);
  const d3 = orientation(cx, cy, dx, dy, ax, ay);
  const d4 = orientation(cx, cy, dx, dy, bx, by);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  if (Math.abs(d1) <= 1e-9 && onSeg(ax, ay, bx, by, cx, cy)) return true;
  if (Math.abs(d2) <= 1e-9 && onSeg(ax, ay, bx, by, dx, dy)) return true;
  if (Math.abs(d3) <= 1e-9 && onSeg(cx, cy, dx, dy, ax, ay)) return true;
  if (Math.abs(d4) <= 1e-9 && onSeg(cx, cy, dx, dy, bx, by)) return true;
  return false;
}

/** Closest distance between two finite segments. */
export function segmentSegmentDist(ax, ay, bx, by, cx, cy, dx, dy) {
  if (segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy)) return 0;
  return Math.min(
    distPointToSeg(ax, ay, cx, cy, dx, dy),
    distPointToSeg(bx, by, cx, cy, dx, dy),
    distPointToSeg(cx, cy, ax, ay, bx, by),
    distPointToSeg(dx, dy, ax, ay, bx, by),
  );
}

/**
 * True when a circle of radius r swept along (x1,y1)→(x2,y2) overlaps the
 * thick wall (capsule around the wall centre-line).
 */
export function segmentHitsWall(wall, x1, y1, x2, y2, r = 0) {
  if (!wall) return false;
  return segmentSegmentDist(x1, y1, x2, y2, wall.x1, wall.y1, wall.x2, wall.y2)
    < r + wall.thickness / 2;
}

/** True when the swept circle overlaps any wall in the list. */
export function segmentHitsWalls(walls, x1, y1, x2, y2, r = 0) {
  return normalizeWalls(walls).some((w) => segmentHitsWall(w, x1, y1, x2, y2, r));
}

/** Parameter t in [0,1] of (ax,ay)→(bx,by) closest to segment CD. */
function closestTOnSeg(ax, ay, bx, by, cx, cy, dx, dy) {
  if (segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy)) {
    const den = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
    if (Math.abs(den) > 1e-12) {
      const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / den;
      return Math.max(0, Math.min(1, t));
    }
  }
  const projectT = (px, py) => {
    const sx = bx - ax, sy = by - ay;
    const len2 = sx * sx + sy * sy;
    if (len2 <= 0) return 0;
    return Math.max(0, Math.min(1, ((px - ax) * sx + (py - ay) * sy) / len2));
  };
  let bestD = Infinity;
  let bestT = 0;
  const consider = (t) => {
    const px = ax + (bx - ax) * t;
    const py = ay + (by - ay) * t;
    const d = distPointToSeg(px, py, cx, cy, dx, dy);
    if (d < bestD) { bestD = d; bestT = t; }
  };
  consider(0);
  consider(1);
  consider(projectT(cx, cy));
  consider(projectT(dx, dy));
  return bestT;
}

/**
 * First contact of a swept circle along (x1,y1)→(x2,y2) with any wall, or
 * null if the path is clear. If the start already overlaps, returns the start.
 *
 * Closest-approach t is found first so a path that tunnels *through* a wall
 * still binary-searches the entry, not the empty far side.
 */
export function firstWallHit(walls, x1, y1, x2, y2, r = 0) {
  const list = normalizeWalls(walls);
  if (!list.length) return null;
  if (circleHitsWalls(list, x1, y1, r)) return { x: x1, y: y1 };
  if (!segmentHitsWalls(list, x1, y1, x2, y2, r)) return null;
  let hi = 1;
  for (const w of list) {
    if (!segmentHitsWall(w, x1, y1, x2, y2, r)) continue;
    const t = closestTOnSeg(x1, y1, x2, y2, w.x1, w.y1, w.x2, w.y2);
    if (t < hi) hi = t;
  }
  // Guarantee the upper bound is actually inside the wall (numerical slack).
  if (!circleHitsWalls(list, x1 + (x2 - x1) * hi, y1 + (y2 - y1) * hi, r)) {
    for (let i = 1; i <= 32; i++) {
      const t = i / 32;
      if (circleHitsWalls(list, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, r)) {
        hi = t;
        break;
      }
    }
  }
  let lo = 0;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const x = x1 + (x2 - x1) * mid;
    const y = y1 + (y2 - y1) * mid;
    if (circleHitsWalls(list, x, y, r)) hi = mid;
    else lo = mid;
  }
  return { x: x1 + (x2 - x1) * hi, y: y1 + (y2 - y1) * hi };
}

/** Axis-aligned slab used by the wall renderer (optional pad for the stroke). */
export function wallAabb(wall, pad = 0) {
  const half = wall.thickness / 2 + pad;
  return {
    x: Math.min(wall.x1, wall.x2) - half,
    y: Math.min(wall.y1, wall.y2) - half,
    w: Math.abs(wall.x2 - wall.x1) + wall.thickness + pad * 2,
    h: Math.abs(wall.y2 - wall.y1) + wall.thickness + pad * 2,
  };
}

function pointInAabb(x, y, box) {
  return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
}

/** First entry of a segment into an AABB, or t=0 if the start is inside. */
function firstAabbHit(x1, y1, x2, y2, box) {
  if (pointInAabb(x1, y1, box)) return { t: 0, x: x1, y: y1 };
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tEnter = 0;
  let tLeave = 1;
  const slabs = [
    { p: -dx, q: x1 - box.x },
    { p: dx, q: box.x + box.w - x1 },
    { p: -dy, q: y1 - box.y },
    { p: dy, q: box.y + box.h - y1 },
  ];
  for (const { p, q } of slabs) {
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) tEnter = Math.max(tEnter, t);
    else tLeave = Math.min(tLeave, t);
  }
  if (tEnter > tLeave || tEnter > 1 || tEnter < 0) return null;
  return { t: tEnter, x: x1 + dx * tEnter, y: y1 + dy * tEnter };
}

/**
 * Draw-time clip: shorten a segment so it stops at the first wall slab it
 * meets (the visible AABB, plus a small stroke pad). Used to keep barrels
 * from drawing through or past a wall. Does not change physics.
 *
 * @returns {{ x1:number, y1:number, x2:number, y2:number, clipped:boolean }}
 */
export function clipSegmentAtWalls(walls, x1, y1, x2, y2, pad = 2) {
  const list = normalizeWalls(walls);
  if (!list.length) return { x1, y1, x2, y2, clipped: false };
  let best = null;
  for (const w of list) {
    const hit = firstAabbHit(x1, y1, x2, y2, wallAabb(w, pad));
    if (hit && (best == null || hit.t < best.t)) best = hit;
  }
  if (!best) return { x1, y1, x2, y2, clipped: false };
  return { x1, y1, x2: best.x, y2: best.y, clipped: true };
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

/** Fraction of the original wall length removed by one breaking hit. */
export const WALL_CHIP_FRAC = 0.2;
/**
 * Minimum chip in world units, so the hole is wide enough for a projectile
 * (radius 6 + wall half-thickness 8, plus a little slack). Short walls get a
 * slightly larger-than-20% hole; long walls stay at 20%.
 */
export const WALL_CHIP_MIN = 32;
/** Drop remainder stubs shorter than this (world units). */
export const WALL_MIN_LEN = 16;

export function wallLength(wall) {
  if (!wall) return 0;
  return Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
}

function withOrig(wall) {
  return { ...wall, origLen: wall.origLen ?? wallLength(wall) };
}

/**
 * Chip ~frac of the wall's original length, centred on (hx, hy).
 * Returns 0–2 remainder segments (same thickness, origLen preserved).
 */
export function chipWallAt(wall, hx, hy, frac = WALL_CHIP_FRAC) {
  if (!wall) return [];
  const w = withOrig(wall);
  const len = wallLength(w);
  if (len < 1e-6) return [];
  const chip = Math.max(WALL_CHIP_MIN, w.origLen * frac);
  const ux = (w.x2 - w.x1) / len;
  const uy = (w.y2 - w.y1) / len;
  let t = ((hx - w.x1) * ux + (hy - w.y1) * uy) / len;
  t = Math.max(0, Math.min(1, t));
  const halfT = (chip / 2) / len;
  const t0 = t - halfT;
  const t1 = t + halfT;
  const pieces = [];
  const cut = (a, b) => {
    if (b - a <= 0) return;
    const segLen = (b - a) * len;
    if (segLen < WALL_MIN_LEN) return;
    pieces.push({
      x1: w.x1 + ux * a * len,
      y1: w.y1 + uy * a * len,
      x2: w.x1 + ux * b * len,
      y2: w.y1 + uy * b * len,
      thickness: w.thickness,
      origLen: w.origLen,
    });
  };
  if (t0 > 0) cut(0, Math.min(1, Math.max(0, t0)));
  if (t1 < 1) cut(Math.max(0, Math.min(1, t1)), 1);
  return pieces;
}

/**
 * Apply a chip to the wall nearest (hx,hy) that the point actually hits.
 * @returns {{ walls: object[], broke: boolean, at: {x:number,y:number}|null }}
 */
export function chipWallsAt(walls, hx, hy, r = 8, frac = WALL_CHIP_FRAC) {
  const list = normalizeWalls(walls).map(withOrig);
  let idx = -1;
  let best = Infinity;
  for (let i = 0; i < list.length; i++) {
    if (!circleHitsWall(list[i], hx, hy, r + 2)) continue;
    const d = distToSegment(list[i], hx, hy);
    if (d < best) { best = d; idx = i; }
  }
  if (idx < 0) return { walls: list, broke: false, at: null };
  const next = [...list.slice(0, idx), ...chipWallAt(list[idx], hx, hy, frac), ...list.slice(idx + 1)];
  return { walls: next, broke: true, at: { x: hx, y: hy } };
}

/** Hits an enemy shot needs on the same ~20% chunk before that segment is removed. */
export const ENEMY_CHIP_HITS = 2;
/** Player at TURRET max still opens a gap in one hit. */
export const PLAYER_CHIP_HITS = 1;

/**
 * Radius (world units) within which a later hit counts as the same chunk.
 * Half of the chip length for that wall, so two impacts on the same ~20%
 * segment stack, while a hit farther down the wall starts a new scar.
 */
export function scarMatchRadius(wall) {
  if (!wall) return WALL_CHIP_MIN / 2;
  const orig = wall.origLen ?? wallLength(wall);
  return Math.max(WALL_CHIP_MIN, orig * WALL_CHIP_FRAC) / 2;
}

function findHitWallIndex(list, hx, hy, r) {
  let idx = -1;
  let best = Infinity;
  for (let i = 0; i < list.length; i++) {
    if (!circleHitsWall(list[i], hx, hy, r + 2)) continue;
    const d = distToSegment(list[i], hx, hy);
    if (d < best) { best = d; idx = i; }
  }
  return idx;
}

function scarsStillOnWalls(scars, walls, r) {
  return (scars ?? []).filter((s) => walls.some((w) => circleHitsWall(w, s.x, s.y, r + 2)));
}

/**
 * Apply one breaking-capable hit. Player max (`hitsNeeded` 1) chips immediately.
 * Enemy (`hitsNeeded` ENEMY_CHIP_HITS) leaves a scar on the first hit and
 * removes the ~20% segment only when the same chunk is hit again.
 *
 * @returns {{ walls: object[], scars: object[], broke: boolean, at: {x:number,y:number}|null }}
 */
export function applyWallChipHit(walls, scars, hx, hy, hitsNeeded = PLAYER_CHIP_HITS, r = 8, frac = WALL_CHIP_FRAC) {
  const list = normalizeWalls(walls).map(withOrig);
  const existing = Array.isArray(scars) ? scars.map((s) => ({ ...s })) : [];
  const idx = findHitWallIndex(list, hx, hy, r);
  if (idx < 0) return { walls: list, scars: existing, broke: false, at: null };

  const needed = Number.isFinite(hitsNeeded) ? hitsNeeded : PLAYER_CHIP_HITS;
  if (needed <= 1) {
    const next = [...list.slice(0, idx), ...chipWallAt(list[idx], hx, hy, frac), ...list.slice(idx + 1)];
    return { walls: next, scars: scarsStillOnWalls(existing, next, r), broke: true, at: { x: hx, y: hy } };
  }

  const matchR = scarMatchRadius(list[idx]);
  let match = -1;
  let bestScar = Infinity;
  for (let i = 0; i < existing.length; i++) {
    const s = existing[i];
    const d = Math.hypot(s.x - hx, s.y - hy);
    if (d <= matchR && d < bestScar) { bestScar = d; match = i; }
  }

  if (match < 0) {
    return {
      walls: list,
      scars: [...existing, { x: hx, y: hy, hits: 1 }],
      broke: false,
      at: { x: hx, y: hy },
    };
  }

  const hits = (existing[match].hits ?? 1) + 1;
  if (hits < needed) {
    const nextScars = existing.slice();
    nextScars[match] = { ...existing[match], hits };
    return { walls: list, scars: nextScars, broke: false, at: { x: existing[match].x, y: existing[match].y } };
  }

  const sx = existing[match].x;
  const sy = existing[match].y;
  const next = [...list.slice(0, idx), ...chipWallAt(list[idx], sx, sy, frac), ...list.slice(idx + 1)];
  const leftover = existing.filter((_, i) => i !== match);
  return { walls: next, scars: scarsStillOnWalls(leftover, next, r), broke: true, at: { x: sx, y: sy } };
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

