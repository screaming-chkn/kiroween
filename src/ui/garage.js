/**
 * src/ui/garage.js
 *
 * Garage overlay — slot list-picker for building a mech.
 *
 * Usage:
 *   import { mountGarage } from './ui/garage.js';
 *
 *   mountGarage(document.getElementById('app'), {
 *     onDeploy(loadout, totals) { startMatch(loadout); }
 *   });
 *
 * ## Structure
 *   - Six slot rows (Legs, Core, Arm L, Arm R, Back, Head).
 *   - Clicking / Enter on a slot opens a part-picker panel listing compatible
 *     parts with stat deltas vs the currently equipped part.
 *   - Keyboard: Tab moves between slots, Enter opens picker, Arrow Up/Down move
 *     through parts, Enter equips, Esc closes picker.
 *   - Footer: weight load%, power balance, role tag, Deploy button.
 *   - Deploy is disabled (with "Too heavy to walk." message) when load% > 115.
 *   - Build is auto-saved to localStorage on every change and restored on mount.
 *
 * ## Accessibility (accessibility.md)
 *   - All interactive elements ≥ 32px tall.
 *   - Visible focus ring: 2px ember outline (token: #FF8A3D).
 *   - Proper ARIA: role="listbox", role="option", aria-selected, aria-expanded,
 *     aria-live region for status changes.
 *   - Labels exposed via aria-label on icon-only elements.
 *   - Stat bars use aria-valuenow / aria-valuemin / aria-valuemax.
 *   - Color is never the sole signal (stat delta uses +/− prefix too).
 *
 * ## Design tokens used (design-tokens.md)
 *   Colors: void, panel, phosphor, phosphor-dim, bone, ash, ember, blood, ghost
 *   Fonts: VT323, Share Tech Mono, IBM Plex Mono, Rajdhani 600
 *   Spacing: 4px base grid
 *   Motion: fast 120ms, ease-out; honors prefers-reduced-motion
 *
 * Pure ES module — no external dependencies.
 */

import { PARTS, PARTS_BY_ID } from '../data/parts.js';
import { defaultLoadout }      from '../data/presets.js';
import { equip, totals }       from '../mech/loadout.js';
import { canDeploy }           from '../mech/weight.js';
import { roleTag, roleTooltip } from '../mech/role.js';
import { effectTokensFor }     from '../combat/loadoutEffects.js';
import { silhouetteSpec }       from '../mech/silhouette.js';

/**
 * Empty-picker hint, aware of the stacked (phone) layout.
 * @param {boolean} stacked  True when slots are above the picker.
 * @returns {string}
 */
export function pickerEmptyHint(stacked) {
  return stacked ? 'Select a slot above.' : 'Select a slot on the left.';
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LS_KEY = 'hh_loadout_v1';

const SLOT_LABELS = {
  legs: 'Legs',
  core: 'Core',
  armL: 'Arm L',
  armR: 'Arm R',
  back: 'Back',
  head: 'Head',
};

const STAT_KEYS = /** @type {const} */ (['armor', 'speed', 'damage', 'sensor']);

const STAT_LABELS = {
  armor:  'Armor',
  speed:  'Speed',
  damage: 'Damage',
  sensor: 'Sensor',
};

// Unique 3-letter codes for compact stat chips (R8). Full-word labels collide
// on their first letter (Speed/Sensor both start "S"), so chips use these
// distinct codes instead of a single initial.
const STAT_CODES = {
  armor:  'ARM',
  speed:  'SPD',
  damage: 'DMG',
  sensor: 'SEN',
};

const RANGE_SLOTS = ['legs', 'core', 'armL', 'armR', 'back', 'head'];

/**
 * Min/max total of each stat across every possible loadout. Slots are
 * independent, so min/max is the sum of each slot's smallest/largest value.
 * A slot with no parts contributes 0.
 * @param {Array} [parts]
 * @returns {{armor:{min:number,max:number},speed:{min:number,max:number},damage:{min:number,max:number},sensor:{min:number,max:number}}}
 */
export function statRanges(parts = PARTS) {
  const out = {};
  for (const key of STAT_KEYS) {
    let min = 0;
    let max = 0;
    for (const slot of RANGE_SLOTS) {
      const vals = parts.filter(p => p.slot === slot).map(p => p.stats?.[key] ?? 0);
      if (vals.length === 0) continue;
      min += Math.min(...vals);
      max += Math.max(...vals);
    }
    out[key] = { min, max };
  }
  return out;
}

const STAT_RANGES = statRanges();

/**
 * Bar width percent for a stat total. Lowest possible total shows a 10% stub.
 * @param {number} value
 * @param {{min:number,max:number}} range
 * @returns {number}
 */
export function statBarPct(value, range) {
  if (range.max <= range.min) return 100;
  const t = Math.min(1, Math.max(0, (value - range.min) / (range.max - range.min)));
  return 10 + 90 * t;
}

// ── localStorage helpers ──────────────────────────────────────────────────────

/**
 * Load saved loadout or fall back to preset.
 * @returns {Object}
 */
function loadSaved() {
  try {
    const raw = globalThis.localStorage?.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Validate: all slots must be present and ids must exist in parts data.
      const slots = Object.keys(SLOT_LABELS);
      const valid = slots.every(s => parsed[s] && PARTS_BY_ID[parsed[s]]);
      if (valid) return parsed;
    }
  } catch (_) {
    // Corrupt save — ignore and fall through to preset.
  }
  return defaultLoadout();
}

/** Last saved loadout, or the default one. */
export function loadSavedLoadout() {
  return loadSaved();
}

/**
 * Plan for a title-screen quick deploy.
 * @returns {{ loadout: Object, totals: Object, deployable: boolean }}
 */
export function quickDeployPlan() {
  const loadout = loadSavedLoadout();
  const t = totals(loadout, PARTS_BY_ID);
  return { loadout, totals: t, deployable: canDeploy(t.loadPct) };
}

/**
 * Persist the current loadout.
 * @param {Object} loadout
 */
