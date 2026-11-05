/**
 * src/ui/possession.js — HAUNT//HOUND possession theme toggle.
 *
 * Two CSS custom-property sets live side by side:
 *
 *   • STERILE_TOKENS  — the "unpossessed" sterile military palette. Flat,
 *     cold, no phosphor glow. This is what the terminal looks like before the
 *     séance wakes anything up.
 *   • POSSESSED_TOKENS — the existing haunted CRT palette (phosphor / bone /
 *     ghost from design-tokens.md). Applied when something is listening.
 *
 * Possession is an INSTANT class swap on <html> (documentElement):
 *   - add    `.possessed`  → haunted palette
 *   - remove `.possessed`  → sterile palette
 *
 * MVP scope (11/5 cuts): NO static burst, NO 1.2 s wipe animation — a plain,
 * reduced-motion-safe class toggle. The actual token values are declared in CSS
 * (injected by `injectPossessionCSS`), so a themed component just reads
 * `var(--color-*)` and re-paints when the class flips.
 *
 * The token maps are exported as plain data so tests can assert the two sets
 * differ without a DOM. `applyPossessed` is guarded so it is a safe no-op when
 * `document` is undefined (plain-Node test environment).
 *
 * ES modules only; no dependencies.
 */

/** CSS class toggled on <html> to enter the haunted palette. */
export const POSSESSED_CLASS = 'possessed';

/**
 * Sterile military palette (unpossessed). Cold greys + a muted signal green;
 * no phosphor glow. Values are self-contained so the toggle is a pure reskin.
 */
export const STERILE_TOKENS = {
  '--color-void':         '#0B0E10',
  '--color-panel':        '#161B1F',
  '--color-phosphor':     '#B8C4C0', // sterile: readouts are cold grey-green
  '--color-phosphor-dim': '#6E7A77',
  '--color-bone':         '#D7DBDC',
  '--color-ghost':        '#7FA6BF',
  '--color-ember':        '#C8792E', // focus ring stays warm + visible
};

/**
 * Possessed palette (haunted CRT) — the existing design-tokens.md values.
 */
export const POSSESSED_TOKENS = {
  '--color-void':         '#0A0D0B',
  '--color-panel':        '#121A15',
  '--color-phosphor':     '#39FF88',
  '--color-phosphor-dim': '#1F9E57',
  '--color-bone':         '#E8E2D0',
  '--color-ghost':        '#9FD8FF',
  '--color-ember':        '#FF8A3D',
};

/**
 * Apply or remove the possessed class on the document root.
 *
 * PURE-ish: returns the resulting boolean possessed state. When `document` is
 * unavailable (Node tests), it is a safe no-op that still echoes the requested
 * state so callers/tests can reason about intent.
 *
 * @param {boolean} possessed
 * @param {Document|undefined} [doc]  Injectable for tests; defaults to global `document`.
 * @returns {boolean} the applied possessed state.
 */
export function applyPossessed(possessed, doc = (typeof document !== 'undefined' ? document : undefined)) {
  const on = Boolean(possessed);
  if (doc && doc.documentElement && doc.documentElement.classList) {
    doc.documentElement.classList.toggle(POSSESSED_CLASS, on);
  }
  return on;
}

/**
 * Convenience wrapper: set the possession state (true = haunted, false =
 * sterile). Thin alias over `applyPossessed` for readable call sites.
 *
 * @param {boolean} possessed
 * @returns {boolean}
 */
export function setPossessed(possessed) {
  return applyPossessed(possessed);
}

/**
 * Report whether the document is currently possessed.
 *
 * @param {Document|undefined} [doc]
 * @returns {boolean}
 */
export function isPossessed(doc = (typeof document !== 'undefined' ? document : undefined)) {
  if (doc && doc.documentElement && doc.documentElement.classList) {
    return doc.documentElement.classList.contains(POSSESSED_CLASS);
  }
  return false;
}

/**
 * Build the CSS text that declares both palettes:
 *   :root            → sterile (default, unpossessed)
 *   :root.possessed  → haunted
 *
 * Instant toggle only — no transition on the custom properties (MVP: no wipe).
 *
 * @returns {string}
 */
export function possessionCSS() {
  const decls = (tokens) =>
    Object.entries(tokens)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n');

  return [
    '/* possession palettes — instant class swap, no wipe/burst (MVP) */',
    ':root {',
    decls(STERILE_TOKENS),
    '}',
    `:root.${POSSESSED_CLASS} {`,
    decls(POSSESSED_TOKENS),
    '}',
  ].join('\n');
}

/** Stylesheet id so the palette CSS is injected at most once. */
const STYLE_ID = 'hh-possession-css';

/**
 * Inject the possession palette CSS into <head> once. Safe no-op without a DOM.
 */
export function injectPossessionCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = possessionCSS();
  document.head.appendChild(style);
}
