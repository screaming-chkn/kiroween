/**
 * tankWire.js — simple 3D wireframe tanks (render only).
 *
 * Necker-cube look: every box edge is drawn, hidden ones included. A slight
 * 3/4 tilt makes height draw up-right. Pure ES module: no DOM at load, only
 * the ctx passed in. Hitboxes/collision/movement are untouched by this file.
 */

import { fxClock, shotFx, hoverBob } from './tankFx.js';
import { shouldDrawEnemy } from './killMoment.js';

export const TILT = { x: 0.35, y: 0.7 };

/** Draw-time scale around the tank origin (hitboxes unchanged). */
export const TANK_DRAW_SCALE = 1.5;

/** Edge look: 'solid' | 'dashed' | 'tech' | 'dashed-tech'. Render only; default dashed-tech. */
export let EDGE_STYLE = 'dashed-tech';
/** ES live bindings are read-only for importers, so tests/tools use this. */
export function setEdgeStyle(v) { EDGE_STYLE = v; }

/**
 * Colour palettes (render only). Each mech is ONE colour: `line` for every crisp
 * stroke, tick, fill and muzzle star; `glow` (slightly deeper) for additive halos.
 */
export const TANK_PALETTES = {
  'mono-blue': {
    player: { line: '#3EF6FF', glow: '#2B5BFF', fillAlpha: 0.14 },
    enemy: { line: '#FF3B5C', glow: '#C01640', fillAlpha: 0.16 },
  },
  'mono-green': {
    player: { line: '#47FF9A', glow: '#20B05C', fillAlpha: 0.14 },
    enemy: { line: '#FF3B5C', glow: '#C01640', fillAlpha: 0.16 },
  },
};
export let TANK_PALETTE = 'mono-green';
export function setTankPalette(v) { TANK_PALETTE = v; }

/**
 * Visual tank silhouette styles (draw-only). Collision / TANK_SPECS footprint
 * stays fixed; styles change what drawTank paints. Default 'wheeled' (owner C7 pick — 8x8).
 * Names: mech | wedge | wheeled | heavy | stealth
 */
export const TANK_STYLE_NAMES = ['mech', 'wedge', 'wheeled', 'heavy', 'stealth'];
export let TANK_STYLE = 'wheeled';
export function setTankStyle(v) {
  if (TANK_STYLE_NAMES.includes(v)) TANK_STYLE = v;
}

/**
 * Visual overrides per style/kind. null fields inherit TANK_SPECS.
 * cutHull/cutTurret override HULL_CUT/TURRET_CUT fractions when set.
 * base: 'hover' | 'treads' | 'wheels'
 */
export const TANK_STYLE_DRAW = {
  mech: null,
  // Low wedge MBT — long low hull, sharp nose, compact turret, long gun
  wedge: {
    player: {
      hull: { L: 44, W: 20, H: 7 }, turret: { L: 12, W: 10, H: 5 },
      barrelLen: 36, twin: false, base: 'treads', cutHull: 0.48, cutTurret: 0.22,
    },
    enemy: {
      hull: { L: 50, W: 26, H: 8 }, turret: { L: 14, W: 12, H: 6 },
      barrelLen: 40, twin: false, base: 'treads', cutHull: 0.48, cutTurret: 0.22,
    },
  },
  // C9g MBT — copy target-iso: low wide hull, octagon turret, 6+2 wheels, muzzle ring
  wheeled: {
    player: {
      hull: { L: 50, W: 24, H: 8 }, turret: { L: 14, W: 12, H: 5.5 },
      barrelLen: 40, twin: false, base: 'wheels', cutHull: 0.50, cutTurret: 0.40,
    },
    enemy: {
      hull: { L: 56, W: 28, H: 9 }, turret: { L: 16, W: 14, H: 6 },
      barrelLen: 44, twin: false, base: 'wheels', cutHull: 0.50, cutTurret: 0.40,
    },
  },
  // Boxy heavy — chunky plates, tall hull, thick/twin barrel
  heavy: {
    player: {
      hull: { L: 32, W: 28, H: 14 }, turret: { L: 18, W: 16, H: 9 },
      barrelLen: 22, twin: true, base: 'treads', cutHull: 0.14, cutTurret: 0.16,
    },
    enemy: {
      hull: { L: 38, W: 34, H: 16 }, turret: { L: 22, W: 20, H: 10 },
      barrelLen: 26, twin: true, base: 'treads', cutHull: 0.14, cutTurret: 0.16,
    },
  },
  // Sleek light — narrow low stealth profile, short turret, thin barrel
  stealth: {
    player: {
      hull: { L: 40, W: 16, H: 6 }, turret: { L: 10, W: 8, H: 4 },
      barrelLen: 18, twin: false, base: 'hover', cutHull: 0.50, cutTurret: 0.40,
    },
    enemy: {
      hull: { L: 46, W: 20, H: 7 }, turret: { L: 12, W: 10, H: 5 },
      barrelLen: 22, twin: false, base: 'hover', cutHull: 0.50, cutTurret: 0.40,
    },
  },
};

