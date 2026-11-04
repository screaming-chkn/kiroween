/**
 * src/engine/camera.js
 *
 * Follow camera with optional screen-shake.
 *
 * All exported functions are pure (no side effects, no DOM/canvas access)
 * so they can be tested in plain Node.
 *
 * ## Coordinate convention
 *   World space: arbitrary units (e.g. 1 unit = 1 px at zoom 1).
 *   Camera offset (cx, cy): the world position the camera is centred on.
 *   To convert a world point (wx, wy) to canvas/screen coords:
 *     sx = (wx - cx) * zoom + viewportW / 2 + shakeX
 *     sy = (wy - cy) * zoom + viewportH / 2 + shakeY
 *
 * ## Reduced-motion / shake cap
 *   When reducedMotion is true the maximum shake displacement is clamped to
 *   SHAKE_MAX_REDUCED (2 px). Otherwise it is clamped to SHAKE_MAX_FULL (12 px).
 *   Both caps apply *after* the raw trauma → displacement mapping so the
 *   setting is always honoured regardless of how much trauma is added.
 */

// ── Constants ────────────────────────────────────────────────────────────────

/** Maximum shake displacement in pixels when full motion is allowed. */
export const SHAKE_MAX_FULL    = 12;

/** Maximum shake displacement in pixels when reduced motion is on. */
export const SHAKE_MAX_REDUCED = 2;

/** Trauma decay rate per second (trauma units/s). */
export const TRAUMA_DECAY      = 1.5;

/** Lerp speed for the follow camera (fraction of gap closed per second). */
export const FOLLOW_SPEED      = 8;

// ── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Linear interpolation.
 * @param {number} a
 * @param {number} b
 * @param {number} t  0–1
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Clamp a value to [min, max].
 * @param {number} v
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/**
 * Pseudo-random number in [−1, 1) derived from a seed.
 * Simple seeded LCG so tests are deterministic.
 * @param {number} seed  Any integer; mutated externally (caller manages state).
 * @returns {{ value: number, nextSeed: number }}
 */
export function seededRandom(seed) {
  // LCG constants (Numerical Recipes).
  // `& 0xffffffff` produces a *signed* 32-bit integer in JS, which can be
  // negative.  `>>> 0` reinterprets the same bits as an *unsigned* 32-bit
  // integer, giving a value in [0, 2^32), then we divide by 2^32 for [0, 1)
  // and map to [−1, 1) with × 2 − 1.
  const next = ((seed * 1664525 + 1013904223) & 0xffffffff) >>> 0;
  const value = (next / 0x100000000) * 2 - 1; // [0, 1) → [−1, 1)
  return { value, nextSeed: next };
}

// ── Camera state factory ─────────────────────────────────────────────────────

/**
 * Create a fresh camera state.
 *
 * @param {object} opts
 * @param {number} [opts.x=0]             Initial world X of camera centre.
 * @param {number} [opts.y=0]             Initial world Y of camera centre.
 * @param {number} [opts.zoom=1]          Pixels per world unit.
 * @param {number} [opts.trauma=0]        Initial trauma [0, 1].
 * @param {number} [opts.seed=0]          Seed for shake PRNG.
 * @param {boolean}[opts.reducedMotion=false]
 * @returns {CameraState}
 */
export function createCamera({
  x = 0,
  y = 0,
  zoom = 1,
  trauma = 0,
  seed = 0,
  reducedMotion = false,
} = {}) {
  return { x, y, zoom, trauma: clamp(trauma, 0, 1), seed, reducedMotion };
}

// ── Pure update functions ─────────────────────────────────────────────────────

/**
 * Move the camera toward a target world position using exponential smoothing.
 *
 * Returns a new camera state (does not mutate the input).
 *
 * @param {CameraState} cam
 * @param {{ x: number, y: number }} target  World position to follow.
 * @param {number} dt  Delta time in seconds.
 * @returns {CameraState}
 */
export function followTarget(cam, target, dt) {
  const t = clamp(FOLLOW_SPEED * dt, 0, 1);
  return {
    ...cam,
    x: lerp(cam.x, target.x, t),
    y: lerp(cam.y, target.y, t),
  };
}

/**
 * Add trauma to the camera (e.g. on explosion or damage hit).
 * Trauma is clamped to [0, 1].
 *
 * @param {CameraState} cam
 * @param {number} amount  Amount to add [0, 1].
 * @returns {CameraState}
 */
export function addTrauma(cam, amount) {
  return { ...cam, trauma: clamp(cam.trauma + amount, 0, 1) };
}

/**
 * Decay trauma over time and compute the current shake offset.
 *
 * shake displacement = maxShake × trauma²  (quadratic feel)
 * Direction comes from two seeded-random values (x, y).
 *
 * @param {CameraState} cam
 * @param {number} dt  Delta time in seconds.
 * @returns {{ camera: CameraState, shakeX: number, shakeY: number }}
 */
export function tickShake(cam, dt) {
  // Decay trauma
  const newTrauma = clamp(cam.trauma - TRAUMA_DECAY * dt, 0, 1);

  // Max displacement respects reduced-motion setting
  const maxDisplace = cam.reducedMotion ? SHAKE_MAX_REDUCED : SHAKE_MAX_FULL;

  // Displacement magnitude: quadratic trauma curve
  const magnitude = maxDisplace * (newTrauma * newTrauma);

  // Two seeded-random directions
  const r1 = seededRandom(cam.seed);
  const r2 = seededRandom(r1.nextSeed);

  const shakeX = r1.value * magnitude;
  const shakeY = r2.value * magnitude;

  return {
    camera: { ...cam, trauma: newTrauma, seed: r2.nextSeed },
    shakeX,
    shakeY,
  };
}

