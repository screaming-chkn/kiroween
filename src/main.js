/**
 * src/main.js — HAUNT//HOUND entry point.
 *
 * Flow:
 *   1. Boot: resize canvas, show Garage overlay.
 *   2. Deploy: user clicks Deploy in Garage → hide Garage, start arena match.
 *   3. Arena loop: each fixed step builds player actions from input (WASD +
 *      mouse aim + LMB fire), calls updateArena, then renders all layers
 *      through the renderer.
 *   4. Win / Lose: overlay is drawn; Enter / Space / click on canvas restarts
 *      (loop stops, Garage remounts).
 *   5. Reduced-motion: camera.reducedMotion is set from prefers-reduced-motion.
 *
 * All game state is local to the boot() function; refreshing the page resets
 * everything cleanly.
 *
 * ES modules only; no external dependencies.
 */

import { startLoop }           from './engine/loop.js';
import { createInputState }    from './engine/input.js';
import { createCamera, updateCamera, addTrauma } from './engine/camera.js';
import {
  createRenderer,
  registerLayer,
  renderAll,
  resizeToDisplay,
  LAYERS,
}                              from './engine/render.js';
import { mountGarage }         from './ui/garage.js';
import { createArena, updateArena } from './combat/arena.js';
import { buildPlayerActions }  from './combat/actions.js';
import { drawWorld,
  drawEntities,
  drawHUD,
  drawOverlay,
}                              from './combat/combatRenderer.js';
import { speedPenalty }        from './mech/weight.js';
import { canRestart, RESTART_GRACE_MS } from './combat/restart.js';

// ── Canvas / loading ─────────────────────────────────────────────────────────

const canvas  = /** @type {HTMLCanvasElement} */ (document.getElementById('game-canvas'));
const loading = document.getElementById('loading');

// ── Garage root div (fixed-position overlay, same stacking layer as canvas) ──

const appRoot = document.createElement('div');
appRoot.id    = 'app-root';
document.body.appendChild(appRoot);

// ── Boot ─────────────────────────────────────────────────────────────────────

function boot() {
  const renderer = createRenderer(canvas);
  resizeToDisplay(renderer);
  window.addEventListener('resize', () => resizeToDisplay(renderer));

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    if (loading) {
      loading.textContent = 'ERROR — Canvas 2D not supported.';
      loading.removeAttribute('hidden');
    }
    return;
  }

  if (loading) loading.hidden = true;
  canvas.focus();

  // Detect reduced-motion preference.
  const prefersReduced =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  showGarage(renderer, prefersReduced);
}

// ── Garage phase ─────────────────────────────────────────────────────────────

/**
 * Mount the Garage and wait for the player to Deploy.
 *
 * @param {Renderer}  renderer
 * @param {boolean}   reducedMotion
 */
function showGarage(renderer, reducedMotion) {
  // Draw a static void background while garage is shown (no loop needed).
  const ctx = renderer.ctx;
  ctx.fillStyle = '#0A0D0B';
  ctx.fillRect(0, 0, renderer.canvas.width, renderer.canvas.height);

  const garage = mountGarage(appRoot, {
    onDeploy(loadout, loadoutTotals) {
      garage.destroy();
      startArena(renderer, loadout, loadoutTotals, reducedMotion);
    },
  });
}

// ── Arena phase ───────────────────────────────────────────────────────────────

/**
 * Start a combat match.
 *
 * @param {Renderer}   renderer
 * @param {Object}     loadout        Part IDs keyed by slot.
 * @param {Object}     loadoutTotals  Weight / power totals from garage.
 * @param {boolean}    reducedMotion
 */
