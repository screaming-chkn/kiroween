/**
 * Design A — classic octagon-turret MBT from keypointsA (target-iso-green).
 * FRESH — not from C9c–g.
 */
import KP from './keypointsA.js';
import {
  beginSolid, beginDashed, strokePoly, strokeSeg, circle,
  isoKpWorld, drawShadow, paletteFor, specs, TANK_DRAW_SCALE, REF_HEADING_ISO,
  project,
} from './common.js';

function mapKp(u, v, cx, cy, heading, scale) {
  return isoKpWorld(u, v, cx, cy, heading, scale, REF_HEADING_ISO);
}

export function drawA(ctx, kind, x, y, hullHeading, turretAngle) {
  const s = specs(kind);
  const pal = paletteFor(kind);
  const parts = KP.parts;
  const w = 1.2;
  const plate = globalThis.__HH_FRESH_PLATE_SCALE__ != null;
  const scale = plate ? globalThis.__HH_FRESH_PLATE_SCALE__ : Math.max(s.hull.L, s.hull.W) * 1.85;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(TANK_DRAW_SCALE, TANK_DRAW_SCALE);
  ctx.translate(-x, -y);

  drawShadow(ctx, x, y, hullHeading, s.hull.L, s.hull.W, pal.stroke);

  beginSolid(ctx, pal.stroke, w);
  strokePoly(ctx, parts.silhouette.map(([u, v]) => mapKp(u, v, x, y, hullHeading, scale)), true);

  beginDashed(ctx, pal.stroke, w);
  if (parts.break_line) {
    const [a, b] = parts.break_line;
    strokeSeg(ctx, mapKp(a[0], a[1], x, y, hullHeading, scale), mapKp(b[0], b[1], x, y, hullHeading, scale));
  }
  for (const h of (parts.hatches || [])) {
    strokePoly(ctx, h.map(([u, v]) => mapKp(u, v, x, y, hullHeading, scale)), true);
  }

  beginSolid(ctx, pal.stroke, w);
  if (plate) {
    // Flat plate match: no z-lift (keeps one connected component)
    strokePoly(ctx, (parts.turret_oct || []).map(([u, v]) => mapKp(u, v, x, y, hullHeading, scale)), true);
    beginDashed(ctx, pal.stroke, w);
    const tur = (parts.turret_oct || []).map(([u, v]) => mapKp(u, v, x, y, hullHeading, scale));
    if (tur.length >= 3) {
      const cx = tur.reduce((a, p) => a + p.x, 0) / tur.length;
      const cy = tur.reduce((a, p) => a + p.y, 0) / tur.length;
      strokePoly(ctx, tur.map((p) => ({ x: cx + (p.x - cx) * 0.7, y: cy + (p.y - cy) * 0.7 })), true);
    }
    beginSolid(ctx, pal.stroke, w);
    const b0 = mapKp(parts.barrel[0][0], parts.barrel[0][1], x, y, hullHeading, scale);
    const b1 = mapKp(parts.barrel[1][0], parts.barrel[1][1], x, y, hullHeading, scale);
    strokeSeg(ctx, b0, b1);
    circle(ctx, b1, Math.max(2, scale * 0.01));
  } else {
    const tur = (parts.turret_oct || []).map(([u, v]) => {
      const base = mapKp(u, v, x, y, hullHeading, scale);
      const e = project(base.x - x, base.y - y, s.hull.H * 0.5);
      return { x: x + e.x, y: y + e.y };
    });
    strokePoly(ctx, tur, true);
    beginDashed(ctx, pal.stroke, w);
    if (tur.length >= 3) {
      const cx = tur.reduce((a, p) => a + p.x, 0) / tur.length;
      const cy = tur.reduce((a, p) => a + p.y, 0) / tur.length;
      strokePoly(ctx, tur.map((p) => ({ x: cx + (p.x - cx) * 0.7, y: cy + (p.y - cy) * 0.7 })), true);
    }
    beginSolid(ctx, pal.stroke, w);
    const root = mapKp(parts.barrel[0][0], parts.barrel[0][1], x, y, hullHeading, scale);
    const tipOff = { x: Math.cos(turretAngle) * s.barrelLen * 1.0, y: Math.sin(turretAngle) * s.barrelLen * 1.0 };
    const rootE = project(root.x - x, root.y - y, s.hull.H * 0.5 + 1);
    const tip = project(root.x - x + tipOff.x, root.y - y + tipOff.y, s.hull.H * 0.5 + 1);
    strokeSeg(ctx, { x: x + rootE.x, y: y + rootE.y }, { x: x + tip.x, y: y + tip.y });
    circle(ctx, { x: x + tip.x, y: y + tip.y }, 2.2);
  }

  // Wheels/ends only in play mode — plate silhouette already carries the track envelope
  if (!plate) {
    beginSolid(ctx, pal.stroke, w);
    const wr = Math.max(2.0, (parts.wheel_r || 0.035) * scale * 0.5);
    for (const [u, v] of (parts.wheels || [])) {
      const p = mapKp(u, v, x, y, hullHeading, scale);
      circle(ctx, p, wr);
      circle(ctx, p, wr * 0.35);
    }
    for (const [u, v] of (parts.ends || [])) {
      circle(ctx, mapKp(u, v, x, y, hullHeading, scale), wr * 1.25);
    }
  }

  ctx.setLineDash([]);
  ctx.restore();
}

export default drawA;