/** Merge collision TANK_SPECS with the active style's visual overrides. */
export function visualSpecs(kind) {
  const base = TANK_SPECS[kind];
  const style = TANK_STYLE_DRAW[TANK_STYLE];
  if (!style || !style[kind]) {
    return {
      hull: { ...base.hull },
      turret: { ...base.turret },
      barrelLen: base.barrelLen,
      twin: base.twin,
      base: base.base,
      cutHull: HULL_CUT,
      cutTurret: TURRET_CUT,
    };
  }
  const o = style[kind];
  return {
    hull: { ...o.hull },
    turret: { ...o.turret },
    barrelLen: o.barrelLen,
    twin: o.twin,
    base: o.base,
    cutHull: o.cutHull ?? HULL_CUT,
    cutTurret: o.cutTurret ?? TURRET_CUT,
  };
}

function paletteFor(kind) {
  const p = (TANK_PALETTES[TANK_PALETTE] ?? TANK_PALETTES['mono-green'])[kind];
  return { stroke: p.line, turretStroke: p.line, tick: p.line, fill: p.line, glow: p.glow, fillAlpha: p.fillAlpha };
}

/** Project a world point with height z into screen space (3/4 tilt). */
export function project(x, y, z) {
  return { x: x + z * TILT.x, y: y - z * TILT.y };
}

/** 12 box edges: bottom loop 0-1-2-3, top loop 4-5-6-7, verticals i -> i+4. */
export const BOX_EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

/** Unprojected ground rectangle corners: front-left, front-right, back-right, back-left. */
function footprintCorners(cx, cy, L, W, heading) {
  const fx = Math.cos(heading), fy = Math.sin(heading);
  const lx = Math.sin(heading), ly = -Math.cos(heading); // left of heading (y down)
  const hl = L / 2, hw = W / 2;
  return [[hl, hw], [hl, -hw], [-hl, -hw], [-hl, hw]].map(([a, b]) => ({
    x: cx + fx * a + lx * b,
    y: cy + fy * a + ly * b,
  }));
}

/**
 * 8 projected corners of a box: 0..3 at z0, 4..7 at z0 + H.
 */
export function boxCorners(cx, cy, z0, L, W, H, heading) {
  const fp = footprintCorners(cx, cy, L, W, heading);
  return [
    ...fp.map(p => project(p.x, p.y, z0)),
    ...fp.map(p => project(p.x, p.y, z0 + H)),
  ];
}

/** Octagon prism edges: bottom loop 0-7, top loop 8-15, verticals i -> i+8. */
export const PRISM_EDGES = [];
for (let i = 0; i < 8; i++) {
  PRISM_EDGES.push([i, (i + 1) % 8], [8 + i, 8 + ((i + 1) % 8)], [i, i + 8]);
}

/**
 * Chamfered (cut-corner) prism: the rectangle footprint with each corner cut
 * by `cut` along both sides. 8 points at z0 then 8 at z0 + H, projected.
 */
export function prismCorners(cx, cy, z0, L, W, H, heading, cut) {
  const hl = L / 2, hw = W / 2, c = Math.min(cut, hl * 0.9, hw * 0.9);
  const loc = [
    [hl - c, hw], [hl, hw - c], [hl, -hw + c], [hl - c, -hw],
    [-hl + c, -hw], [-hl, -hw + c], [-hl, hw - c], [-hl + c, hw],
  ];
  const fx = Math.cos(heading), fy = Math.sin(heading);
  const lx = Math.sin(heading), ly = -Math.cos(heading);
  const ground = loc.map(([a, b]) => ({ x: cx + fx * a + lx * b, y: cy + fy * a + ly * b }));
  return [...ground.map(p => project(p.x, p.y, z0)), ...ground.map(p => project(p.x, p.y, z0 + H))];
}

