/**
 * src/ui/rotateGate.js — force a landscape play surface on portrait phones.
 *
 * iOS Safari and the X in-app browser cannot lock orientation. Instead of a
 * blocking "rotate" overlay, touch + portrait applies a CSS rotate(90deg) shell
 * so the game lays out as landscape, and pointer coords are remapped into that
 * logical space. Native landscape and desktop are unchanged.
 */

const CSS = `
#hh-shell{position:fixed;inset:0;width:100%;height:100%;height:100dvh;height:100svh;overflow:hidden;touch-action:manipulation}
#hh-shell.hh-css-landscape{right:auto;bottom:auto;transform:rotate(90deg);transform-origin:top left}
#hh-shell #game-canvas{display:block;width:100%;height:100%}
.hh-rotate-hint{position:absolute;z-index:50;left:50%;bottom:10px;transform:translateX(-50%);
  margin:0;padding:6px 10px;border-radius:4px;pointer-events:none;
  font-family:var(--font-hud,'Share Tech Mono',monospace);font-size:12px;letter-spacing:.04em;
  color:#C8D0C8;background:rgba(10,13,11,.72);border:1px solid rgba(57,255,136,.35);
  opacity:0;transition:opacity .25s ease}
.hh-rotate-hint[data-show="1"]{opacity:1}
`;

let styled = false;
function injectCss() {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.id = 'hh-css-landscape-style';
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
 * Apply the CSS-landscape shell only on a touch-UI device that is in portrait.
 * Desktop never forces it. Kept as shouldShowRotateGate for older call sites.
 *
 * @param {{ touchUi?: boolean, width?: number, height?: number, orientationType?: string, windowOrientation?: number }} info
 * @returns {boolean}
 */
export function shouldForceCssLandscape({ touchUi = false, ...viewport } = {}) {
  if (!touchUi) return false;
  // Size wins when the aspect is clear. Preferring orientation.type here caused
  // a double-rotate on native landscape when the API lagged (or in automation).
  const { width, height } = viewport;
  if (typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0 && width !== height) {
    return height > width;
  }
  return isPortraitViewport(viewport);
}

/** @deprecated use shouldForceCssLandscape — name kept so older tests/docs still resolve */
export const shouldShowRotateGate = shouldForceCssLandscape;

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

/**
 * Physical client (CSS px) → logical landscape coords inside a
 * rotate(90deg) shell with transform-origin top left and
 * left = offsetLeft + physW, top = offsetTop.
 *
 * Inverse of local (lx,ly) → screen (offsetLeft+physW - ly, offsetTop + lx).
 *
 * @param {number} clientX
 * @param {number} clientY
 * @param {{ physW: number, offsetLeft?: number, offsetTop?: number }} box
 * @returns {{ x: number, y: number }}
 */
export function remapClientForCssLandscape(clientX, clientY, { physW, offsetLeft = 0, offsetTop = 0 }) {
  const w = Number(physW);
  const ol = Number(offsetLeft) || 0;
  const ot = Number(offsetTop) || 0;
  if (!(w > 0)) return { x: clientX, y: clientY };
  return {
    x: clientY - ot,
    y: (ol + w) - clientX,
  };
}

/**
 * Logical size of the CSS-landscape shell for a physical viewport.
 * width = physical height, height = physical width.
 *
 * @param {number} physW
 * @param {number} physH
 * @returns {{ width: number, height: number }}
 */
export function cssLandscapeSize(physW, physH) {
  return { width: physH, height: physW };
}

/**
 * Read the physical visible viewport (prefers visualViewport).
 * @returns {{ width: number, height: number, offsetLeft: number, offsetTop: number }}
 */
export function readPhysicalViewport() {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0, offsetLeft: 0, offsetTop: 0 };
  }
  const vv = window.visualViewport;
  if (vv && vv.width > 0 && vv.height > 0) {
    return {
      width: vv.width,
      height: vv.height,
      offsetLeft: vv.offsetLeft || 0,
      offsetTop: vv.offsetTop || 0,
    };
  }
  return {
    width: window.innerWidth || 0,
    height: window.innerHeight || 0,
    offsetLeft: 0,
    offsetTop: 0,
  };
}

/**
 * Ensure a #hh-shell wraps the canvas (and becomes the mount root for UI).
 * Moves #game-canvas into the shell when needed. Idempotent.
 *
 * @param {HTMLElement} [body]
 * @returns {HTMLElement}
 */
export function ensureGameShell(body = typeof document !== 'undefined' ? document.body : null) {
  injectCss();
  if (!body) throw new Error('ensureGameShell: no document body');
  let shell = body.querySelector('#hh-shell');
  if (!shell) {
    shell = document.createElement('div');
    shell.id = 'hh-shell';
    const canvas = body.querySelector('#game-canvas');
    if (canvas) {
      body.insertBefore(shell, canvas);
      shell.appendChild(canvas);
    } else {
      body.appendChild(shell);
    }
  }
  return shell;
}

