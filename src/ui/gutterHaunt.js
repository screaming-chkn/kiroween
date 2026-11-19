/**
 * src/ui/gutterHaunt.js — C9b faint spectral fill in the letterbox gutters only.
 *
 * Screen-space, never inside the arena. Baked tile + clip; draw is a few
 * drawImage calls. Opacity ~4–6% (barely noticeable). Styles: silver | purple.
 * Toggle: ?gutter=silver|purple|off  (default silver).
 */

export const GUTTER_HAUNT_ALPHA = 0.06; // top of owner's 4–6% faint band (picker-visible)
export const GUTTER_HAUNT_STYLES = Object.freeze(['silver', 'purple', 'off']);
export const GUTTER_TILE = 128;

/** @typedef {'silver'|'purple'|'off'} GutterHauntStyle */

export const GUTTER_PALETTES = Object.freeze({
  // Light silver / cool ghost lines (authored bright; drawn at ~5% alpha)
  silver: Object.freeze({
    line: 'rgba(230, 238, 245, 1)',
    soft: 'rgba(190, 205, 220, 1)',
    accent: 'rgba(255, 255, 255, 1)',
  }),
  // Dark shiny purple — saturated so it still reads violet at ~5% alpha
  purple: Object.freeze({
    line: 'rgba(210, 120, 255, 1)',
    soft: 'rgba(150, 60, 220, 1)',
    accent: 'rgba(240, 170, 255, 1)',
  }),
});

/**
 * Parse ?gutter= from a search string. Unknown / missing → 'silver'.
 * @param {string} [search]
 * @returns {GutterHauntStyle}
 */
export function readGutterHaunt(search = '') {
  try {
    const raw = String(search || '');
    const q = raw.startsWith('?') ? raw.slice(1) : raw;
    const v = new URLSearchParams(q).get('gutter');
    if (v === 'off' || v === 'none' || v === '0') return 'off';
    if (v === 'purple' || v === 'violet') return 'purple';
    if (v === 'silver' || v === 'grey' || v === 'gray') return 'silver';
    return 'silver';
  } catch {
    return 'silver';
  }
}

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

/** Tiny seeded RNG (mulberry32). */
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

const tileCache = new Map();

/**
 * Bake a repeating filigree tile for `style`. Cached per style.
 * @param {Exclude<GutterHauntStyle,'off'>} style
 * @returns {OffscreenCanvas|HTMLCanvasElement|null}
 */
export function getGutterHauntTile(style) {
  if (style !== 'silver' && style !== 'purple') return null;
  if (tileCache.has(style)) return tileCache.get(style);
  const pal = GUTTER_PALETTES[style];
  const N = GUTTER_TILE;
  const c = makeCanvas(N, N);
  const g = c && c.getContext && c.getContext('2d');
  if (!g) return null;
  g.clearRect(0, 0, N, N);
  const rnd = makeRng(style === 'silver' ? 0x51c3 : 0xa71c);

  // Fine spectral grid
  g.strokeStyle = pal.soft;
  g.lineWidth = 0.6;
  g.beginPath();
  for (let i = 0; i <= 8; i++) {
    const x = (i / 8) * N;
    g.moveTo(x, 0); g.lineTo(x, N);
    g.moveTo(0, x); g.lineTo(N, x);
  }
  g.stroke();

  // Sparse diagonal filigree
  g.strokeStyle = pal.line;
  g.lineWidth = 0.7;
  g.beginPath();
  for (let k = 0; k < 8; k++) {
    const x0 = rnd() * N;
    const y0 = rnd() * N;
    g.moveTo(x0, y0);
    g.quadraticCurveTo(
      (x0 + rnd() * 40 - 10 + N) % N,
      (y0 + rnd() * 40 - 10 + N) % N,
      (x0 + rnd() * 60 - 20 + N) % N,
      (y0 + rnd() * 60 - 20 + N) % N,
    );
  }
  g.stroke();

  // Faint ghost silhouettes (simple hooded blobs as stroke outlines)
  g.strokeStyle = pal.accent;
  g.lineWidth = 0.9;
  for (let n = 0; n < 5; n++) {
    const cx = 20 + rnd() * (N - 40);
    const cy = 24 + rnd() * (N - 48);
    const hw = 10 + rnd() * 8;
    const hh = 16 + rnd() * 10;
    g.beginPath();
    g.moveTo(cx - hw, cy + hh * 0.55);
    g.lineTo(cx - hw, cy);
    g.quadraticCurveTo(cx - hw, cy - hh * 0.55, cx, cy - hh * 0.55);
    g.quadraticCurveTo(cx + hw, cy - hh * 0.55, cx + hw, cy);
    g.lineTo(cx + hw, cy + hh * 0.55);
    // scalloped hem
    for (let s = 0; s < 3; s++) {
      const x1 = cx + hw - (s + 1) * ((2 * hw) / 3);
      g.quadraticCurveTo(x1 + hw / 3, cy + hh * 0.7, x1, cy + hh * 0.55);
    }
    g.stroke();
    // eyes
    g.beginPath();
    g.arc(cx - hw * 0.35, cy - hh * 0.05, 1.2, 0, Math.PI * 2);
    g.arc(cx + hw * 0.35, cy - hh * 0.05, 1.2, 0, Math.PI * 2);
    g.stroke();
  }

  // A few wisps
  g.strokeStyle = pal.soft;
  g.lineWidth = 0.55;
  g.beginPath();
  for (let w = 0; w < 4; w++) {
    const x = rnd() * N;
    const y = rnd() * N;
    g.moveTo(x, y);
    g.bezierCurveTo(x + 12, y - 18, x + 28, y + 10, x + 40, y - 8);
  }
  g.stroke();

  tileCache.set(style, c);
  return c;
}

