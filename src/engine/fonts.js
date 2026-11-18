/**
 * src/engine/fonts.js — wait for the self-hosted CRT faces before canvas text.
 *
 * Canvas text does not re-render when a web font arrives, so the arena waits
 * for these faces (declared with @font-face in index.html, font-display: swap
 * for the DOM). The wait is capped so a slow network never blocks play.
 */

/** Faces canvas text uses (see ctx.font across src/). */
export const CANVAS_FONTS = Object.freeze([
  '20px "VT323"',
  '16px "Share Tech Mono"',
  'bold 16px "Share Tech Mono"',
]);

export const FONT_WAIT_MS = 2500;

let ready = null;

/**
 * Resolve once the canvas faces are loaded, or after `timeoutMs`, whichever is
 * first. Never rejects. Cached: call as often as you like.
 * @param {Document} [doc]
 * @returns {Promise<boolean>} true if the fonts loaded in time
 */
export function loadGameFonts(doc = globalThis.document, timeoutMs = FONT_WAIT_MS) {
  if (ready) return ready;
  const fonts = doc && doc.fonts;
  if (!fonts || typeof fonts.load !== 'function') {
    ready = Promise.resolve(false);
    return ready;
  }
  const all = Promise.all(CANVAS_FONTS.map(f => fonts.load(f)))
    .then(() => fonts.ready)
    .then(() => true, () => false);
  const cap = new Promise(res => setTimeout(() => res(false), timeoutMs));
  ready = Promise.race([all, cap]);
  return ready;
}

/** Test hook. */
export function _resetFontsForTests() { ready = null; }
