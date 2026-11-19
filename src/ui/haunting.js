/**
 * src/ui/haunting.js — arena haunting: border fog, ectoplasm trail, kill ghost,
 * grid flicker, vignette. Pure logic plus Canvas 2D draws. No per-frame
 * allocation; sprites are pre-rendered lazily and only when a canvas exists.
 */

export const HAUNT_FX = Object.freeze({
  TRAIL_MAX: 16, TRAIL_SAMPLE_MS: 60, TRAIL_LIFE_MS: 700,
  FOG_PUFFS: 14, FOG_PUFFS_LITE: 8, GHOST_MS: 1400, GHOST_RISE_WU: 90,
  GRID_BASE: 0.12, GRID_MIN: 0.08, GRID_MAX: 0.18, GRID_WINDUP: 0.2,
  FLICKER_MAX_PER_S: 2, VIGNETTE_MAX: 0.25, FOG_MAX: 0.35,
});

const GHOST_COLOR = '#9FD8FF';
const VOID_COLOR = '#0A0D0B';
const GHOST_ALPHA_START = 0.9;
const TRAIL_ALPHA_START = 0.35;
const SWAY_WU = 6;
const FOG_DRIFT_WU = 18;
const FOG_BLEED_WU = 24;
const GHOST_H = 84;

/**
 * Which effects run. `lite` (touch UI / phones) drops the full-screen vignette
 * and uses FOG_PUFFS_LITE puffs: each costs ~4 ms/frame on a 4x-throttled
 * DPR 2 phone profile, which broke 60 fps (spec 12, R7).
 */
export function hauntFlags(reducedMotion, lite = false) {
  const on = !reducedMotion;
  return { trail: on, fogDrift: on, ghostRise: on, gridFlicker: on, vignette: !lite };
}

/** Tiny seeded RNG (mulberry32), local to puff placement. */
function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function placePuffs(arena, seed, count = HAUNT_FX.FOG_PUFFS) {
  const rnd = makeRng(seed);
  const W = arena.width;
  const H = arena.height;
  const perim = 2 * (W + H);
  const puffs = [];
  for (let i = 0; i < count; i++) {
    const r = 130 + rnd() * 40;   // big, overlapping puffs read as one fog bank
    // Centre sits at least r - 6 outside the edge, leaving room for 18 wu of
    // drift while the inner edge never reaches more than 24 wu inside.
    const out = r - 6 + rnd() * 20;
    let p = ((i + 0.5 + (rnd() - 0.5) * 0.4) / count) * perim;
    let x;
    let y;
    if (p < W) { x = p; y = -out; }
    else if ((p -= W) < H) { x = W + out; y = p; }
    else if ((p -= H) < W) { x = W - p; y = H + out; }
    else { p -= W; x = -out; y = H - p; }
    puffs.push({ x, y, r, phase: rnd() * Math.PI * 2 });
  }
  return puffs;
}

export function createHauntFx({ reducedMotion = false, arena = { width: 1200, height: 900 }, seed = 1, lite = false } = {}) {
  return {
    t: 0,
    xs: new Float64Array(HAUNT_FX.TRAIL_MAX),
    ys: new Float64Array(HAUNT_FX.TRAIL_MAX),
    ts: new Float64Array(HAUNT_FX.TRAIL_MAX),
    head: 0,
    count: 0,
    lastSampleMs: -Infinity,
    flags: hauntFlags(reducedMotion, lite),
    puffs: placePuffs(arena, seed, lite ? HAUNT_FX.FOG_PUFFS_LITE : HAUNT_FX.FOG_PUFFS),
    ghost: { active: false, x: 0, y: 0, t0: 0 },
  };
}

export function tickHaunt(fx, dtMs, enemy) {
  fx.t += dtMs;
  if (!fx.flags.trail || !enemy || !(enemy.hp > 0)) return;
  if (fx.t - fx.lastSampleMs < HAUNT_FX.TRAIL_SAMPLE_MS) return;
  const h = fx.head;
  fx.xs[h] = enemy.x;
  fx.ys[h] = enemy.y;
  fx.ts[h] = fx.t;
  fx.head = (h + 1) % HAUNT_FX.TRAIL_MAX;
  if (fx.count < HAUNT_FX.TRAIL_MAX) fx.count++;
  fx.lastSampleMs = fx.t;
}

export function liveTrailCount(fx) {
  let n = 0;
  for (let i = 0; i < fx.count; i++) {
    if (fx.t - fx.ts[i] < HAUNT_FX.TRAIL_LIFE_MS) n++;
  }
  return n;
}