function saveLoadout(loadout) {
  try {
    globalThis.localStorage?.setItem(LS_KEY, JSON.stringify(loadout));
  } catch (_) {
    // Storage quota or private-browsing restriction — silently skip.
  }
}

// ── CSS injected once ─────────────────────────────────────────────────────────

/**
 * Garage stylesheet. Exported as a plain string so layout rules (R10 and
 * friends) can be asserted under Node without a DOM.
 * @type {string}
 */
export const GARAGE_CSS = `
/* ── Garage overlay ─────────────────────────────────── */

.hh-garage {
  position: fixed;
  inset: 0;
  background: var(--color-void, #0A0D0B);   /* void — flips on possession */
  color: var(--color-bone, #E8E2D0);        /* bone text — flips on possession */
  font-family: 'IBM Plex Mono', 'Courier New', monospace;
  font-size: 14px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  overflow: hidden;
  z-index: 100;
}

/* header */
.hh-garage__header {
  padding: 16px 24px 8px;
  border-bottom: 1px solid var(--color-phosphor-dim, #1F9E57); /* flips on possession */
  display: flex;
  align-items: baseline;
  gap: 16px;
}
.hh-garage__title {
  font-family: 'VT323', monospace;
  font-size: 28px;
  color: var(--color-phosphor, #39FF88); /* phosphor accent — flips on possession */
  letter-spacing: 0.05em;
  margin: 0;
}
.hh-garage__subtitle {
  font-family: 'Share Tech Mono', monospace;
  font-size: 14px;
  color: #8F9A92; /* ash */
}

/* body — columns.
   Default (<960px): two columns (slots | part list); the preview + stats
   column wraps to a full-width third row.
   R10 ≥960px (was 1280px; M7 #4 for 1024x640): three columns
   slots | part list | mech preview + stats. */
.hh-garage__body {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 1fr;
  grid-template-areas:
    "slots picker"
    "preview preview";
  gap: 0;
  overflow: hidden;
}
.hh-garage__slots  { grid-area: slots; }
.hh-picker         { grid-area: picker; }
.hh-preview        { grid-area: preview; }

@media (min-width: 960px) {
  .hh-garage__body {
    grid-template-columns: minmax(220px, 1fr) 1.3fr minmax(300px, 1fr);
    grid-template-areas: "slots picker preview";
  }
}

/* Dark, thin scrollbars everywhere in the garage (M7 #4). */
.hh-garage, .hh-garage * {
  scrollbar-color: var(--color-phosphor-dim, #1F9E57) var(--color-void, #0A0D0B);
  scrollbar-width: thin;
}
.hh-garage { color-scheme: dark; }
.hh-garage ::-webkit-scrollbar { width: 8px; height: 8px; }
.hh-garage ::-webkit-scrollbar-track { background: var(--color-void, #0A0D0B); }
.hh-garage ::-webkit-scrollbar-thumb { background: var(--color-phosphor-dim, #1F9E57); border-radius: 4px; }


/* slot list (left) */
.hh-garage__slots {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  border-right: 1px solid var(--color-panel, #121A15); /* flips on possession */
}

/* individual slot row */
.hh-slot {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  min-height: 48px;
  border: 1px solid transparent;
  cursor: pointer;
  border-radius: 2px;
  transition: background 120ms ease-out, border-color 120ms ease-out;
  background: var(--color-panel, #121A15); /* flips on possession */
}
.hh-slot:hover,
.hh-slot:focus {
  background: #1a2a1f;
  border-color: var(--color-phosphor-dim, #1F9E57); /* flips on possession */
  outline: none;
}
.hh-slot:focus {
  outline: 2px solid var(--color-ember, #FF8A3D); /* ember — accessibility focus ring */
  outline-offset: 1px;
}
.hh-slot[aria-expanded="true"] {
  border-color: var(--color-phosphor, #39FF88); /* flips on possession */
}
.hh-slot__label {
  font-family: 'Share Tech Mono', monospace;
  font-size: 14px;
  color: #8F9A92; /* ash */
  min-width: 48px;
}
.hh-slot__name {
  font-family: 'Rajdhani', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: var(--color-bone, #E8E2D0); /* bone — flips on possession */
  flex: 1;
}
.hh-slot__caret {
  color: #8F9A92; /* ash */
  font-size: 12px;
  transition: transform 120ms ease-out;
}
.hh-slot[aria-expanded="true"] .hh-slot__caret {
  transform: rotate(180deg);
}

/* part picker panel (right) */
.hh-picker {
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hh-picker__heading {
  font-family: 'Share Tech Mono', monospace;
  font-size: 13px;
  color: #8F9A92; /* ash */
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 4px;
}
.hh-picker__empty {
  color: #8F9A92;
  font-style: italic;
  padding: 16px 0;
}

/* preview + stats column (third column at ≥960px — R10) */
.hh-preview {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  border-left: 1px solid var(--color-panel, #121A15); /* flips on possession */
}
.hh-preview__art {
  /* M4.7: never shrink. .hh-preview is a flex column; below 960px it sits in
     a short grid row, so default flex-shrink squeezed this box to its 120px
     min-height while the SVG kept its 220px height and spilled out of it.
     Holding the box at its content size lets .hh-preview scroll instead. */
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  border: 1px solid var(--color-phosphor-dim, #1F9E57); /* flips on possession */
  border-radius: 2px;
  background: var(--color-panel, #121A15);              /* flips on possession */
  padding: 8px;
}

/* top-down mech silhouette (SVG) — reflects equipped parts.
   Present slots use bone fill + phosphor stroke; empty slots are dimmed so
   absence reads by shape/opacity, never by colour alone (a11y rule 6). */
.hh-preview__svg {
  width: 100%;
  height: auto;
  max-height: 220px;
  display: block;
}
.hh-sil__part {
  fill: var(--color-bone, #E8E2D0);        /* bone — flips on possession */
  stroke: var(--color-phosphor, #39FF88);  /* phosphor stroke — flips on possession */
  stroke-width: 1.5;
}
.hh-sil__part--empty {
  fill: var(--color-panel, #121A15);            /* panel — flips on possession */
  stroke: var(--color-phosphor-dim, #1F9E57);   /* phosphor-dim — flips on possession */
  stroke-width: 1.5;
  stroke-dasharray: 3 3;           /* dashed outline = empty, shape-based cue */
  opacity: 0.6;
}
.hh-sil__edge { fill: none; stroke: var(--color-phosphor, #39FF88); stroke-width: 1; opacity: 0.8; pointer-events: none; }
.hh-sil__label {
  fill: #B9C2BA;                   /* empty slot: light on dark */
  font-family: 'Share Tech Mono', monospace;
  font-size: 8px;
  letter-spacing: 0.04em;
}
.hh-sil__label--present { fill: var(--color-void, #0A0D0B); font-weight: bold; }  /* dark on light part */

/* part option */
.hh-option {
  padding: 10px 12px;
  border: 1px solid #121A15;
  background: #121A15; /* panel */
  cursor: pointer;
  border-radius: 2px;
  min-height: 48px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: background 120ms ease-out, border-color 120ms ease-out;
}
.hh-option:hover {
  background: #1a2a1f;
  border-color: var(--color-bone, #E8E2D0); /* bone — R10 part hover border, flips on possession */
  outline: none;
}
.hh-option:focus {
  background: #1a2a1f;
  outline: 2px solid var(--color-ember, #FF8A3D);
  outline-offset: 1px;
}
.hh-option[aria-selected="true"] {
  border-color: var(--color-phosphor, #39FF88); /* flips on possession */
  background: #0e1f14;
}
.hh-option__name {
  font-family: 'Rajdhani', sans-serif;
  font-weight: 600;
  font-size: 15px;
  color: #E8E2D0;
}
.hh-option__flavor {
  font-size: 14px;        /* R8: body text ≥14px, non-italic */
  line-height: 1.35;
  color: #B9C2BA;         /* lighter ash — ≥4.5:1 on panel */
}
.hh-option__effect {
  /* M4.6: fixed phosphor, like .hh-delta--up. var(--color-phosphor) is a
     possession slot that the sterile (unpossessed) garage palette repaints
     steel grey (#C3CBD2), so the COMBAT line read grey outside the séance. */
  font-family: 'Share Tech Mono', monospace;
  font-size: 14px;        /* accessibility: text ≥14px */
  line-height: 1.5;
  color: #39FF88;         /* phosphor (design-tokens.md) — ≥4.5:1 on panel */
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 10px;
  max-width: 44ch;        /* keeps tokens from running into one long desktop line */
  margin-top: 2px;
}
.hh-option__effect-label {
  opacity: 0.85;          /* label, not data; still ≥4.5:1 on every option background */
  letter-spacing: 0.06em;
}
.hh-option__effect-token {
  white-space: nowrap;    /* each effect stays on one line; tokens wrap as units */
  max-width: 100%;
  overflow-wrap: anywhere;
}
.hh-option__meta {
  font-family: 'Share Tech Mono', monospace;
  font-size: 14px;        /* R8: tonnage/draw ≥14px, non-italic */
  font-variant-numeric: tabular-nums;
  color: #B9C2BA;         /* ≥4.5:1 on panel */
}
.hh-option__deltas {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: baseline;
  margin-top: 2px;
}
.hh-option__delta-caption {
  font-family: 'Share Tech Mono', monospace;
  font-size: 14px;        /* R8: label ≥14px, non-italic */
  color: #B9C2BA;         /* ≥4.5:1 on panel */
  margin-right: 4px;
}
.hh-delta {
  font-family: 'Share Tech Mono', monospace;
  font-size: 14px;        /* R8: readable ≥14px */
  font-variant-numeric: tabular-nums;
  padding: 1px 4px;
  border-radius: 1px;
}
.hh-delta--up   { color: #39FF88; }   /* phosphor — stat improvement */
.hh-delta--down { color: #FF4D5E; }   /* blood — stat decrease */
.hh-delta--same { color: #8F9A92; }   /* ash — no change */

/* hex marker */
.hh-option__hex {
  font-size: 11px;
  color: #FF8A3D;   /* ember */
  font-family: 'Share Tech Mono', monospace;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* footer — stats + deploy */
.hh-garage__footer {
  padding: 12px 24px;
  border-top: 1px solid var(--color-phosphor-dim, #1F9E57); /* flips on possession */
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  align-items: center;
}
.hh-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hh-summary__row {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  align-items: center;
}
.hh-stat-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 120px;
}
.hh-stat__label {
  font-family: 'Share Tech Mono', monospace;
  font-size: 11px;
  color: #8F9A92;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.hh-stat__value {
  font-family: 'Share Tech Mono', monospace;
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  color: #E8E2D0;
}
.hh-stat__value--warn  { color: #FF8A3D; } /* ember */
.hh-stat__value--error { color: #FF4D5E; } /* blood */

/* aggregate stat bars */
.hh-bars {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.hh-bar-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.hh-bar-group__label {
  font-family: 'Share Tech Mono', monospace;
  font-size: 12px;        /* R10: ≥12px bar labels */
  color: #8F9A92;
  text-transform: uppercase;
}
.hh-bar-track {
  height: 12px;           /* R10: stat bars ≥12px tall */
  background: #1F1F1F;
  border-radius: 1px;
  overflow: hidden;
}
.hh-bar-fill {
  height: 100%;
  background: var(--color-phosphor, #39FF88); /* flips on possession */
  border-radius: 1px;
  transition: width 120ms ease-out;
}

/* role tag pill */
.hh-role {
  font-family: 'VT323', monospace;
  font-size: 20px;
  color: var(--color-ghost, #9FD8FF); /* ghost — flips on possession */
  letter-spacing: 0.1em;
}
.hh-role--null { color: #8F9A92; }

/* deploy button */
.hh-deploy {
  font-family: 'VT323', monospace;
  font-size: 24px;
  color: var(--color-void, #0A0D0B);
  background: var(--color-phosphor, #39FF88); /* phosphor accent — flips on possession */
  border: none;
  padding: 8px 24px;
  min-height: 48px;
  cursor: pointer;
  border-radius: 2px;
  letter-spacing: 0.08em;
  transition: background 120ms ease-out, opacity 120ms ease-out;
}
.hh-deploy:hover:not(:disabled) {
  background: #5fffaa;
}
.hh-deploy:focus {
  outline: 2px solid var(--color-ember, #FF8A3D);
  outline-offset: 2px;
}
.hh-deploy:disabled {
  background: var(--color-phosphor-dim, #1F9E57); /* flips on possession */
  color: var(--color-void, #0A0D0B);
  opacity: 0.5;
  cursor: not-allowed;
}

/* séance button — secondary action, sits to the left of the deploy column */
.hh-seance-btn {
  margin-right: auto;            /* push to the far left of the flex-end footer */
  font-family: 'VT323', monospace;
  font-size: 22px;
  color: var(--color-ghost, #9FD8FF);                /* ghost — flips on possession */
  background: transparent;
  border: 1px solid var(--color-ghost, #9FD8FF);
  padding: 6px 20px;
  min-height: 48px;
  cursor: pointer;
  border-radius: 2px;
  letter-spacing: 0.08em;
  transition: background 120ms ease-out, color 120ms ease-out;
}
.hh-seance-btn:hover {
  background: var(--color-panel, #121A15);           /* flips on possession */
  color: var(--color-bone, #E8E2D0);                 /* flips on possession */
}
.hh-seance-btn:focus {
  outline: 2px solid var(--color-ember, #FF8A3D);    /* ember */
  outline-offset: 2px;
}

/* deploy column — button + stutter confirm line (R8) */
.hh-deploy-col {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}
.hh-deploy-confirm {
  font-family: 'Share Tech Mono', monospace;
  font-size: 14px;            /* R8: ≥14px, non-italic */
  color: #FF8A3D;             /* ember — ≥4.5:1 on void */
  text-align: right;
  max-width: 240px;
}
.hh-deploy-confirm[hidden] { display: none; }

/* overdraw / blocked notice — height reserved so the footer never jumps (R10) */
.hh-notice {
  font-family: 'Share Tech Mono', monospace;
  font-size: 13px;
  line-height: 1.4;
  min-height: 1.4em;   /* reserve one line even when empty */
  margin-top: 4px;
}
.hh-notice--overdraw { color: #FF8A3D; }   /* ember */
.hh-notice--blocked  { color: #FF4D5E; }   /* blood */
.hh-notice--placeholder { color: transparent; }

/* live region for screen readers */
.hh-sr-status {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* reduced motion — skip width transitions */
/* Short landscape screens (1024x640 and similar): compact rows and a smaller
   preview so all six slots and the stats fit with no inner scrolling (M7 #4). */
@media (min-width: 701px) and (max-height: 760px) {
  .hh-garage__header { padding: 10px 24px 6px; }
  .hh-garage__slots, .hh-picker, .hh-preview { padding: 10px 12px; }
  .hh-preview { gap: 10px; }
  .hh-slot { min-height: 40px; padding: 6px 10px; }
  .hh-preview__art { min-height: 0; padding: 4px; }
  .hh-preview__svg { max-height: 150px; }
}

@media (prefers-reduced-motion: reduce) {
  .hh-bar-fill,
  .hh-slot,
  .hh-option,
  .hh-deploy { transition: none; }
  .hh-slot__caret { transition: none; }
}

/* ── Phone (≤700px, e.g. 390×844): single column, scrollable ───────────── */
@media (max-width: 700px) {
  .hh-garage {
    display: flex;
    flex-direction: column;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    max-width: 100%;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
  .hh-garage__header {
    flex: 0 0 auto;
    flex-wrap: wrap;
    gap: 4px 12px;
    padding: 12px 16px 8px;
  }
  .hh-garage__body {
    flex: 1 1 auto;
    min-height: 0;
    grid-template-columns: 1fr;
    grid-template-areas:
      "slots"
      "picker"
      "preview";
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    max-width: 100%;
  }
  .hh-garage__slots,
  .hh-picker,
  .hh-preview {
    overflow: visible;
    max-width: 100%;
    padding: 12px 16px;
    border-left: none;
    border-right: none;
  }
  .hh-slot,
  .hh-option,
  .hh-deploy,
  .hh-seance-btn {
    min-height: 44px;
    max-width: 100%;
  }
  .hh-garage__footer {
    flex: 0 0 auto;
    position: sticky;
    bottom: 0;
    background: var(--color-void, #0A0D0B);   /* opaque, matches .hh-garage */
    border-top: 1px solid var(--color-phosphor-dim, #1F9E57);
    flex-wrap: wrap;
    justify-content: space-between;
    padding: 12px 16px calc(max(16px, env(safe-area-inset-bottom)) + 12px);
    max-width: 100%;
  }
  .hh-deploy-col { align-items: stretch; }
  .hh-summary__row { gap: 12px; }
  .hh-stat-block { min-width: 0; }
}
`;

