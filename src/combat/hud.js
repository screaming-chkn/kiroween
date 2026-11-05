/**
 * src/combat/hud.js
 *
 * Pure helpers for the R9 fixed combat HUD (bottom-left, screen space).
 *
 * No DOM, Canvas, or timing access — every function takes plain data and
 * returns plain data, so they are directly unit-testable with Node's assert.
 *
 * The renderer (combatRenderer.drawFixedHUD) consumes these helpers so the
 * number/label formatting lives in exactly one place.
 *
 * Accessibility (accessibility.md):
 *   - HUD numbers are tabular (monospace, zero-padded where it helps the eye)
 *     so values don't jitter as digits change.
 *   - POWER reads as text ("OK" / "STUTTER"), never colour alone (rule 6);
 *     the ember colour is only an extra cue layered on the STUTTER word.
 */

// ── formatHudStat ──────────────────────────────────────────────────────────────

/**
 * Format a current/maximum pair as a tabular `cur/max` string for the HUD.
 *
 * Rules:
 *   - Non-finite or negative `value` clamps to 0.
 *   - `value` is clamped to the `[0, max]` range (HP/EN never show above full
 *     or below empty) and rounded up so "1 HP left" never shows as "0".
 *   - Non-finite or negative `max` clamps to 0.
 *
 * @param {number} value  Current amount (e.g. hp).
 * @param {number} max    Maximum amount (e.g. maxHp).
 * @returns {string}      e.g. "300/300", "7/300", "0/0".
 */
export function formatHudStat(value, max) {
  const safeMax = Number.isFinite(max) && max > 0 ? Math.round(max) : 0;
  const safeVal = Number.isFinite(value) && value > 0 ? value : 0;
  const clamped = Math.min(safeMax, Math.ceil(safeVal));
  return `${clamped}/${safeMax}`;
}

// ── powerStateLabel ─────────────────────────────────────────────────────────────

/**
 * Map a power balance (powerOut − powerDraw) to a HUD POWER label.
 *
 * A non-negative balance means the core supplies at least as much energy as
 * the loadout draws → "OK". A negative balance is an Overdraw condition that
 * makes the mech stutter → "STUTTER".
 *
 * Non-finite input is treated as 0 (OK) so a missing balance never shows a
 * false fault.
 *
 * @param {number} balance  powerOut − powerDraw.
 * @returns {'OK'|'STUTTER'}
 */
export function powerStateLabel(balance) {
  const safe = Number.isFinite(balance) ? balance : 0;
  return safe < 0 ? 'STUTTER' : 'OK';
}

// ── isPowerStutter ──────────────────────────────────────────────────────────────

/**
 * Boolean form of {@link powerStateLabel} — true when the HUD should draw the
 * POWER tag in ember (Overdraw / STUTTER).
 *
 * @param {number} balance
 * @returns {boolean}
 */
export function isPowerStutter(balance) {
  return powerStateLabel(balance) === 'STUTTER';
}

// ── cooldownReadyFraction ───────────────────────────────────────────────────────

/**
 * Fraction (0–1) of the weapon cooldown ring that should be filled, where
 * 1 means the weapon is fully ready to fire and 0 means it just fired.
 *
 * @param {number} fireCooldown  Milliseconds remaining until the weapon is
 *                               ready (0 = ready). Clamped to `[0, cooldownMs]`.
 * @param {number} cooldownMs    Total cooldown duration in milliseconds.
 * @returns {number}             Ready fraction in `[0, 1]`. Returns 1 when
 *                               `cooldownMs` is not a positive number.
 */
export function cooldownReadyFraction(fireCooldown, cooldownMs) {
  if (!Number.isFinite(cooldownMs) || cooldownMs <= 0) return 1;
  const remaining = Number.isFinite(fireCooldown) && fireCooldown > 0 ? fireCooldown : 0;
  const clamped = Math.min(cooldownMs, remaining);
  return 1 - clamped / cooldownMs;
}

// ── Overdraw stutter (R12) ──────────────────────────────────────────────────────

/**
 * Pulse frequency for the Overdraw POWER tag, in hertz.
 *
 * Accessibility (accessibility.md rule 4): no content flashes more than
 * 3 times/second, and our flicker cap is 2. A full ember pulse is one bright
 * peak per cycle, so the cycle rate IS the flash rate — capped here at 2 Hz.
 */
export const POWER_PULSE_HZ = 2;

/**
 * Ember-pulse opacity in [0, 1] for the Overdraw POWER tag.
 *
 * WHEN the build is overdrawn (R12) THEN the POWER tag pulses ember at
 * `hz` cycles/second. This returns a smooth cosine pulse so there is exactly
 * one bright peak per cycle (never a hard strobe): 1 at the peak, 0 at the
 * trough. `hz` is clamped to at most {@link POWER_PULSE_HZ} (2 Hz) so the
 * flicker cap can never be exceeded, even if a caller passes a larger value.
 *
 * Pure: the current time is passed in (ms), so the pulse is directly testable
 * without a clock.
 *
 * @param {number} nowMs  Current time in milliseconds (e.g. state.elapsedMs).
 * @param {number} [hz=POWER_PULSE_HZ]  Pulse rate; clamped to (0, POWER_PULSE_HZ].
 * @returns {number}  Pulse opacity in [0, 1].
 */
export function powerPulseAlpha(nowMs, hz = POWER_PULSE_HZ) {
  const t = Number.isFinite(nowMs) && nowMs > 0 ? nowMs : 0;
  const rate = Number.isFinite(hz) && hz > 0 ? Math.min(hz, POWER_PULSE_HZ) : POWER_PULSE_HZ;
  // cos maps one cycle per 1/rate seconds; remap from [-1, 1] to [0, 1].
  const phase = (t / 1000) * rate * 2 * Math.PI;
  return (1 - Math.cos(phase)) / 2;
}

/** Number of discrete steps the cooldown ring snaps to while stuttering. */
export const STUTTER_RING_STEPS = 4;

/**
 * Cooldown-ring fill fraction with Overdraw stutter applied (R12).
 *
 * WHEN overdrawn THEN the ring SHALL "visibly skip" rather than fill smoothly:
 * the ready fraction is quantised to {@link STUTTER_RING_STEPS} discrete steps
 * so it jumps in visible increments on stuttered shots. When not stuttering the
 * fraction passes through unchanged (smooth fill).
 *
 * @param {number}  readyFraction  Smooth ready fraction in [0, 1]
 *                                  (from {@link cooldownReadyFraction}).
 * @param {boolean} stutter        True when the build is overdrawn.
 * @param {number}  [steps=STUTTER_RING_STEPS]  Quantisation steps (≥ 1).
 * @returns {number}  Ring fill fraction in [0, 1].
 */
export function stutterRingFraction(readyFraction, stutter, steps = STUTTER_RING_STEPS) {
  const f = Number.isFinite(readyFraction) ? Math.min(1, Math.max(0, readyFraction)) : 0;
  if (!stutter) return f;
  const n = Number.isFinite(steps) && steps >= 1 ? Math.floor(steps) : STUTTER_RING_STEPS;
  // Snap down to the nearest step boundary so the ring lurches between fills.
  return Math.floor(f * n) / n;
}
