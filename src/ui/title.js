/**
 * src/ui/title.js — title screen (M2). A DOM overlay in the CRT/haunted style:
 * glitching HAUNT//HOUND logo, one-line pitch, pulsing "press / tap to
 * DEPLOY", scanlines + drifting fog. Any tap, click or key goes on. The global
 * audio gesture hook (engine/audio.js) unlocks Web Audio on that same input.
 * Animations stop under prefers-reduced-motion.
 *
 * iOS Safari: listen to pointerup/touchend as well as click (click can fail to
 * fire when the toolbar/visual-viewport shift eats the synthesized click).
 * Size the overlay to visualViewport (or 100svh/dvh) so the logo is not
 * clipped under the Safari chrome in landscape.
 */

const CSS = `
.hh-title{position:fixed;top:0;left:0;right:0;bottom:0;z-index:20;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;
  width:100%;height:100%;height:100dvh;height:100svh;box-sizing:border-box;
  background:radial-gradient(ellipse at 50% 45%,#10201a 0%,#0A0D0B 62%,#050706 100%);color:var(--color-bone,#E8E2D0);
  font-family:var(--font-display,'VT323',monospace);text-align:center;
  padding:max(12px,env(safe-area-inset-top)) 24px max(12px,env(safe-area-inset-bottom));
  cursor:pointer;overflow:hidden;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.hh-title::before{content:"";position:absolute;inset:0;pointer-events:none;
  background:repeating-linear-gradient(0deg,rgba(0,0,0,.28) 0 1px,transparent 1px 3px);mix-blend-mode:multiply}
.hh-title::after{content:"";position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 140px 40px rgba(0,0,0,.85)}
.hh-title-fog{position:absolute;inset:-20%;pointer-events:none;opacity:.5;
  background:radial-gradient(closest-side at 30% 60%,rgba(57,255,136,.10),transparent),radial-gradient(closest-side at 70% 40%,rgba(255,59,92,.08),transparent);
  animation:hh-fog 14s ease-in-out infinite alternate}
.hh-logo{position:relative;margin:0;font-weight:400;letter-spacing:.08em;line-height:1;
  font-size:clamp(28px,8vw,72px);color:#47FF9A;
  text-shadow:0 0 6px #20B05C,0 0 22px rgba(57,255,136,.55),3px 0 0 rgba(255,59,92,.55),-3px 0 0 rgba(62,246,255,.35);
  animation:hh-flicker 4.2s steps(1) infinite}
.hh-logo span{color:#FF3B5C;text-shadow:0 0 8px #C01640,0 0 24px rgba(255,59,92,.6)}
.hh-pitch{max-width:34em;font-family:var(--font-hud,'Share Tech Mono',monospace);font-size:clamp(10px,2.6vw,14px);color:var(--color-ash,#8F9A92);letter-spacing:.04em}
.hh-pitch b{color:var(--color-bone,#E8E2D0);font-weight:400}
.hh-title-go{margin-top:10px;background:transparent;border:2px solid #47FF9A;color:#47FF9A;cursor:pointer;
  font-family:inherit;font-size:clamp(22px,6vw,34px);letter-spacing:.14em;padding:10px 26px;
  box-shadow:0 0 14px rgba(57,255,136,.35),inset 0 0 12px rgba(57,255,136,.2);animation:hh-pulse 1.3s ease-in-out infinite;
  -webkit-tap-highlight-color:transparent;touch-action:manipulation}
.hh-title-garage{background:transparent;border:1px solid #8F9A92;color:#E8E2D0;cursor:pointer;
  font-family:inherit;font-size:20px;letter-spacing:.12em;padding:8px 20px;min-width:44px;min-height:44px;
  -webkit-tap-highlight-color:transparent;touch-action:manipulation}
.hh-title-garage:focus-visible,.hh-title-go:focus-visible{outline:2px solid #FF8A3D;outline-offset:2px}
.hh-title-keys{font-family:var(--font-hud,'Share Tech Mono',monospace);font-size:clamp(15px,3.2vw,18px);color:#E8E2D0;letter-spacing:.06em}
.hh-title-lv{position:absolute;top:calc(10px + env(safe-area-inset-top));right:14px;font-size:18px;color:#FF8A3D;letter-spacing:.1em}
@keyframes hh-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.97)}}
@keyframes hh-fog{from{transform:translate(-4%,2%) scale(1)}to{transform:translate(4%,-3%) scale(1.08)}}
@keyframes hh-flicker{0%,100%{opacity:1}91%{opacity:1}92%{opacity:.55;transform:translateX(2px)}93%{opacity:1;transform:none}96%{opacity:.8}97%{opacity:1}}
@media (prefers-reduced-motion: reduce){.hh-title-fog,.hh-logo,.hh-title-go{animation:none}}
/* Phone landscape with Safari toolbar: shrink so HAUNT//HOUND + CTA fit in the visible viewport */
@media (orientation: landscape) and (max-height: 500px){
  .hh-title{gap:6px;padding:max(6px,env(safe-area-inset-top)) 16px max(6px,env(safe-area-inset-bottom));justify-content:safe center}
  .hh-logo{font-size:clamp(18px,6.5vh,40px)}
  .hh-pitch{font-size:clamp(11px,3.2vh,15px);max-width:42em}
  .hh-title-go{margin-top:2px;font-size:clamp(10px,3.6vh,16px);padding:6px 18px}
  .hh-title-garage{font-size:15px;padding:5px 14px;min-height:36px}
  .hh-title-keys{font-size:clamp(11px,2.8vh,14px)}
  .hh-title-lv{top:calc(4px + env(safe-area-inset-top));right:10px;font-size:13px}
}
@media (orientation: landscape) and (max-height: 380px){
  .hh-title-keys{display:none}
  .hh-pitch{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
}
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
 * Decide what a title click/key/pointer does. Pure.
 * @param {{type?:string, key?:string, onGarageButton?:boolean}} ev
 * @returns {'deploy'|'garage'|null}
 */
export function titleChoice({ type, key, onGarageButton } = {}) {
  if (onGarageButton) return 'garage';
  if (type === 'keydown') {
    if (key === 'g' || key === 'G') return 'garage';
    if (key === 'Tab' || key === 'Shift') return null;
  }
  return 'deploy';
}

/**
 * Pin an overlay to the visual viewport (iOS Safari toolbar-safe).
 * No-op when visualViewport is missing. Pure of side effects beyond style.
 * @param {HTMLElement} el
 */
export function syncTitleToVisualViewport(el) {
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
 * Mount the title screen. Calls onDeploy() or onGarage() once on the first
 * pointerup / touchend / click / key. pointerup+touchend cover iOS Safari
 * where click may never fire after a toolbar/visual-viewport shift.
 * @param {HTMLElement} root
 * @param {{onDeploy?:Function, onStart?:Function, onGarage?:Function, touchUi?:boolean, hauntLv?:number}} opts
 * @returns {{destroy:Function}}
 */
export function mountTitle(root, { onDeploy, onStart, onGarage, touchUi = false, hauntLv = 1 }) {
  const deploy = onDeploy || onStart;
  injectCss();
  const el = document.createElement('div');
  el.className = 'hh-title';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'HAUNT//HOUND title');
  const keys = touchUi
    ? 'LEFT STICK move · RIGHT PAD aim + fire · DASH dodge · ❚❚ pause'
    : 'WASD move · MOUSE aim · CLICK fire · SHIFT dash · ESC pause · G garage';
  el.innerHTML = `
    <div class="hh-title-fog"></div>
    <div class="hh-title-lv">HAUNT LV ${hauntLv}</div>
    <h1 class="hh-logo">HAUNT<span>//</span>HOUND</h1>
    <p class="hh-pitch">Something is <b>possessing the other tank</b>. Duel it, dodge its tell, exorcise it. Climb <b>HAUNT LV 1–5</b>.</p>
    <button class="hh-title-go" type="button">${touchUi ? 'TAP' : 'PRESS'} TO DEPLOY</button>
    <button class="hh-title-garage" type="button">GARAGE</button>
    <p class="hh-title-keys">${keys}</p>`;
  root.appendChild(el);
  const goBtn = el.querySelector('.hh-title-go');
  const garageBtn = el.querySelector('.hh-title-garage');
  if (goBtn && typeof goBtn.focus === 'function') goBtn.focus({ preventScroll: true });

  syncTitleToVisualViewport(el);
  const onVv = () => syncTitleToVisualViewport(el);
  if (typeof window !== 'undefined' && window.visualViewport) {
    window.visualViewport.addEventListener('resize', onVv);
    window.visualViewport.addEventListener('scroll', onVv);
  }
  window.addEventListener('resize', onVv);

  let done = false;
  function go(e) {
    if (done) return;
    // Ignore non-primary pointer / multi-touch leftovers.
    if (e && e.type === 'pointerup' && typeof e.button === 'number' && e.button !== 0) return;
    if (e && e.type === 'touchend' && e.touches && e.touches.length > 0) return;
    const choice = titleChoice({
      type: e && e.type,
      key: e && e.key,
      onGarageButton: !!(e && e.target && e.target.closest && e.target.closest('.hh-title-garage')),
    });
    if (!choice) return;
    done = true;
    // Accept the gesture; preventDefault stops a late synthesized click from
    // double-firing into a destroyed tree (safe — title is not scrollable).
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    destroy();
    if (choice === 'garage') { if (onGarage) onGarage(); else if (deploy) deploy(); }
    else if (deploy) deploy();
  }

  // pointerup first (modern), touchend for older iOS, click for mouse/desktop.
  // done-flag dedupes so accepting pointerup skips the ghost click.
  el.addEventListener('pointerup', go);
  el.addEventListener('touchend', go, { passive: false });
  el.addEventListener('click', go);
  if (goBtn) {
    goBtn.addEventListener('pointerup', go);
    goBtn.addEventListener('touchend', go, { passive: false });
  }
  if (garageBtn) {
    garageBtn.addEventListener('pointerup', go);
    garageBtn.addEventListener('touchend', go, { passive: false });
  }
  window.addEventListener('keydown', go);

  function destroy() {
    done = true;
    window.removeEventListener('keydown', go);
    window.removeEventListener('resize', onVv);
    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', onVv);
      window.visualViewport.removeEventListener('scroll', onVv);
    }
    el.remove();
  }
  return { destroy };
}
