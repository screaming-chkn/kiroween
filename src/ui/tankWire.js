/**
 * tankWire.js — simple 3D wireframe tanks (render only).
 *
 * Necker-cube look: every box edge is drawn, hidden ones included. A slight
 * 3/4 tilt makes height draw up-right. Pure ES module: no DOM at load, only
 * the ctx passed in. Hitboxes/collision/movement are untouched by this file.
 */

import { fxClock, shotFx, hoverBob } from './tankFx.js';

export const TILT = { x: 0.35, y: 0.7 };

/** Draw-time scale around the tank origin (hitboxes unchanged). */
export const TANK_DRAW_SCALE = 1.3;

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

export const TANK_SPECS = {
  player: {
    hull: { L: 34, W: 24, H: 9 }, turret: { L: 16, W: 13, H: 7 }, barrelLen: 24, twin: false,
    stroke: '#39FF88', turretStroke: '#9FD8FF', fill: '#9FD8FF', fillAlpha: 0.14, base: 'hover',
  },
  enemy: {
    hull: { L: 40, W: 32, H: 12 }, turret: { L: 20, W: 17, H: 8 }, barrelLen: 28, twin: true,
    stroke: '#FF4D5E', turretStroke: '#FF8A3D', fill: '#FF4D5E', fillAlpha: 0.16, base: 'treads',
  },
};

/**
 * Geometry for one tank.
 * @returns {{hull:Array,turret:Array,barrels:Array,footprint:Array}}
 */
export function tankGeometry(kind, x, y, hullHeading, turretAngle) {
  const s = TANK_SPECS[kind];
  const hull = boxCorners(x, y, 0, s.hull.L, s.hull.W, s.hull.H, hullHeading);
  const turret = boxCorners(x, y, s.hull.H, s.turret.L, s.turret.W, s.turret.H, turretAngle);
  const footprint = footprintCorners(x, y, s.hull.L, s.hull.W, hullHeading);

  const fx = Math.cos(turretAngle), fy = Math.sin(turretAngle);
  const lx = Math.sin(turretAngle), ly = -Math.cos(turretAngle);
  const z = s.hull.H + s.turret.H / 2;
  const offsets = s.twin ? [-3, 3] : [0];
  const barrels = offsets.map(o => {
    const sx = x + fx * (s.turret.L / 2) + lx * o;
    const sy = y + fy * (s.turret.L / 2) + ly * o;
    const a = project(sx, sy, z);
    const b = project(sx + fx * s.barrelLen, sy + fy * s.barrelLen, z);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  });
  return { hull, turret, barrels, footprint };
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
  for (const [i, j] of BOX_EDGES) {
    ctx.moveTo(pts[i].x, pts[i].y);
    ctx.lineTo(pts[j].x, pts[j].y);
  }
  ctx.stroke();
}

function fillTop(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[4].x, pts[4].y);
  for (let k = 5; k <= 7; k++) ctx.lineTo(pts[k].x, pts[k].y);
  ctx.closePath();
  ctx.fill();
}

/** Edges on the front face (corner indices 0,1,4,5). */
const FRONT_EDGES = [[0, 1], [4, 5], [0, 4], [1, 5]];

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
function drawMuzzle(ctx, px, py, ang, flash, color) {
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
  widePass(ctx, color, 3, 0.2 * flash, lines);
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

/** Draw a wireframe tank (all edges visible). */
export function drawTank(ctx, kind, x, y, hullHeading, turretAngle, flashIntensity = 0) {
  ctx.save();
  const g = tankGeometry(kind, x, y, hullHeading, turretAngle);
  const s = TANK_SPECS[kind];
  const clock = fxClock();
  const bob = hoverBob(kind, clock);
  const fx0 = shotFx(kind, clock);
  ctx.translate(x, y);
  ctx.scale(TANK_DRAW_SCALE, TANK_DRAW_SCALE);
  ctx.translate(-x, -y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // a) ground shadow (no bob): hover disc / shadow under treads
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = s.stroke;
  ctx.beginPath();
  ctx.ellipse(x, y + 5, s.hull.L * 0.62, s.hull.W * 0.6, hullHeading, 0, Math.PI * 2);
  ctx.fill();
  if (s.base !== 'hover') {
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
  }

  // everything below bobs (hull, turret, barrels, hit flash)
  ctx.translate(0, bob);

  // b) faint hull top fill
  ctx.globalAlpha = s.fillAlpha;
  ctx.fillStyle = s.fill;
  fillTop(ctx, g.hull);

  // c) wide additive glow, then crisp 1px with brighter front edges
  for (const [pts, col] of [[g.hull, s.stroke], [g.turret, s.turretStroke]]) {
    widePass(ctx, col, 8, 0.12, () => strokeEdges(ctx, pts)); // under-halo
    widePass(ctx, col, 5.5, 0.32, () => strokeEdges(ctx, pts)); // mid halo
    ctx.lineWidth = 1;
    ctx.globalAlpha = 1;
    ctx.strokeStyle = col;
    strokeEdges(ctx, pts);
    ctx.strokeStyle = tint(col, 0.35);
    strokeSome(ctx, pts, FRONT_EDGES);
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
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
    }
    ctx.stroke();
  };
  widePass(ctx, s.turretStroke, 5, 0.18, barrelPath);
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = s.turretStroke;
  barrelPath();

  // muzzle flash at the recoiled tip of the firing barrel
  if (fx0.flash > 0) {
    const b = bs[fx0.barrelIndex] ?? bs[0];
    drawMuzzle(ctx, b.x2, b.y2, turretAngle, fx0.flash, s.turretStroke);
  }

  // e) hit flash
  if (flashIntensity > 0) {
    ctx.globalAlpha = flashIntensity;
    ctx.fillStyle = '#E8E2D0';
    fillTop(ctx, g.hull);
    fillTop(ctx, g.turret);
  }
  ctx.restore();
}

/** Hull-only wireframe afterimage. */
export function drawTankGhost(ctx, kind, x, y, heading, alpha) {
  const s = TANK_SPECS[kind];
  const pts = boxCorners(x, y, 0, s.hull.L, s.hull.W, s.hull.H, heading);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(TANK_DRAW_SCALE, TANK_DRAW_SCALE);
  ctx.translate(-x, -y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = s.stroke;
  ctx.globalAlpha = alpha;
  strokeEdges(ctx, pts);
  ctx.restore();
}