let _cssInjected = false;

function injectCSS() {
  if (_cssInjected) return;
  _cssInjected = true;

  const style = document.createElement('style');
  style.textContent = GARAGE_CSS;
  document.head.appendChild(style);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Compute aggregate stats (sum) for a loadout.
 * @param {Object} loadout
 * @returns {{ armor: number, speed: number, damage: number, sensor: number }}
 */
function aggregateStats(loadout) {
  const out = { armor: 0, speed: 0, damage: 0, sensor: 0 };
  for (const id of Object.values(loadout)) {
    if (id == null) continue;
    const part = PARTS_BY_ID[id];
    if (!part) continue;
    for (const k of STAT_KEYS) out[k] += part.stats[k] ?? 0;
  }
  return out;
}

/**
 * Format a stat delta with leading sign.
 * @param {number} delta
 * @returns {{ text: string, cls: string }}
 */
export function formatDelta(delta) {
  if (delta > 0)  return { text: `+${delta}`, cls: 'hh-delta--up' };
  if (delta < 0)  return { text: `${delta}`,  cls: 'hh-delta--down' };
  return           { text: `±0`,               cls: 'hh-delta--same' };
}

/**
 * Build the compact chip text for a stat delta, e.g. "SPD +2" (R8).
 * Uses a unique 3-letter code so no two stats share a label.
 * @param {keyof typeof STAT_CODES} key
 * @param {number} delta
 * @returns {string}
 */
export function statChipLabel(key, delta) {
  return `${STAT_CODES[key]} ${formatDelta(delta).text}`;
}

/**
 * Fire-rate penalty for an overdrawn build, as a whole-number percent (R4/R8).
 *
 * When power draw exceeds output, weapons stutter: in-match fire rate is scaled
 * by output/draw (R4), so the displayed reduction is (1 − output/draw) × 100.
 * Returns 0 when the build is not overdrawn (balance ≥ 0) or when draw is 0.
 *
 * Bounded to [0, 100] and rounded to the nearest whole percent for the
 * "Overdrawn: fire rate -X%" readout.
 *
 * @param {number} powerOut   - total core output
 * @param {number} powerDraw  - total draw from weapons/sensors
 * @returns {number}          - penalty percent in [0, 100]
 */
export function overdrawPenaltyPct(powerOut, powerDraw) {
  // Not overdrawn (or no draw at all) → no stutter.
  if (powerDraw <= 0) return 0;
  if (powerOut >= powerDraw) return 0;

  const scale = Math.max(0, powerOut) / powerDraw; // output/draw, clamped ≥ 0
  const pct = (1 - scale) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

/**
 * Create a DOM element with optional class and attributes.
 * @param {string} tag
 * @param {{ [k: string]: string }} [attrs]
 * @returns {HTMLElement}
 */
function el(tag, attrs = {}) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    node.setAttribute(k, v);
  }
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Create an SVG element with attributes (SVG needs its own namespace). */
function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    node.setAttribute(k, String(v));
  }
  return node;
}

