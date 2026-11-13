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
import { createCamera, updateCamera, addTrauma, isPortraitTouch, phoneCameraZoom, phoneFollowPoint } from './engine/camera.js';
import {
  createRenderer,
  registerLayer,
  renderAll,
  resizeToDisplay,
  LAYERS,
}                              from './engine/render.js';
import { mountGarage }         from './ui/garage.js';
import { syncTankFx }          from './ui/tankFx.js';
import { mountSeance }         from './ui/seance.js';
import { injectPossessionCSS } from './ui/possession.js';
import { playMusicBed }        from './engine/audio.js';
import { createArena, updateArena } from './combat/arena.js';
import { buildPlayerActions }  from './combat/actions.js';
import { drawWorld,
  drawEntities,
  drawHUD,
  drawFixedHUD,
  drawOverlay,
}                              from './combat/combatRenderer.js';
import { speedPenalty }        from './mech/weight.js';
import { playerKickAmount }    from './combat/hitFeedback.js';
import { canRestart, RESTART_GRACE_MS } from './combat/restart.js';
import { screenToWorld, worldToScreen } from './engine/camera.js';
import { ENEMY_SHOT_WINDUP_MS } from './combat/config.js';
import {
  endCardScale, scaleRects, phoneHudScale, phoneHudViewportH, hudPanelRect, phoneHudRect,
  circleOverlapsRect, drawWindupGlow, drawCompactHp, HUD_UNDER_ALPHA,
  rectsOverlap, playerHpBarScreenRect, playerOnlyState, unsquashTextCtx,
  drawEnemyShotGlow, pushAfterimage, drawDashAfterimages,
}                              from './ui/phoneCombatUi.js';
import { edgeArrowPlacement, drawEdgeArrow, EDGE_ARROW } from './ui/phoneCombatUi.js';
import { prefersTouchUi, mergeTouchActions, TOUCH_LAYOUT, stickRadiusPx } from './engine/touch.js';
import { mountTouchControls }  from './ui/touchControls.js';

// ── Canvas / loading ─────────────────────────────────────────────────────────

const canvas  = /** @type {HTMLCanvasElement} */ (document.getElementById('game-canvas'));
const loading = document.getElementById('loading');

// ── Garage root div (fixed-position overlay, same stacking layer as canvas) ──

const appRoot = document.createElement('div');
appRoot.id    = 'app-root';
document.body.appendChild(appRoot);

// ── Boot ─────────────────────────────────────────────────────────────────────

