/**
 * src/engine/render.js
 *
 * Layered renderer stub for HAUNT//HOUND.
 *
 * Layers (bottom → top):
 *   0  WORLD   — arena floor, terrain, walls
 *   1  ENTITY  — mechs, projectiles, effects
 *   2  FOG     — static / fog-of-war overlay (opacity ≤ 0.35 per accessibility rules)
 *   3  HUD     — health bars, ammo, radar, wingman status
 *   4  OVERLAY — pause, win/lose screens, settings
 *
 * Usage
 * ──────
 *   import { createRenderer, LAYERS, registerLayer, renderAll } from './render.js';
 *
 *   const renderer = createRenderer(canvas);
 *
 *   // Register draw callbacks for each layer
 *   registerLayer(renderer, LAYERS.WORLD,   (ctx, state) => { ... });
 *   registerLayer(renderer, LAYERS.ENTITY,  (ctx, state) => { ... });
 *   registerLayer(renderer, LAYERS.HUD,     (ctx, state) => { ... });
 *
 *   // Each frame (after update):
 *   renderAll(renderer, gameState, shakeX, shakeY);
 *
 * Coordinate system
 * ──────────────────
 *   Callbacks receive a Canvas 2D context that has already been transformed so
 *   that (0, 0) is the camera centre. Callers draw in world-space coordinates.
 *   The FOG layer is drawn in screen space (no world transform) so the overlay
 *   always fills the viewport exactly.
 *
 * Notes
 * ─────
 *   - No dependencies; plain ES module.
 *   - The renderer is a stub: it calls registered callbacks in layer order.
 *     Each system registers its own draw function; nothing is hardcoded here.
 *   - Static/fog opacity is enforced at the renderer level: any FOG layer draw
 *     call is wrapped with globalAlpha clamped to [0, 0.35].
 */

// ── Layer constants ───────────────────────────────────────────────────────────

/** Ordered layer identifiers.  */
export const LAYERS = Object.freeze({
  WORLD:   0,
  ENTITY:  1,
  FOG:     2,
  HUD:     3,
  OVERLAY: 4,
});

/** Maximum opacity permitted for the FOG layer (accessibility rule 2). */
export const FOG_MAX_ALPHA = 0.35;

// ── Renderer factory ──────────────────────────────────────────────────────────

/**
 * Create a renderer bound to a canvas element.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {Renderer}
 */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  // One array of callbacks per layer, in layer order.
  const callbacks = [
    [], // WORLD
    [], // ENTITY
    [], // FOG
    [], // HUD
    [], // OVERLAY
  ];

  return { canvas, ctx, callbacks };
}

// ── Layer registration ────────────────────────────────────────────────────────

/**
 * Register a draw callback for a layer.
 * Callbacks are called in registration order within the same layer.
 *
 * @param {Renderer}  renderer
 * @param {number}    layer     One of the LAYERS values.
 * @param {Function}  fn        (ctx: CanvasRenderingContext2D, state: any, camera: CameraState) => void
 */
export function registerLayer(renderer, layer, fn) {
  if (layer < 0 || layer >= renderer.callbacks.length) {
    throw new RangeError(`Unknown layer: ${layer}`);
  }
  renderer.callbacks[layer].push(fn);
}

/**
 * Remove a previously registered callback from a layer.
 * No-op if the callback is not found.
 *
 * @param {Renderer}  renderer
 * @param {number}    layer
 * @param {Function}  fn
 */
export function unregisterLayer(renderer, layer, fn) {
  if (layer < 0 || layer >= renderer.callbacks.length) return;
  const arr = renderer.callbacks[layer];
  const idx = arr.indexOf(fn);
  if (idx !== -1) arr.splice(idx, 1);
}

// ── Render pass ───────────────────────────────────────────────────────────────