function startArena(renderer, loadout, loadoutTotals, reducedMotion) {
  // ── Derive arena loadout stats from garage totals ──────────────────────────
  // speedPenalty comes from the weight curve (mech/weight.js).
  const arenaStats = {
    speedPenalty: speedPenalty(loadoutTotals.loadPct ?? 0),
  };

  let arenaState = createArena(arenaStats);

  // ── Input ──────────────────────────────────────────────────────────────────
  const input = createInputState();

  canvas.addEventListener('keydown',   e => input.onKeyDown(e));
  canvas.addEventListener('keyup',     e => input.onKeyUp(e));
  canvas.addEventListener('mousedown', e => input.onMouseDown(e));
  canvas.addEventListener('mouseup',   e => input.onMouseUp(e));
  canvas.addEventListener('mousemove', e => input.onMouseMove(e));
  canvas.focus();

  // ── Camera ─────────────────────────────────────────────────────────────────
  // Zoom to fit the whole arena into the viewport (1280×800 reference).
  // Uses the *actual* canvas size so it's correct on any display.
  const { width: aw, height: ah } = arenaState.arena;
  const vpW0 = renderer.canvas.width  || 1280;
  const vpH0 = renderer.canvas.height || 800;
  // Leave a small margin (factor 0.95) so the wall stroke is never cropped.
  const fitZoom = Math.min(vpW0 / aw, vpH0 / ah) * 0.95;
  let camera = createCamera({
    x:            aw / 2,
    y:            ah / 2,
    zoom:         fitZoom,
    reducedMotion,
  });
  let shakeX = 0;
  let shakeY = 0;

  // Track previous player HP to detect hits (for camera trauma).
  let prevPlayerHp = arenaState.player.hp;

  // ── Renderer registration ──────────────────────────────────────────────────
  // Clear any callbacks from a previous arena session.
  // (createRenderer always starts clean; we reuse the existing renderer object,
  //  so clear old callbacks by rebuilding them via module-level references.)
  renderer.callbacks[LAYERS.WORLD].length   = 0;
  renderer.callbacks[LAYERS.ENTITY].length  = 0;
  renderer.callbacks[LAYERS.HUD].length     = 0;
  renderer.callbacks[LAYERS.OVERLAY].length = 0;

  registerLayer(renderer, LAYERS.WORLD,   (ctx, st) => drawWorld(ctx, st));
  registerLayer(renderer, LAYERS.ENTITY,  (ctx, st) => drawEntities(ctx, st));
  registerLayer(renderer, LAYERS.HUD,     (ctx, st) => drawHUD(ctx, st));

  // Overlay needs viewport dimensions (drawn in screen space).
  registerLayer(renderer, LAYERS.OVERLAY, (ctx, st) => {
    const vpW = renderer.canvas.width;
    const vpH = renderer.canvas.height;
    const restartReady = canRestart(phaseEndedAtMs, performance.now(), null);
    drawOverlay(ctx, st, camera, vpW, vpH, restartReady);
  });

  // ── Restart handler (Enter / Space / click while overlay showing) ──────────
  let restartRequested = false;

  // Timestamps for the R6 BUG-1 stale-click guard.
  let phaseEndedAtMs  = 0;   // set when phase first leaves 'playing'
  let lastMouseDownAt = 0;   // updated by every mousedown on the canvas

  function onCanvasMouseDown() {
    lastMouseDownAt = performance.now();
  }
  canvas.addEventListener('mousedown', onCanvasMouseDown);

  function requestRestart(e) {
    if (arenaState.phase === 'playing') return;
    // Click: only accept left button.
    if (e instanceof MouseEvent && e.button !== 0) return;
    // Keyboard: only Enter or Space.
    if (e instanceof KeyboardEvent && e.key !== 'Enter' && e.key !== ' ') return;

    // For keyboard events there is no stale mousedown risk → pass null.
    const mouseDownTs = (e instanceof MouseEvent) ? lastMouseDownAt : null;

    if (!canRestart(phaseEndedAtMs, performance.now(), mouseDownTs)) return;

    restartRequested = true;
  }

  canvas.addEventListener('keydown', requestRestart);
  canvas.addEventListener('click',   requestRestart);

  // ── Loop ───────────────────────────────────────────────────────────────────
  const loop = startLoop({
    update(dt) {
      // If player requested restart, tear down and go back to garage.
      if (restartRequested) {
        restartRequested = false;
        loop.stop();
        cleanup();
        showGarage(renderer, reducedMotion);
        return;
      }

      // Once the match is decided, stop updating but keep rendering.
      if (arenaState.phase !== 'playing') return;

      // Build player actions from current input + camera.
      const vpW = renderer.canvas.width;
      const vpH = renderer.canvas.height;

      const actions = buildPlayerActions(
        input,
        camera,
        vpW,
        vpH,
        shakeX,
        shakeY,
      );

      // Step the arena.
      arenaState = updateArena(arenaState, actions, dt);

      // Record when the phase first left 'playing' (for restart grace guard).
      if (arenaState.phase !== 'playing' && phaseEndedAtMs === 0) {
        phaseEndedAtMs = performance.now();
      }

      // Camera trauma on player hit.
      if (arenaState.player.hp < prevPlayerHp) {
        camera = addTrauma(camera, 0.35);
      }
      prevPlayerHp = arenaState.player.hp;

      // Follow camera — track player position.
      const cameraResult = updateCamera(camera, arenaState.player, dt);
      camera = cameraResult.camera;
      shakeX = cameraResult.shakeX;
      shakeY = cameraResult.shakeY;
    },

    render(_alpha) {
      renderAll(renderer, arenaState, camera, shakeX, shakeY);
    },
  });

  // ── Cleanup helper ─────────────────────────────────────────────────────────
  function cleanup() {
    canvas.removeEventListener('keydown',   requestRestart);
    canvas.removeEventListener('click',     requestRestart);
    canvas.removeEventListener('mousedown', onCanvasMouseDown);
    // Input listeners are re-added on the next startArena; remove the old ones
    // by a simple pattern: we defined them as inline arrows, so we need to
    // stash references.  For simplicity we rely on the fact that showGarage
    // doesn't use keyboard events from the canvas, and startArena always
    // re-attaches fresh listeners — acceptable for this prototype.
    // Future: use AbortController to group all listeners.
    renderer.callbacks[LAYERS.WORLD].length   = 0;
    renderer.callbacks[LAYERS.ENTITY].length  = 0;
    renderer.callbacks[LAYERS.HUD].length     = 0;
    renderer.callbacks[LAYERS.OVERLAY].length = 0;
  }
}

// ── Entry ─────────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
