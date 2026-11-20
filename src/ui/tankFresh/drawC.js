/**
 * Design C — heavy casemate assault gun. Side hero re-projected to TILT for play.
 * Plate mode draws side silhouette 1:1 for IoU vs side hero; play mode uses extrusion.
 * FRESH — not from C9c–g.
 */
import KP from './keypointsC.js';
import {
  beginSolid, beginDashed, strokePoly, strokeSeg, circle,
  drawShadow, paletteFor, specs, TANK_DRAW_SCALE, REF_HEADING_ISO,
  project, rot, isoKpWorld,
} from './common.js';

function sideToWorld(u, v, lat, cx, cy, heading, L, Htop) {
  const fx = (u - 0.5) * L;
  const z = (1 - v) * Htop;
  const r = rot(fx, lat, heading);
  const p = project(r.x, r.y, z);
  return { x: cx + p.x, y: cy + p.y };
}

export function drawC(ctx, kind, x, y, hullHeading, turretAngle) {
  const s = specs(kind);
  const pal = paletteFor(kind);
  const parts = KP.parts;
  const w = 1.2;
  const plateScale = globalThis.__HH_FRESH_PLATE_SCALE__;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(TANK_DRAW_SCALE, TANK_DRAW_SCALE);
  ctx.translate(-x, -y);

  // PLATE MODE: draw side silhouette in 2D plate space (hero is side view)
  if (plateScale != null) {
    beginSolid(ctx, pal.stroke, w);
    const sil = parts.silhouette.map(([u, v]) => isoKpWorld(u, v, x, y, REF_HEADING_ISO, plateScale, REF_HEADING_ISO));
    strokePoly(ctx, sil, true);
    beginDashed(ctx, pal.stroke, w);
    if (parts.break_line) {
      const [a,b]=parts.break_line;
      strokeSeg(ctx, isoKpWorld(a[0],a[1],x,y,REF_HEADING_ISO,plateScale), isoKpWorld(b[0],b[1],x,y,REF_HEADING_ISO,plateScale));
    }
    beginSolid(ctx, pal.stroke, w);
    if (parts.casemate) strokePoly(ctx, parts.casemate.map(([u,v])=>isoKpWorld(u,v,x,y,REF_HEADING_ISO,plateScale)), true);
    if (parts.barrel) strokeSeg(ctx, isoKpWorld(parts.barrel[0][0],parts.barrel[0][1],x,y,REF_HEADING_ISO,plateScale),
      isoKpWorld(parts.barrel[1][0],parts.barrel[1][1],x,y,REF_HEADING_ISO,plateScale));
    const wr = Math.max(3, (parts.wheel_r||0.055)*plateScale*0.5);
    for (const [u,v] of (parts.wheels||[])) circle(ctx, isoKpWorld(u,v,x,y,REF_HEADING_ISO,plateScale), wr);
    for (const [u,v] of (parts.ends||[])) circle(ctx, isoKpWorld(u,v,x,y,REF_HEADING_ISO,plateScale), wr*0.7);
    ctx.setLineDash([]);
    ctx.restore();
    return;
  }

  // PLAY MODE: re-project side profile into TILT iso
  const L = s.hull.L * 1.15;
  const W = s.hull.W * 1.05;
  const H = s.hull.H + s.turret.H * 0.9;
  const hw = W * 0.55;

  drawShadow(ctx, x, y, hullHeading, s.hull.L, s.hull.W, pal.stroke);

  const track = parts.track || [[0.04,0.60],[0.96,0.60],[0.98,0.90],[0.02,0.90]];
  beginSolid(ctx, pal.stroke, w);
  const near = track.map(([u,v]) => sideToWorld(u,v,hw,x,y,hullHeading,L,H));
  strokePoly(ctx, near, true);
  beginDashed(ctx, pal.stroke, w);
  const far = track.map(([u,v]) => sideToWorld(u,v,-hw*0.85,x,y,hullHeading,L,H));
  strokePoly(ctx, far, true);
  beginSolid(ctx, pal.stroke, w);
  for (let i=0;i<track.length;i++) strokeSeg(ctx, near[i], far[i]);

  const casePoly = parts.casemate || [];
  beginSolid(ctx, pal.stroke, w);
  const caseNear = casePoly.map(([u,v]) => sideToWorld(u,v,hw*0.75,x,y,hullHeading,L,H));
  strokePoly(ctx, caseNear, true);
  beginDashed(ctx, pal.stroke, w);
  const caseFar = casePoly.map(([u,v]) => sideToWorld(u,v,-hw*0.75,x,y,hullHeading,L,H));
  strokePoly(ctx, caseFar, true);
  beginSolid(ctx, pal.stroke, w);
  for (let i=0;i<casePoly.length;i++) strokeSeg(ctx, caseNear[i], caseFar[i]);

  beginDashed(ctx, pal.stroke, w);
  if (parts.break_line) {
    const [a,b]=parts.break_line;
    strokeSeg(ctx, sideToWorld(a[0],a[1],hw*0.9,x,y,hullHeading,L,H), sideToWorld(b[0],b[1],hw*0.9,x,y,hullHeading,L,H));
  }

  beginSolid(ctx, pal.stroke, w);
  const barrelRoot = sideToWorld(0.82, 0.28, 0, x, y, hullHeading, L, H);
  const bl = s.barrelLen * 0.55;
  const bTipOff = rot(bl, 0, hullHeading);
  const bTip = { x: barrelRoot.x + bTipOff.x, y: barrelRoot.y + bTipOff.y };
  strokeSeg(ctx, barrelRoot, bTip);
  const lat = rot(0, 2.2, hullHeading);
  strokeSeg(ctx, {x:barrelRoot.x+lat.x,y:barrelRoot.y+lat.y}, {x:bTip.x+lat.x,y:bTip.y+lat.y});
  const mb=3.2;
  strokePoly(ctx, [{x:bTip.x-mb,y:bTip.y-mb},{x:bTip.x+mb,y:bTip.y-mb},{x:bTip.x+mb,y:bTip.y+mb},{x:bTip.x-mb,y:bTip.y+mb}], true);

  beginSolid(ctx, pal.stroke, w);
  const wr = Math.max(2.8, s.hull.H * 0.35);
  for (const [u,v] of (parts.wheels||[])) {
    const p=sideToWorld(u,v,hw*0.95,x,y,hullHeading,L,H);
    circle(ctx,p,wr); circle(ctx,p,wr*0.35);
  }
  for (const [u,v] of (parts.ends||[])) circle(ctx, sideToWorld(u,v,hw*0.95,x,y,hullHeading,L,H), wr*0.75);

  ctx.setLineDash([]);
  ctx.restore();
}

export default drawC;