export function trailAlpha(ageMs) {
  if (!(ageMs >= 0) || ageMs >= HAUNT_FX.TRAIL_LIFE_MS) return 0;
  return TRAIL_ALPHA_START * (1 - ageMs / HAUNT_FX.TRAIL_LIFE_MS);
}

/** Calls fn(x, y, alpha) for live samples, oldest to newest. */
export function forEachTrail(fx, fn) {
  const max = HAUNT_FX.TRAIL_MAX;
  const start = (fx.head - fx.count + max) % max;
  for (let i = 0; i < fx.count; i++) {
    const k = (start + i) % max;
    const a = trailAlpha(fx.t - fx.ts[k]);
    if (a > 0) fn(fx.xs[k], fx.ys[k], a);
  }
}

export function startGhost(fx, x, y) {
  const g = fx.ghost;
  g.x = x;
  g.y = y;
  g.t0 = fx.t;
  g.active = true;
}

const _pose = { x: 0, y: 0, alpha: 0, sway: 0 };

export function ghostPose(fx) {
  const g = fx.ghost;
  if (!g.active) return null;
  const age = fx.t - g.t0;
  if (age >= HAUNT_FX.GHOST_MS) {
    g.active = false;
    return null;
  }
  const p = age < 0 ? 0 : age / HAUNT_FX.GHOST_MS;
  const eased = 1 - (1 - p) * (1 - p);
  const move = fx.flags.ghostRise;
  _pose.x = g.x;
  _pose.y = g.y - (move ? HAUNT_FX.GHOST_RISE_WU * eased : 0);
  _pose.alpha = GHOST_ALPHA_START * (1 - p);
  _pose.sway = move ? Math.sin(p * Math.PI * 4) * SWAY_WU : 0;
  return _pose;
}

function hash01(n) {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function gridAlpha(tMs, windupT01 = 0, reducedMotion = false) {
  if (reducedMotion) return HAUNT_FX.GRID_BASE;
  const step = Math.floor(tMs / (1000 / HAUNT_FX.FLICKER_MAX_PER_S));
  const v = HAUNT_FX.GRID_MIN + (HAUNT_FX.GRID_MAX - HAUNT_FX.GRID_MIN) * hash01(step);
  const w = windupT01 > 1 ? 1 : windupT01 > 0 ? windupT01 : 0;
  return v * (1 - w) + HAUNT_FX.GRID_WINDUP * w;
}

const _off = { dx: 0, dy: 0 };

export function fogPuffOffset(puff, tMs, reducedMotion) {
  if (reducedMotion) {
    _off.dx = 0;
    _off.dy = 0;
    return _off;
  }
  const s = tMs / 1000;
  _off.dx = Math.sin(s * ((Math.PI * 2) / 8) + puff.phase) * FOG_DRIFT_WU;
  _off.dy = Math.sin(s * ((Math.PI * 2) / 11) + puff.phase * 1.7) * FOG_DRIFT_WU;
  return _off;
}

// ---- sprite cache -------------------------------------------------------

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (typeof document !== 'undefined' && document.createElement) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  return null;
}

let puffSprite = null;
let ghostSprite = null;
let vignetteSprite = null;
let vignetteW = 0;
let vignetteH = 0;

const PUFF_PX = 128;
const GHOST_W_PX = 72;
const GHOST_H_PX = 96;