/** Chamfer size as a fraction of the shorter side. */
export const HULL_CUT = 0.28;
export const TURRET_CUT = 0.34;

export const TANK_SPECS = {
  player: {
    hull: { L: 34, W: 24, H: 9 }, turret: { L: 16, W: 13, H: 7 }, barrelLen: 27, twin: false,
    stroke: '#47FF9A', turretStroke: '#47FF9A', fill: '#47FF9A', fillAlpha: 0.14, base: 'hover',
  },
  enemy: {
    hull: { L: 40, W: 32, H: 12 }, turret: { L: 20, W: 17, H: 8 }, barrelLen: 31, twin: true,
    stroke: '#FF3B5C', turretStroke: '#FF3B5C', fill: '#FF3B5C', fillAlpha: 0.16, base: 'treads',
  },
};

/**
 * Geometry for one tank.
 * @returns {{hull:Array,turret:Array,barrels:Array,footprint:Array}}
 */
export function tankGeometry(kind, x, y, hullHeading, turretAngle) {
  const col = TANK_SPECS[kind];
  const s = visualSpecs(kind);
  // C9e: wheeled hull sits into track band (draw-only). Hitboxes untouched.
  const wheeled = TANK_STYLE === 'wheeled' && s.base === 'wheels';
  const hullZ0 = wheeled ? -2.2 : 0;
  // Turret narrower + set toward the BACK of the hull (side-ref cue)
  const hfx = Math.cos(hullHeading), hfy = Math.sin(hullHeading);
  const turOff = wheeled ? -s.hull.L * 0.12 : 0;
  const tx = x + hfx * turOff, ty = y + hfy * turOff;
  const hull = boxCorners(x, y, hullZ0, s.hull.L, s.hull.W, s.hull.H, hullHeading);
  const turret = boxCorners(tx, ty, hullZ0 + s.hull.H, s.turret.L, s.turret.W, s.turret.H, turretAngle);
  // Footprint always from collision specs (hitbox unchanged).
  const footprint = footprintCorners(x, y, col.hull.L, col.hull.W, hullHeading);

  const fx = Math.cos(turretAngle), fy = Math.sin(turretAngle);
  const lx = Math.sin(turretAngle), ly = -Math.cos(turretAngle);
  const z = hullZ0 + s.hull.H + s.turret.H / 2;
  const twinOff = s.twin ? (s.turret.W > 14 ? 3.5 : 2.8) : 0;
  const offsets = s.twin ? [-twinOff, twinOff] : [0];
  const barrels = offsets.map(o => {
    const sx = tx + fx * (s.turret.L / 2) + lx * o;
    const sy = ty + fy * (s.turret.L / 2) + ly * o;
    const a = project(sx, sy, z);
    const b = project(sx + fx * s.barrelLen, sy + fy * s.barrelLen, z);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  });
  const hullPrism = prismCorners(x, y, hullZ0, s.hull.L, s.hull.W, s.hull.H, hullHeading,
    s.cutHull * Math.min(s.hull.L, s.hull.W));
  const turretPrism = prismCorners(tx, ty, hullZ0 + s.hull.H, s.turret.L, s.turret.W, s.turret.H, turretAngle,
    s.cutTurret * Math.min(s.turret.L, s.turret.W));
  return { hull, turret, hullPrism, turretPrism, barrels, footprint, hullZ0, turOff };
}

/**
 * Render-only hull heading follows movement direction.
 * Moved 0.5..200 wu -> atan2; >= 200 (teleport/new match) or no prev -> fallback;
 * otherwise keep prev.
 */
export function updateHullHeading(prev, prevPos, pos, fallback) {
  if (prevPos && pos) {
    const dx = pos.x - prevPos.x, dy = pos.y - prevPos.y;
    const d = Math.hypot(dx, dy);
    if (d >= 200) return fallback;
    if (d > 0.5) return Math.atan2(dy, dx);
  }
  return prev == null ? fallback : prev;
}

function strokeEdges(ctx, pts) {
  ctx.beginPath();
  for (const [i, j] of PRISM_EDGES) {
    ctx.moveTo(pts[i].x, pts[i].y);
    ctx.lineTo(pts[j].x, pts[j].y);
  }
  ctx.stroke();
}

function fillTop(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[8].x, pts[8].y);
  for (let k = 9; k <= 15; k++) ctx.lineTo(pts[k].x, pts[k].y);
  ctx.closePath();
  ctx.fill();
}