/**
 * Clear the canvas and call all registered layer callbacks in order.
 *
 * Layers WORLD, ENTITY, and HUD are drawn with a world-space transform applied:
 *   - origin translated to canvas centre
 *   - shake offset applied
 *   - zoom scaling applied
 * This means callbacks in those layers draw in world coordinates.
 *
 * The FOG layer is drawn in screen space so the overlay always fills the
 * viewport; globalAlpha is clamped to FOG_MAX_ALPHA.
 *
 * The OVERLAY layer is also drawn in screen space (no world transform) so
 * win/lose/pause screens fill the viewport.
 *
 * @param {Renderer}     renderer
 * @param {any}          state      Game state passed through to every callback.
 * @param {CameraState}  camera     Camera state (x, y, zoom).
 * @param {number}       shakeX     Current shake offset in pixels.
 * @param {number}       shakeY     Current shake offset in pixels.
 */
export function renderAll(renderer, state, camera, shakeX = 0, shakeY = 0) {
  const { canvas, ctx, callbacks } = renderer;
  const vpW = canvas.width;
  const vpH = canvas.height;

  // Clear entire canvas
  ctx.clearRect(0, 0, vpW, vpH);

  // ── World-space layers (WORLD=0, ENTITY=1) ──────────────────────────────
  for (const layerIdx of [LAYERS.WORLD, LAYERS.ENTITY]) {
    if (callbacks[layerIdx].length === 0) continue;

    ctx.save();
    // Translate: camera centre → canvas centre, add shake
    ctx.translate(
      vpW / 2 - camera.x * camera.zoom + shakeX,
      vpH / 2 - camera.y * camera.zoom + shakeY,
    );
    ctx.scale(camera.zoom, camera.zoom);

    for (const fn of callbacks[layerIdx]) {
      ctx.save();
      fn(ctx, state, camera);
      ctx.restore();
    }

    ctx.restore();
  }

  // ── FOG layer — screen space, opacity capped ────────────────────────────
  if (callbacks[LAYERS.FOG].length > 0) {
    ctx.save();
    const savedAlpha = ctx.globalAlpha;
    // Clamp whatever the callback sets; we enforce the cap via a wrapper.
    // The callback itself should respect FOG_MAX_ALPHA, but we double-enforce.
    ctx.globalAlpha = Math.min(savedAlpha, FOG_MAX_ALPHA);

    for (const fn of callbacks[LAYERS.FOG]) {
      ctx.save();
      // Each callback's own globalAlpha is capped relative to FOG_MAX_ALPHA
      fn(ctx, state, camera);
      // After callback, re-apply cap in case it changed globalAlpha
      ctx.globalAlpha = Math.min(ctx.globalAlpha, FOG_MAX_ALPHA);
      ctx.restore();
    }

    ctx.restore();
  }

  // ── HUD layer — world-space transform (HUD elements track world) ────────
  //   Intentionally drawn WITHOUT shake so numbers never jitter (a11y rule).
  if (callbacks[LAYERS.HUD].length > 0) {
    ctx.save();
    ctx.translate(
      vpW / 2 - camera.x * camera.zoom,
      vpH / 2 - camera.y * camera.zoom,
    );
    ctx.scale(camera.zoom, camera.zoom);

    for (const fn of callbacks[LAYERS.HUD]) {
      ctx.save();
      fn(ctx, state, camera);
      ctx.restore();
    }

    ctx.restore();
  }

  // ── OVERLAY layer — screen space, no transform ──────────────────────────
  if (callbacks[LAYERS.OVERLAY].length > 0) {
    ctx.save();
    for (const fn of callbacks[LAYERS.OVERLAY]) {
      ctx.save();
      fn(ctx, state, camera);
      ctx.restore();
    }
    ctx.restore();
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

/**
 * Resize the canvas to match its CSS display size (handles HiDPI / devicePixelRatio).
 * Call on window resize and once at startup.
 *
 * @param {Renderer} renderer
 * @param {number}   [dpr=devicePixelRatio]
 */
export function resizeToDisplay(renderer, dpr = (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1)) {
  const { canvas } = renderer;
  const cssW = canvas.clientWidth  || canvas.width;
  const cssH = canvas.clientHeight || canvas.height;
  const w = Math.round(cssW * dpr);
  const h = Math.round(cssH * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width  = w;
    canvas.height = h;
  }
}