function getPuffSprite() {
  if (puffSprite) return puffSprite;
  const c = makeCanvas(PUFF_PX, PUFF_PX);
  const g = c && c.getContext && c.getContext('2d');
  if (!g) return null;
  const m = PUFF_PX / 2;
  const grad = g.createRadialGradient(m, m, 0, m, m, m);
  grad.addColorStop(0, 'rgba(159,216,255,0.55)');
  grad.addColorStop(0.45, 'rgba(159,216,255,0.22)');
  grad.addColorStop(1, 'rgba(159,216,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, PUFF_PX, PUFF_PX);
  puffSprite = c;
  return c;
}

function getGhostSprite() {
  if (ghostSprite) return ghostSprite;
  const c = makeCanvas(GHOST_W_PX, GHOST_H_PX);
  const g = c && c.getContext && c.getContext('2d');
  if (!g) return null;
  const w = GHOST_W_PX;
  const h = GHOST_H_PX;
  const l = 6;
  const r = w - 6;
  const top = 4;
  const hem = h - 10;
  const cx = w / 2;
  g.fillStyle = GHOST_COLOR;
  g.shadowColor = GHOST_COLOR;   // baked-in glow (drawn once)
  g.shadowBlur = 6;
  g.beginPath();
  g.moveTo(l, hem);
  g.lineTo(l, top + (r - l) / 2);
  g.arc(cx, top + (r - l) / 2, (r - l) / 2, Math.PI, 0);
  g.lineTo(r, hem);
  const n = 4;
  const seg = (r - l) / n;
  for (let i = 0; i < n; i++) {
    const x1 = r - seg * i;
    const x2 = x1 - seg;
    g.quadraticCurveTo(x1 - seg / 2, i % 2 === 0 ? h : hem - 2, x2, hem);
  }
  g.closePath();
  g.fill();
  g.shadowBlur = 0;
  g.fillStyle = VOID_COLOR;
  g.beginPath();
  g.ellipse(cx - 11, 32, 5, 8, 0, 0, Math.PI * 2);
  g.ellipse(cx + 11, 32, 5, 8, 0, 0, Math.PI * 2);
  g.fill();
  ghostSprite = c;
  return c;
}

function getVignetteSprite(vpW, vpH) {
  if (vignetteSprite && vignetteW === vpW && vignetteH === vpH) return vignetteSprite;
  const c = vignetteSprite || makeCanvas(vpW, vpH);
  const g = c && c.getContext && c.getContext('2d');
  if (!g) return null;
  c.width = vpW;
  c.height = vpH;
  const cx = vpW / 2;
  const cy = vpH / 2;
  const rad = Math.hypot(cx, cy);
  const grad = g.createRadialGradient(cx, cy, rad * 0.55, cx, cy, rad);
  // The renderer draws the FOG layer at globalAlpha FOG_MAX (0.35), so the
  // sprite is authored at VIGNETTE_MAX / FOG_MAX to land at VIGNETTE_MAX on screen.
  const a = Math.min(1, HAUNT_FX.VIGNETTE_MAX / HAUNT_FX.FOG_MAX);
  grad.addColorStop(0, 'rgba(10,13,11,0)');
  grad.addColorStop(0.6, `rgba(10,13,11,${(a * 0.5).toFixed(3)})`);
  grad.addColorStop(1, `rgba(20,30,34,${a})`);
  g.clearRect(0, 0, vpW, vpH);
  g.fillStyle = grad;
  g.fillRect(0, 0, vpW, vpH);
  vignetteSprite = c;
  vignetteW = vpW;
  vignetteH = vpH;
  return c;
}

// ---- draws ----------------------------------------------------------------

export function drawBorderFog(ctx, fx) {
  const sprite = getPuffSprite();
  if (!sprite) return;
  const reduced = !fx.flags.fogDrift;
  ctx.save();
  ctx.globalAlpha = HAUNT_FX.FOG_MAX;
  for (let i = 0; i < fx.puffs.length; i++) {
    const p = fx.puffs[i];
    const o = fogPuffOffset(p, fx.t, reduced);
    ctx.drawImage(sprite, p.x + o.dx - p.r, p.y + o.dy - p.r, p.r * 2, p.r * 2);
  }
  ctx.restore();
}

let _trailCtx = null;
function trailDot(x, y, a) {
  const c = _trailCtx;
  c.globalAlpha = a;
  c.beginPath();
  c.arc(x, y, 5, 0, Math.PI * 2);
  c.fill();
}

export function drawEctoTrail(ctx, fx) {
  if (!fx.flags.trail || fx.count === 0) return;
  ctx.save();
  ctx.fillStyle = GHOST_COLOR;
  _trailCtx = ctx;
  forEachTrail(fx, trailDot);
  _trailCtx = null;
  ctx.restore();
}

export function drawKillGhost(ctx, fx) {
  const pose = ghostPose(fx);
  if (!pose) return;
  const sprite = getGhostSprite();
  if (!sprite) return;
  const h = GHOST_H;
  const w = h * (GHOST_W_PX / GHOST_H_PX);
  ctx.save();
  ctx.globalAlpha = pose.alpha;
  ctx.drawImage(sprite, pose.x + pose.sway - w / 2, pose.y - h / 2, w, h);
  ctx.restore();
}

export function drawHauntVignette(ctx, fx, vpW, vpH) {
  if (!fx.flags.vignette || !(vpW > 0) || !(vpH > 0)) return;
  const sprite = getVignetteSprite(vpW, vpH);
  if (!sprite) return;
  ctx.drawImage(sprite, 0, 0, vpW, vpH);
}
