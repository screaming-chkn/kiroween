/**
 * src/engine/loop.js — Fixed-timestep game loop.
 *
 * Design:
 *   accumulator += frameDt
 *   while accumulator >= dt: update(dt); accumulator -= dt
 *   render(accumulator / dt)   ← interpolation alpha
 *
 * The loop pauses automatically when the document is hidden
 * (Page Visibility API) and resumes on visibility restored,
 * resetting the accumulator to avoid a burst of catch-up steps.
 *
 * Public API:
 *   startLoop({ update, render })  → loop handle  { stop }
 *   stepAccumulator(acc, frameDt, dt, maxSteps)  → { steps, acc, alpha }
 *
 * stepAccumulator is a pure function so it can be unit-tested
 * without touching the DOM or requestAnimationFrame.
 */

// ── Constants ────────────────────────────────────────────────────────────────

/** Fixed simulation timestep in seconds (1 / 60). */
export const FIXED_DT = 1 / 60;

/**
 * Maximum number of update steps per frame before the loop drops
 * time rather than spiral-of-death-ing. 4 steps ≈ 66ms of slop.
 */
export const MAX_STEPS = 4;

// ── Pure helper — exported for testing ──────────────────────────────────────

/**
 * Advance the accumulator by `frameDt` seconds and return how many
 * fixed steps should fire, the leftover accumulator, and the render
 * interpolation alpha.
 *
 * This is a pure function: no side effects, no DOM access.
 *
 * @param {number} acc      Leftover time from the previous frame (seconds).
 * @param {number} frameDt  Wall-clock time since last frame (seconds).
 * @param {number} dt       Fixed simulation timestep (seconds).
 * @param {number} maxSteps Maximum update steps allowed per frame.
 * @returns {{ steps: number, acc: number, alpha: number }}
 */
export function stepAccumulator(acc, frameDt, dt, maxSteps) {
  // Clamp frameDt so a single long pause doesn't produce a burst of steps.
  const clamped = Math.min(frameDt, dt * maxSteps);
  let   running = acc + clamped;
  let   steps   = 0;

  while (running >= dt && steps < maxSteps) {
    running -= dt;
    steps++;
  }

  // alpha: how far into the current step the render sits, in [0, 1).
  const alpha = running / dt;

  return { steps, acc: running, alpha };
}

// ── Loop lifecycle ───────────────────────────────────────────────────────────

/**
 * Start the game loop.
 *
 * @param {{
 *   update: (dt: number) => void,
 *   render: (alpha: number) => void,
 *   dt?:       number,
 *   maxSteps?: number,
 * }} options
 * @returns {{ stop: () => void }}
 */
export function startLoop({ update, render, dt = FIXED_DT, maxSteps = MAX_STEPS }) {
  let rafId       = 0;
  let lastTime    = null;   // DOMHighResTimeStamp | null
  let accumulator = 0;
  let running     = true;

  /**
   * Main rAF callback.
   * @param {DOMHighResTimeStamp} now
   */
  function tick(now) {
    if (!running) return;

    // On the first tick (or after a resume) lastTime is null;
    // treat frame delta as zero so we don't burst.
    const frameDt = lastTime === null ? 0 : (now - lastTime) / 1000;
    lastTime = now;

    const result = stepAccumulator(accumulator, frameDt, dt, maxSteps);
    accumulator  = result.acc;

    for (let i = 0; i < result.steps; i++) {
      update(dt);
    }

    render(result.alpha);

    rafId = requestAnimationFrame(tick);
  }

  // Pause / resume on Page Visibility change.
  function onVisibilityChange() {
    if (document.hidden) {
      // Pause: cancel the pending frame.
      cancelAnimationFrame(rafId);
      rafId    = 0;
      lastTime = null; // reset so resume doesn't burst
    } else if (running) {
      // Resume: request a fresh frame.
      lastTime = null;
      rafId    = requestAnimationFrame(tick);
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange);

  // Kick off.
  rafId = requestAnimationFrame(tick);

  return {
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    },
  };
}
