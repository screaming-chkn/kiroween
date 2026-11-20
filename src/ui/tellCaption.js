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
export function drawTellCaption(ctx, text, pos) {
  if (!text) return;
  const scale = pos.scale > 0 ? pos.scale : 1;
  ctx.save();
  // E4: slightly larger + stroke for phone/desk readability (HUD floors still OK).
  ctx.font = `700 ${Math.round(18 * scale)}px "Share Tech Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.lineWidth = 4 * scale;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0A0D0B';
  ctx.strokeText(text, pos.x, pos.y);
  ctx.fillStyle = '#FF3B5C';
  ctx.fillText(text, pos.x, pos.y);
  ctx.restore();
}
