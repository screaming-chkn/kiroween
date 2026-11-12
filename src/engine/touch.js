/**
 * src/engine/touch.js — Phone/touch input: PURE logic (no DOM required).
 *
 * This module provides the math and state machine for an on-screen twin-ish
 * control scheme:
 *   • Left half  → virtual movement stick (drag to steer).
 *   • Bottom-right → FIRE button (held = firing).
 *   • Above fire → DASH button (held = dash; arena buffers the press like Shift).
 *
 * Everything here is framework-free and DOM-free so it runs under plain Node
 * for tests. The DOM overlay in src/ui/touchControls.js wires real pointer
 * events into createTouchController().
 *
 * Aim model (simple twin-stick, predictable):
 *   • FIRE finger down and dragged past the dead-zone from where it touched
 *     down → aim direction = that drag direction.
 *   • Else if the move stick is active → aim direction = move direction.
 *   • Else keep the last aim direction (initially right, {1,0}).
 *   aimScreen = viewport centre + dir * 0.35 * min(vpW, vpH), always non-null,
 *   in CSS px. mergeTouchActions() converts it to world space.
 *
 * No hex or game-state effect may ever disable input (steering rule): this
 * module never checks or applies any such flag.
 */

// ── Layout constants (fractions of the viewport) ─────────────────────────────

/**
 * Touch control layout expressed as fractions of viewport width/height.
 * hitTestTouchControl() turns these into concrete pixel rects per frame so the
 * layout scales to any screen (390×844 portrait phone, 1280×800 desktop, …).
 *
 * Zones:
 *   • stick  — left ~45% width, bottom ~55% height. The stick origin recenters
 *              on the initial touch-down within this zone.
 *   • fire   — round button near the bottom-right corner.
 *   • dash   — round button above / inboard of fire.
 */
export const TOUCH_LAYOUT = Object.freeze({
  // Movement-stick activation zone (anchored bottom-left).
  stick: Object.freeze({
    xFrac: 0,        // left edge
    yFrac: 0.45,     // starts 45% down → occupies bottom 55% height
    wFrac: 0.45,     // left 45% width
    hFrac: 0.55,
  }),
  // Visual stick base radius (fraction of the smaller viewport dimension).
  stickRadiusFrac: 0.14,
  // Dead-zone as a fraction of the stick radius: tiny wobbles = no movement.
  deadzone: 0.18,

  // FIRE button — centre + radius as fractions of the viewport.
  fire: Object.freeze({
    cxFrac: 0.86,    // 86% across (near right edge)
    cyFrac: 0.80,    // 80% down   (near bottom)
    rFrac:  0.11,    // radius vs min(vpW, vpH)
  }),
  // DASH button — above / inboard of fire.
  dash: Object.freeze({
    cxFrac: 0.68,
    cyFrac: 0.66,
    rFrac:  0.085,
  }),
});

// ── Pure geometry helpers ────────────────────────────────────────────────────

/**
 * Compute the normalised stick vector from an origin to a pointer.
 *
 * The raw offset is divided by `radius` and clamped to a unit circle, then the
 * dead-zone is applied: if the magnitude is below `deadzone` (as a fraction of
 * the radius) the result is null (treated as "no movement").
 *
 * The returned dx/dy are in screen space (y grows downward), each in −1..1.
 * Magnitude is capped at 1 so pulling far past the base does not run faster.
 *
 * @param {number} originX   Stick base centre X (screen px).
 * @param {number} originY   Stick base centre Y (screen px).
 * @param {number} pointerX  Current finger X (screen px).
 * @param {number} pointerY  Current finger Y (screen px).
 * @param {number} radius    Stick base radius (screen px).
 * @param {number} [deadzone] Dead-zone as a fraction of the radius.
 * @returns {{ dx: number, dy: number } | null}
 */
export function stickVectorFromPointer(
  originX,
  originY,
  pointerX,
  pointerY,
  radius,
  deadzone = TOUCH_LAYOUT.deadzone,
) {
  if (!(radius > 0)) return null;

  const ox = pointerX - originX;
  const oy = pointerY - originY;
  const dist = Math.hypot(ox, oy);

  // Below the dead-zone → no movement.
  if (dist < radius * deadzone) return null;

  // Normalise to the unit circle; clamp magnitude to 1.
  const mag = Math.min(1, dist / radius);
  const invDist = dist > 0 ? 1 / dist : 0;
  return {
    dx: ox * invDist * mag,
    dy: oy * invDist * mag,
  };
}

/**
 * Hit-test a screen point against the touch layout.
 *
 * @param {number} x    Point X (screen px).
 * @param {number} y    Point Y (screen px).
 * @param {number} vpW  Viewport width  (screen px).
 * @param {number} vpH  Viewport height (screen px).
 * @returns {'stick' | 'fire' | 'dash' | null}
 *
 * Buttons take priority over the stick zone so a thumb landing on FIRE/DASH is
 * never swallowed by the (large) stick activation area.
 */
