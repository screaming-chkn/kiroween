/**
 * src/ui/tellCaption.js — one-time "dodge the tell" caption (playtest fix #2).
 *
 * Shows once per browser: prefer fight-start so the teach lands BEFORE the
 * first enemy shot (cold-play E1). Windup edge remains a fallback. Key is
 * versioned (`hh-tell-caption-seen-v3`) so a retune can re-teach once without
 * wiping other progress; for a cold pass, clear that key or use a fresh origin.
 * No animation (reduced-motion safe): the line just appears, holds and goes.
 */

export const TELL_CAPTION_KEY = 'hh-tell-caption-seen-v3';
export const TELL_CAPTION_MS = 5000;

/** Grace before the enemy may start a windup on a fresh duel (teach window). */
export const TEACH_FIRE_GRACE_MS = 2500;

/** Caption text for the current controls (SHIFT on desktop, DASH button on touch). */
export function tellCaptionText(touchUi) {
  return touchUi
    ? 'RED RING = INCOMING SHOT - TAP DASH NOW'
    : 'RED RING = INCOMING SHOT - SHIFT TO DASH NOW';
}

function defaultStore() {
  try {
    return typeof localStorage !== 'undefined' && localStorage ? localStorage : null;
  } catch (_) {
    return null;
  }
}

/**
 * @param {{ storage?: Storage|null, touchUi?: boolean }} [opts]
 * @returns {{ onFightStart(nowMs:number): boolean, onWindup(nowMs:number): boolean, current(nowMs:number): string }}
 */
export function createTellCaption({ storage = defaultStore(), touchUi = false } = {}) {
  let shownAtMs = null;
  const seen = () => {
    try { return storage ? storage.getItem(TELL_CAPTION_KEY) === '1' : false; } catch (_) { return false; }
  };
  const show = (nowMs) => {
    if (shownAtMs !== null || seen()) return false;
    shownAtMs = nowMs;
    try { storage?.setItem(TELL_CAPTION_KEY, '1'); } catch (_) { /* show once this match only */ }
    return true;
  };
  return {
    /** Call at duel start so the teach appears before the first enemy shot. */
    onFightStart(nowMs) {
      return show(nowMs);
    },
    /** Call on each windup edge (fallback if fight-start was skipped). */
    onWindup(nowMs) {
      return show(nowMs);
    },
    /** Text to draw now, or '' when hidden. */
    current(nowMs) {
      if (shownAtMs === null || nowMs - shownAtMs >= TELL_CAPTION_MS) return '';
      return tellCaptionText(touchUi);
    },
  };
}

/**
 * Centered line in screen space.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {{x:number,y:number,scale?:number}} pos  x = center, y = top
 */
/** Base CSS-px size of the teach caption at scale 1. Shrinks only to fit maxWidth. */
export const TELL_CAPTION_FONT_PX = 22;
export const TELL_CAPTION_MIN_PX = 14;
export const TELL_CAPTION_FILL = '#FF6B82';
export const TELL_CAPTION_STROKE = '#050706';

export function drawTellCaption(ctx, text, pos) {
  if (!text) return;
  const scale = pos.scale > 0 ? pos.scale : 1;
  let px = Math.round(TELL_CAPTION_FONT_PX * scale);
  ctx.save();
  ctx.font = `700 ${px}px "Share Tech Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  if (typeof ctx.measureText === 'function' && pos.maxWidth > 0) {
    const w = ctx.measureText(text).width;
    if (w > pos.maxWidth) {
      px = Math.max(Math.round(TELL_CAPTION_MIN_PX * scale), Math.floor(px * pos.maxWidth / w));
      ctx.font = `700 ${px}px "Share Tech Mono", monospace`;
    }
  }
  const width = typeof ctx.measureText === 'function' ? ctx.measureText(text).width : 0;
  if (width > 0 && typeof ctx.fillRect === 'function') {
    const padX = 12 * scale;
    const padY = 7 * scale;
    const x = pos.x - width / 2 - padX;
    const y = pos.y - padY;
    const w = width + padX * 2;
    const h = px + padY * 2;
    ctx.fillStyle = 'rgba(5,7,6,0.88)';
    if (typeof ctx.roundRect === 'function' && typeof ctx.beginPath === 'function') {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 4 * scale);
      ctx.fill();
    } else {
      ctx.fillRect(x, y, w, h);
    }
  }
  // Dark plate + thicker stroke + brighter red: readable on phone and desk.
  // Grows downward from y (baseline top), so it does not crowd meters above.
  ctx.lineWidth = 5 * scale;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = TELL_CAPTION_STROKE;
  ctx.strokeText(text, pos.x, pos.y);
  ctx.fillStyle = TELL_CAPTION_FILL;
  ctx.fillText(text, pos.x, pos.y);
  ctx.restore();
}