/**
 * Convert a world coordinate to a canvas (screen) coordinate.
 *
 * @param {number} wx         World X.
 * @param {number} wy         World Y.
 * @param {CameraState} cam   Current camera state (x, y, zoom).
 * @param {number} vpW        Viewport width in pixels.
 * @param {number} vpH        Viewport height in pixels.
 * @param {number} [shakeX=0] Current shake offset X.
 * @param {number} [shakeY=0] Current shake offset Y.
 * @returns {{ sx: number, sy: number }}
 */
export function worldToScreen(wx, wy, cam, vpW, vpH, shakeX = 0, shakeY = 0) {
  return {
    sx: (wx - cam.x) * cam.zoom + vpW / 2 + shakeX,
    sy: (wy - cam.y) * cam.zoom + vpH / 2 + shakeY,
  };
}

/**
 * Convert a canvas (screen) coordinate to a world coordinate.
 * Useful for mouse → aim direction.
 *
 * @param {number} sx         Screen X.
 * @param {number} sy         Screen Y.
 * @param {CameraState} cam
 * @param {number} vpW
 * @param {number} vpH
 * @param {number} [shakeX=0]
 * @param {number} [shakeY=0]
 * @returns {{ wx: number, wy: number }}
 */
export function screenToWorld(sx, sy, cam, vpW, vpH, shakeX = 0, shakeY = 0) {
  return {
    wx: (sx - vpW / 2 - shakeX) / cam.zoom + cam.x,
    wy: (sy - vpH / 2 - shakeY) / cam.zoom + cam.y,
  };
}

// ── Arena framing helpers ─────────────────────────────────────────────────────

/**
 * Pin the camera to the arena centre when the whole arena fits the viewport
 * at the current zoom level (i.e. the arena is not larger than the view).
 *
 * Returns a camera state whose (x, y) is the arena centre.
 * This is a pure function — it does not check viewport size; the caller
 * decides whether to call pin or clamp based on whether the arena fits.
 *
 * @param {CameraState} cam
 * @param {{ width: number, height: number }} arena  Arena dimensions in world units.
 * @returns {CameraState}
 */
export function pinArenaCentre(cam, arena) {
  return { ...cam, x: arena.width / 2, y: arena.height / 2 };
}

/**
 * Clamp the camera position so the viewport never shows area outside the
 * arena walls — used when the arena is larger than the viewport at the
 * current zoom.
 *
 * Half-viewport in world units = (vpSize / 2) / zoom.
 * Camera centre must stay in [ halfVpW, arenaW − halfVpW ] × [ halfVpH, arenaH − halfVpH ].
 * If the arena is narrower than the viewport (should not happen here but safe
 * to handle), the camera is pinned to the arena centre on that axis.
 *
 * @param {CameraState} cam
 * @param {{ width: number, height: number }} arena
 * @param {number} vpW  Viewport width in pixels.
 * @param {number} vpH  Viewport height in pixels.
 * @returns {CameraState}
 */
export function clampToArena(cam, arena, vpW, vpH) {
  const halfWorldW = vpW / 2 / cam.zoom;
  const halfWorldH = vpH / 2 / cam.zoom;

  const minX = halfWorldW;
  const maxX = arena.width  - halfWorldW;
  const minY = halfWorldH;
  const maxY = arena.height - halfWorldH;

  // If arena smaller than viewport on an axis, pin to centre on that axis.
  const cx = minX >= maxX ? arena.width  / 2 : clamp(cam.x, minX, maxX);
  const cy = minY >= maxY ? arena.height / 2 : clamp(cam.y, minY, maxY);

  return { ...cam, x: cx, y: cy };
}

/**
 * Apply one full camera tick: follow the target (or pin/clamp to arena when
 * arena bounds are provided), then tick shake.
 * Convenience wrapper used by the game loop.
 *
 * When `arena` and `vpW`/`vpH` are supplied the function decides:
 *   • arena fits viewport → pin to arena centre (no follow)
 *   • arena larger than viewport → follow target, then clamp to arena bounds
 *
 * @param {CameraState} cam
 * @param {{ x: number, y: number }} target
 * @param {number} dt
 * @param {{ width: number, height: number } | null} [arena]  Optional arena bounds.
 * @param {number} [vpW]  Viewport width in pixels (required when arena supplied).
 * @param {number} [vpH]  Viewport height in pixels (required when arena supplied).
 * @returns {{ camera: CameraState, shakeX: number, shakeY: number }}
 */
export function updateCamera(cam, target, dt, arena = null, vpW = 0, vpH = 0) {
  let followed;

  if (arena && vpW > 0 && vpH > 0) {
    const arenaScreenW = arena.width  * cam.zoom;
    const arenaScreenH = arena.height * cam.zoom;

    if (arenaScreenW <= vpW && arenaScreenH <= vpH) {
      // Arena fits — keep camera pinned on the arena centre.
      followed = pinArenaCentre(cam, arena);
    } else {
      // Arena larger than viewport — follow player, then clamp.
      const f = followTarget(cam, target, dt);
      followed = clampToArena(f, arena, vpW, vpH);
    }
  } else {
    // No arena bounds — plain follow (legacy path).
    followed = followTarget(cam, target, dt);
  }

  return tickShake(followed, dt);
}