/** Edges on the front face (corner indices 0,1,4,5). */
const FRONT_EDGES = [[1, 2], [9, 10], [1, 9], [2, 10]];

function strokeSome(ctx, pts, edges) {
  ctx.beginPath();
  for (const [i, j] of edges) {
    ctx.moveTo(pts[i].x, pts[i].y);
    ctx.lineTo(pts[j].x, pts[j].y);
  }
  ctx.stroke();
}

/** Mix hex colour toward #E8E2D0 by t (0..1). */
function tint(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const to = [0xE8, 0xE2, 0xD0];
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, i) => Math.round(v + (to[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** Wide additive pass then restore composite. */
function widePass(ctx, color, w, a, draw) {
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = w;
  ctx.globalAlpha = a;
  ctx.strokeStyle = color;
  draw();
  ctx.globalCompositeOperation = 'source-over';
}

/** Small wire star at (px,py), 5 short lines, plus faint glow. */
function drawMuzzle(ctx, px, py, ang, flash, color, glow) {
  const rays = 5, len = 7.5 + 4.5 * flash;
  const lines = () => {
    ctx.beginPath();
    for (let k = 0; k < rays; k++) {
      const a = ang + ((k - (rays - 1) / 2) * Math.PI) / 5;
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
    }
    ctx.stroke();
  };
  widePass(ctx, glow, 3, 0.2 * flash, lines);
  ctx.lineWidth = 1;
  ctx.globalAlpha = flash;
  ctx.strokeStyle = color;
  lines();
  // white-hot core on top of the colored star
  const coreLen = len * 0.45;
  ctx.strokeStyle = '#E8E2D0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let k = 0; k < rays; k++) {
    const a = ang + ((k - (rays - 1) / 2) * Math.PI) / 5;
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(a) * coreLen, py + Math.sin(a) * coreLen);
  }
  ctx.stroke();
}

/** Short CAD-style ticks at each of a box's 8 corners, along two meeting edges. */
function drawCornerTicks(ctx, pts, box) {
  const len = 0.14 * Math.min(box.L, box.W);
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const base = i < 8 ? 0 : 8;
    const loopNb = base + ((i - base + 1) % 8);
    const vertNb = i < 8 ? i + 8 : i - 8;
    for (const j of [loopNb, vertNb]) {
      const dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y;
      const d = Math.hypot(dx, dy) || 1;
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[i].x + (dx / d) * len, pts[i].y + (dy / d) * len);
    }
  }
  ctx.stroke();
}