export function hitTestTouchControl(x, y, vpW, vpH) {
  const minDim = Math.min(vpW, vpH);

  // FIRE button (circle).
  const fx = TOUCH_LAYOUT.fire.cxFrac * vpW;
  const fy = TOUCH_LAYOUT.fire.cyFrac * vpH;
  const fr = TOUCH_LAYOUT.fire.rFrac * minDim;
  if (Math.hypot(x - fx, y - fy) <= fr) return 'fire';

  // DASH button (circle).
  const dx = TOUCH_LAYOUT.dash.cxFrac * vpW;
  const dy = TOUCH_LAYOUT.dash.cyFrac * vpH;
  const dr = TOUCH_LAYOUT.dash.rFrac * minDim;
  if (Math.hypot(x - dx, y - dy) <= dr) return 'dash';

  // Stick activation zone (rect anchored bottom-left).
  const sx = TOUCH_LAYOUT.stick.xFrac * vpW;
  const sy = TOUCH_LAYOUT.stick.yFrac * vpH;
  const sw = TOUCH_LAYOUT.stick.wFrac * vpW;
  const sh = TOUCH_LAYOUT.stick.hFrac * vpH;
  if (x >= sx && x <= sx + sw && y >= sy && y <= sy + sh) return 'stick';

  return null;
}

/**
 * Stick base radius in screen pixels for a given viewport.
 * @param {number} vpW
 * @param {number} vpH
 * @returns {number}
 */
export function stickRadiusPx(vpW, vpH) {
  return TOUCH_LAYOUT.stickRadiusFrac * Math.min(vpW, vpH);
}

// ── Stateful controller ──────────────────────────────────────────────────────

/**
 * Minimal pointer-event shape the controller understands. Mirrors the parts of
 * a DOM PointerEvent we rely on, so tests can pass plain objects.
 * @typedef {{ pointerId: number, clientX: number, clientY: number, button?: number }} PointerLike
 */

/** Normalise (x,y); return `fallback` for a zero vector. */
function normDir(x, y, fallback) {
  const m = Math.hypot(x, y);
  return m > 0 ? { x: x / m, y: y / m } : fallback;
}

/**
 * Convert an aim direction to a screen point: viewport centre + dir * 0.35 *
 * min(vpW, vpH). Always returns a concrete {x, y} in CSS px.
 * @param {{ x: number, y: number }} dir
 * @param {number} vpW
 * @param {number} vpH
 * @returns {{ x: number, y: number }}
 */
export function aimScreenFromDir(dir, vpW, vpH) {
  const d = 0.35 * Math.min(vpW, vpH);
  return { x: vpW / 2 + dir.x * d, y: vpH / 2 + dir.y * d };
}

/**
 * Create a touch controller. It owns the multi-touch bookkeeping: which pointer
 * is driving the stick, which is holding fire, which is holding dash, plus the
 * geometry needed to produce a per-frame sample().
 *
 * The controller needs the current viewport to hit-test and to recenter the
 * stick origin on touch-down. Pass a `getViewport()` returning { width, height };
 * if omitted it reads nothing and callers must pass a viewport into sample via
 * the pointer events (the DOM layer always supplies getViewport).
 *
 * @param {{ getViewport?: () => { width: number, height: number } }} [opts]
 * @returns {TouchController}
 */
