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
import { createCamera, updateCamera, addTrauma, isPortraitTouch, phoneCameraZoom, phoneFrame } from './engine/camera.js';
import {
  createRenderer,
  registerLayer,
  renderAll,
  resizeToDisplay,
  LAYERS,
}                              from './engine/render.js';
import { mountGarage, quickDeployPlan } from './ui/garage.js';
import { syncTankFx }          from './ui/tankFx.js';
import { mountSeance }         from './ui/seance.js';
import { injectPossessionCSS } from './ui/possession.js';
import { installAudioGestures, playSfx, SFX, setBusVolume, BUSES } from './engine/audio.js';
import { cueMusic }           from './engine/music.js';
import { loadGameFonts }      from './engine/fonts.js';
import { loadSettings, saveSettings, busLevels } from './engine/settings.js';
import { mountTitle }          from './ui/title.js';
import { mountPauseMenu, mountPauseButton } from './ui/pauseMenu.js';
import {
  gateTick, addHitStop, HITSTOP_HIT_MS, HITSTOP_HURT_MS, traumaForImpact,
  impactsForTick, createSparks, spawnSparks, stepSparks, drawSparks,
}                              from './combat/feel.js';
import { sfxEventsForTick }    from './combat/sfxEvents.js';
import { createArena, updateArena } from './combat/arena.js';
import { combatModsFor }       from './combat/loadoutEffects.js';
import { buildPlayerActions }  from './combat/actions.js';
import { drawWorld,
  drawEntities,
  drawHUD,
  drawFixedHUD,
}                              from './combat/combatRenderer.js';
import { speedPenalty }        from './mech/weight.js';
import { playerKickAmount }    from './combat/hitFeedback.js';
import { canRestart, RESTART_GRACE_MS } from './combat/restart.js';
import { screenToWorld, worldToScreen } from './engine/camera.js';
import { clientToCanvasEl } from './engine/pointer.js';
import { ENEMY_SHOT_WINDUP_MS } from './combat/config.js';
import {
  endCardScale, scaleRects, phoneHudScale, phoneHudViewportH, hudPanelRect, phoneHudRect,
  circleOverlapsRect, drawWindupGlow, drawCompactHp, HUD_UNDER_ALPHA,
  rectsOverlap, playerHpBarScreenRect, playerOnlyState, unsquashTextCtx,
  drawEnemyShotGlow, pushAfterimage, drawDashAfterimages,
}                              from './ui/phoneCombatUi.js';
import { edgeArrowPlacement, drawEdgeArrow, EDGE_ARROW, compactHpLayout, landscapeStripW } from './ui/phoneCombatUi.js';
import { prefersTouchUi, mergeTouchActions, touchLayoutFor, stickRadiusPx, LANDSCAPE_GUTTER_FRAC } from './engine/touch.js';
import { mountTouchControls }  from './ui/touchControls.js';
import {
  beginKillMoment, tickKillMoment, resetKillMoment, shouldDrawEndCard,
  isKillMomentActive, killMomentPhase, drawKillShatter, drawKillFlicker,
  killMomentT01, getKillSnapshot,
}                              from './ui/killMoment.js';
import { formatArenaSpecStamp } from './ui/specStamp.js';
import { SEANCE_DATA_URL }     from './ui/seance.js';
import { drawEndCardView }     from './ui/endCardView.js';
import {
  createTauntMachine, isDemoTaunts, drawPossessedTaunt, specTauntLine, tauntBaselineY,
}                              from './ui/possessedTaunts.js';
import {
  readHauntLevel, setHauntLevel, bumpHauntLevel, applyHauntPressure, drawHauntLevel, MAX_HAUNT_LEVEL,
}                              from './ui/hauntLevel.js';
import { createTellCaption, drawTellCaption } from './ui/tellCaption.js';
import { applyLevelParam } from './ui/levelParam.js';
import { resetHpFx }           from './ui/phoneCombatUi.js';
import {
  createHauntFx, tickHaunt, startGhost, gridAlpha, drawBorderFog,
  drawEctoTrail, drawKillGhost, drawHauntVignette,
}                              from './ui/haunting.js';

