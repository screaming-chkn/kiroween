/**
 * src/mech/weight.js
 *
 * Weight-curve functions for mech builds.
 *
 * Design — piecewise linear: (0,0) → (80,0) → (100,0.15) → (115,0.45)
 * Load% > 115 blocks deploy entirely.
 *
 * All functions take `loadPct` — a number in any range — and return a
 * pure value. No side-effects, no I/O; safe to property-test in Node.
 *
 * Exports:
 *   speedPenalty(loadPct)      → number  [0, 0.45], clamped at segment ends
 *   dashCooldownMult(loadPct)  → number  1.0 below 100, 2.0 at or above 100 (and ≤ 115)
 *   canDeploy(loadPct)         → boolean false when loadPct > 115
 */

// ── Curve constants ──────────────────────────────────────────────────────────

const SOFT_LOW   = 80;   // penalty-free ceiling
const SOFT_HIGH  = 100;  // end of 0→15% band
const HARD_HIGH  = 115;  // end of 15→45% band; above this deploy is blocked
const BLOCKED    = 115;  // alias for clarity in canDeploy

const PENALTY_AT_100 = 0.15;
const PENALTY_AT_115 = 0.45;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Linear interpolation between (x0,y0) and (x1,y1) at x.
 * @param {number} x
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @returns {number}
 */
function lerp(x, x0, y0, x1, y1) {
  const t = (x - x0) / (x1 - x0);
  return y0 + t * (y1 - y0);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Speed penalty as a fraction of base speed.
 *
 * Segments:
 *   loadPct ≤ 80          → 0
 *   80 < loadPct ≤ 100    → linear 0 → 0.15
 *   100 < loadPct ≤ 115   → linear 0.15 → 0.45
 *   loadPct > 115         → 0.45 (deploy is blocked, but the value is still defined)
 *
 * @param {number} loadPct
 * @returns {number}
 */
export function speedPenalty(loadPct) {
  if (loadPct <= SOFT_LOW) {
    return 0;
  }
  if (loadPct <= SOFT_HIGH) {
    return lerp(loadPct, SOFT_LOW, 0, SOFT_HIGH, PENALTY_AT_100);
  }
  if (loadPct <= HARD_HIGH) {
    return lerp(loadPct, SOFT_HIGH, PENALTY_AT_100, HARD_HIGH, PENALTY_AT_115);
  }
  // Above hard cap: value saturates at 0.45 (deploy blocked by canDeploy).
  return PENALTY_AT_115;
}

/**
 * Dash-cooldown multiplier.
 *
 * Returns 1.0 below the 100% threshold; doubles to 2.0 at 100% and above.
 * Above 115% the mech cannot deploy, but the multiplier value is still 2.0.
 *
 * @param {number} loadPct
 * @returns {number}
 */
export function dashCooldownMult(loadPct) {
  return loadPct > SOFT_HIGH ? 2.0 : 1.0;
}

/**
 * Whether the build is light enough to deploy.
 *
 * Returns false only when load% strictly exceeds 115, triggering
 * the "Too heavy to walk." message in the UI.
 *
 * @param {number} loadPct
 * @returns {boolean}
 */
export function canDeploy(loadPct) {
  return loadPct <= BLOCKED;
}
