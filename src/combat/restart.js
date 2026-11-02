/**
 * src/combat/restart.js
 *
 * Pure helper for the post-match restart guard (R6 — BUG 1 fix).
 *
 * Problem: when the player holds fire (LMB) at the moment the match ends, the
 * subsequent mouseup fires a synthetic "click" event on the canvas.  That
 * click is immediately picked up by the restart listener, skipping the
 * VICTORY/DESTROYED overlay entirely.
 *
 * Fix strategy:
 *   1. Grace period — ignore all restart input for RESTART_GRACE_MS after the
 *      phase leaves 'playing'.
 *   2. Stale-click guard — ignore any click whose mousedown started before
 *      the phase changed.
 *
 * This module contains only pure functions and constants; no DOM access.
 *
 * Exports:
 *   RESTART_GRACE_MS   — milliseconds to block restart input after phase end.
 *   canRestart(phaseEndedAtMs, nowMs, mouseDownAtMs) → boolean
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * How long (in ms) to ignore restart input after the phase leaves 'playing'.
 * Long enough that even a slow-releasing fire button cannot trigger restart.
 */
export const RESTART_GRACE_MS = 1000;

// ── canRestart ────────────────────────────────────────────────────────────────

/**
 * Determine whether a restart request should be honoured.
 *
 * Returns `true` only when ALL of these hold:
 *   1. The grace period has elapsed (`nowMs - phaseEndedAtMs >= RESTART_GRACE_MS`).
 *   2. The mousedown that preceded the input event happened *after* the phase
 *      ended (`mouseDownAtMs > phaseEndedAtMs`), OR `mouseDownAtMs` is null/0
 *      (i.e. a keyboard event — no stale-click risk).
 *
 * @param {number}        phaseEndedAtMs  - `performance.now()` when phase left 'playing'.
 *                                          Pass 0 (or -Infinity) if the phase has not ended.
 * @param {number}        nowMs           - Current `performance.now()`.
 * @param {number | null} mouseDownAtMs   - `performance.now()` of the most recent mousedown.
 *                                          Pass `null` for keyboard-triggered restarts.
 * @returns {boolean}
 */
export function canRestart(phaseEndedAtMs, nowMs, mouseDownAtMs) {
  // Phase hasn't ended yet — never restart while playing.
  if (phaseEndedAtMs <= 0) return false;

  // Grace period must have elapsed.
  if (nowMs - phaseEndedAtMs < RESTART_GRACE_MS) return false;

  // For click events: mousedown must have occurred AFTER phase ended.
  // (mouseDownAtMs === null means it's a keyboard event — always safe.)
  if (mouseDownAtMs !== null && mouseDownAtMs <= phaseEndedAtMs) return false;

  return true;
}