// ── Session-level state shared across arena restarts ────────────────────────

/** Set only when a fight ends in a win (never by a loss, REDEPLOY or GARAGE); consumed (once) by startArena. */
let advanceHaunt = false;
/** End-card spec stamp from the build-time seance JSON; null until/unless real data loads. */
let specStampText = null;
let specStampRequested = false;
/** Parsed seance JSON array for the spec-haunted player-death taunt; null until/unless loaded. */
let seanceTasks = null;

/** Fetch the seance JSON once. Real counts only; any failure leaves null. */
function loadSpecStamp() {
  if (specStampRequested || typeof fetch !== 'function') return;
  specStampRequested = true;
  fetch(SEANCE_DATA_URL)
    .then(res => (res.ok ? res.json() : null))
    .then(json => {
      specStampText = formatArenaSpecStamp(json);
      seanceTasks = Array.isArray(json) ? json : null;
    })
    .catch(() => { specStampText = null; seanceTasks = null; });
}

// ── Audio settings (M2): SFX / music volume + mute, persisted ──────────────
let settings = loadSettings();
function applySettings(next) {
  settings = saveSettings(next);
  const lv = busLevels(settings);
  setBusVolume(BUSES.SFX, lv.sfx);
  setBusVolume(BUSES.MUSIC, lv.music);
}

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
  loadGameFonts();   // start fetching the self-hosted faces right away
  canvas.focus();

  // First gesture unlocks Web Audio (iOS); DOM buttons get a UI click.
  installAudioGestures(document);
  applySettings(settings);

  // ?lv=1..5 jumps straight to a HAUNT LV (judges can see the ramp), for that visit only.
  let session = null;
  try { session = globalThis.sessionStorage ?? null; } catch (_) { /* blocked */ }
  applyLevelParam(location.search, { set: setHauntLevel, storage: session });

  // Detect reduced-motion preference.
  const prefersReduced =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  showTitle(renderer, prefersReduced);
}

// ── Title phase (M2) ─────────────────────────────────────────────────────────

function isTouchUi() {
  const coarse = typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;
  return prefersTouchUi({
    maxTouchPoints: navigator.maxTouchPoints,
    matchMediaCoarse: coarse,
    width: window.innerWidth,
  });
}