/**
 * Mount the CSS-landscape controller on an existing #hh-shell.
 * Does not block input. Optional tiny hint when forced.
 *
 * @param {HTMLElement} shell
 * @param {{ isTouchUi?: boolean|Function, onChange?: (active: boolean) => void, showHint?: boolean }} [opts]
 * @returns {{
 *   destroy: Function,
 *   sync: Function,
 *   active: () => boolean,
 *   logicalViewport: () => { width: number, height: number },
 *   physicalViewport: () => { width: number, height: number, offsetLeft: number, offsetTop: number },
 *   remapClient: (clientX: number, clientY: number) => { x: number, y: number },
 *   el: HTMLElement,
 * }}
 */
export function mountCssLandscape(shell, { isTouchUi = false, onChange, showHint = false } = {}) {
  injectCss();
  let hint = null;
  if (showHint) {
    hint = document.createElement('p');
    hint.className = 'hh-rotate-hint';
    hint.textContent = 'Rotate for native landscape';
    hint.setAttribute('aria-hidden', 'true');
    shell.appendChild(hint);
  }

  let lastActive = null;
  let hintTimer = 0;

  function readViewport() {
    const touchUi = typeof isTouchUi === 'function' ? !!isTouchUi() : !!isTouchUi;
    const phys = readPhysicalViewport();
    const orientationType = (typeof screen !== 'undefined' && screen.orientation)
      ? screen.orientation.type
      : undefined;
    const windowOrientation = typeof window !== 'undefined' ? window.orientation : undefined;
    return {
      touchUi,
      width: phys.width,
      height: phys.height,
      offsetLeft: phys.offsetLeft,
      offsetTop: phys.offsetTop,
      orientationType,
      windowOrientation,
    };
  }

  function applyShell(active, phys) {
    if (active) {
      const { width: logW, height: logH } = cssLandscapeSize(phys.width, phys.height);
      shell.classList.add('hh-css-landscape');
      shell.style.width = `${logW}px`;
      shell.style.height = `${logH}px`;
      shell.style.top = `${phys.offsetTop}px`;
      // rotate(90deg) origin top-left: place left edge at physW so the shell fills.
      shell.style.left = `${phys.offsetLeft + phys.width}px`;
      shell.style.right = 'auto';
      shell.style.bottom = 'auto';
    } else {
      shell.classList.remove('hh-css-landscape');
      shell.style.width = '';
      shell.style.height = '';
      shell.style.top = '';
      shell.style.left = '';
      shell.style.right = '';
      shell.style.bottom = '';
    }
  }

  function sync() {
    const vp = readViewport();
    const active = shouldForceCssLandscape(vp);
    applyShell(active, vp);
    if (hint) {
      if (active && lastActive !== true) {
        hint.dataset.show = '1';
        if (hintTimer) clearTimeout(hintTimer);
        hintTimer = setTimeout(() => { hint.dataset.show = '0'; }, 2400);
      } else if (!active) {
        hint.dataset.show = '0';
      }
    }
    if (active !== lastActive) {
      lastActive = active;
      if (typeof onChange === 'function') onChange(active);
    }
  }

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
    if (hintTimer) clearTimeout(hintTimer);
    window.removeEventListener('resize', onVv);
    window.removeEventListener('orientationchange', onVv);
    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', onVv);
      window.visualViewport.removeEventListener('scroll', onVv);
    }
    if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.removeEventListener === 'function') {
      screen.orientation.removeEventListener('change', onVv);
    }
    applyShell(false, { width: 0, height: 0, offsetLeft: 0, offsetTop: 0 });
    if (hint) hint.remove();
  }

  return {
    destroy,
    sync,
    active: () => !!lastActive,
    logicalViewport() {
      const phys = readPhysicalViewport();
      if (!lastActive) return { width: phys.width, height: phys.height };
      return cssLandscapeSize(phys.width, phys.height);
    },
    physicalViewport: readPhysicalViewport,
    remapClient(clientX, clientY) {
      if (!lastActive) return { x: clientX, y: clientY };
      const phys = readPhysicalViewport();
      return remapClientForCssLandscape(clientX, clientY, {
        physW: phys.width,
        offsetLeft: phys.offsetLeft,
        offsetTop: phys.offsetTop,
      });
    },
    el: shell,
  };
}

/**
 * Back-compat name: older main.js imported mountRotateGate. Now mounts the
 * non-blocking CSS-landscape shell (same sync / destroy shape).
 */
export function mountRotateGate(root, opts = {}) {
  const shell = root && root.id === 'hh-shell' ? root : ensureGameShell();
  return mountCssLandscape(shell, opts);
}
