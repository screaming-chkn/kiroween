/**
 * src/ui/touchControls.js — on-screen phone controls (DOM overlay).
 *
 * Draws a movement stick (bottom-left), FIRE (bottom-right) and DASH (bottom
 * row, left of FIRE) buttons
 * and forwards pointer events to createTouchController() from engine/touch.js.
 * No top-level DOM access, so TOUCH_CONTROLS_CSS can be imported under Node.
 *
 * z-index 40 keeps the overlay below the garage (100) so the garage always
 * sits above it. setActive(false) makes the overlay inert so end-card taps
 * reach the canvas.
 */

import {
  createTouchController,
  stickRadiusPx,
  touchSafeShift,
  touchLayoutFor,
} from '../engine/touch.js';

/** Overlay stylesheet (exported for tests). */
export const TOUCH_CONTROLS_CSS = `
.hh-touch {
  position: fixed;
  inset: 0;
  z-index: 40;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  font-family: 'Press Start 2P', 'VT323', 'Share Tech Mono', monospace;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
}
.hh-touch[hidden] { display: none; }
.hh-touch__stick,
.hh-touch__knob,
.hh-touch__btn {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  box-sizing: border-box;
}
/* Stick + knob + Fire/Dash — neon blue (C7; cut green chrome from controls) */
.hh-touch__stick,
.hh-touch__knob,
.hh-touch__btn {
  border: 2px solid #4DD8FF;
  background: rgba(77, 216, 255, 0.08);
  box-shadow: 0 0 8px rgba(127, 227, 255, 0.45);
}
.hh-touch__knob {
  background: rgba(77, 216, 255, 0.22);
}
.hh-touch__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4DD8FF;
  font-size: 14px;
  letter-spacing: 0.06em;
  min-width: 44px;
  min-height: 44px;
}
.hh-touch__btn--held {
  background: rgba(77, 216, 255, 0.40);
  color: #0A0D0B;
  box-shadow: 0 0 10px rgba(127, 227, 255, 0.7);
  transform: scale(0.94);
}
.hh-touch__cd {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  pointer-events: none;
  --cd: 0;
  background: conic-gradient(rgba(77, 216, 255, 0.55) calc(var(--cd) * 360deg), transparent 0);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px));
}
.hh-touch__cd[hidden] { display: none; }
`;

/**
 * Remaining fraction of the dash cooldown for the ring: 0 (hidden) when either
 * value is 0/invalid, otherwise clamp(remaining / base, 0, 1).
 */
export function dashCooldownFraction(remainingMs, baseMs) {
  if (!(remainingMs > 0) || !(baseMs > 0)) return 0;
  return Math.min(1, remainingMs / baseMs);
}

const STYLE_ID = 'hh-touch-style';

/**
 * Mount the touch overlay.
 *
 * @param {HTMLElement} root
 * @param {{ getViewport: () => { width: number, height: number } }} opts
 * @returns {{ destroy: () => void, sample: () => any, controller: any, setActive: (on: boolean) => void, setDashCooldown: (remainingMs: number, baseMs: number) => void }}
 */
