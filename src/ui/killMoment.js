/**
 * src/ui/killMoment.js — kill-moment presentation (render only).
 *
 * Sequence after the final hit (phase playing → win | lose):
 *   hitstop (200 ms, last pose held) → shatter (550 ms, enemy dashed edges fly
 *   apart) → flicker (180 ms CRT pulse) → done (end card may show).
 *
 * No combat math lives here. The module is deterministic: it never reads a
 * clock, only the `nowMs` values passed in. On a LOSS the enemy did not die,
 * so the shatter is skipped (hitstop → flicker → done) and the enemy stays
 * drawn. Under reducedMotion everything is skipped and the state is 'done'.
 *
 * Pure ES module: no DOM at load, only the ctx passed in.
 */

import { tankGeometry, BOX_EDGES, TANK_DRAW_SCALE, TANK_PALETTES, TANK_PALETTE } from './tankWire.js';

export const HITSTOP_MS = 200;
export const SHATTER_MS = 550;
export const FLICKER_MS = 180;
export const FLICKER_FRAMES = 3;
export const KILL_RED = '#FF3B5C';

/** @type {{phase:string, kind:string, t0:number, reduced:boolean, snapshot:any}} */
const km = { phase: 'idle', kind: 'win', t0: 0, reduced: false, snapshot: null };

