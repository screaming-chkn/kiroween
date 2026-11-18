/**
 * src/ui/title.js — title screen (M2). A DOM overlay in the CRT/haunted style:
 * glitching HAUNT//HOUND logo, one-line pitch, pulsing "press / tap to
 * DEPLOY", scanlines + drifting fog. Any tap, click or key goes on. The global
 * audio gesture hook (engine/audio.js) unlocks Web Audio on that same input.
 * Animations stop under prefers-reduced-motion.
 */

const CSS = `
.hh-title{position:fixed;inset:0;z-index:20;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;
  background:radial-gradient(ellipse at 50% 45%,#10201a 0%,#0A0D0B 62%,#050706 100%);color:var(--color-bone,#E8E2D0);
  font-family:var(--font-display,'VT323',monospace);text-align:center;padding:24px;cursor:pointer;overflow:hidden;user-select:none;-webkit-user-select:none}
.hh-title::before{content:"";position:absolute;inset:0;pointer-events:none;
  background:repeating-linear-gradient(0deg,rgba(0,0,0,.28) 0 1px,transparent 1px 3px);mix-blend-mode:multiply}
.hh-title::after{content:"";position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 140px 40px rgba(0,0,0,.85)}
.hh-title-fog{position:absolute;inset:-20%;pointer-events:none;opacity:.5;
  background:radial-gradient(closest-side at 30% 60%,rgba(57,255,136,.10),transparent),radial-gradient(closest-side at 70% 40%,rgba(255,59,92,.08),transparent);
  animation:hh-fog 14s ease-in-out infinite alternate}
.hh-logo{position:relative;margin:0;font-weight:400;letter-spacing:.08em;line-height:1;
  font-size:clamp(44px,12vw,128px);color:#47FF9A;
  text-shadow:0 0 6px #20B05C,0 0 22px rgba(57,255,136,.55),3px 0 0 rgba(255,59,92,.55),-3px 0 0 rgba(62,246,255,.35);
  animation:hh-flicker 4.2s steps(1) infinite}
.hh-logo span{color:#FF3B5C;text-shadow:0 0 8px #C01640,0 0 24px rgba(255,59,92,.6)}
.hh-pitch{max-width:34em;font-family:var(--font-hud,'Share Tech Mono',monospace);font-size:clamp(14px,3.6vw,20px);color:var(--color-ash,#8F9A92);letter-spacing:.04em}
.hh-pitch b{color:var(--color-bone,#E8E2D0);font-weight:400}
.hh-title-go{margin-top:10px;background:transparent;border:2px solid #47FF9A;color:#47FF9A;cursor:pointer;
  font-family:inherit;font-size:clamp(22px,6vw,34px);letter-spacing:.14em;padding:10px 26px;
  box-shadow:0 0 14px rgba(57,255,136,.35),inset 0 0 12px rgba(57,255,136,.2);animation:hh-pulse 1.3s ease-in-out infinite}
.hh-title-keys{font-family:var(--font-hud,'Share Tech Mono',monospace);font-size:13px;color:#5E6B74;letter-spacing:.06em}
.hh-title-lv{position:absolute;top:calc(10px + env(safe-area-inset-top));right:14px;font-size:18px;color:#FF8A3D;letter-spacing:.1em}
@keyframes hh-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.97)}}
@keyframes hh-fog{from{transform:translate(-4%,2%) scale(1)}to{transform:translate(4%,-3%) scale(1.08)}}
@keyframes hh-flicker{0%,100%{opacity:1}91%{opacity:1}92%{opacity:.55;transform:translateX(2px)}93%{opacity:1;transform:none}96%{opacity:.8}97%{opacity:1}}
@media (prefers-reduced-motion: reduce){.hh-title-fog,.hh-logo,.hh-title-go{animation:none}}
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
 * Mount the title screen. Calls onStart() once on the first tap/click/key.
 * @param {HTMLElement} root
 * @param {{onStart:Function, touchUi?:boolean, hauntLv?:number}} opts
 * @returns {{destroy:Function}}
 */
export function mountTitle(root, { onStart, touchUi = false, hauntLv = 1 }) {
  injectCss();
  const el = document.createElement('div');
  el.className = 'hh-title';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'HAUNT//HOUND title');
  const keys = touchUi
    ? 'LEFT STICK move · RIGHT PAD aim + fire · DASH dodge · ❚❚ pause'
    : 'WASD move · MOUSE aim · CLICK fire · SHIFT dash · ESC pause';
  el.innerHTML = `
    <div class="hh-title-fog"></div>
    <div class="hh-title-lv">HAUNT LV ${hauntLv}</div>
    <h1 class="hh-logo">HAUNT<span>//</span>HOUND</h1>
    <p class="hh-pitch">Something is <b>possessing the other tank</b>. Duel it, dodge its tell, exorcise it. Climb <b>HAUNT LV 1–5</b>.</p>
    <button class="hh-title-go" type="button">${touchUi ? 'TAP' : 'PRESS'} TO DEPLOY</button>
    <p class="hh-title-keys">${keys}</p>`;
  root.appendChild(el);
  el.querySelector('.hh-title-go').focus({ preventScroll: true });

  let done = false;
  function go(e) {
    if (done) return;
    if (e && e.type === 'keydown' && (e.key === 'Tab' || e.key === 'Shift')) return;
    done = true;
    if (e) e.preventDefault();
    destroy();
    onStart();
  }
  el.addEventListener('click', go);
  window.addEventListener('keydown', go);

  function destroy() {
    window.removeEventListener('keydown', go);
    el.remove();
  }
  return { destroy };
}