export function mountTouchControls(root, { getViewport }) {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = TOUCH_CONTROLS_CSS;
    document.head.appendChild(style);
  }

  // Bottom safe-area inset, read once per layout via a hidden probe.
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;bottom:0;left:0;height:0;padding-bottom:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none;';
  root.appendChild(probe);
  let shift = 0;
  function computeShift() {
    const { width: w, height: h } = getViewport();
    const inset = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
    shift = touchSafeShift(w, h, inset);
  }
  computeShift();

  const controller = createTouchController({ getViewport, getBottomShift: () => shift });

  const overlay = document.createElement('div');
  overlay.className = 'hh-touch';
  overlay.setAttribute('aria-hidden', 'true');

  const stickEl = document.createElement('div');
  stickEl.className = 'hh-touch__stick';
  const knobEl = document.createElement('div');
  knobEl.className = 'hh-touch__knob';
  const fireEl = document.createElement('div');
  fireEl.className = 'hh-touch__btn hh-touch__btn--fire';
  fireEl.textContent = 'FIRE';
  const dashEl = document.createElement('div');
  dashEl.className = 'hh-touch__btn hh-touch__btn--dash';
  dashEl.textContent = 'DASH';
  const cdEl = document.createElement('div');
  cdEl.className = 'hh-touch__cd';
  cdEl.hidden = true;
  dashEl.appendChild(cdEl);
  overlay.append(stickEl, knobEl, fireEl, dashEl);
  root.appendChild(overlay);

  function place(el, cx, cy, r) {
    el.style.width = `${r * 2}px`;
    el.style.height = `${r * 2}px`;
    el.style.left = `${cx - r}px`;
    el.style.top = `${cy - r}px`;
  }

  /** Recompute geometry/visual state from layout + controller. */
  function layout() {
    const { width: w, height: h } = getViewport();
    const min = Math.min(w, h);
    const sr = stickRadiusPx(w, h);
    computeShift();

    const vis = controller.stickVisual();
    // Default rest spot: bottom-left (80% down keeps it well above the home bar).
    const L = touchLayoutFor(w, h);
    const restX = Math.max(sr + 16, L.stickRest.xFrac * w);
    const restY = L.stickRest.yFrac * h - shift;
    let ox = restX;
    let oy = restY;
    let kx = restX;
    let ky = restY;
    if (vis) {
      ox = vis.originX; oy = vis.originY;
      const dx = vis.curX - vis.originX;
      const dy = vis.curY - vis.originY;
      const d = Math.hypot(dx, dy);
      const k = d > sr ? sr / d : 1;
      kx = ox + dx * k;
      ky = oy + dy * k;
    }
    // Absolute children resolve against the viewport edge, so viewport
    // fractions line up with hitTestTouchControl().
    place(stickEl, ox, oy, sr);
    place(knobEl, kx, ky, sr * 0.45);

    const f = L.fire;
    place(fireEl, f.cxFrac * w, f.cyFrac * h - shift, f.rFrac * min);
    const d2 = L.dash;
    place(dashEl, d2.cxFrac * w, d2.cyFrac * h - shift, d2.rFrac * min);

    fireEl.classList.toggle('hh-touch__btn--held', controller.activeFireId !== null);
    dashEl.classList.toggle('hh-touch__btn--held', controller.activeDashId !== null);
  }

  // ── Pointer handlers ─────────────────────────────────────────────────────
  function down(e) {
    e.preventDefault();
    if (overlay.setPointerCapture) {
      try { overlay.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }
    controller.onPointerDown(e);
    layout();
  }
  function move(e) {
    e.preventDefault();
    controller.onPointerMove(e);
    layout();
  }
  function up(e) {
    e.preventDefault();
    controller.onPointerUp(e);
    layout();
  }
  function cancel(e) {
    e.preventDefault();
    controller.onPointerCancel(e);
    layout();
  }
  // Only cancel touches the browser says are cancelable: calling
  // preventDefault on a non-cancelable touchmove (scroll already in progress)
  // does nothing and logs a console intervention warning. touch-action: none
  // on the overlay already stops the scroll/zoom (M5 headless phone pass).
  function stopTouch(e) { if (e.cancelable) e.preventDefault(); }

  overlay.addEventListener('pointerdown', down);
  overlay.addEventListener('pointermove', move);
  overlay.addEventListener('pointerup', up);
  overlay.addEventListener('pointercancel', cancel);
  overlay.addEventListener('touchstart', stopTouch, { passive: false });
  overlay.addEventListener('touchmove', stopTouch, { passive: false });

  const onResize = () => layout();
  window.addEventListener('resize', onResize);
  layout();

  return {
    controller,
    sample() { return controller.sample(); },
    /** Sweep the ring on DASH: remaining/base; hidden when either is 0. */
    setDashCooldown(remainingMs, baseMs) {
      const f = dashCooldownFraction(remainingMs, baseMs);
      if (f <= 0) { cdEl.hidden = true; return; }
      cdEl.hidden = false;
      cdEl.style.setProperty('--cd', f.toFixed(3));
    },
    setActive(on) {
      overlay.hidden = !on;
      overlay.style.pointerEvents = on ? '' : 'none';
      if (!on) {
        controller.reset();
        layout();
      }
    },
    destroy() {
      overlay.removeEventListener('pointerdown', down);
      overlay.removeEventListener('pointermove', move);
      overlay.removeEventListener('pointerup', up);
      overlay.removeEventListener('pointercancel', cancel);
      overlay.removeEventListener('touchstart', stopTouch);
      overlay.removeEventListener('touchmove', stopTouch);
      window.removeEventListener('resize', onResize);
      overlay.remove();
      probe.remove();
    },
  };
}