/** Draw a wireframe tank (all edges visible). */
export function drawTank(ctx, kind, x, y, hullHeading, turretAngle, flashIntensity = 0) {
  if (kind === 'enemy' && !shouldDrawEnemy()) return;
  ctx.save();
  const g = tankGeometry(kind, x, y, hullHeading, turretAngle);
  const vis = visualSpecs(kind);
  const s = { ...TANK_SPECS[kind], ...vis, ...paletteFor(kind) };
  const clock = fxClock();
  const bob = hoverBob(kind, clock);
  const dashed = EDGE_STYLE === 'dashed' || EDGE_STYLE === 'dashed-tech';
  const tech = EDGE_STYLE === 'tech' || EDGE_STYLE === 'dashed-tech';
  const dashLen = Math.max(4, 0.16 * s.hull.L);
  const gapLen = Math.max(2, 0.06 * s.hull.L);
  const dash = [dashLen, gapLen];
  const fx0 = shotFx(kind, clock);
  ctx.translate(x, y);
  ctx.scale(TANK_DRAW_SCALE, TANK_DRAW_SCALE);
  ctx.translate(-x, -y);
  if (TANK_STYLE === 'wheeled') {
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'butt';
  } else {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  }

  // a) ground shadow (no bob): hover disc / shadow under treads
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = s.stroke;
  ctx.beginPath();
  ctx.ellipse(x, y + 5, s.hull.L * 0.62, s.hull.W * 0.6, hullHeading, 0, Math.PI * 2);
  ctx.fill();
  if (s.base === 'treads') {
    const fx = Math.cos(hullHeading), fy = Math.sin(hullHeading);
    const lx = Math.sin(hullHeading), ly = -Math.cos(hullHeading);
    const hl = s.hull.L / 2, off = s.hull.W / 2 + 2;
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = s.turretStroke;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (const side of [-1, 1]) {
      const ox = lx * off * side, oy = ly * off * side;
      ctx.moveTo(x + fx * hl + ox, y + fy * hl + oy);
      ctx.lineTo(x - fx * hl + ox, y - fy * hl + oy);
      for (let t = -hl; t <= hl; t += 6) {
        const px = x + fx * t + ox, py = y + fy * t + oy;
        ctx.moveTo(px, py);
        ctx.lineTo(px + lx * 3 * side, py + ly * 3 * side);
      }
    }
    ctx.stroke();
  } else if (s.base === 'wheels') {
    // C9e ground contact shadow only here (no bob). Housing drawn with hull after bob.
    const hullZ0 = -2.2;
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y + 3.8, s.hull.L * 0.56, s.hull.W * 0.42, hullHeading, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // everything below bobs (hull, turret, barrels, hit flash)
  ctx.translate(0, bob);

  // C9g wheeled: one-piece hull+track under fender — 6 road wheels + end sprockets.
  if (s.base === 'wheels') {
    const fx = Math.cos(hullHeading), fy = Math.sin(hullHeading);
    const lx = Math.sin(hullHeading), ly = -Math.cos(hullHeading);
    const hl = s.hull.L / 2, hw = s.hull.W / 2;
    const nearSide = ly >= 0 ? 1 : -1;
    const hullZ0 = -2.2;
    // Flush skirt (barely past hull side) — fender + track = one silhouette
    const skirtLat = hw + 0.15;
    // Upper/lower band split by ONE break line (target: hull wall becomes track housing)
    const breakZ = hullZ0 + s.hull.H * 0.28;
    const botZ = hullZ0 - 7.2;
    const nRoad = 6;
    const roadR = Math.max(1.7, s.hull.H * 0.22);
    const endR = roadR * 1.35;

    const wallPts = (side, z, alongScale = 1) => {
      const ox = lx * skirtLat * side, oy = ly * skirtLat * side;
      const a = hl * alongScale;
      return {
        front: project(x + fx * a + ox, y + fy * a + oy, z),
        rear: project(x - fx * a + ox, y - fy * a + oy, z),
      };
    };

    // Angled front fender blocks (chamfered corners → short forward shelves)
    {
      const side = nearSide;
      const ox = lx * skirtLat * side, oy = ly * skirtLat * side;
      const f0 = project(x + fx * (hl * 0.92) + ox, y + fy * (hl * 0.92) + oy, breakZ + 1.2);
      const f1 = project(x + fx * (hl * 1.02) + ox * 0.72, y + fy * (hl * 1.02) + oy * 0.72, breakZ + 0.4);
      const f2 = project(x + fx * (hl * 0.78) + ox, y + fy * (hl * 0.78) + oy, breakZ);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = s.turretStroke;
      ctx.lineWidth = 0.75;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(f2.x, f2.y);
      ctx.lineTo(f0.x, f0.y);
      ctx.lineTo(f1.x, f1.y);
      ctx.stroke();
    }

    // Near-side continuous lower band + wheels
    {
      const side = nearSide;
      const top = wallPts(side, breakZ, 0.98);
      const bot = wallPts(side, botZ, 0.96);
      const wheelLat = skirtLat * 0.42;
      const wox = lx * wheelLat * side, woy = ly * wheelLat * side;
      const wheelZ = breakZ * 0.40 + botZ * 0.60;

      // Road wheels: double circle + hub (target cue)
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = s.turretStroke;
      ctx.setLineDash([]);
      ctx.lineWidth = 0.65;
      const roadTs = [];
      for (let i = 0; i < nRoad; i++) {
        const tt = -hl * 0.62 + (hl * 1.24) * ((i + 0.5) / nRoad);
        roadTs.push(tt);
        const c = project(x + fx * tt + wox, y + fy * tt + woy, wheelZ);
        const rx = roadR * 0.78, ry = roadR * 0.46;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y + 0.15, rx, ry, hullHeading, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(c.x, c.y + 0.15, rx * 0.55, ry * 0.55, hullHeading, 0, Math.PI * 2);
        ctx.stroke();
        // hub tick
        ctx.beginPath();
        ctx.moveTo(c.x - 0.35, c.y + 0.15);
        ctx.lineTo(c.x + 0.35, c.y + 0.15);
        ctx.stroke();
      }

      // Larger idler (front) + sprocket (rear)
      ctx.lineWidth = 0.7;
      for (const [tt, big] of [[hl * 0.78, true], [-hl * 0.78, true]]) {
        const c = project(x + fx * tt + wox, y + fy * tt + woy, wheelZ + 0.2);
        const rx = endR * 0.82, ry = endR * 0.48;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y + 0.1, rx, ry, hullHeading, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(c.x, c.y + 0.1, rx * 0.5, ry * 0.5, hullHeading, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ONE outer silhouette: break + bottom + front/rear drops
      ctx.globalAlpha = 1;
      ctx.strokeStyle = s.turretStroke;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(top.front.x, top.front.y);
      ctx.lineTo(top.rear.x, top.rear.y);
      ctx.moveTo(bot.front.x, bot.front.y);
      ctx.lineTo(bot.rear.x, bot.rear.y);
      ctx.moveTo(top.front.x, top.front.y);
      ctx.lineTo(bot.front.x, bot.front.y);
      ctx.moveTo(top.rear.x, top.rear.y);
      ctx.lineTo(bot.rear.x, bot.rear.y);
      ctx.stroke();

      // Single dashed inner track path (not twin parallel rails)
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 0.4;
      ctx.setLineDash([1.2, 1.8]);
      const mid = wallPts(side, (breakZ + botZ) * 0.55, 0.90);
      ctx.beginPath();
      ctx.moveTo(mid.front.x, mid.front.y);
      ctx.lineTo(mid.rear.x, mid.rear.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Far side: skip ghost slab — hull prism already shows far edges
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }


  // b) faint hull top fill
  ctx.globalAlpha = s.fillAlpha;
  ctx.fillStyle = s.fill;
  fillTop(ctx, g.hullPrism);

  // c) C8: single thin halo + crisp stroke (less bloom at phone size)
  for (const [pts, col] of [[g.hullPrism, s.stroke], [g.turretPrism, s.turretStroke]]) {
    const isWheeled = TANK_STYLE === 'wheeled';
    if (isWheeled) {
      // C9e: no glow underlay — smoother crisp edges
      ctx.globalAlpha = 1;
      ctx.lineWidth = 0.7;
    } else {
      widePass(ctx, s.glow, 5.5, 0.22, () => strokeEdges(ctx, pts));
      ctx.lineWidth = 1;
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = col;
    // C9d: solid outer silhouette; dotted interior panel seams (wheeled)
    if (isWheeled) {
      ctx.setLineDash([]); // solid outer
      strokeEdges(ctx, pts);
      // Dotted interior facets / panel lines
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = tint(col, 0.12);
      ctx.setLineDash([1.5, 2.0]);
      strokeSome(ctx, pts, FRONT_EDGES);
      // Extra mid-panel seams on hull top (lengthwise + cross)
      if (pts === g.hullPrism) {
        const midEdges = [[8, 12], [10, 14], [9, 13], [11, 15]];
        strokeSome(ctx, pts, midEdges);
      } else {
        // Turret: dotted cross-seams
        strokeSome(ctx, pts, [[8, 12], [10, 14]]);
      }
      ctx.setLineDash([]);
    } else {
      const useDash = dashed;
      if (useDash) ctx.setLineDash(dash);
      strokeEdges(ctx, pts);
      if (useDash) ctx.setLineDash([]);
      if (tech) {
        ctx.strokeStyle = s.tick ?? s.turretStroke;
        drawCornerTicks(ctx, pts, pts === g.hullPrism ? s.hull : s.turret);
      }
      ctx.strokeStyle = tint(col, 0.35);
      strokeSome(ctx, pts, FRONT_EDGES);
    }
  }

  // C9g: cylindrical mantlet at barrel root + front deck hatches + rear panels
  if (TANK_STYLE === 'wheeled') {
    const hfx = Math.cos(hullHeading), hfy = Math.sin(hullHeading);
    const hlx = Math.sin(hullHeading), hly = -Math.cos(hullHeading);
    const hullZ0 = -2.2;
    const deckZ = hullZ0 + s.hull.H;
    // Two small rectangular hatches on front deck (dashed)
    {
      const hatchL = s.hull.L * 0.07, hatchW = s.hull.W * 0.14;
      for (const side of [-1, 1]) {
        const cx = x + hfx * (s.hull.L * 0.28) + hlx * side * (s.hull.W * 0.22);
        const cy = y + hfy * (s.hull.L * 0.28) + hly * side * (s.hull.W * 0.22);
        const box = boxCorners(cx, cy, deckZ - 0.05, hatchL, hatchW, 0.2, hullHeading);
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = s.stroke;
        ctx.lineWidth = 0.55;
        ctx.setLineDash([1.2, 1.6]);
        ctx.beginPath();
        ctx.moveTo(box[4].x, box[4].y);
        for (const i of [5, 6, 7]) ctx.lineTo(box[i].x, box[i].y);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    // Rear deck panel lines (dashed)
    {
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = s.stroke;
      ctx.lineWidth = 0.45;
      ctx.setLineDash([1.4, 1.8]);
      for (const t of [-0.22, -0.32, -0.42]) {
        const a = project(x + hfx * (s.hull.L * t) + hlx * (s.hull.W * 0.28),
          y + hfy * (s.hull.L * t) + hly * (s.hull.W * 0.28), deckZ);
        const b = project(x + hfx * (s.hull.L * t) - hlx * (s.hull.W * 0.28),
          y + hfy * (s.hull.L * t) - hly * (s.hull.W * 0.28), deckZ);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    // Cylindrical mantlet at turret front / barrel root
    {
      const tfx = Math.cos(turretAngle), tfy = Math.sin(turretAngle);
      const turOff = -s.hull.L * 0.12;
      const tx = x + hfx * turOff, ty = y + hfy * turOff;
      const mz = hullZ0 + s.hull.H + s.turret.H * 0.45;
      const mx = tx + tfx * (s.turret.L / 2 + 0.8);
      const my = ty + tfy * (s.turret.L / 2 + 0.8);
      const c = project(mx, my, mz);
      const c2 = project(mx + tfx * 2.8, my + tfy * 2.8, mz);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = s.turretStroke;
      ctx.lineWidth = 0.8;
      ctx.setLineDash([]);
      const ang = Math.atan2(c2.y - c.y, c2.x - c.x);
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 2.4, 1.7, ang, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(c2.x, c2.y, 1.9, 1.35, ang, 0, Math.PI * 2);
      ctx.stroke();
      // side lines of cylinder
      const nx = -(c2.y - c.y), ny = (c2.x - c.x);
      const nd = Math.hypot(nx, ny) || 1;
      const ux = nx / nd, uy = ny / nd;
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(c.x + ux * 1.7 * sgn, c.y + uy * 1.7 * sgn);
        ctx.lineTo(c2.x + ux * 1.35 * sgn, c2.y + uy * 1.35 * sgn);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // d) barrels (recoil shifts only the firing barrel back along turretAngle)
  const ca = Math.cos(turretAngle), sa = Math.sin(turretAngle);
  const bs = g.barrels.map((b, i) => {
    const r = i === fx0.barrelIndex ? fx0.recoil : 0;
    return { x1: b.x1 - ca * r, y1: b.y1 - sa * r, x2: b.x2 - ca * r, y2: b.y2 - sa * r };
  });
  const barrelPath = () => {
    ctx.beginPath();
    for (const b of bs) {
      const dx = b.x2 - b.x1, dy = b.y2 - b.y1, d = Math.hypot(dx, dy) || 1;
      const nx = -dy / d, ny = dx / d;
      // C9g wheeled: thin near-parallel tube (target simple barrel); others keep taper
      const w0 = TANK_STYLE === 'wheeled' ? 1.15 : 2.2;
      const w1 = TANK_STYLE === 'wheeled' ? 0.95 : 0.4;
      ctx.moveTo(b.x1 + nx * w0, b.y1 + ny * w0);
      ctx.lineTo(b.x2 + nx * w1, b.y2 + ny * w1);
      ctx.moveTo(b.x1 - nx * w0, b.y1 - ny * w0);
      ctx.lineTo(b.x2 - nx * w1, b.y2 - ny * w1);
      if (TANK_STYLE === 'wheeled') {
        // dashed centreline (target CAD cue)
        // centre drawn solid thin after; skip here
      } else {
        ctx.moveTo(b.x1, b.y1);
        ctx.lineTo(b.x2, b.y2);
      }
    }
    ctx.stroke();
  };
  if (TANK_STYLE === 'wheeled') {
    ctx.lineWidth = 0.75;
  } else {
    widePass(ctx, s.glow, 5, 0.18, barrelPath);
    ctx.lineWidth = 1.4;
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = s.turretStroke;
  // C9d: solid barrel; other styles keep dashed when EDGE_STYLE asks
  if (dashed && TANK_STYLE !== 'wheeled') ctx.setLineDash(dash);
  barrelPath();
  if (dashed && TANK_STYLE !== 'wheeled') ctx.setLineDash([]);
  if (TANK_STYLE === 'wheeled') {
    ctx.setLineDash([1.5, 2.0]);
    ctx.lineWidth = 0.45;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    for (const b of bs) {
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 0.75;
  }

  // C9g muzzle tip — open ring/sleeve (target: not a rectangular box)
  if (TANK_STYLE === 'wheeled') {
    ctx.setLineDash([]);
    ctx.lineWidth = 0.75;
    for (const b of bs) {
      const dx = b.x2 - b.x1, dy = b.y2 - b.y1, d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d;
      const nx = -uy, ny = ux;
      const ang = Math.atan2(dy, dx);
      // short sleeve behind tip
      const sleeve = 2.4, half = 1.15;
      const bx = b.x2 - ux * sleeve, by = b.y2 - uy * sleeve;
      ctx.beginPath();
      ctx.moveTo(bx + nx * half * 0.85, by + ny * half * 0.85);
      ctx.lineTo(b.x2 - ux * 0.4 + nx * half, by - uy * 0.4 + ny * half);
      ctx.moveTo(bx - nx * half * 0.85, by - ny * half * 0.85);
      ctx.lineTo(b.x2 - ux * 0.4 - nx * half, by - uy * 0.4 - ny * half);
      ctx.stroke();
      // open muzzle ring
      ctx.beginPath();
      ctx.ellipse(b.x2, b.y2, 1.55, 1.05, ang, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(b.x2, b.y2, 0.7, 0.45, ang, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // antenna / sensor mast
  {
    const rear = project(x - Math.cos(turretAngle) * s.turret.L * 0.3, y - Math.sin(turretAngle) * s.turret.L * 0.3,
      (TANK_STYLE === 'wheeled' ? -2.2 : 0) + s.hull.H + s.turret.H);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.strokeStyle = s.turretStroke;
    if (TANK_STYLE === 'wheeled') {
      // C9g: flat turret top — tiny cupola hatch (dashed) + short stub only
      const cupZ = -2.2 + s.hull.H + s.turret.H;
      const cupOff = s.turret.L * 0.08;
      const cupCx = x - Math.cos(turretAngle) * cupOff;
      const cupCy = y - Math.sin(turretAngle) * cupOff;
      const cup = boxCorners(cupCx, cupCy, cupZ, s.turret.L * 0.22, s.turret.W * 0.28, 1.4, turretAngle);
      ctx.lineWidth = 0.6;
      ctx.setLineDash([1.2, 1.6]);
      ctx.beginPath();
      ctx.moveTo(cup[4].x, cup[4].y);
      for (const i of [5, 6, 7]) ctx.lineTo(cup[i].x, cup[i].y);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      const tip = { x: rear.x + 0.4, y: rear.y - 4.5 };
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(rear.x, rear.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(rear.x - 1.2, rear.y);
      ctx.lineTo(rear.x + 1.5, rear.y - 10.5);
      ctx.lineTo(rear.x + 1.2, rear.y);
      ctx.stroke();
    }
  }

  // muzzle flash at the recoiled tip of the firing barrel
  if (fx0.flash > 0) {
    const b = bs[fx0.barrelIndex] ?? bs[0];
    drawMuzzle(ctx, b.x2, b.y2, turretAngle, fx0.flash, s.turretStroke, s.glow);
  }

  // e) hit flash
  if (flashIntensity > 0) {
    ctx.globalAlpha = flashIntensity;
    ctx.fillStyle = '#E8E2D0';
    fillTop(ctx, g.hullPrism);
    fillTop(ctx, g.turretPrism);
  }
  ctx.restore();
}

/** Hull-only wireframe afterimage. */
export function drawTankGhost(ctx, kind, x, y, heading, alpha) {
  const s = visualSpecs(kind);
  const pts = prismCorners(x, y, 0, s.hull.L, s.hull.W, s.hull.H, heading,
    s.cutHull * Math.min(s.hull.L, s.hull.W));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(TANK_DRAW_SCALE, TANK_DRAW_SCALE);
  ctx.translate(-x, -y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = paletteFor(kind).stroke;
  ctx.globalAlpha = alpha;
  strokeEdges(ctx, pts);
  ctx.restore();
}
