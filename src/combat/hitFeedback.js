/**
 * src/combat/hitFeedback.js
 *
 * Pure helpers for R10 hit feedback:
 *   - an 80 ms white/ember flash on any mech that is hit;
 *   - a small floating damage number that rises and fades;
 *   - a 2–4 px screen kick when the player is hit, OFF under reduced motion
 *     (this also closes task 13 — the reduced-motion shake cap in combat).
 *
 * No DOM, Canvas, or timing access — every function takes plain data and a
 * `dt` (seconds) and returns plain data, so they are directly unit-testable
 * with Node's assert. The renderer (combatRenderer) and the arena loop
 * (arena.js / main.js) consume these helpers; all drawing lives elsewhere.
 *
 * Accessibility (accessibility.md):
 *   - The flash is a single 80 ms ramp, well under the 2 flashes/second cap
 *     (rule 4): one hit = one brief fade, never a strobe.
 *   - The kick is capped at KICK_MAX_PX (4 px) and forced to 0 when
 *     reduced motion is requested (rule 3 / R7), so motion-sensitive players
 *     get no screen displacement.
 */

// ── Flash ───────────────────────────────────────────────────────────────────

/** Flash duration in milliseconds (R10). */
export const FLASH_DURATION_MS = 80;

/**
 * Minimum gap between the START of two hit-flashes on the same mech (ms).
 *
 * R10 flicker fix: without a floor, rapid hits (e.g. an enemy burst) could
 * re-trigger createFlash every few ms and strobe the sprite, breaking the
 * ≤ 2 flashes/second cap (accessibility rule 4). We refuse a new flash if the
 * last one started less than FLASH_RETRIGGER_MS ago; the in-flight flash keeps
 * ramping and floating damage numbers still spawn on every hit.
 */
export const FLASH_RETRIGGER_MS = 500;

/**
 * Create a hit-flash timer.
 *
 * @param {number} [durationMs=FLASH_DURATION_MS]  Total flash lifetime in ms.
 * @param {number} [startedAtMs=0]                 Match-clock time the flash
 *                                                 started (ms); used by
 *                                                 {@link shouldCreateFlash} to
 *                                                 rate-limit re-triggers.
 * @returns {{ remainingMs: number, durationMs: number, startedAtMs: number }}
 */
export function createFlash(durationMs = FLASH_DURATION_MS, startedAtMs = 0) {
  const d = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : FLASH_DURATION_MS;
  const t = Number.isFinite(startedAtMs) ? startedAtMs : 0;
  return { remainingMs: d, durationMs: d, startedAtMs: t };
}

/**
 * Pure rate-limit test: may we start a NEW flash right now?
 *
 * Returns true when there is no existing flash, when the existing flash has no
 * recorded start time, or when at least FLASH_RETRIGGER_MS have elapsed since
 * the existing flash started. Returns false while we are still inside the
 * retrigger window, so a burst of hits produces at most one flash per window.
 *
 * @param {{ startedAtMs?: number } | null | undefined} existingFlash
 * @param {number} nowMs       Current match-clock time in ms.
 * @param {number} [retriggerMs=FLASH_RETRIGGER_MS]
 * @returns {boolean}
 */
export function shouldCreateFlash(existingFlash, nowMs, retriggerMs = FLASH_RETRIGGER_MS) {
  if (!existingFlash) return true;
  const started = existingFlash.startedAtMs;
  if (!Number.isFinite(started)) return true;
  const gap = Number.isFinite(retriggerMs) ? retriggerMs : FLASH_RETRIGGER_MS;
  const now = Number.isFinite(nowMs) ? nowMs : 0;
  return now - started >= gap;
}

/**
 * Pure helper that returns the flash to use after a hit at `nowMs`.
 *
 * WHEN a new flash is allowed (see {@link shouldCreateFlash}) THEN a fresh
 * full-duration flash stamped with `nowMs` is returned; OTHERWISE the existing
 * flash is returned unchanged (so it keeps ramping and is not re-triggered
 * within FLASH_RETRIGGER_MS — R10 flicker fix).
 *
 * @param {{ startedAtMs?: number } | null | undefined} existingFlash
 * @param {number} nowMs       Current match-clock time in ms.
 * @param {number} [retriggerMs=FLASH_RETRIGGER_MS]
 * @returns {{ remainingMs: number, durationMs: number, startedAtMs: number }}
 */
export function maybeCreateFlash(existingFlash, nowMs, retriggerMs = FLASH_RETRIGGER_MS) {
  if (shouldCreateFlash(existingFlash, nowMs, retriggerMs)) {
    return createFlash(FLASH_DURATION_MS, nowMs);
  }
  return existingFlash;
}

/**
 * Advance a flash timer by `dt` seconds. Returns a new timer (pure); never
 * drops below 0 remaining.
 *
 * @param {{ remainingMs: number, durationMs: number }} flash
 * @param {number} dt  Delta time in seconds.
 * @returns {{ remainingMs: number, durationMs: number }}
 */
