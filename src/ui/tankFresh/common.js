/**
 * Shared helpers for fresh tank designs (mock/tank-fresh4 only).
 * Intentionally does NOT import tankWire.js (avoids circular init with the dispatcher).
 * Draw-only. No glow. Solid outer / dashed inner / one stroke weight.
 */

export const TILT = { x: 0.35, y: 0.7 };
export const TANK_DRAW_SCALE = 1.5;

/** Mirror of tankWire TANK_SPECS — collision footprint unchanged in tankWire; these are draw sizes only. */
export const TANK_SPECS = {
  player: {
    hull: { L: 36, W: 22, H: 10 },
    turret: { L: 16, W: 14, H: 7 },
    barrelLen: 28,
    twin: false,
    base: 'treads',
  },
  enemy: {
    hull: { L: 40, W: 26, H: 12 },
    turret: { L: 20, W: 18, H: 8 },
    barrelLen: 24,
    twin: true,
    base: 'treads',
  },
};

const PALETTES = {
  'mono-blue': {
    player: { line: '#3EF6FF', fillAlpha: 0.14 },
    enemy: { line: '#FF3B5C', fillAlpha: 0.16 },
  },
  'mono-green': {
    player: { line: '#47FF9A', fillAlpha: 0.14 },
    enemy: { line: '#FF3B5C', fillAlpha: 0.16 },
  },
};

export const FRESH_IDS = ['a', 'b', 'c', 'd'];

/** Active fresh design id or null (legacy tankWire path). */
export let FRESH_TANK = null;
export function setFreshTank(id) {
  if (id == null || id === '' || id === 'off') { FRESH_TANK = null; return; }
  const v = String(id).toLowerCase();
  if (FRESH_IDS.includes(v)) FRESH_TANK = v;
}

export function project(x, y, z) {
  return { x: x + z * TILT.x, y: y - z * TILT.y };
}

export function paletteFor(kind) {
  const name = globalThis.__HH_TANK_PALETTE__ || 'mono-green';
  const p = (PALETTES[name] ?? PALETTES['mono-green'])[kind];
  return { stroke: p.line, fill: p.line, fillAlpha: p.fillAlpha };
}

export function rot(lx, ly, heading) {
  const c = Math.cos(heading), s = Math.sin(heading);
  return { x: lx * c - ly * s, y: lx * s + ly * c };
}

export function strokePoly(ctx, pts, close = true) {
  if (!pts || pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if (close) ctx.closePath();
  ctx.stroke();
}

export function strokeSeg(ctx, a, b) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

export function circle(ctx, p, r) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.stroke();
}

export const REF_HEADING_ISO = -2.45;

export function isoKpWorld(u, v, cx, cy, heading, scale, refHeading = REF_HEADING_ISO) {
  const px = (u - 0.5) * scale;
  const py = (v - 0.5) * scale * 0.85;
  const dHead = heading - refHeading;
  const c = Math.cos(dHead), s = Math.sin(dHead);
  const rx = px * c - py * s;
  const ry = px * s + py * c;
  return { x: cx + rx, y: cy + ry };
}

export function beginSolid(ctx, color, w = 1.2) {
  ctx.setLineDash([]);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';
  ctx.globalAlpha = 1;
}

export function beginDashed(ctx, color, w = 1.2) {
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';
  ctx.globalAlpha = 1;
}

export function drawShadow(ctx, x, y, heading, L, W, color) {
  if (globalThis.__HH_FRESH_PLATE_SCALE__ != null) return; // plate/IoU: no shadow blob
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y + 5, L * 0.55, W * 0.5, heading, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function specs(kind) {
  return TANK_SPECS[kind] || TANK_SPECS.player;
}