function showTitle(renderer, reducedMotion) {
  mountTitle(appRoot, {
    touchUi: isTouchUi(),
    hauntLv: readHauntLevel(),
    onDeploy() {
      // Same gesture already unlocked Web Audio (installAudioGestures).
      cueMusic('title-go');
      playSfx(SFX.UI_CLICK);
      const plan = quickDeployPlan();
      if (plan.deployable) {
        loadGameFonts().then(() => startArena(renderer, plan.loadout, plan.totals, reducedMotion));
      } else {
        showGarage(renderer, reducedMotion);
      }
    },
    onGarage() {
      cueMusic('title-go');
      playSfx(SFX.UI_CLICK);
      showGarage(renderer, reducedMotion);
    },
  });
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
  cueMusic('garage');

  const garage = mountGarage(appRoot, {
    onDeploy(loadout, loadoutTotals) {
      garage.destroy();
      // Canvas text must not first-draw in the fallback face (usually
      // already loaded by now; capped wait inside loadGameFonts).
      loadGameFonts().then(() => startArena(renderer, loadout, loadoutTotals, reducedMotion));
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
  // M4.5 loadout effects: set only when the flag is on.
  const combatMods = combatModsFor(loadout);
  if (combatMods) arenaStats.combatMods = combatMods;

  let arenaState = createArena(arenaStats);
  cueMusic('duel');

  // Difficulty ramp (HAUNT LV): applied at spawn, outside createArena math.
  if (advanceHaunt) { bumpHauntLevel(); advanceHaunt = false; }
  const hauntLv = readHauntLevel();
  arenaState = { ...arenaState, enemy: applyHauntPressure(arenaState.enemy, hauntLv) };
  const hauntFx = createHauntFx({
    reducedMotion,
    arena: { width: arenaState.arena.width, height: arenaState.arena.height },
    seed: 7,
    lite: isTouchUi(),   // phones: no vignette, fewer fog puffs (60 fps budget)
  });
  const windupT01 = (enemy) => (enemy && enemy.windupRemainingMs > 0
    ? Math.min(1, Math.max(0, 1 - enemy.windupRemainingMs / ENEMY_SHOT_WINDUP_MS))
    : 0);

  // Kill-moment / taunt / HP-flash presentation state starts clean every match.
  resetKillMoment();
  resetHpFx();
  loadSpecStamp();
  const tauntMachine = createTauntMachine({ demo: isDemoTaunts(location.search) });
  tauntMachine.reset();
  tauntMachine.onSpawn(performance.now());
  let prevWindup = arenaState.enemy.windupRemainingMs ?? 0;
  const tellCaption = createTellCaption({ touchUi: isTouchUi() });
  let cardShownAtMs = 0;     // when the end card first drew (count-up clock)

  // ── Input ──────────────────────────────────────────────────────────────────
  const input = createInputState();
  // Every listener this match adds goes through `on` so cleanup() drops them
  // all at once (they used to pile up across REDEPLOYs).
  const listeners = new AbortController();
  const on = (target, ev, fn) => target.addEventListener(ev, fn, { signal: listeners.signal });

  on(canvas, 'keydown',   e => input.onKeyDown(e));
  on(canvas, 'keyup',     e => input.onKeyUp(e));
  on(canvas, 'mousedown', e => input.onMouseDown(e));
  on(canvas, 'mouseup',   e => input.onMouseUp(e));
  on(canvas, 'mousemove', e => input.onMouseMove(e, canvas));   // canvas px at any DPR
  canvas.focus();

  // ── Pause (M2) + hit-stop + sparks ─────────────────────────────────────────
  let paused = false;
  let pauseMenu = null;
  let hitStopMs = 0;
  const sparks = createSparks();

  // ── Camera ─────────────────────────────────────────────────────────────────
  // Zoom to fit the whole arena into the viewport (1280×800 reference).
  // Uses the *actual* canvas size so it's correct on any display.
  const { width: aw, height: ah } = arenaState.arena;
  const vpW0 = renderer.canvas.width  || 1280;
  const vpH0 = renderer.canvas.height || 800;
  // Touch-UI decision is made once, before the camera, and reused below.
  const coarse = typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;
  const touchUi = prefersTouchUi({
    maxTouchPoints: navigator.maxTouchPoints,
    matchMediaCoarse: coarse,
    width: window.innerWidth,
  });
  // Leave a small margin (factor 0.95) so the wall stroke is never cropped.
  // Landscape phones fit the middle strip so the arena clears the control gutters
  // and the top-left HUD panel.
  const landscapeTouch = touchUi && (canvas.clientWidth || 0) > (canvas.clientHeight || 0);
  const fitZoom = (landscapeTouch
    ? Math.min(landscapeStripW(vpW0, vpW0 / (canvas.clientWidth || vpW0), LANDSCAPE_GUTTER_FRAC) / aw, vpH0 / ah)
    : Math.min(vpW0 / aw, vpH0 / ah)) * 0.95;
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


  // ── Renderer registration ──────────────────────────────────────────────────
  // Clear any callbacks from a previous arena session.
  // (createRenderer always starts clean; we reuse the existing renderer object,
  //  so clear old callbacks by rebuilding them via module-level references.)
  renderer.callbacks[LAYERS.WORLD].length   = 0;
  renderer.callbacks[LAYERS.ENTITY].length  = 0;
  renderer.callbacks[LAYERS.FOG].length     = 0;
  renderer.callbacks[LAYERS.HUD].length     = 0;
  renderer.callbacks[LAYERS.OVERLAY].length = 0;

  registerLayer(renderer, LAYERS.WORLD,   (ctx, st) => {
    drawWorld(ctx, st, gridAlpha(hauntFx.t, windupT01(st.enemy), reducedMotion));
    drawBorderFog(ctx, hauntFx);
  });
  const afterimages = [];
  registerLayer(renderer, LAYERS.ENTITY,  (ctx) => drawEctoTrail(ctx, hauntFx));
  registerLayer(renderer, LAYERS.ENTITY,  (ctx) => drawDashAfterimages(ctx, afterimages));
  registerLayer(renderer, LAYERS.ENTITY,  (ctx, st) => { syncTankFx(st); });
  registerLayer(renderer, LAYERS.ENTITY,  (ctx, st) => drawEntities(ctx, st));
  registerLayer(renderer, LAYERS.ENTITY,  (ctx) => drawSparks(ctx, sparks));
  registerLayer(renderer, LAYERS.ENTITY,  (ctx) => {
    if (killMomentPhase() === 'shatter') {
      drawKillShatter(ctx, getKillSnapshot(), killMomentT01(performance.now()));
    }
  });
  registerLayer(renderer, LAYERS.ENTITY,  (ctx) => drawKillGhost(ctx, hauntFx));
  registerLayer(renderer, LAYERS.FOG,     (ctx) =>
    drawHauntVignette(ctx, hauntFx, renderer.canvas.width, renderer.canvas.height));
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
    // Hide the live HUD once the end card is up so the panel is clean (it stays
    // through the kill moment so the HUD doesn't blink out mid-hit-stop).
    if (st.phase !== 'playing' && shouldDrawEndCard()) return;
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
    const TL = touchLayoutFor(cssW, cssH);
    const bottomLimit = Math.min(
      TL.fire.cyFrac * cssH - TL.fire.rFrac * Math.min(cssW, cssH),
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
    const nowMs = performance.now();
    const hudScale = touchUi ? uiDpr : 1;

    // CRT flicker after the shatter (opacity-capped inside drawKillFlicker).
    if (killMomentPhase() === 'flicker') {
      drawKillFlicker(ctx, vpW, vpH, killMomentT01(nowMs));
    }

    // HAUNT LV label: top-right, clear of the top-left phone HUD and the pads.
    drawHauntLevel(ctx, hauntLv, {
      x: vpW - 8 * hudScale, y: (8 + insetTop) * hudScale, align: 'right', scale: hudScale,
    });

    const cardUp = shouldDrawEndCard();

    // One-time tell caption (first windup ever), under the HUD row.
    if (!cardUp) {
      const hr = phonePortrait ? phoneHudRect(phoneHudScale(uiDpr)) : null;
      const capTop = hr ? (hr.y + hr.h) / hudScale + 8 : 32 + insetTop;
      drawTellCaption(ctx, tellCaption.current(nowMs), { x: vpW / 2, y: capTop * hudScale, scale: hudScale });
    }

    // Possessed taunt. While playing it floats above the enemy (screen space,
    // clamped); once the end card is up it sits near the top so the veil
    // doesn't swallow the death line.
    const taunt = tauntMachine.current();
    let afterCard = null;
    if (taunt) {
      let tx;
      let ty;
      if (cardUp) {
        tx = vpW / 2;
        ty = (56 + insetTop) * hudScale;
      } else {
        const sp = worldToScreen(st.enemy.x, st.enemy.y, camera, vpW, vpH,
          shakeX + kickX, shakeY + kickY);
        tx = sp.sx;
        // Above the enemy's HOUND label with a gap (bug 2: it used to sit on it).
        const cl = compactHpLayout('enemy');
        // Portrait: keep the line under the HUD panel row, too.
        const hudR = phonePortrait ? phoneHudRect(phoneHudScale(uiDpr)) : null;
        ty = tauntBaselineY({ enemyY: sp.sy, zoom: camera.zoom, scale: hudScale, vpH,
          insetTop: hudR ? Math.max(insetTop, (hudR.y + hudR.h) / hudScale) : insetTop,
          ...(phonePortrait ? { labelTopWu: cl.offsetY + cl.h + 2 + cl.fontPx } : {}) });
      }
      if (!cardUp) drawPossessedTaunt(ctx, taunt, { x: tx, y: ty, scale: hudScale });
      else afterCard = { x: tx, y: ty, scale: hudScale };
    }

    // End card — only once the kill moment has finished.
    if (!cardUp) { endCardButtons = null; return; }
    if (cardShownAtMs === 0) {
      cardShownAtMs = nowMs;
      cueMusic(st.phase === 'win' ? 'win' : 'lose');
    }
    const restartReady = canRestart(phaseEndedAtMs, nowMs, null);
    const cardOpts = { shownAtMs: cardShownAtMs, nowMs, specStamp: specStampText,
      level: hauntLv, maxLevel: MAX_HAUNT_LEVEL };
    if (touchUi) {
      const { sx, sy } = endCardScale({
        touchUi, dpr: uiDpr, cssW: canvas.clientWidth || window.innerWidth,
      });
      ctx.save();
      ctx.scale(sx, sy);
      const result = drawEndCardView(unsquashTextCtx(ctx, sy / sx), st, camera, vpW / sx, vpH / sy, restartReady, focusIndex, cardOpts);
      ctx.restore();
      endCardButtons = result ? scaleRects(result.buttons, sx, sy) : null;
    } else {
      const result = drawEndCardView(ctx, st, camera, vpW, vpH, restartReady, focusIndex, cardOpts);
      endCardButtons = result ? result.buttons : null;
    }
    if (afterCard) drawPossessedTaunt(ctx, taunt, afterCard);
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
  on(canvas, 'mousedown', onCanvasMouseDown);

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

    // Translate client coords → canvas pixel coords (shared pointer mapping).
    const { x: px, y: py } = clientToCanvasEl(e.clientX, e.clientY, canvas);

    const hit = buttonAtPoint(px, py);
    if (!hit) return;
    focusIndex    = hit.id === 'retry' ? 0 : 1;
    pendingAction = hit.id;
  }

  on(canvas, 'keydown', onCardKeyDown);
  on(canvas, 'click',   onCardClick);

  // ── Pause: Esc / P, the phone button, or the tab going hidden ─────────────
  function setPaused(want) {
    if (want === paused) return;
    if (want && arenaState.phase !== 'playing') return;   // not mid kill moment / card
    paused = want;
    input.reset();
    if (paused) {
      pauseMenu = mountPauseMenu(appRoot, {
        settings,
        onChange: applySettings,
        onPreview: () => playSfx(SFX.PLAYER_SHOT),
        touchUi,
        onResume: () => setPaused(false),
        onQuit: () => { setPaused(false); pendingAction = 'garage'; },
      });
    } else {
      if (pauseMenu) { pauseMenu.destroy(); pauseMenu = null; }
      canvas.focus();
    }
  }
  on(window, 'keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (arenaState.phase !== 'playing') return;
      e.preventDefault();
      setPaused(!paused);
    }
  });
  on(document, 'visibilitychange', () => { if (document.hidden) setPaused(true); });

  // ── Touch controls (phones/tablets only) ───────────────────────────────────
  let touch = null;
  let pauseBtn = null;
  if (touchUi) {
    touch = mountTouchControls(document.body, {
      getViewport: () => ({ width: window.innerWidth, height: window.innerHeight }),
    });
    pauseBtn = mountPauseButton(document.body, () => setPaused(true));
  }

  /** Client CSS px → canvas px (shared pointer mapping) → world. */
  function touchScreenToWorld(p) {
    const c = clientToCanvasEl(p.x, p.y, canvas);
    const { wx, wy } = screenToWorld(
      c.x, c.y, camera,
      renderer.canvas.width, renderer.canvas.height, shakeX, shakeY,
    );
    return { x: wx, y: wy };
  }

  /** One fixed sim step: input → arena → SFX + M2 feel. */
  function stepSim(dt) {
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
      actions = mergeTouchActions(actions, touch.sample(), touchScreenToWorld, arenaState.player);
    }

    // Step the arena, then voice whatever happened this tick (M1 SFX).
    const prevState = arenaState;
    arenaState = updateArena(arenaState, actions, dt);
    const sfxEvents = sfxEventsForTick(prevState, arenaState);
    for (const name of sfxEvents) playSfx(name);
    pushAfterimage(afterimages, arenaState.player);

    // M2 feel: sparks at the impact point, hit-stop, shake scaled by hit.
    const ended = arenaState.phase !== 'playing';
    for (const hit of impactsForTick(prevState, arenaState)) {
      const onEnemy = hit.target === 'enemy';
      spawnSparks(sparks, {
        x: hit.x, y: hit.y, angle: hit.angle,
        count: reducedMotion ? 4 : (onEnemy ? 9 : 7), hot: !onEnemy,
      });
      if (!ended) {
        hitStopMs = addHitStop(hitStopMs, onEnemy ? HITSTOP_HIT_MS : HITSTOP_HURT_MS);
        camera = addTrauma(camera, traumaForImpact(onEnemy ? 'hit' : 'hurt', hit.damage, reducedMotion));
      }
      // R10 player screen kick on hit — 2–4 px, OFF under reduced motion.
      if (!onEnemy) {
        const kick = playerKickAmount(reducedMotion);
        if (kick > 0) {
          const dir = Math.random() * Math.PI * 2;
          kickX = Math.cos(dir) * kick;
          kickY = Math.sin(dir) * kick;
        }
      }
    }
    if (ended) {
      const dead = arenaState.phase === 'win' ? arenaState.enemy : arenaState.player;
      spawnSparks(sparks, {
        x: dead.x, y: dead.y, angle: 0, spread: Math.PI, speed: 420,
        count: reducedMotion ? 8 : 28, hot: arenaState.phase === 'win',
      });
      camera = addTrauma(camera, traumaForImpact('kill', 0, reducedMotion));
    }
    // Firing recoil: a 1.5 px screen nudge against the aim (off when reduced).
    if (!reducedMotion && sfxEvents.includes('playerShot')) {
      const a = arenaState.player.angle ?? 0;
      kickX -= Math.cos(a) * 1.5;
      kickY -= Math.sin(a) * 1.5;
    }

    // Taunt on the enemy's windup edge (0 → >0).
    const windupNow = arenaState.enemy.windupRemainingMs ?? 0;
    if (prevWindup <= 0 && windupNow > 0) {
      tauntMachine.onWindup(performance.now());
      tellCaption.onWindup(performance.now());
    }
    prevWindup = windupNow;

    // Taunts on player damage and on the first drop to 25% HP or less.
    const hpBefore = prevState.player.hp;
    const hpNow = arenaState.player.hp;
    if (arenaState.phase === 'playing') {
      if (hpNow < hpBefore) tauntMachine.onHit(performance.now());
      if (hpNow > 0 && hpNow <= 0.25 * arenaState.player.maxHp) tauntMachine.onLowHp(performance.now());
    }

    // Playing → win/lose: start the kill moment (the early return above
    // freezes combat for the hit-stop). The restart grace starts later, with
    // the end card (see the non-playing branch above).
    if (arenaState.phase !== 'playing') {
      const killNow = performance.now();
      beginKillMoment({
        phase: arenaState.phase, enemy: arenaState.enemy, nowMs: killNow, reducedMotion,
      });
      const wreck = arenaState.phase === 'win' ? arenaState.enemy : arenaState.player;
      startGhost(hauntFx, wreck.x, wreck.y);
      if (arenaState.phase === 'win') {
        advanceHaunt = true;
        tauntMachine.onDeath(killNow);
      } else if (arenaState.phase === 'lose') {
        tauntMachine.onPlayerDeath(killNow, specTauntLine(seanceTasks));
      }
      if (touch) touch.setActive(false);
    }

  }

  /** Per-tick presentation: sparks, kick decay, camera follow + shake. */
  function stepPresentation(dt) {
    const vpW = renderer.canvas.width;
    const vpH = renderer.canvas.height;
    tickHaunt(hauntFx, dt * 1000, arenaState.phase === 'playing' ? arenaState.enemy : null);
    stepSparks(sparks, dt);
    // Decay the kick toward zero so it reads as a single punch (~120 ms).
    const kickDecay = Math.max(0, 1 - dt * 8);
    kickX *= kickDecay;
    kickY *= kickDecay;

    // Camera: pin to arena centre when arena fits the viewport; follow +
    // clamp when the arena is larger than the viewport (R11).
    // Portrait phone: frame both tanks inside the band between the HUD panel
    // and the touch controls, easing the zoom.
    let camTarget = arenaState.player;
    if (phonePortrait) {
      const cssW = canvas.clientWidth || window.innerWidth;
      const cssH = canvas.clientHeight || window.innerHeight;
      const hudR = phoneHudRect(phoneHudScale(uiDpr));
      const L = touchLayoutFor(cssW, cssH);
      const topControlPx = (L.fire.cyFrac * cssH - L.fire.rFrac * Math.min(cssW, cssH)) * uiDpr;
      const f = phoneFrame({
        player: arenaState.player,
        enemy: arenaState.enemy,
        fitZoom,
        maxZoom: startZoom,
        vpW,
        vpH,
        topPx: hudR.y + hudR.h + 8 * uiDpr,
        bottomPx: vpH - topControlPx,
        marginY: 110,   // the enemy's compact HP label sits ~92 wu above it
      });
      camera = { ...camera, zoom: camera.zoom + (f.zoom - camera.zoom) * Math.min(1, dt * 3) };
      camTarget = { x: f.x, y: f.y };
    }
    const cameraResult = updateCamera(
      camera,
      camTarget,
      dt,
      arenaState.arena,
      vpW,
      vpH,
    );
    camera = cameraResult.camera;
    shakeX = cameraResult.shakeX;
    shakeY = cameraResult.shakeY;
  }

  // ── Loop ───────────────────────────────────────────────────────────────────
  const loop = startLoop({
    update(dt) {
      // Handle an end-card action (RETRY / GARAGE); both tear down the loop.
      if (pendingAction) {
        const action = pendingAction;
        pendingAction = null;
        playSfx(SFX.UI_CLICK);
        loop.stop();
        cleanup();
        if (action === 'retry') {
          // REDEPLOY does not ramp by itself: advanceHaunt was set only if this
          // match ended in a win, so a loss + REDEPLOY keeps the same level.
          // Restart a fresh match with the SAME loadout (R8).
          startArena(renderer, loadout, loadoutTotals, reducedMotion);
        } else {
          // GARAGE — reopen the garage (a win already flagged the ramp; a loss keeps the level).
          showGarage(renderer, reducedMotion);
        }
        return;
      }

      // Pause freezes everything (sim, hit-stop timer, camera, sparks).
      const gate = gateTick({ paused, hitStopMs }, dt * 1000);
      hitStopMs = gate.hitStopMs;
      if (gate.paused) return;

      // Once the match is decided, stop the sim but keep sparks + shake alive.
      if (arenaState.phase !== 'playing') {
        if (touch) touch.setActive(false);
        // The restart grace starts together with the end card, not the kill moment.
        if (phaseEndedAtMs === 0 && shouldDrawEndCard()) {
          phaseEndedAtMs = performance.now();
        }
        stepPresentation(dt);
        return;
      }

      // Hit-stop freezes the sim; camera shake + sparks keep moving.
      if (gate.step) stepSim(dt);
      stepPresentation(dt);
    },

    render(_alpha) {
      const nowMs = performance.now();
      tickKillMoment(nowMs);
      tauntMachine.tick(nowMs);
      if (touch) {
        touch.setDashCooldown(
          arenaState.player.dashCooldownMs ?? 0,
          arenaState.player.dashCooldownBaseMs ?? 0,
        );
      }
      renderAll(renderer, arenaState, camera, shakeX + kickX, shakeY + kickY);
    },
  });

  // ── Cleanup helper ─────────────────────────────────────────────────────────
  function cleanup() {
    listeners.abort();
    if (pauseMenu) { pauseMenu.destroy(); pauseMenu = null; }
    if (pauseBtn) { pauseBtn.destroy(); pauseBtn = null; }
    if (touch) { touch.destroy(); touch = null; }
    resetKillMoment();
    tauntMachine.reset();
    if (insetProbe) { insetProbe.remove(); insetProbe = null; }
    renderer.callbacks[LAYERS.WORLD].length   = 0;
    renderer.callbacks[LAYERS.ENTITY].length  = 0;
    renderer.callbacks[LAYERS.FOG].length     = 0;
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