/** Deterministic 0..1 hash (no Math.random). */
function frac(i) {
  const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Build the flying segments from the enemy's death pose.
 * Each segment: midpoint-relative endpoints, velocity (wu/s) away from the
 * hull centre, and a spin (rad/s).
 *
 * @param {{x:number,y:number,angle?:number,hullHeading?:number}} enemy
 * @returns {{x:number,y:number,color:string,segs:Array<object>}}
 */
export function buildShatterSnapshot(enemy) {
  const x = enemy?.x ?? 0;
  const y = enemy?.y ?? 0;
  const turretAngle = enemy?.angle ?? Math.PI;
  const hullHeading = enemy?.hullHeading ?? turretAngle;
  const g = tankGeometry('enemy', x, y, hullHeading, turretAngle);

  // Hull centre in projected space = mean of the 8 hull corners.
  let cx = 0, cy = 0;
  for (const p of g.hull) { cx += p.x; cy += p.y; }
  cx /= g.hull.length; cy /= g.hull.length;

  const raw = [];
  for (const pts of [g.hull, g.turret]) {
    for (const [i, j] of BOX_EDGES) {
      raw.push({ x1: pts[i].x, y1: pts[i].y, x2: pts[j].x, y2: pts[j].y });
    }
  }
  for (const b of g.barrels) raw.push({ x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2 });

  const segs = raw.map((s, n) => {
    const mx = (s.x1 + s.x2) / 2;
    const my = (s.y1 + s.y2) / 2;
    let dx = mx - cx, dy = my - cy;
    let d = Math.hypot(dx, dy);
    if (d < 1e-6) { const a = frac(n) * Math.PI * 2; dx = Math.cos(a); dy = Math.sin(a); d = 1; }
    const speed = 50 + 90 * frac(n + 1);           // wu/s
    return {
      mx, my,
      hx: (s.x2 - s.x1) / 2,
      hy: (s.y2 - s.y1) / 2,
      vx: (dx / d) * speed,
      vy: (dy / d) * speed,
      spin: (frac(n + 7) - 0.5) * 6,               // ±3 rad/s
    };
  });

  const pal = (TANK_PALETTES[TANK_PALETTE] ?? TANK_PALETTES['mono-green']).enemy;
  return { x, y, color: pal?.line ?? KILL_RED, segs };
}

/**
 * Start the sequence. Ignored unless phase is 'win' or 'lose'.
 *
 * @param {{phase:string, enemy:object, nowMs:number, reducedMotion?:boolean}} p
 */
export function beginKillMoment({ phase, enemy, nowMs, reducedMotion = false }) {
  if (phase !== 'win' && phase !== 'lose') return;
  km.kind = phase;
  km.t0 = Number.isFinite(nowMs) ? nowMs : 0;
  km.reduced = !!reducedMotion;
  km.snapshot = phase === 'win' ? buildShatterSnapshot(enemy) : null;
  km.phase = km.reduced ? 'done' : 'hitstop';
}

/** Advance the sequence to `nowMs`; returns the current phase. */
export function tickKillMoment(nowMs) {
  if (km.phase === 'idle' || km.phase === 'done') return km.phase;
  const e = nowMs - km.t0;
  const hasShatter = km.kind === 'win';
  const tShatter = HITSTOP_MS;
  const tFlicker = tShatter + (hasShatter ? SHATTER_MS : 0);
  const tDone = tFlicker + FLICKER_MS;
  if (e >= tDone) km.phase = 'done';
  else if (e >= tFlicker) km.phase = 'flicker';
  else if (e >= tShatter && hasShatter) km.phase = 'shatter';
  else km.phase = 'hitstop';
  return km.phase;
}

export function resetKillMoment() {
  km.phase = 'idle';
  km.kind = 'win';
  km.t0 = 0;
  km.reduced = false;
  km.snapshot = null;
}

/** @returns {'idle'|'hitstop'|'shatter'|'flicker'|'done'} */
export function killMomentPhase() { return km.phase; }

export function shouldDrawEndCard() { return km.phase === 'done'; }

/** Enemy wire is hidden once it shatters (win only) until reset. */
export function shouldDrawEnemy() {
  if (km.kind !== 'win') return true;
  return km.phase === 'idle' || km.phase === 'hitstop';
}

export function isKillMomentActive() {
  return km.phase === 'hitstop' || km.phase === 'shatter' || km.phase === 'flicker';
}

export function getKillSnapshot() { return km.snapshot; }

/** 0..1 progress through the current phase (0 when idle/done). */
export function killMomentT01(nowMs) {
  const e = nowMs - km.t0;
  if (km.phase === 'shatter') return clamp01((e - HITSTOP_MS) / SHATTER_MS);
  if (km.phase === 'flicker') {
    const start = HITSTOP_MS + (km.kind === 'win' ? SHATTER_MS : 0);
    return clamp01((e - start) / FLICKER_MS);
  }
  return 0;
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

/**
 * WORLD-space draw: dashed 1px segments flying apart. Balanced save/restore.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x:number,y:number,color?:string,segs:Array<object>}|null} snapshot
 * @param {number} t01  0..1 across the shatter phase.
 */
export function drawKillShatter(ctx, snapshot, t01) {
  if (!snapshot || !snapshot.segs) return;
  const t = clamp01(t01);
  const secs = (t * SHATTER_MS) / 1000;
  ctx.save();
  ctx.translate(snapshot.x, snapshot.y);
  ctx.scale(TANK_DRAW_SCALE, TANK_DRAW_SCALE);
  ctx.translate(-snapshot.x, -snapshot.y);
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.strokeStyle = snapshot.color ?? KILL_RED;
  ctx.globalAlpha = 1 - 0.85 * t;
  ctx.setLineDash([4, 2]);
  ctx.beginPath();
  for (const s of snapshot.segs) {
    const mx = s.mx + s.vx * secs;
    const my = s.my + s.vy * secs;
    const a = s.spin * secs;
    const c = Math.cos(a), sn = Math.sin(a);
    const hx = s.hx * c - s.hy * sn;
    const hy = s.hx * sn + s.hy * c;
    ctx.moveTo(mx - hx, my - hy);
    ctx.lineTo(mx + hx, my + hy);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * SCREEN-space CRT flicker: 2–3 frames of scanlines plus a slight brightness
 * pulse. Opacities stay ≤ 0.35 (accessibility rule 2). Balanced save/restore.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} vpW
 * @param {number} vpH
 * @param {number} t01  0..1 across the flicker phase.
 */
export function drawKillFlicker(ctx, vpW, vpH, t01) {
  const frame = Math.min(FLICKER_FRAMES - 1, Math.floor(clamp01(t01) * FLICKER_FRAMES));
  ctx.save();
  // Brightness pulse on frames 0 and 2 only (gap frame between).
  if (frame !== 1) {
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#E8E2D0';
    ctx.fillRect(0, 0, vpW, vpH);
  }
  // Scanlines on every frame; offset alternates per frame.
  ctx.globalAlpha = frame === 1 ? 0.3 : 0.2;
  ctx.fillStyle = '#0A0D0B';
  for (let y = frame % 2; y < vpH; y += 3) ctx.fillRect(0, y, vpW, 1);
  ctx.restore();
}