export function createTouchController(opts = {}) {
  const getViewport =
    typeof opts.getViewport === 'function'
      ? opts.getViewport
      : () => ({ width: 0, height: 0 });

  // ── Stick state ────────────────────────────────────────────────────────────
  let stickPointerId = null;   // pointerId currently driving the stick
  let stickOriginX = 0;        // screen px where the stick was first touched
  let stickOriginY = 0;
  let stickCurX = 0;           // current finger position
  let stickCurY = 0;

  // ── Fire state ───────────────────────────────────────────────────────────
  let firePointerId = null;    // pointerId holding FIRE
  let fireX = 0;               // current fire-finger position (for aim)
  let fireY = 0;
  let fireOriginX = 0;         // where the fire finger first touched down
  let fireOriginY = 0;

  // ── Aim state ──────────────────────────────────────────────────────────────
  let lastAimDir = { x: 1, y: 0 };  // persists when no input drives aim

  // ── Dash state ─────────────────────────────────────────────────────────────
  let dashPointerId = null;    // pointerId holding DASH

  /** Reset everything (used on cancel / teardown). */
  function reset() {
    stickPointerId = null;
    firePointerId = null;
    dashPointerId = null;
    fireOriginX = 0;
    fireOriginY = 0;
  }

  /**
   * Route a pointer-down to whichever control it landed on.
   * @param {PointerLike} ev
   */
  function onPointerDown(ev) {
    const { width, height } = getViewport();
    const zone = hitTestTouchControl(ev.clientX, ev.clientY, width, height);
    if (zone === 'stick' && stickPointerId === null) {
      stickPointerId = ev.pointerId;
      stickOriginX = ev.clientX;
      stickOriginY = ev.clientY;
      stickCurX = ev.clientX;
      stickCurY = ev.clientY;
    } else if (zone === 'fire' && firePointerId === null) {
      firePointerId = ev.pointerId;
      fireX = ev.clientX;
      fireY = ev.clientY;
      fireOriginX = ev.clientX;
      fireOriginY = ev.clientY;
    } else if (zone === 'dash' && dashPointerId === null) {
      dashPointerId = ev.pointerId;
    }
  }

  /**
   * Update the finger position for whichever control a moving pointer owns.
   * @param {PointerLike} ev
   */
  function onPointerMove(ev) {
    if (ev.pointerId === stickPointerId) {
      stickCurX = ev.clientX;
      stickCurY = ev.clientY;
    } else if (ev.pointerId === firePointerId) {
      fireX = ev.clientX;
      fireY = ev.clientY;
    }
    // Dash has no drag behaviour.
  }

  /**
   * Release whichever control a lifting pointer owned.
   * @param {PointerLike} ev
   */
  function onPointerUp(ev) {
    if (ev.pointerId === stickPointerId) {
      stickPointerId = null;
    } else if (ev.pointerId === firePointerId) {
      firePointerId = null;
    } else if (ev.pointerId === dashPointerId) {
      dashPointerId = null;
    }
  }

  /**
   * Treat a cancelled pointer exactly like a release.
   * @param {PointerLike} ev
   */
  function onPointerCancel(ev) {
    onPointerUp(ev);
  }

  /**
   * Produce the per-frame input sample.
   *
   * @returns {{
   *   move: { dx: number, dy: number } | null,
   *   fire: boolean,
   *   dash: boolean,
   *   aimScreen: { x: number, y: number },
   * }}
   */
  function sample() {
    const { width, height } = getViewport();
    const radius = stickRadiusPx(width, height);

    const move =
      stickPointerId !== null
        ? stickVectorFromPointer(stickOriginX, stickOriginY, stickCurX, stickCurY, radius)
        : null;

    const fire = firePointerId !== null;
    const dash = dashPointerId !== null;

    // Aim: fire-drag direction → stick direction → last direction.
    let fireDragged = false;
    if (fire) {
      const fdx = fireX - fireOriginX;
      const fdy = fireY - fireOriginY;
      const fd = Math.hypot(fdx, fdy);
      const fr = TOUCH_LAYOUT.fire.rFrac * Math.min(width, height);
      if (fr > 0 && fd >= fr * TOUCH_LAYOUT.deadzone) {
        lastAimDir = { x: fdx / fd, y: fdy / fd };
        fireDragged = true;
      }
    }
    if (!fireDragged && move) {
      lastAimDir = normDir(move.dx, move.dy, lastAimDir);
    }
    const aimScreen = aimScreenFromDir(lastAimDir, width, height);

    return { move, fire, dash, aimScreen };
  }

  /** @returns {{ originX, originY, curX, curY, radius } | null} stick visual. */
  function stickVisual() {
    if (stickPointerId === null) return null;
    const { width, height } = getViewport();
    return {
      originX: stickOriginX,
      originY: stickOriginY,
      curX: stickCurX,
      curY: stickCurY,
      radius: stickRadiusPx(width, height),
    };
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    sample,
    reset,
    stickVisual,
    // Exposed for tests / debugging.
    get activeStickId() { return stickPointerId; },
    get activeFireId()  { return firePointerId; },
    get activeDashId()  { return dashPointerId; },
  };
}

/**
 * @typedef {ReturnType<typeof createTouchController>} TouchController
 */

// ── Device heuristic ─────────────────────────────────────────────────────────

/**
 * Decide whether to show touch controls. Pure helper so it is testable without
 * a browser; the DOM layer feeds it real values.
 *
 * Returns true when EITHER:
 *   • the primary pointer is coarse (a touchscreen), OR
 *   • the device reports touch points AND the viewport is narrow (≤ 900px).
 *
 * A narrow desktop mouse window (no touch points, fine pointer) returns false,
 * so desktop play is never cluttered with thumb pads.
 *
 * @param {{ maxTouchPoints?: number, matchMediaCoarse?: boolean, width?: number }} info
 * @returns {boolean}
 */
export function prefersTouchUi({ maxTouchPoints = 0, matchMediaCoarse = false, width = Infinity } = {}) {
  if (matchMediaCoarse) return true;
  if (maxTouchPoints > 0 && width <= 900) return true;
  return false;
}

/**
 * Merge keyboard/mouse actions with a touch sample. Pure; returns a new object.
 *
 * @param {{ move: any, aim: any, fire: boolean, dash: boolean }} baseActions
 * @param {{ move: any, fire: boolean, dash: boolean, aimScreen: {x:number,y:number} }} touchSample
 * @param {(p: {x:number,y:number}) => {x:number,y:number}} screenToWorldFn
 */
export function mergeTouchActions(baseActions, touchSample, screenToWorldFn) {
  const touchAiming = !!(touchSample.move || touchSample.fire);
  return {
    ...baseActions,
    move: touchSample.move ? touchSample.move : baseActions.move,
    fire: !!(baseActions.fire || touchSample.fire),
    dash: !!(baseActions.dash || touchSample.dash),
    aim: touchAiming ? screenToWorldFn(touchSample.aimScreen) : baseActions.aim,
  };
}
