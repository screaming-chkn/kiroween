/**
 * Design D — light long-gun TD. Side hero; plate mode = side silhouette; play = TILT extrusion.
 * FRESH — not from C9c–g.
 */
import KP from './keypointsD.js';
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

export function drawD(ctx, kind, x, y, hullHeading, turretAngle) {
  const s = specs(kind);
  const pal = paletteFor(kind);
  const parts = KP.parts;
  const w = 1.1;
  const plateScale = globalThis.__HH_FRESH_PLATE_SCALE__;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(TANK_DRAW_SCALE, TANK_DRAW_SCALE);
  ctx.translate(-x, -y);

  if (plateScale != null) {
    beginSolid(ctx, pal.stroke, w);
    strokePoly(ctx, parts.silhouette.map(([u,v])=>isoKpWorld(u,v,x,y,REF_HEADING_ISO,plateScale)), true);
    beginDashed(ctx, pal.stroke, w);
    if (parts.break_line) {
      const [a,b]=parts.break_line;
      strokeSeg(ctx, isoKpWorld(a[0],a[1],x,y,REF_HEADING_ISO,plateScale), isoKpWorld(b[0],b[1],x,y,REF_HEADING_ISO,plateScale));
    }
    beginSolid(ctx, pal.stroke, w);
    if (parts.turret) strokePoly(ctx, parts.turret.map(([u,v])=>isoKpWorld(u,v,x,y,REF_HEADING_ISO,plateScale)), true);
    if (parts.barrel) strokeSeg(ctx, isoKpWorld(parts.barrel[0][0],parts.barrel[0][1],x,y,REF_HEADING_ISO,plateScale),
      isoKpWorld(parts.barrel[1][0],parts.barrel[1][1],x,y,REF_HEADING_ISO,plateScale));
    const wr=Math.max(4,(parts.wheel_r||0.09)*plateScale*0.45);
    for (const [u,v] of (parts.wheels||[])) {
      const p=isoKpWorld(u,v,x,y,REF_HEADING_ISO,plateScale);
      circle(ctx,p,wr);
      ctx.beginPath(); ctx.moveTo(p.x-wr*0.5,p.y); ctx.lineTo(p.x+wr*0.5,p.y);
      ctx.moveTo(p.x,p.y-wr*0.5); ctx.lineTo(p.x,p.y+wr*0.5); ctx.stroke();
    }
    for (const [u,v] of (parts.idler||[])) circle(ctx, isoKpWorld(u,v,x,y,REF_HEADING_ISO,plateScale), wr*0.45);
    ctx.setLineDash([]);
    ctx.restore();
    return;
  }

  const L = s.hull.L * 1.2;
  const W = s.hull.W * 0.85;
  const H = s.hull.H + s.turret.H * 0.7;
  const hw = W * 0.5;

  drawShadow(ctx, x, y, hullHeading, s.hull.L*0.9, s.hull.W*0.8, pal.stroke);

  const track = parts.track || [[0.05,0.58],[0.95,0.60],[0.98,0.90],[0.02,0.88]];
  beginSolid(ctx, pal.stroke, w);
  const near = track.map(([u,v])=>sideToWorld(u,v,hw,x,y,hullHeading,L,H));
  strokePoly(ctx, near, true);
  beginDashed(ctx, pal.stroke, w);
  const far = track.map(([u,v])=>sideToWorld(u,v,-hw*0.8,x,y,hullHeading,L,H));
  strokePoly(ctx, far, true);
  beginSolid(ctx, pal.stroke, w);
  for (let i=0;i<track.length;i++) strokeSeg(ctx, near[i], far[i]);

  beginDashed(ctx, pal.stroke, w);
  if (parts.glacis) strokePoly(ctx, parts.glacis.map(([u,v])=>sideToWorld(u,v,hw*0.7,x,y,hullHeading,L,H)), false);
  if (parts.break_line) {
    const [a,b]=parts.break_line;
    strokeSeg(ctx, sideToWorld(a[0],a[1],hw*0.85,x,y,hullHeading,L,H), sideToWorld(b[0],b[1],hw*0.85,x,y,hullHeading,L,H));
  }

  beginSolid(ctx, pal.stroke, w);
  strokePoly(ctx, (parts.turret||[]).map(([u,v])=>sideToWorld(u,v,hw*0.55,x,y,hullHeading,L,H)), true);
  beginDashed(ctx, pal.stroke, w);
  strokePoly(ctx, (parts.turret||[]).map(([u,v])=>sideToWorld(u,v,-hw*0.55,x,y,hullHeading,L,H)), true);

  beginSolid(ctx, pal.stroke, w);
  const root = sideToWorld(0.68, 0.22, 0, x, y, hullHeading, L, H);
  const bl = s.barrelLen * 1.25;
  const tip = { x: root.x + Math.cos(turretAngle)*bl, y: root.y + Math.sin(turretAngle)*bl };
  strokeSeg(ctx, root, tip);
  const mb=2.0;
  strokePoly(ctx, [{x:tip.x-mb,y:tip.y-mb*0.7},{x:tip.x+mb,y:tip.y-mb*0.7},{x:tip.x+mb,y:tip.y+mb*0.7},{x:tip.x-mb,y:tip.y+mb*0.7}], true);

  beginSolid(ctx, pal.stroke, w);
  const wr = Math.max(4.5, s.hull.H * 0.55);
  for (const [u,v] of (parts.wheels||[])) {
    const p=sideToWorld(u,v,hw*0.95,x,y,hullHeading,L,H);
    circle(ctx,p,wr);
    ctx.beginPath(); ctx.moveTo(p.x-wr*0.5,p.y); ctx.lineTo(p.x+wr*0.5,p.y);
    ctx.moveTo(p.x,p.y-wr*0.5); ctx.lineTo(p.x,p.y+wr*0.5); ctx.stroke();
    circle(ctx,p,wr*0.25);
  }
  for (const [u,v] of (parts.idler||[])) circle(ctx, sideToWorld(u,v,hw*0.95,x,y,hullHeading,L,H), wr*0.45);

  ctx.setLineDash([]);
  ctx.restore();
}

export default drawD;