/**
 * Layout of each silhouette part in the 100×140 viewBox (top-down view).
 * `label` is the short slot code drawn beside/over the shape.
 * Order matters: back is drawn first (behind the core), head last (on top).
 */
const SIL_SHAPES = [
  { slot: 'back', label: 'BCK', shape: 'rect', attrs: { x: 34, y: 8,  width: 32, height: 20, rx: 3 },  lx: 50, ly: 21 },
  { slot: 'armL', label: 'L',   shape: 'rect', attrs: { x: 6,  y: 52, width: 20, height: 44, rx: 4 },  lx: 16, ly: 76 },
  { slot: 'armR', label: 'R',   shape: 'rect', attrs: { x: 74, y: 52, width: 20, height: 44, rx: 4 },  lx: 84, ly: 76 },
  { slot: 'core', label: 'CORE',shape: 'rect', attrs: { x: 32, y: 48, width: 36, height: 44, rx: 4 },  lx: 50, ly: 72 },
  { slot: 'legs', label: 'LEGS',shape: 'rect', attrs: { x: 30, y: 96, width: 40, height: 36, rx: 4 },  lx: 50, ly: 116 },
  { slot: 'head', label: 'HD',  shape: 'circle', attrs: { cx: 50, cy: 40, r: 11 },                     lx: 50, ly: 42 },
];

