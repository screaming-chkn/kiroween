/**
 * src/ui/rotateGate.js — portrait phones must rotate to landscape before play.
 *
 * iOS Safari cannot lock orientation, so a full-screen overlay blocks input
 * until the device is actually landscape. Android (and other browsers that
 * expose screen.orientation.lock) may flip after a user gesture; lock errors
 * are swallowed. Desktop (no touch UI) never sees the gate.
 */

const CSS = `
.hh-rotate-gate{position:fixed;top:0;left:0;right:0;bottom:0;z-index:300;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;
  width:100%;height:100%;height:100dvh;height:100svh;box-sizing:border-box;
  background:radial-gradient(ellipse at 50% 45%,#10201a 0%,#0A0D0B 62%,#050706 100%);color:var(--color-bone,#E8E2D0);
  font-family:var(--font-display,'VT323',monospace);text-align:center;
  padding:max(16px,env(safe-area-inset-top)) 24px max(16px,env(safe-area-inset-bottom));
  user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation;cursor:pointer}
.hh-rotate-gate[hidden]{display:none!important}
.hh-rotate-gate::before{content:"";position:absolute;inset:0;pointer-events:none;
  background:repeating-linear-gradient(0deg,rgba(0,0,0,.28) 0 1px,transparent 1px 3px);mix-blend-mode:multiply}
.hh-rotate-gate::after{content:"";position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 140px 40px rgba(0,0,0,.85)}
.hh-rotate-gate h2{position:relative;z-index:1;margin:0;font-weight:400;letter-spacing:.08em;line-height:1.1;
  font-size:clamp(22px,7vw,40px);color:#47FF9A;text-shadow:0 0 6px #20B05C,0 0 22px rgba(57,255,136,.55)}
.hh-rotate-gate p{position:relative;z-index:1;margin:0;max-width:22em;line-height:1.4;
  font-family:var(--font-hud,'Share Tech Mono',monospace);font-size:clamp(15px,3.4vw,18px);color:#C8D0C8;letter-spacing:.04em}
`;

let styled = false;
function injectCss() {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);
}

/**
 * True when the viewport is portrait. Prefers the screen orientation API
 * (and the legacy window.orientation value) over raw width/height, because
 * iOS can fire resize/orientationchange before visualViewport settles.
 *
 * @param {{ width?: number, height?: number, orientationType?: string, windowOrientation?: number }} info
 * @returns {boolean}
 */
export function isPortraitViewport({
  width,
  height,
  orientationType,
  windowOrientation,
} = {}) {
  if (typeof orientationType === 'string') {
    if (orientationType.startsWith('portrait')) return true;
    if (orientationType.startsWith('landscape')) return false;
  }
  if (typeof windowOrientation === 'number' && Number.isFinite(windowOrientation)) {
    const ang = Math.abs(windowOrientation) % 180;
    if (ang === 0) return true;
    if (ang === 90) return false;
  }
  if (typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0) {
    return height > width;
  }
  return false;
}

/**
 * Show the rotate overlay only on a touch-UI device that is in portrait.
 * Desktop (fine pointer, no narrow touch) never sees it.
 *
 * @param {{ touchUi?: boolean, width?: number, height?: number, orientationType?: string, windowOrientation?: number }} info
 * @returns {boolean}
 */
export function shouldShowRotateGate({ touchUi = false, ...viewport } = {}) {
  return !!touchUi && isPortraitViewport(viewport);
}

/**
 * Ask the browser to lock landscape after a user gesture. Swallows rejections
 * (iOS Safari, desktop, missing Fullscreen). Tries `landscape`, then
 * `landscape-primary`.
 *
 * @param {{ lock?: Function }|null|undefined} orientation
 * @returns {Promise<boolean>}
 */
export async function tryLockLandscape(orientation) {
  const api = orientation !== undefined
    ? orientation
    : (typeof screen !== 'undefined' ? screen.orientation : null);
  if (!api || typeof api.lock !== 'function') return false;
  for (const type of ['landscape', 'landscape-primary']) {
    try {
      await api.lock(type);
      return true;
    } catch {
      // NotAllowedError / NotSupportedError / SecurityError — keep trying.
    }
  }
  return false;
}

function syncToVisualViewport(el) {
  if (!el || typeof window === 'undefined') return;
  const vv = window.visualViewport;
  if (!vv) return;
  el.style.top = `${vv.offsetTop}px`;
  el.style.left = `${vv.offsetLeft}px`;
  el.style.width = `${vv.width}px`;
  el.style.height = `${vv.height}px`;
  el.style.right = 'auto';
  el.style.bottom = 'auto';
}

/**
 * Mount the rotate gate. Hidden on desktop and in landscape. A tap on the
 * overlay tries orientation.lock (Android) but only hides when the viewport
 * is actually landscape.
 *
 * @param {HTMLElement} root
 * @param {{ isTouchUi?: boolean|Function, onChange?: (visible: boolean) => void, lock?: Function }} [opts]
 * @returns {{ destroy: Function, sync: Function, el: HTMLElement }}
 */
export function mountRotateGate(root, { isTouchUi = false, onChange, lock = tryLockLandscape } = {}) {
  injectCss();
  const el = document.createElement('div');
  el.className = 'hh-rotate-gate';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Rotate your phone to landscape');
  el.innerHTML = `
    <h2>ROTATE YOUR PHONE</h2>
    <p>Landscape required to play.</p>`;
  root.appendChild(el);

  let lastVisible = null;

  function readViewport() {
    const touchUi = typeof isTouchUi === 'function' ? !!isTouchUi() : !!isTouchUi;
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    const width = (vv && vv.width) || (typeof window !== 'undefined' ? window.innerWidth : 0);
    const height = (vv && vv.height) || (typeof window !== 'undefined' ? window.innerHeight : 0);
    const orientationType = (typeof screen !== 'undefined' && screen.orientation)
      ? screen.orientation.type
      : undefined;
    const windowOrientation = typeof window !== 'undefined' ? window.orientation : undefined;
    return { touchUi, width, height, orientationType, windowOrientation };
  }

  function sync() {
    const visible = shouldShowRotateGate(readViewport());
    el.hidden = !visible;
    el.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (visible) syncToVisualViewport(el);
    if (visible !== lastVisible) {
      lastVisible = visible;
      if (typeof onChange === 'function') onChange(visible);
    }
  }

  function onGesture(e) {
    if (el.hidden) return;
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    Promise.resolve(lock()).catch(() => {});
    sync();
  }

  el.addEventListener('pointerup', onGesture);
  el.addEventListener('click', onGesture);

  const onVv = () => sync();
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onVv);
    window.addEventListener('orientationchange', onVv);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onVv);
      window.visualViewport.addEventListener('scroll', onVv);
    }
  }
  if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.addEventListener === 'function') {
    screen.orientation.addEventListener('change', onVv);
  }

  sync();

  function destroy() {
    window.removeEventListener('resize', onVv);
    window.removeEventListener('orientationchange', onVv);
    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', onVv);
      window.visualViewport.removeEventListener('scroll', onVv);
    }
    if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.removeEventListener === 'function') {
      screen.orientation.removeEventListener('change', onVv);
    }
    el.remove();
  }

  return { destroy, sync, el };
}