function boot() {
  // Declare the sterile/possessed palette custom properties up front so themed
  // components (e.g. the garage) read live var(--hh-*) values; opening the
  // séance flips to the possessed palette via setPossessed(true).
  injectPossessionCSS();

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
      // First user gesture → start the looping music bed (no autoplay before
      // this point; honors the music bus volume). Safe no-op if unavailable.
      playMusicBed();
      garage.destroy();
      startArena(renderer, loadout, loadoutTotals, reducedMotion);
    },
    onSeance() {
      // Open the séance terminal overlay. mountSeance possesses the page on
      // open and restores the sterile palette on close (instant swap, no wipe).
      mountSeance(appRoot, {});
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
  // speedPenalty comes from the weight curve (mech/weight.js); powerOut /
  // powerDraw / balance flow straight through for the fixed HUD EN + POWER
  // readout (R9).
  const arenaStats = {
    ...loadoutTotals,
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
  // Touch-UI decision is made once, before the camera, and reused below.
  const coarse = typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;
  const touchUi = prefersTouchUi({
    maxTouchPoints: navigator.maxTouchPoints,
    matchMediaCoarse: coarse,
    width: window.innerWidth,
  });
  // Portrait phone: zoom in so the mech is readable, and bias toward the enemy.
  const phonePortrait = isPortraitTouch({
    touchUi,
    cssW: canvas.clientWidth  || window.innerWidth,
    cssH: canvas.clientHeight || window.innerHeight,
  });
  const uiDpr = canvas.width / (canvas.clientWidth || canvas.width);
  const startZoom = phonePortrait
    ? phoneCameraZoom({
        fitZoom,
        dpr: canvas.width / (canvas.clientWidth || canvas.width),
      })
    : fitZoom;
  let camera = createCamera({
    x:            aw / 2,
    y:            ah / 2,
    zoom:         startZoom,
    reducedMotion,
  });
  let shakeX = 0;
  let shakeY = 0;

  // R10 player screen kick: a brief 2–4 px displacement when the player is
  // hit, OFF under reduced motion (playerKickAmount returns 0). Decays each
  // frame so it's a single punch, not a sustained shake. Added on top of the
  // camera shake offset at render time.
  let kickX = 0;
  let kickY = 0;

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
  const afterimages = [];
  registerLayer(renderer, LAYERS.ENTITY,  (ctx) => drawDashAfterimages(ctx, afterimages));
  registerLayer(renderer, LAYERS.ENTITY,  (ctx, st) => { syncTankFx(st); });
  registerLayer(renderer, LAYERS.ENTITY,  (ctx, st) => drawEntities(ctx, st));
  registerLayer(renderer, LAYERS.ENTITY,  (ctx, st, cam) =>
    drawWindupGlow(ctx, st.enemy, ENEMY_SHOT_WINDUP_MS, (cam ?? camera).zoom / uiDpr));
  registerLayer(renderer, LAYERS.ENTITY,  (ctx, st) => drawEnemyShotGlow(ctx, st.projectiles));
  registerLayer(renderer, LAYERS.HUD,     (ctx, st) => {
    if (!phonePortrait) { drawHUD(ctx, st); return; }
    const vw = renderer.canvas.width;
    const vh = renderer.canvas.height;
    const hw = vw / 2 / camera.zoom;
    const hh = vh / 2 / camera.zoom;
    drawCompactHp(ctx, st, {
      left: camera.x - hw, right: camera.x + hw,
      top: camera.y - hh, bottom: camera.y + hh,
    });
  });

  // Fixed bottom-left combat HUD (R9) — screen space, so it lives on the
  // OVERLAY layer (drawn without the world transform) ahead of the end card.
  let hudOffscreen = null;   // lazily created (desktop fade-under only)
  registerLayer(renderer, LAYERS.OVERLAY, (ctx, st) => {
    // Hide the live HUD once the match ends so the end card panel is clean.
    if (st.phase !== 'playing') return;
    const vpW = renderer.canvas.width;
    const vpH = renderer.canvas.height;
    const s = touchUi ? phoneHudScale(uiDpr) : 1;
    const sp = worldToScreen(st.player.x, st.player.y, camera, vpW, vpH,
      shakeX + kickX, shakeY + kickY);
    const rect = touchUi ? phoneHudRect(s) : hudPanelRect(vpH);
    if (circleOverlapsRect(sp.sx, sp.sy, 30 * camera.zoom, rect) ||
        rectsOverlap(playerHpBarScreenRect(st.player, camera, vpW, vpH, phonePortrait), rect)) {
      if (!hudOffscreen) hudOffscreen = document.createElement('canvas');
      if (hudOffscreen.width !== vpW || hudOffscreen.height !== vpH) {
        hudOffscreen.width = vpW;
        hudOffscreen.height = vpH;
      }
      const octx = hudOffscreen.getContext('2d');
      octx.clearRect(0, 0, vpW, vpH);
      if (touchUi) {
        octx.save();
        octx.scale(s, s);
        drawFixedHUD(octx, st, vpW / s, phoneHudViewportH());
        octx.restore();
      } else {
        drawFixedHUD(octx, st, vpW, vpH);
      }
      ctx.save();
      ctx.globalAlpha = HUD_UNDER_ALPHA;
      ctx.drawImage(hudOffscreen, 0, 0);
      ctx.restore();
      // Keep the player HP bar readable above the faded HUD.
      ctx.save();
      ctx.translate(vpW / 2 - camera.x * camera.zoom, vpH / 2 - camera.y * camera.zoom);
      ctx.scale(camera.zoom, camera.zoom);
      (phonePortrait ? drawCompactHp : drawHUD)(ctx, playerOnlyState(st));
      ctx.restore();
    } else if (touchUi) {
      ctx.save();
      ctx.scale(s, s);
      drawFixedHUD(ctx, st, vpW / s, phoneHudViewportH());
      ctx.restore();
    } else {
      drawFixedHUD(ctx, st, vpW, vpH);
    }
  });

  // Phone-only enemy edge arrow (draw-only). Safe-area insets read once.
  let insetProbe = null;
  let insetTop = 0;
  let insetBottom = 0;
  if (phonePortrait) {
    insetProbe = document.createElement('div');
    insetProbe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;' +
      'padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);' +
      'visibility:hidden;pointer-events:none;';
    document.body.appendChild(insetProbe);
    const cs = getComputedStyle(insetProbe);
    insetTop = parseFloat(cs.paddingTop) || 0;
    insetBottom = parseFloat(cs.paddingBottom) || 0;
  }
  registerLayer(renderer, LAYERS.OVERLAY, (ctx, st) => {
    if (!phonePortrait || st.phase !== 'playing') return;
    const cssW = canvas.clientWidth || window.innerWidth;
    const cssH = canvas.clientHeight || window.innerHeight;
    const vpW = renderer.canvas.width;
    const vpH = renderer.canvas.height;
    const sp = worldToScreen(st.enemy.x, st.enemy.y, camera, vpW, vpH,
      shakeX + kickX, shakeY + kickY);
    const r = phoneHudRect(phoneHudScale(uiDpr));
    const hud = { x: r.x / uiDpr, y: r.y / uiDpr, w: r.w / uiDpr, h: r.h / uiDpr };
    const bottomLimit = Math.min(
      TOUCH_LAYOUT.fire.cyFrac * cssH - TOUCH_LAYOUT.fire.rFrac * Math.min(cssW, cssH),
      0.8 * cssH - stickRadiusPx(cssW, cssH),
    ) - EDGE_ARROW.padGap;
    const placement = edgeArrowPlacement({
      enabled: phonePortrait,
      ex: sp.sx / uiDpr, ey: sp.sy / uiDpr, er: 20 * camera.zoom / uiDpr,
      cssW, cssH, insetTop, insetBottom, hud, bottomLimit,
    });
    drawEdgeArrow(ctx, placement, uiDpr);
  });

  // Overlay needs viewport dimensions (drawn in screen space).
  // It returns the end-card button hit-rects so clicks can be mapped to a
  // button. Default focus is RETRY (index 0).
  let endCardButtons = null;   // Array<{id,x,y,w,h}> while the card is shown
  let focusIndex     = 0;      // 0 = RETRY, 1 = GARAGE
  registerLayer(renderer, LAYERS.OVERLAY, (ctx, st) => {
    const vpW = renderer.canvas.width;
    const vpH = renderer.canvas.height;
    const restartReady = canRestart(phaseEndedAtMs, performance.now(), null);
    if (touchUi) {
      const { sx, sy } = endCardScale({
        touchUi, dpr: uiDpr, cssW: canvas.clientWidth || window.innerWidth,
      });
      ctx.save();
      ctx.scale(sx, sy);
      const result = drawOverlay(unsquashTextCtx(ctx, sy / sx), st, camera, vpW / sx, vpH / sy, restartReady, focusIndex);
      ctx.restore();
      endCardButtons = result ? scaleRects(result.buttons, sx, sy) : null;
      return;
    }
    const result = drawOverlay(ctx, st, camera, vpW, vpH, restartReady, focusIndex);
    endCardButtons = result ? result.buttons : null;
  });

  // ── End-card handling (RETRY / GARAGE) ─────────────────────────────────────
  // Both actions respect the existing restart guard (1 s grace + stale-click).
  let pendingAction = null;   // 'retry' | 'garage' | null

  // Timestamps for the R6 BUG-1 stale-click guard.
  let phaseEndedAtMs  = 0;   // set when phase first leaves 'playing'
  let lastMouseDownAt = 0;   // updated by every mousedown on the canvas

  function onCanvasMouseDown() {
    lastMouseDownAt = performance.now();
  }
  canvas.addEventListener('mousedown', onCanvasMouseDown);

  /** True when the card is up and the grace guard allows interaction. */
  function cardInteractive(mouseDownTs) {
    if (arenaState.phase === 'playing') return false;
    return canRestart(phaseEndedAtMs, performance.now(), mouseDownTs);
  }

  /** Map a canvas click to the button under the cursor, if any. */
  function buttonAtPoint(px, py) {
    if (!endCardButtons) return null;
    for (const b of endCardButtons) {
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
        return b;
      }
    }
    return null;
  }

  function onCardKeyDown(e) {
    if (arenaState.phase === 'playing') return;

    // Focus navigation is always allowed (no restart risk).
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
        e.key === 'Tab' || e.key === 'a' || e.key === 'd') {
      e.preventDefault();
      if (e.key === 'ArrowLeft'  || e.key === 'a') focusIndex = 0;
      else if (e.key === 'ArrowRight' || e.key === 'd') focusIndex = 1;
      else focusIndex = focusIndex === 0 ? 1 : 0;   // Tab toggles
      return;
    }

    // Activation — Enter or Space activates the focused button.
    if (e.key === 'Enter' || e.key === ' ') {
      // Keyboard events carry no stale-click risk → pass null.
      if (!cardInteractive(null)) return;
      e.preventDefault();
      pendingAction = focusIndex === 0 ? 'retry' : 'garage';
    }
  }

  function onCardClick(e) {
    if (arenaState.phase === 'playing') return;
    if (e.button !== 0) return;
    if (!cardInteractive(lastMouseDownAt)) return;

    // Translate client coords → canvas pixel coords.
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top)  * scaleY;

    const hit = buttonAtPoint(px, py);
    if (!hit) return;
    focusIndex    = hit.id === 'retry' ? 0 : 1;
    pendingAction = hit.id;
  }

  canvas.addEventListener('keydown', onCardKeyDown);
  canvas.addEventListener('click',   onCardClick);

  // ── Touch controls (phones/tablets only) ───────────────────────────────────
  let touch = null;
  if (touchUi) {
    touch = mountTouchControls(document.body, {
      getViewport: () => ({ width: window.innerWidth, height: window.innerHeight }),
    });
  }

  /** CSS px → canvas px → world (mirrors actions.js). */
  function touchScreenToWorld(p) {
    const sx = canvas.clientWidth  > 0 ? canvas.width  / canvas.clientWidth  : 1;
    const sy = canvas.clientHeight > 0 ? canvas.height / canvas.clientHeight : 1;
    const { wx, wy } = screenToWorld(
      p.x * sx, p.y * sy, camera,
      renderer.canvas.width, renderer.canvas.height, shakeX, shakeY,
    );
    return { x: wx, y: wy };
  }

  // ── Loop ───────────────────────────────────────────────────────────────────
  const loop = startLoop({
    update(dt) {
      // Handle an end-card action (RETRY / GARAGE); both tear down the loop.
      if (pendingAction) {
        const action = pendingAction;
        pendingAction = null;
        loop.stop();
        cleanup();
        if (action === 'retry') {
          // Restart a fresh match with the SAME loadout (R8).
          startArena(renderer, loadout, loadoutTotals, reducedMotion);
        } else {
          // GARAGE — reopen the garage.
          showGarage(renderer, reducedMotion);
        }
        return;
      }

      // Once the match is decided, stop updating but keep rendering.
      if (arenaState.phase !== 'playing') {
        if (touch) touch.setActive(false);
        return;
      }

      // Build player actions from current input + camera.
      const vpW = renderer.canvas.width;
      const vpH = renderer.canvas.height;

      let actions = buildPlayerActions(
        input,
        camera,
        vpW,
        vpH,
        shakeX,
        shakeY,
      );
      if (touch) {
        actions = mergeTouchActions(actions, touch.sample(), touchScreenToWorld);
      }

      // Step the arena.
      arenaState = updateArena(arenaState, actions, dt);
      pushAfterimage(afterimages, arenaState.player);

      // Record when the phase first left 'playing' (for restart grace guard).
      if (arenaState.phase !== 'playing' && phaseEndedAtMs === 0) {
        phaseEndedAtMs = performance.now();
        if (touch) touch.setActive(false);
      }

      // R10 player screen kick on hit — 2–4 px, OFF under reduced motion.
      // We keep a small camera trauma too so the shake system stays coherent,
      // but the kick itself is the primary, reduced-motion-gated cue.
      if (arenaState.player.hp < prevPlayerHp) {
        const kick = playerKickAmount(reducedMotion);
        if (kick > 0) {
          // Random direction so repeated hits don't push the same way.
          const dir = Math.random() * Math.PI * 2;
          kickX = Math.cos(dir) * kick;
          kickY = Math.sin(dir) * kick;
          camera = addTrauma(camera, 0.35);
        }
      }
      prevPlayerHp = arenaState.player.hp;

      // Decay the kick toward zero so it reads as a single punch (~120 ms).
      const kickDecay = Math.max(0, 1 - dt * 8);
      kickX *= kickDecay;
      kickY *= kickDecay;

      // Camera: pin to arena centre when arena fits the viewport; follow +
      // clamp when the arena is larger than the viewport (R11).
      const cameraResult = updateCamera(
        camera,
        phonePortrait
          ? phoneFollowPoint(arenaState.player, arenaState.enemy, camera.zoom, vpW, vpH)
          : arenaState.player,
        dt,
        arenaState.arena,
        vpW,
        vpH,
      );
      camera = cameraResult.camera;
      shakeX = cameraResult.shakeX;
      shakeY = cameraResult.shakeY;
    },

    render(_alpha) {
      renderAll(renderer, arenaState, camera, shakeX + kickX, shakeY + kickY);
    },
  });

  // ── Cleanup helper ─────────────────────────────────────────────────────────
  function cleanup() {
    canvas.removeEventListener('keydown',   onCardKeyDown);
    canvas.removeEventListener('click',     onCardClick);
    canvas.removeEventListener('mousedown', onCanvasMouseDown);
    if (touch) { touch.destroy(); touch = null; }
    if (insetProbe) { insetProbe.remove(); insetProbe = null; }
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