/**
 * Build a top-down SVG silhouette <svg> node from a silhouette spec.
 * Present slots render solid (bone/phosphor); empty slots render dashed/dim.
 * Each shape carries a <title> and visible short label so slots read by shape
 * and text, never colour alone (a11y rule 6).
 *
 * @param {ReturnType<typeof silhouetteSpec>} spec
 * @returns {SVGElement}
 */
function buildSilhouette(spec) {
  const svg = svgEl('svg', {
    class: 'hh-preview__svg',
    viewBox: '0 0 100 140',
    role: 'img',
  });

  const present = SIL_SHAPES.filter(s => spec[s.slot]?.present).map(s => s.slot);
  svg.setAttribute('aria-label',
    present.length
      ? `Mech silhouette — equipped: ${present.join(', ')}`
      : 'Mech silhouette — no parts equipped');

  for (const def of SIL_SHAPES) {
    const info = spec[def.slot] ?? { present: false, name: null };
    const cls = info.present ? 'hh-sil__part' : 'hh-sil__part hh-sil__part--empty';
    const shape = svgEl(def.shape, { ...def.attrs, class: cls });
    const title = svgEl('title');
    title.textContent = info.present
      ? `${SLOT_LABELS[def.slot]}: ${info.name}`
      : `${SLOT_LABELS[def.slot]}: empty`;
    shape.append(title);
    svg.append(shape);

    // Wireframe depth: same rect offset (+4,-4) plus 4 joining corner lines.
    if (info.present && def.shape === 'rect') {
      const { x, y, width: w, height: h } = def.attrs;
      const o = 4;
      const edge = svgEl('path', {
        class: 'hh-sil__edge',
        'aria-hidden': 'true',
        d: `M${x + o} ${y - o}h${w}v${h}h${-w}z` +
           `M${x} ${y}L${x + o} ${y - o}` +
           `M${x + w} ${y}L${x + w + o} ${y - o}` +
           `M${x + w} ${y + h}L${x + w + o} ${y + h - o}` +
           `M${x} ${y + h}L${x + o} ${y + h - o}`,
      });
      svg.append(edge);
    }

    const label = svgEl('text', {
      x: def.lx, y: def.ly,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      class: info.present ? 'hh-sil__label hh-sil__label--present' : 'hh-sil__label',
      'aria-hidden': 'true',
    });
    label.textContent = def.label;
    svg.append(label);
  }

  return svg;
}

// ── Mount ─────────────────────────────────────────────────────────────────────

/**
 * Mount the Garage overlay into `root`.
 *
 * @param {HTMLElement} root
 * @param {{ onDeploy: (loadout: Object, totals: Object) => void }} options
 */
