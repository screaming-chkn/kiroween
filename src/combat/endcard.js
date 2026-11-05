/**
 * src/combat/endcard.js
 *
 * Pure text helpers for the R8 end card (VICTORY / DESTROYED panel).
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
 * Big title for the given end phase.
 *
 * @param {'win'|'lose'|string} phase
 * @returns {string}  'VICTORY' on win, 'DESTROYED' otherwise.
 */
export function titleText(phase) {
  return phase === 'win' ? 'VICTORY' : 'DESTROYED';
}

/**
 * Optional subtitle for the given end phase.
 *
 * @param {'win'|'lose'|string} phase
 * @returns {string}  'MISSION COMPLETE' on win, 'MISSION FAILED' otherwise.
 */
export function subtitleText(phase) {
  return phase === 'win' ? 'MISSION COMPLETE' : 'MISSION FAILED';
}

/**
 * One-line cause describing how the round ended.
 *
 * @param {'win'|'lose'|string} phase
 * @returns {string}
 */
export function causeText(phase) {
  return phase === 'win'
    ? 'Enemy mech disabled.'
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
 * @returns {{
 *   isWin: boolean,
 *   title: string,
 *   subtitle: string,
 *   cause: string,
 *   timeLine: string,
 * }}
 */
export function endCardText(phase, elapsedMs) {
  return {
    isWin:    phase === 'win',
    title:    titleText(phase),
    subtitle: subtitleText(phase),
    cause:    causeText(phase),
    timeLine: timeSurvivedLine(elapsedMs),
  };
}
