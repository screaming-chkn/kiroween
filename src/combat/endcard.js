/**
 * src/combat/endcard.js
 *
 * Pure text helpers for the end card (EXORCISED / POSSESSED / LAID TO REST,
 * spec 11-haunt-words; was VICTORY / DESTROYED).
 *
 * No DOM, Canvas, or timing access — every function takes plain data and
 * returns plain data, so they are directly unit-testable with Node's assert.
 *
 * The renderer (combatRenderer.drawOverlay) and the wiring (main.js) consume
 * these helpers so copy lives in exactly one place.
 *
 * Copy follows ui-style.md: short, in-world, plain English; "SI" never "AI".
 */

// ── formatTimeSurvived ────────────────────────────────────────────────────────

/**
 * Format an elapsed-time value (milliseconds) as `M:SS`.
 *
 * Rules:
 *   - Negative, NaN, or non-finite input is clamped to 0 → "0:00".
 *   - Milliseconds are floored to whole seconds (partial seconds drop).
 *   - Seconds are always zero-padded to two digits; minutes are not padded.
 *
 * @param {number} ms  Elapsed time in milliseconds.
 * @returns {string}   e.g. "0:00", "0:07", "1:05", "12:30".
 */
export function formatTimeSurvived(ms) {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// ── Phase → text helpers ──────────────────────────────────────────────────────

/**
 * True for a win fought at the top HAUNT LV (LAID TO REST case).
 * With missing/non-numeric options it is false (plain win).
 *
 * @param {'win'|'lose'|string} phase
 * @param {{level?:number, maxLevel?:number}} [opts]
 */
function isMaxWin(phase, opts) {
  const { level, maxLevel } = opts ?? {};
  return phase === 'win'
    && Number.isFinite(level) && Number.isFinite(maxLevel)
    && level >= maxLevel;
}

/**
 * Big title for the given end phase.
 *
 * @param {'win'|'lose'|string} phase
 * @param {{level?:number, maxLevel?:number}} [opts]  HAUNT LV fought at, and the cap.
 * @returns {string}  'EXORCISED', 'LAID TO REST' (max-level win) or 'POSSESSED'.
 */
export function titleText(phase, opts) {
  if (phase !== 'win') return 'POSSESSED';
  return isMaxWin(phase, opts) ? 'LAID TO REST' : 'EXORCISED';
}

/**
 * Subtitle for the given end phase.
 *
 * @param {'win'|'lose'|string} phase
 * @param {{level?:number, maxLevel?:number}} [opts]
 * @returns {string}
 */
export function subtitleText(phase, opts) {
  if (phase !== 'win') return 'Your mech joins the haunt.';
  return isMaxWin(phase, opts)
    ? 'Nothing left to haunt. Yet.'
    : 'The haunt retreats... for now.';
}

/**
 * One-line cause describing how the round ended.
 *
 * @param {'win'|'lose'|string} phase
 * @param {{level?:number, maxLevel?:number}} [_opts]  Accepted for symmetry; the cause does not vary by level.
 * @returns {string}
 */
export function causeText(phase, _opts) {
  return phase === 'win'
    ? 'Spirit banished.'
    : 'Your mech was destroyed.';
}

/**
 * Label for the "time survived" stat line, combining the stat and its value.
 *
 * @param {number} elapsedMs
 * @returns {string}  e.g. "Time survived  1:05"
 */
export function timeSurvivedLine(elapsedMs) {
  return `Time survived  ${formatTimeSurvived(elapsedMs)}`;
}

/**
 * Build the complete set of end-card strings for a phase + elapsed time.
 * Convenience aggregator used by the renderer so it never branches on phase.
 *
 * @param {'win'|'lose'|string} phase
 * @param {number} elapsedMs
 * @param {{level?:number, maxLevel?:number}} [opts]
 * @returns {{
 *   isWin: boolean,
 *   title: string,
 *   subtitle: string,
 *   cause: string,
 *   timeLine: string,
 * }}
 */
export function endCardText(phase, elapsedMs, opts) {
  return {
    isWin:    phase === 'win',
    title:    titleText(phase, opts),
    subtitle: subtitleText(phase, opts),
    cause:    causeText(phase, opts),
    timeLine: timeSurvivedLine(elapsedMs),
  };
}
