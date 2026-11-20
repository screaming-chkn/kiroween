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
import { createCamera, updateCamera, addTrauma, isPortraitTouch, phoneCameraZoom, phoneFrame, cameraYForEqualTauntBottomGap } from './engine/camera.js';
import {
  createRenderer,
  registerLayer,
  renderAll,
  resizeToDisplay,
  LAYERS,
}                              from './engine/render.js';
import { mountGarage, quickDeployPlan } from './ui/garage.js';
import { syncTankFx }          from './ui/tankFx.js';
import { setTankStyle, TANK_STYLE_NAMES } from './ui/tankWire.js';
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
}                              from './combat/combatRenderer.js';
import {
  drawScreenHpMeters, SCREEN_HP_LAYOUT, arenaTopLineSy, arenaTopLineTopSy, arenaBottomLineSy, meterTopInset,
  meterSideReserve, arenaSideEdges, sideOutGeometry, METER_FIELD_GAP, METER_LABEL_GAP, TAUNT_HP_GAP,
} from './combat/screenHpMeters.js';
import { drawTopBarHud, topBarHeight, TOP_BAR } from './combat/topBarHud.js';
import { drawGhostPerk } from './combat/ghostPerk.js';
import { speedPenalty }        from './mech/weight.js';
import { playerKickAmount }    from './combat/hitFeedback.js';
import { canRestart, RESTART_GRACE_MS } from './combat/restart.js';
import { screenToWorld, worldToScreen } from './engine/camera.js';
import { clientToCanvasEl } from './engine/pointer.js';
import { ENEMY_SHOT_WINDUP_MS } from './combat/config.js';
import {
  endCardScale, scaleRects,
  drawWindupGlow,
  unsquashTextCtx,
  drawEnemyShotGlow, pushAfterimage, drawDashAfterimages,
}                              from './ui/phoneCombatUi.js';
import { edgeArrowPlacement, drawEdgeArrow, EDGE_ARROW, landscapeStripW, HUD_SPACE } from './ui/phoneCombatUi.js';
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
  createTauntMachine, isDemoTaunts, drawPossessedTaunt, specTauntLine,
  tauntUnderLineY, tauntAboveLineY, TAUNT_ABOVE_GAP,
}                              from './ui/possessedTaunts.js';
import {
  readHauntLevel, setHauntLevel, bumpHauntLevel, applyHauntPressure, MAX_HAUNT_LEVEL,
}                              from './ui/hauntLevel.js';
import { createTellCaption, drawTellCaption } from './ui/tellCaption.js';
import { applyLevelParam } from './ui/levelParam.js';
import { resetHpFx }           from './ui/phoneCombatUi.js';
import {
  createHauntFx, tickHaunt, startGhost, gridAlpha, drawBorderFog,
  drawEctoTrail, drawKillGhost, drawHauntVignette,
}                              from './ui/haunting.js';
import { readGutterHaunt, drawGutterHaunt } from './ui/gutterHaunt.js';

// ── Session-level state shared across arena restarts ────────────────────────