export function mountGarage(root, { onDeploy, onSeance } = {}) {
  injectCSS();

  // ── State ──────────────────────────────────────────────────────────────────

  let loadout      = loadSaved();
  let activeSlot   = null;   // which slot picker is open
  let deployConfirmPending = false; // R8: stutter confirm armed on overdrawn Deploy

  // ── Scaffold ───────────────────────────────────────────────────────────────

  const overlay = el('div', { class: 'hh-garage', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Garage — build your mech' });

  // Header
  const header = el('div', { class: 'hh-garage__header' });
  const titleEl = el('h1', { class: 'hh-garage__title' });
  titleEl.textContent = 'GARAGE';
  const subtitleEl = el('p', { class: 'hh-garage__subtitle' });
  subtitleEl.textContent = 'Select a slot to swap parts';
  header.append(titleEl, subtitleEl);

  // Body
  const body = el('div', { class: 'hh-garage__body' });

  // Slot list
  const slotList = el('div', { class: 'hh-garage__slots', role: 'group', 'aria-label': 'Mech slots' });

  // Picker panel
  const pickerPanel = el('div', { class: 'hh-picker', role: 'region', 'aria-label': 'Part picker', 'aria-live': 'polite' });

  // Preview + stats column (third column at ≥960px — R10).
  const previewCol = el('div', { class: 'hh-preview', role: 'region', 'aria-label': 'Mech preview and stats' });
  const previewArt = el('div', { class: 'hh-preview__art' });
  const summary = el('div', { class: 'hh-summary', 'aria-live': 'polite', 'aria-atomic': 'true' });
  previewCol.append(previewArt, summary);

  body.append(slotList, pickerPanel, previewCol);

  // Footer
  const footer = el('div', { class: 'hh-garage__footer' });
  const deployCol = el('div', { class: 'hh-deploy-col' });
  const deployBtn = el('button', { class: 'hh-deploy', type: 'button', 'aria-label': 'Deploy mech' });
  deployBtn.textContent = 'DEPLOY';
  // Confirm line shown when Deploy is pressed on an overdrawn build (R8).
  // Deploy stays allowed — a second press proceeds.
  const deployConfirm = el('div', { class: 'hh-deploy-confirm', role: 'alert', hidden: '' });
  deployCol.append(deployBtn, deployConfirm);

  // SÉANCE — opens the build-ledger terminal (and possesses the page).
  const seanceBtn = el('button', { class: 'hh-seance-btn', type: 'button', 'aria-label': 'Open séance terminal' });
  seanceBtn.textContent = 'SÉANCE';
  seanceBtn.addEventListener('click', () => {
    if (typeof onSeance === 'function') onSeance();
  });

  footer.append(seanceBtn, deployCol);

  // SR live region
  const srStatus = el('div', { class: 'hh-sr-status', role: 'status', 'aria-live': 'polite' });

  overlay.append(header, body, footer, srStatus);
  root.append(overlay);

  // ── Slot rows (built once, updated in place) ───────────────────────────────

  /** @type {Map<string, HTMLElement>} slot key → row element */
  const slotRows = new Map();

  for (const slotKey of Object.keys(SLOT_LABELS)) {
    const row = el('div', {
      class: 'hh-slot',
      tabindex: '0',
      role: 'button',
      'aria-expanded': 'false',
      'aria-label': `${SLOT_LABELS[slotKey]} — empty — press Enter to pick a part`,
      'data-slot': slotKey,
    });

    const labelSpan = el('span', { class: 'hh-slot__label', 'aria-hidden': 'true' });
    labelSpan.textContent = SLOT_LABELS[slotKey];

    const nameSpan = el('span', { class: 'hh-slot__name' });
    const caret    = el('span', { class: 'hh-slot__caret', 'aria-hidden': 'true' });
    caret.textContent = '▾';

    row.append(labelSpan, nameSpan, caret);
    slotList.append(row);
    slotRows.set(slotKey, row);

    row.addEventListener('click',   () => togglePicker(slotKey));
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePicker(slotKey); }
      if (e.key === 'Escape') closePicker();
    });
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  /** Update a single slot row's displayed part name. */
  function refreshSlotRow(slotKey) {
    const row      = slotRows.get(slotKey);
    const nameSpan = row.querySelector('.hh-slot__name');
    const partId   = loadout[slotKey];
    const part     = partId ? PARTS_BY_ID[partId] : null;
    nameSpan.textContent = part ? part.name : '— empty —';
    row.setAttribute('aria-expanded', activeSlot === slotKey ? 'true' : 'false');
    // aria-label MUST start with the visible slot label text (accessibility
    // rule 5 / label-in-name), e.g. "Legs — Runner Legs — press Enter…".
    row.setAttribute('aria-label',
      `${SLOT_LABELS[slotKey]} — ${part ? part.name : 'empty'} — press Enter to pick a part`);
  }

  /** Rebuild the top-down mech silhouette from the current loadout. */
  function refreshPreview(nextLoadout = loadout) {
    const spec = silhouetteSpec(nextLoadout, PARTS_BY_ID);
    previewArt.innerHTML = '';
    previewArt.append(buildSilhouette(spec));
  }

  /** Rebuild the footer summary (weight, power, role, stat bars). */
  function refreshSummary() {
    const t = totals(loadout, PARTS_BY_ID);
    const role = roleTag(loadout, PARTS_BY_ID);
    const aggStats = aggregateStats(loadout);
    const deployable = canDeploy(t.loadPct);

    summary.innerHTML = '';

    // Row 1: weight / power / role
    const row1 = el('div', { class: 'hh-summary__row' });

    // Weight
    const wBlock = el('div', { class: 'hh-stat-block' });
    const wLabel = el('div', { class: 'hh-stat__label' }); wLabel.textContent = 'Load';
    const wVal   = el('div', {
      class: `hh-stat__value${t.loadPct > 115 ? ' hh-stat__value--error' : t.loadPct > 80 ? ' hh-stat__value--warn' : ''}`,
      'aria-label': `Load ${t.loadPct.toFixed(0)}%`,
    });
    wVal.textContent = `${t.loadPct.toFixed(0)}%  (${t.weight}/${t.capacity} cap from LEGS)`;
    wBlock.append(wLabel, wVal);

    // Power
    const pBlock = el('div', { class: 'hh-stat-block' });
    const pLabel = el('div', { class: 'hh-stat__label' }); pLabel.textContent = 'Power';
    const pVal   = el('div', {
      class: `hh-stat__value${t.balance < 0 ? ' hh-stat__value--error' : ''}`,
      'aria-label': `Power balance ${t.balance >= 0 ? '+' : ''}${t.balance}`,
    });
    pVal.textContent = `${t.balance >= 0 ? '+' : ''}${t.balance}  (${t.powerOut} out / ${t.powerDraw} draw)`;
    pBlock.append(pLabel, pVal);

    // Role tag
    const rBlock = el('div', { class: 'hh-stat-block' });
    const rLabel = el('div', { class: 'hh-stat__label' }); rLabel.textContent = 'Role';
    const rVal   = el('div', { class: `hh-role${role ? '' : ' hh-role--null'}` });
    rVal.textContent = role ?? '—';
    // R9: one-line tooltip naming the parts that set the role (e.g.
    // "Role from: Back + Legs"). Exposed via title (pointer hover) and
    // aria-label (screen readers) so it is never pointer-only.
    const roleTip = roleTooltip(loadout, PARTS_BY_ID);
    if (roleTip) {
      rVal.setAttribute('title', roleTip);
      rVal.setAttribute('aria-label', `Role ${role} — ${roleTip}`);
    }
    rBlock.append(rLabel, rVal);

    row1.append(wBlock, pBlock, rBlock);
    summary.append(row1);

    // Notices. The line is always present (empty when the build is fine) so its
    // reserved height keeps the footer from jumping when a warning appears (R10).
    if (!deployable) {
      const notice = el('div', { class: 'hh-notice hh-notice--blocked', role: 'alert' });
      notice.textContent = 'Too heavy to walk.';
      summary.append(notice);
    } else if (t.balance < 0) {
      const pct = overdrawPenaltyPct(t.powerOut, t.powerDraw);
      const notice = el('div', { class: 'hh-notice hh-notice--overdraw' });
      notice.textContent = `Overdrawn: fire rate -${pct}%`;
      summary.append(notice);
    } else {
      // Placeholder keeps the reserved line height; aria-hidden so SR skips it.
      const notice = el('div', { class: 'hh-notice hh-notice--placeholder', 'aria-hidden': 'true' });
      notice.textContent = '';
      summary.append(notice);
    }

    // Row 2: aggregate stat bars
    const barsRow = el('div', { class: 'hh-bars', 'aria-label': 'Aggregate stats' });
    for (const key of STAT_KEYS) {
      const val = aggStats[key];
      const range = STAT_RANGES[key];
      const pct = statBarPct(val, range);

      const grp   = el('div', { class: 'hh-bar-group' });
      const lbl   = el('div', { class: 'hh-bar-group__label', 'aria-hidden': 'true' });
      lbl.textContent = STAT_LABELS[key];
      const track = el('div', { class: 'hh-bar-track' });
      const fill  = el('div', {
        class: 'hh-bar-fill',
        role: 'progressbar',
        'aria-label': STAT_LABELS[key],
        'aria-valuenow': String(val),
        'aria-valuemin': String(range.min),
        'aria-valuemax': String(range.max),
      });
      fill.style.width = `${pct}%`;
      track.append(fill);
      grp.append(lbl, track);
      barsRow.append(grp);
    }
    summary.append(barsRow);

    // Update deploy button
    deployBtn.disabled = !deployable;
    deployBtn.setAttribute('aria-disabled', deployable ? 'false' : 'true');
    deployBtn.setAttribute('title', deployable ? 'Deploy mech to match' : 'Too heavy to walk.');
  }

  /** Rebuild the picker panel for `slotKey`. */
  function renderPicker(slotKey) {
    pickerPanel.innerHTML = '';

    const heading = el('div', { class: 'hh-picker__heading' });
    heading.textContent = `${SLOT_LABELS[slotKey]} — choose a part`;
    pickerPanel.append(heading);

    const compatible = PARTS.filter(p => p.slot === slotKey);
    if (compatible.length === 0) {
      const empty = el('div', { class: 'hh-picker__empty' });
      empty.textContent = 'No parts available.';
      pickerPanel.append(empty);
      return;
    }

    const equippedId   = loadout[slotKey];
    const equippedPart = equippedId ? PARTS_BY_ID[equippedId] : null;

    // Build options list with keyboard listbox semantics.
    const listbox = el('div', { role: 'listbox', 'aria-label': `${SLOT_LABELS[slotKey]} parts`, 'aria-orientation': 'vertical' });

    for (const part of compatible) {
      const isSelected = part.id === equippedId;
      const optEl = el('div', {
        role: 'option',
        tabindex: isSelected ? '0' : '-1',
        class: 'hh-option',
        'aria-selected': isSelected ? 'true' : 'false',
        'data-part-id': part.id,
      });

      // Part name
      const nameEl = el('div', { class: 'hh-option__name' });
      nameEl.textContent = part.name;

      // Hex marker (if cursed)
      if (part.hexId) {
        const hexEl = el('div', { class: 'hh-option__hex', 'aria-label': `Cursed: ${part.hexId}` });
        hexEl.textContent = `⚑ ${part.hexId}`;
        optEl.append(hexEl);
      }

      // Stat deltas vs currently equipped part
      const deltasEl = el('div', { class: 'hh-option__deltas', 'aria-label': 'Stat changes vs equipped' });
      const deltaCaption = el('span', { class: 'hh-option__delta-caption', 'aria-hidden': 'true' });
      deltaCaption.textContent = 'vs equipped';
      deltasEl.append(deltaCaption);
      for (const key of STAT_KEYS) {
        const newVal  = part.stats[key] ?? 0;
        const oldVal  = equippedPart ? (equippedPart.stats[key] ?? 0) : 0;
        const delta   = newVal - oldVal;
        const { cls } = formatDelta(delta);
        const label   = statChipLabel(key, delta);
        const chip = el('span', { class: `hh-delta ${cls}`, 'aria-label': `${STAT_LABELS[key]} ${formatDelta(delta).text} vs equipped` });
        chip.textContent = label;
        deltasEl.append(chip);
      }

      // Weight + power line
      const metaEl = el('div', { class: 'hh-option__meta' });
      const powerStr = part.powerOut != null
        ? `+${part.powerOut} out`
        : part.powerDraw != null
          ? `-${part.powerDraw} draw`
          : 'no power';
      metaEl.textContent = `${part.weight}t · ${powerStr}`;

      // Flavor
      const flavorEl = el('div', { class: 'hh-option__flavor' });
      flavorEl.textContent = part.flavor;

      optEl.append(nameEl, metaEl, deltasEl, flavorEl);
      // M4.5: one COMBAT line per arm/core part, only when the flag is on.
      // M4.6: shown as a label plus short wrapping tokens; full line kept for screen readers.
      const effect = effectTokensFor(part.id);
      if (effect) {
        const effectEl = el('div', { class: 'hh-option__effect', role: 'note', 'aria-label': effect.text });
        if (effect.label) {
          const labelEl = el('span', { class: 'hh-option__effect-label', 'aria-hidden': 'true' });
          labelEl.textContent = effect.label;
          effectEl.append(labelEl);
        }
        for (const tok of effect.tokens) {
          const tokEl = el('span', { class: 'hh-option__effect-token', 'aria-hidden': 'true' });
          tokEl.textContent = tok;
          effectEl.append(tokEl);
        }
        optEl.append(effectEl);
      }
      listbox.append(optEl);

      // Events
      optEl.addEventListener('click',   () => equipPart(slotKey, part));
      optEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); equipPart(slotKey, part); }
        if (e.key === 'Escape')    { closePicker(); slotRows.get(slotKey)?.focus(); }
        if (e.key === 'ArrowDown') { e.preventDefault(); focusOption(listbox, 1); }
        if (e.key === 'ArrowUp')   { e.preventDefault(); focusOption(listbox, -1); }
      });
    }

    pickerPanel.append(listbox);

    // Auto-focus the equipped option (or first option).
    const selectedOpt = listbox.querySelector('[aria-selected="true"]') ?? listbox.querySelector('[role="option"]');
    if (selectedOpt instanceof HTMLElement) selectedOpt.focus();
  }

  /** Move focus within a listbox by delta (+1 or -1). */
  function focusOption(listbox, delta) {
    const opts = Array.from(listbox.querySelectorAll('[role="option"]'));
    const idx  = opts.indexOf(document.activeElement);
    const next = (idx + delta + opts.length) % opts.length;
    if (opts[next] instanceof HTMLElement) opts[next].focus();
  }

  // ── Interactions ────────────────────────────────────────────────────────────

  function togglePicker(slotKey) {
    if (activeSlot === slotKey) {
      closePicker();
    } else {
      openPicker(slotKey);
    }
  }

  function openPicker(slotKey) {
    activeSlot = slotKey;
    // Update aria-expanded for all rows.
    for (const [key, row] of slotRows.entries()) {
      row.setAttribute('aria-expanded', key === slotKey ? 'true' : 'false');
    }
    renderPicker(slotKey);
    announce(`Showing parts for ${SLOT_LABELS[slotKey]}`);
  }

  function closePicker() {
    if (activeSlot) {
      slotRows.get(activeSlot)?.setAttribute('aria-expanded', 'false');
    }
    activeSlot = null;
    pickerPanel.innerHTML = '';
    const empty = el('div', { class: 'hh-picker__empty' });
    empty.textContent = pickerEmptyHint(
      typeof window !== 'undefined' &&
      window.matchMedia?.('(max-width: 700px)').matches === true,
    );
    pickerPanel.append(empty);
  }

  function equipPart(slotKey, part) {
    loadout = equip(loadout, part);
    saveLoadout(loadout);
    clearDeployConfirm();
    refreshSlotRow(slotKey);
    refreshSummary();
    refreshPreview();
    // Re-render picker so deltas + selection reflect new state.
    renderPicker(slotKey);
    announce(`Equipped ${part.name} in ${SLOT_LABELS[slotKey]}`);
  }

  /** Post a message to the ARIA live region. */
  function announce(msg) {
    srStatus.textContent = '';
    // Force a DOM re-read so screen readers notice the new text.
    requestAnimationFrame(() => { srStatus.textContent = msg; });
  }

  // ── Deploy ──────────────────────────────────────────────────────────────────

  deployBtn.addEventListener('click', () => {
    if (deployBtn.disabled) return;
    const t = totals(loadout, PARTS_BY_ID);

    // R8: overdrawn build must confirm before deploying (Deploy still allowed).
    // First press arms the confirm line; a second press proceeds.
    if (t.balance < 0 && !deployConfirmPending) {
      deployConfirmPending = true;
      deployConfirm.textContent = 'Weapons will stutter. Deploy anyway?';
      deployConfirm.hidden = false;
      announce('Weapons will stutter. Press Deploy again to deploy anyway.');
      return;
    }

    clearDeployConfirm();
    if (typeof onDeploy === 'function') {
      onDeploy({ ...loadout }, t);
    }
  });

  /** Hide and disarm the stutter confirm line. */
  function clearDeployConfirm() {
    deployConfirmPending = false;
    deployConfirm.hidden = true;
    deployConfirm.textContent = '';
  }

  // ── Initial render ─────────────────────────────────────────────────────────

  for (const slotKey of Object.keys(SLOT_LABELS)) {
    refreshSlotRow(slotKey);
  }
  refreshSummary();
  refreshPreview();
  closePicker(); // shows the "select a slot" prompt

  return {
    /** Programmatically update the loadout (e.g. after Salvage). */
    setLoadout(newLoadout) {
      loadout = { ...newLoadout };
      saveLoadout(loadout);
      clearDeployConfirm();
      for (const slotKey of Object.keys(SLOT_LABELS)) refreshSlotRow(slotKey);
      refreshSummary();
      refreshPreview();
      if (activeSlot) renderPicker(activeSlot);
    },
    /** Remove the overlay from the DOM. */
    destroy() {
      overlay.remove();
    },
  };
}
