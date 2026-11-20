/**
 * Design B — low wedge MBT from keypointsB (ref1-red-wedge). FRESH.
 */
import KP from './keypointsB.js';
import {
  beginSolid, beginDashed, strokePoly, strokeSeg, circle,
  isoKpWorld, drawShadow, paletteFor, specs, TANK_DRAW_SCALE, REF_HEADING_ISO,
  project,
} from './common.js';

function mapKp(u, v, cx, cy, heading, scale) {
  return isoKpWorld(u, v, cx, cy, heading, scale, REF_HEADING_ISO);
}

export function drawB(ctx, kind, x, y, hullHeading, turretAngle) {
  const s = specs(kind);
  const pal = paletteFor(kind);
  const parts = KP.parts;
  const w = 1.2;
  const scale = (globalThis.__HH_FRESH_PLATE_SCALE__ != null)
    ? globalThis.__HH_FRESH_PLATE_SCALE__
    : Math.max(s.hull.L, s.hull.W) * 1.9;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(TANK_DRAW_SCALE, TANK_DRAW_SCALE);
  ctx.translate(-x, -y);

  drawShadow(ctx, x, y, hullHeading, s.hull.L, s.hull.W, pal.stroke);

  beginSolid(ctx, pal.stroke, w);
  strokePoly(ctx, parts.silhouette.map(([u, v]) => mapKp(u, v, x, y, hullHeading, scale)), true);

  beginDashed(ctx, pal.stroke, w);
  if (parts.glacis) strokePoly(ctx, parts.glacis.map(([u, v]) => mapKp(u, v, x, y, hullHeading, scale)), false);
  if (parts.break_line) {
    const [a, b] = parts.break_line;
    strokeSeg(ctx, mapKp(a[0], a[1], x, y, hullHeading, scale), mapKp(b[0], b[1], x, y, hullHeading, scale));
  }

  beginSolid(ctx, pal.stroke, w);
  const tur = (parts.turret || []).map(([u, v]) => {
    const base = mapKp(u, v, x, y, hullHeading, scale);
    const e = project(base.x - x, base.y - y, s.hull.H * 0.45);
    return { x: x + e.x, y: y + e.y };
  });
  strokePoly(ctx, tur, true);

  beginDashed(ctx, pal.stroke, w);
  if (parts.sensor) {
    strokePoly(ctx, parts.sensor.map(([u, v]) => {
      const base = mapKp(u, v, x, y, hullHeading, scale);
      const e = project(base.x - x, base.y - y, s.hull.H * 0.45 + 2);
      return { x: x + e.x, y: y + e.y };
    }), true);
  }

  beginSolid(ctx, pal.stroke, w);
  const root = mapKp(parts.barrel[0][0], parts.barrel[0][1], x, y, hullHeading, scale);
  const tipOff = { x: Math.cos(turretAngle) * s.barrelLen * 1.1, y: Math.sin(turretAngle) * s.barrelLen * 1.1 };
  const rootE = project(root.x - x, root.y - y, s.hull.H * 0.45 + 1);
  const tip = project(root.x - x + tipOff.x, root.y - y + tipOff.y, s.hull.H * 0.45 + 1);
  const R = { x: x + rootE.x, y: y + rootE.y };
  const T = { x: x + tip.x, y: y + tip.y };
  strokeSeg(ctx, R, T);
  const box = 2.6;
  strokePoly(ctx, [
    { x: T.x - box, y: T.y - box }, { x: T.x + box, y: T.y - box },
    { x: T.x + box, y: T.y + box }, { x: T.x - box, y: T.y + box },
  ], true);

  beginSolid(ctx, pal.stroke, w);
  const wr = Math.max(2.2, (parts.wheel_r || 0.04) * scale * 0.5);
  for (const [u, v] of (parts.wheels || [])) {
    const p = mapKp(u, v, x, y, hullHeading, scale);
    circle(ctx, p, wr); circle(ctx, p, wr * 0.35);
  }

  ctx.setLineDash([]);
  ctx.restore();
}

export default drawB;