/** Set only when a fight ends in a win (never by a loss, REDEPLOY or GARAGE); consumed (once) by startArena. */
let advanceHaunt = false;
/** End-card spec stamp from the build-time seance JSON; null until/unless real data loads. */
let specStampText = null;
let specStampRequested = false;
/** Parsed seance JSON array for the spec-haunted player-death taunt; null until/unless loaded. */
let seanceTasks = null;
/** C9b gutter haunt style: 'silver' | 'purple' | 'off'. */
let gutterHauntStyle = 'silver';

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
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => resizeToDisplay(renderer));
  }

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

  // Tank silhouette (draw-only). Default wheeled; override with ?tank= or __HH_TANK_STYLE__.
  try {
    const params = new URLSearchParams(location.search.startsWith('?') ? location.search.slice(1) : location.search);
    const raw = params.get('tank') || globalThis.__HH_TANK_STYLE__ || null;
    if (raw && TANK_STYLE_NAMES.includes(raw)) setTankStyle(raw);
  } catch (_) { /* ignore */ }
  globalThis.__HH_SET_TANK_STYLE__ = (v) => { if (TANK_STYLE_NAMES.includes(v)) setTankStyle(v); };

  // C9b gutter haunt: ?gutter=silver|purple|off (default silver, ~5% opacity).
  gutterHauntStyle = readGutterHaunt(location.search);
  try {
    if (globalThis.__HH_GUTTER__) gutterHauntStyle = readGutterHaunt('gutter=' + globalThis.__HH_GUTTER__);
    const ga = new URLSearchParams(location.search.startsWith('?') ? location.search.slice(1) : location.search).get('gutterAlpha');
    if (ga != null && Number.isFinite(Number(ga))) globalThis.__HH_GUTTER_ALPHA__ = Number(ga);
  } catch (_) { /* ignore */ }
  globalThis.__HH_SET_GUTTER__ = (v) => { gutterHauntStyle = readGutterHaunt('gutter=' + v); };
  globalThis.__HH_GUTTER_STYLE__ = () => gutterHauntStyle;


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

  // Difficulty ramp (HAUNT LV): applied at spawn, outside createArena math.
  // Read the level first: the Sever Wall (LV3+) is part of the arena itself.
  if (advanceHaunt) { bumpHauntLevel(); advanceHaunt = false; }
  const hauntLv = readHauntLevel();

  let arenaState = createArena(arenaStats, { enableGhostPerk: true, hauntLv });
  cueMusic('duel');

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
  // Desktop reserves the top strip band above and below so the arena's green
  // line clears the top HUD strip (arena stays centred, zoom drops ~5%).
  const stripReserve = 2 * (TOP_BAR.rowH + 4) * (touchUi ? vpW0 / (canvas.clientWidth || vpW0) : 1);
  // C5: ~10% wider landscape field vs C4. C4's landscapeStripW was capped by the
  // old top-left HUD panel clearance; that panel is gone (C4 top strip), so we
  // grow the strip 10% from that base, still capped by the control gutters.
  // Height fit is unchanged (already maxed on 844×390).
  const uiDprFit = vpW0 / (canvas.clientWidth || vpW0);
  const landStripBase = landscapeStripW(vpW0, uiDprFit, LANDSCAPE_GUTTER_FRAC);
  const landStrip = Math.min(vpW0 * (1 - 2 * LANDSCAPE_GUTTER_FRAC), landStripBase * 1.1);
  const fitZoom = (landscapeTouch
    ? Math.min(landStrip / aw, (vpH0 - stripReserve) / ah)
    : Math.min(vpW0 / aw, (vpH0 - (touchUi ? 0 : stripReserve)) / ah)) * (touchUi ? 0.95 : 1);
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
  // C6: landscape/desktop — bottom letterbox matches taunt↔field gap (shift field down).
  // Portrait phoneFrame path keeps arena-centre Y.
  const hudScale0 = touchUi ? (canvas.width / (canvas.clientWidth || canvas.width)) : 1;
  const equalBottomGapCanvas = phonePortrait ? null : TAUNT_ABOVE_GAP * hudScale0;
  const startCamY = equalBottomGapCanvas == null
    ? ah / 2
    : cameraYForEqualTauntBottomGap({
        arenaH: ah,
        zoom: startZoom,
        vpH: vpH0,
        gapCanvas: equalBottomGapCanvas,
      });
  let camera = createCamera({
    x:            aw / 2,
    y:            startCamY,
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
  registerLayer(renderer, LAYERS.ENTITY,  (ctx, st) => drawGhostPerk(ctx, st.ghostPerk, st.elapsedMs ?? 0));
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
  // World-space over-mech HP bars removed — meters live in screen space
  // (drawScreenHpMeters on OVERLAY). Legacy drawHUD/drawCompactHp remain for unit tests.
  registerLayer(renderer, LAYERS.HUD,     (_ctx, _st) => {});

  // C4: slim top strip (timer + LV) ABOVE the green field; HP meters OUTSIDE
  // the L/R borders; taunt just ABOVE the field top. Scale = canvas/CSS px.
  const hudScale = touchUi ? uiDpr : 1;
  const stripOpts = () => ({
    scale: hudScale, hauntLv,
    insetTop: phonePortrait ? insetTop : 0,
    pauseReserve: touchUi ? TOP_BAR.pauseReserve : 0,
    compact: landscapeTouch,   // one short timer-centric row
  });
  const stripBottomPx = (vpW) => topBarHeight(vpW, hudScale, stripOpts());
  /** Bottom edge of the green line (canvas px); never above the strip bottom. */
  const lineBottomPx = (vpW, vpH) => Math.max(
    arenaTopLineSy(camera, vpW, vpH, shakeX + kickX, shakeY + kickY, aw / 2),
    stripBottomPx(vpW),
  );
  const meterGeomOpts = () => {
    const vpW = renderer.canvas.width;
    const vpH = renderer.canvas.height;
    const edges = arenaSideEdges(camera, vpW, vpH, aw,
      { shakeX: shakeX + kickX, shakeY: shakeY + kickY });
    // C9: meter TOP aligns exactly to the arena top border line (lineTop).
    // Bars sit just outside L/R with HUD_SPACE gap; names stay far outward.
    const lb = lineBottomPx(vpW, vpH);
    const lt = Math.min(
      arenaTopLineTopSy(camera, vpW, vpH, shakeX + kickX, shakeY + kickY, aw / 2),
      lb,
    );
    return {
      layout: SCREEN_HP_LAYOUT,
      scale: hudScale,
      compact: !!landscapeTouch,
      arenaLeft: edges.left,
      arenaRight: edges.right,
      topInset: lt,
      gapCss: METER_FIELD_GAP,
    };
  };

  registerLayer(renderer, LAYERS.OVERLAY, (ctx, st) => {
    // Hide the live HUD once the end card is up so the panel is clean (it stays
    // through the kill moment so the HUD doesn't blink out mid-hit-stop).
    if (st.phase !== 'playing' && shouldDrawEndCard()) return;
    const vpW = renderer.canvas.width;
    const vpH = renderer.canvas.height;
    // C9b: faint spectral filigree in letterbox gutters only (under HUD text).
    // Use unshaken arena edges so the pattern doesn't jitter with kick/shake.
    {
      const edges = arenaSideEdges(camera, vpW, vpH, aw, {});
      const top = arenaTopLineTopSy(camera, vpW, vpH, 0, 0, aw / 2);
      const bottom = arenaBottomLineSy(camera, vpW, vpH, ah, 0, 0, aw / 2);
      const gutterAlpha = Number(globalThis.__HH_GUTTER_ALPHA__);
      drawGutterHaunt(ctx, {
        vpW, vpH,
        left: edges.left, right: edges.right,
        top, bottom,
        style: gutterHauntStyle,
        tMs: st.elapsedMs ?? 0,
        alpha: Number.isFinite(gutterAlpha) ? gutterAlpha : undefined,
      });
    }
    drawTopBarHud(ctx, st, vpW, stripBottomPx(vpW), stripOpts());

    // C4 side-out HP meters — outside the green L/R borders.
    const lineBottom = lineBottomPx(vpW, vpH);
    const lineTop = Math.min(
      arenaTopLineTopSy(camera, vpW, vpH, shakeX + kickX, shakeY + kickY, aw / 2),
      lineBottom,
    );
    const meterOpts = { ...meterGeomOpts() };
    drawScreenHpMeters(ctx, st, vpW, vpH, meterOpts);

    // Field-edge probe for shots-hud-c4 (meters outside; taunt above).
    if (st.phase === 'playing') {
      const g = sideOutGeometry(vpW, vpH, meterOpts);
      const tauntBaseline = tauntAboveLineY({ lineTop, scale: hudScale, gap: TAUNT_ABOVE_GAP });
      const fontPx = Math.max(12, Math.round(12 * hudScale));
      const tauntTop = Math.max(stripBottomPx(vpW) + 2 * hudScale, tauntBaseline - fontPx);
      const tauntBottom = tauntBaseline; // alphabetic ≈ glyph bottom
      const fieldBottom = arenaBottomLineSy(
        camera, vpW, vpH, ah, shakeX + kickX, shakeY + kickY, aw / 2,
      );
      // C8 spacing probe (CSS px); unit = HUD_SPACE
      const cssW = canvas.clientWidth || window.innerWidth;
      const cssH = canvas.clientHeight || window.innerHeight;
      const TL = touchLayoutFor(cssW, cssH);
      const minDim = Math.min(cssW, cssH);
      const stickR = stickRadiusPx(cssW, cssH);
      const stickX = TL.stickRest.xFrac * cssW;
      const stickY = TL.stickRest.yFrac * cssH;
      const fireR = TL.fire.rFrac * minDim;
      const fireX = TL.fire.cxFrac * cssW;
      const fireY = TL.fire.cyFrac * cssH;
      const dashR = TL.dash.rFrac * minDim;
      const dashX = TL.dash.cxFrac * cssW;
      const dashY = TL.dash.cyFrac * cssH;
      globalThis.__HH_HUD_Y__ = {
        unit: 'canvasPx',
        scale: hudScale,
        hudSpace: HUD_SPACE,
        lineTop,
        lineBottom,
        fieldBottom,
        meterTop: g.top,
        playerMeterRight: g.player.x + g.player.w,
        enemyMeterLeft: g.enemy.x,
        arenaLeft: g.arenaLeft ?? meterOpts.arenaLeft,
        arenaRight: g.arenaRight ?? meterOpts.arenaRight,
        tauntTop,
        tauntBottom,
        playerGapCss: ((g.arenaLeft ?? meterOpts.arenaLeft) - (g.player.x + g.player.w)) / hudScale,
        enemyGapCss: (g.enemy.x - (g.arenaRight ?? meterOpts.arenaRight)) / hudScale,
        tauntGapCss: (lineTop - tauntBottom) / hudScale,
        bottomGapCss: (vpH - fieldBottom) / hudScale,
        stickToLeftEdgeCss: stickX - stickR,
        stickToBottomEdgeCss: cssH - (stickY + stickR),
        fireToRightEdgeCss: cssW - (fireX + fireR),
        fireToBottomEdgeCss: cssH - (fireY + fireR),
        dashToRightEdgeCss: cssW - (dashX + dashR),
        // C9e: hard gaps — FAIL field-check if meter↔HP < 8 or taunt↔HP < 16
        meterLabelGapCss: g.gap / hudScale,
        meterLabelGapMinCss: METER_LABEL_GAP,
        tauntHpGapCss: TAUNT_HP_GAP,
        tauntSidePadCss: meterSideReserve(vpW, vpH, meterOpts) / hudScale,
        playerLabelAnchorX: g.player.labelX,
        enemyLabelAnchorX: g.enemy.labelX,
        playerBarX: g.player.barX,
        enemyBarX: g.enemy.barX,
        playerMeterToLabelCss: (g.player.barX - g.player.labelX) / hudScale,
        enemyMeterToLabelCss: (g.enemy.labelX - (g.enemy.barX + g.thick)) / hudScale,
      };
      globalThis.__HH_HUD_FIELD__ = globalThis.__HH_HUD_Y__;
      // Screen-space player centre for close-up crops (CSS px via scale).
      try {
        const pw = arenaState.player;
        if (pw) {
          const sx = (pw.x - camera.x) * camera.zoom + vpW / 2 + (shakeX + kickX);
          const sy = (pw.y - camera.y) * camera.zoom + vpH / 2 + (shakeY + kickY);
          globalThis.__HH_PLAYER_SCREEN__ = { x: sx / hudScale, y: sy / hudScale, scale: hudScale };
        }
      } catch (_) {}

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
    const hud = { x: 0, y: 0, w: cssW, h: stripBottomPx(vpW) / uiDpr };
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

    // CRT flicker after the shatter (opacity-capped inside drawKillFlicker).
    if (killMomentPhase() === 'flicker') {
      drawKillFlicker(ctx, vpW, vpH, killMomentT01(nowMs));
    }

    // HAUNT LV now lives in the top strip (drawTopBarHud).

    const cardUp = shouldDrawEndCard();

    // One-time tell caption (first windup ever), under the meters' top and the
    // taunt line: 36 CSS px below the green line's bottom edge.
    const lineBottom = lineBottomPx(vpW, vpH);
    if (!cardUp) {
      const capTop = lineBottom / hudScale + 36;
      drawTellCaption(ctx, tellCaption.current(nowMs), { x: vpW / 2, y: capTop * hudScale, scale: hudScale });
    }

    // Possessed taunt. C9 in-fight: centred ABOVE the neon field top (HUD_SPACE
    // gap); plate/multi-line grow upward. End card: near the top.
    // Shot/debug: __HH_FORCE_TAUNT__ = full string to show (typed instantly).
    const forcedTaunt = typeof globalThis.__HH_FORCE_TAUNT__ === 'string' && globalThis.__HH_FORCE_TAUNT__
      ? {
          text: globalThis.__HH_FORCE_TAUNT__,
          typed: globalThis.__HH_FORCE_TAUNT__,
          alpha: 1,
          speaker: 'hound',
          color: '#FF4D5E',
        }
      : null;
    const taunt = forcedTaunt || tauntMachine.current();
    let afterCard = null;
    if (taunt) {
      let tx = vpW / 2;
      let ty;
      const sidePad = meterSideReserve(vpW, vpH, meterGeomOpts());
      if (cardUp) {
        ty = (56 + insetTop) * hudScale;
      } else {
        const lineTop = Math.min(
          arenaTopLineTopSy(camera, vpW, vpH, shakeX + kickX, shakeY + kickY, aw / 2),
          lineBottom,
        );
        ty = tauntAboveLineY({ lineTop, scale: hudScale, gap: TAUNT_ABOVE_GAP });
        // Keep clear of the slim top strip.
        const minBase = stripBottomPx(vpW) + 14 * hudScale;
        if (ty < minBase) ty = minBase;
      }
      if (!cardUp) drawPossessedTaunt(ctx, taunt, { x: tx, y: ty, scale: hudScale, sidePad });
      else afterCard = { x: tx, y: ty, scale: hudScale, sidePad };
    }

    // End card — only once the kill moment has finished.
    if (!cardUp) { endCardButtons = null; return; }
    if (cardShownAtMs === 0) {
      cardShownAtMs = nowMs;
      focusIndex = 0; // always open on REDEPLOY (a/d during death used to flip focus)
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
    // Arrows + Tab only. Do not bind a/d — those are move keys and flip focus
    // to GARAGE when the player dies while strafing.
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Tab') {
      e.preventDefault();
      if (e.key === 'ArrowLeft') focusIndex = 0;
      else if (e.key === 'ArrowRight') focusIndex = 1;
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
      getViewport: () => {
        const vv = window.visualViewport;
        return {
          width: (vv && vv.width) || window.innerWidth,
          height: (vv && vv.height) || window.innerHeight,
        };
      },
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
      const L = touchLayoutFor(cssW, cssH);
      const topControlPx = (L.fire.cyFrac * cssH - L.fire.rFrac * Math.min(cssW, cssH)) * uiDpr;
      const f = phoneFrame({
        player: arenaState.player,
        enemy: arenaState.enemy,
        fitZoom,
        maxZoom: startZoom,
        vpW,
        vpH,
        topPx: stripBottomPx(vpW) + 8 * uiDpr,
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
      equalBottomGapCanvas == null ? null : { bottomGapCanvas: equalBottomGapCanvas },
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