export function stepFlash(flash, dt) {
  const dtMs = Number.isFinite(dt) && dt > 0 ? dt * 1000 : 0;
  return {
    ...flash,
    remainingMs: Math.max(0, flash.remainingMs - dtMs),
  };
}

/**
 * True while the flash still has time left.
 *
 * @param {{ remainingMs: number }} flash
 * @returns {boolean}
 */
export function flashActive(flash) {
  return !!flash && flash.remainingMs > 0;
}

/**
 * Flash intensity in [0, 1]: 1 at the instant of the hit, ramping linearly to
 * 0 as the timer expires. Used as the alpha of the white/ember overlay on the
 * mech sprite.
 *
 * @param {{ remainingMs: number, durationMs: number }} flash
 * @returns {number}
 */
export function flashIntensity(flash) {
  if (!flash || flash.durationMs <= 0) return 0;
  const t = flash.remainingMs / flash.durationMs;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

// ── Floating damage number ────────────────────────────────────────────────────

/** How long a floating damage number lives before fully fading (ms). */
export const FLOAT_LIFETIME_MS = 700;

/** How far a floating number rises over its lifetime (world units, upward). */
export const FLOAT_RISE = 36;

/**
 * Create a floating damage number anchored at a world position. It rises and
 * fades over FLOAT_LIFETIME_MS.
 *
 * @param {{ x: number, y: number, amount: number, lifetimeMs?: number, rise?: number }} cfg
 * @returns {{
 *   x: number, y: number, startY: number, amount: number,
 *   ageMs: number, lifetimeMs: number, rise: number, dead: boolean
 * }}
 */
export function createFloatingNumber({ x, y, amount, lifetimeMs = FLOAT_LIFETIME_MS, rise = FLOAT_RISE }) {
  const life = Number.isFinite(lifetimeMs) && lifetimeMs > 0 ? lifetimeMs : FLOAT_LIFETIME_MS;
  return {
    x,
    y,
    startY: y,
    amount,
    ageMs: 0,
    lifetimeMs: life,
    rise,
    dead: false,
  };
}

/**
 * Advance a floating number by `dt` seconds. The `y` position moves upward
 * (decreasing y) proportionally to elapsed life; when its age reaches the
 * lifetime it is marked `dead` so callers can cull it.
 *
 * @param {object} fn  A floating number from {@link createFloatingNumber}.
 * @param {number} dt  Delta time in seconds.
 * @returns {object}   New floating number (pure).
 */
export function stepFloatingNumber(fn, dt) {
  const dtMs = Number.isFinite(dt) && dt > 0 ? dt * 1000 : 0;
  const ageMs = Math.min(fn.lifetimeMs, fn.ageMs + dtMs);
  const progress = fn.lifetimeMs > 0 ? ageMs / fn.lifetimeMs : 1;
  return {
    ...fn,
    ageMs,
    y: fn.startY - fn.rise * progress,
    dead: ageMs >= fn.lifetimeMs,
  };
}

/**
 * Opacity in [0, 1] for a floating number: full at spawn, fading linearly to
 * 0 at the end of its life.
 *
 * @param {{ ageMs: number, lifetimeMs: number }} fn
 * @returns {number}
 */
export function floatingNumberAlpha(fn) {
  if (!fn || fn.lifetimeMs <= 0) return 0;
  const t = 1 - fn.ageMs / fn.lifetimeMs;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

// ── Player screen kick (R10 / closes task 13) ───────────────────────────────

/** Minimum screen-kick displacement when the player is hit (px). */
export const KICK_MIN_PX = 2;

/** Maximum screen-kick displacement when the player is hit (px). */
export const KICK_MAX_PX = 4;

/**
 * Screen-kick displacement in pixels for a player hit.
 *
 * WHEN prefers-reduced-motion is set THEN the kick is OFF (returns 0) — this
 * honours accessibility rule 3 / R7 and closes task 13's reduced-motion cap.
 *
 * Otherwise the kick is in the 2–4 px band (R10). An optional 0–1 `intensity`
 * lets callers scale within the band by hit severity; it defaults to the max
 * so a plain `playerKickAmount(false)` yields a full 4 px kick. The result is
 * always clamped to [KICK_MIN_PX, KICK_MAX_PX].
 *
 * @param {boolean} reducedMotion   True when prefers-reduced-motion is active.
 * @param {number}  [intensity=1]   0–1 scale within the kick band.
 * @returns {number}  Kick displacement in px (0 under reduced motion).
 */
export function playerKickAmount(reducedMotion, intensity = 1) {
  if (reducedMotion) return 0;
  const t = Number.isFinite(intensity) ? (intensity < 0 ? 0 : intensity > 1 ? 1 : intensity) : 1;
  const amount = KICK_MIN_PX + (KICK_MAX_PX - KICK_MIN_PX) * t;
  return Math.max(KICK_MIN_PX, Math.min(KICK_MAX_PX, amount));
}
