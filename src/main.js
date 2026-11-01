/**
 * src/main.js — HAUNT//HOUND entry point.
 *
 * Responsibilities:
 *  - Size the canvas to the viewport (respecting devicePixelRatio).
 *  - Start the game loop.
 *  - Remove the loading overlay.
 *
 * All game-system wiring will grow here as specs land.
 */

import { startLoop } from './engine/loop.js';

// ── Canvas setup ────────────────────────────────────────────────────────────

const canvas  = /** @type {HTMLCanvasElement} */ (document.getElementById('game-canvas'));
const loading = document.getElementById('loading');

/**
 * Set the canvas backing-store size to match the CSS size × devicePixelRatio,
 * so the game renders sharply on HiDPI screens.
 */
function resizeCanvas() {
  const dpr = window.devicePixelRatio ?? 1;
  const w   = canvas.clientWidth;
  const h   = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width  = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
}

// ── Stub update / render hooks (replaced by systems as they land) ────────────

/** @param {number} _dt Fixed timestep in seconds (1/60). */
function update(_dt) {
  // systems.forEach(s => s.update(_dt));
}

/**
 * @param {number} alpha  Interpolation factor in [0, 1].
 * @param {CanvasRenderingContext2D} ctx
 */
function render(alpha, ctx) {
  // Clear with void colour each frame.
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // TODO: renderer layers — world / fog+static / HUD
  void alpha; // used once renderer is wired
}

// ── Boot ─────────────────────────────────────────────────────────────────────

function boot() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // Error state: canvas 2D unsupported (very rare).
    if (loading) {
      loading.textContent = 'ERROR — Canvas 2D not supported.';
      loading.removeAttribute('hidden');
    }
    return;
  }

  // Hide the loading overlay — game is ready.
  if (loading) loading.hidden = true;

  // Focus the canvas so keyboard events are captured immediately.
  canvas.focus();

  startLoop({
    update,
    render: (alpha) => render(alpha, ctx),
  });
}

// Defer boot until the DOM is interactive (it always is for type="module",
// but the explicit check makes intent clear).
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