/** Test helper: drop cached tiles. */
export function clearGutterHauntCache() {
  tileCache.clear();
}

/**
 * Tile a pattern into a clipped axis-aligned rect (screen space).
 * @param {CanvasRenderingContext2D} ctx
 * @param {OffscreenCanvas|HTMLCanvasElement} tile
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} ox  scroll offset
 * @param {number} oy
 */
function fillRectWithTile(ctx, tile, x, y, w, h, ox, oy) {
  if (!(w > 0) || !(h > 0)) return;
  const tw = GUTTER_TILE;
  const th = GUTTER_TILE;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const x0 = x - ((ox % tw) + tw) % tw;
  const y0 = y - ((oy % th) + th) % th;
  for (let yy = y0; yy < y + h; yy += th) {
    for (let xx = x0; xx < x + w; xx += tw) {
      ctx.drawImage(tile, xx, yy, tw, th);
    }
  }
  ctx.restore();
}

/**
 * Draw faint gutter haunt in the four letterbox margins. Never paints the
 * arena interior (left..right × top..bottom).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{
 *   vpW: number, vpH: number,
 *   left: number, right: number, top: number, bottom: number,
 *   style?: GutterHauntStyle,
 *   tMs?: number,
 *   alpha?: number,
 * }} o
 */
export function drawGutterHaunt(ctx, o) {
  const style = o.style ?? 'silver';
  if (style === 'off') return;
  const vpW = o.vpW | 0;
  const vpH = o.vpH | 0;
  if (!(vpW > 0) || !(vpH > 0)) return;
  const left = Number(o.left);
  const right = Number(o.right);
  const top = Number(o.top);
  const bottom = Number(o.bottom);
  if (![left, right, top, bottom].every(Number.isFinite)) return;
  if (!(right > left) || !(bottom > top)) return;

  const tile = getGutterHauntTile(style);
  if (!tile) return;

  const alpha = Number.isFinite(o.alpha) ? o.alpha : GUTTER_HAUNT_ALPHA;
  // Very slow drift (~6 px / 10 s)
  const t = Number(o.tMs) || 0;
  const ox = (t * 0.0006) % GUTTER_TILE;
  const oy = (t * 0.0004) % GUTTER_TILE;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(0.08, alpha)); // hard cap ~8%
  // Top letterbox
  fillRectWithTile(ctx, tile, 0, 0, vpW, top, ox, oy);
  // Bottom letterbox
  fillRectWithTile(ctx, tile, 0, bottom, vpW, vpH - bottom, ox, oy);
  // Left gutter (between top and bottom so we don't double-draw corners)
  fillRectWithTile(ctx, tile, 0, top, left, bottom - top, ox, oy);
  // Right gutter
  fillRectWithTile(ctx, tile, right, top, vpW - right, bottom - top, ox, oy);
  ctx.restore();
}
