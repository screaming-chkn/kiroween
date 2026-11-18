/**
 * src/ui/pauseMenu.js — pause overlay (M2): resume, SFX + music volume,
 * mute, quit to garage. DOM only; the caller owns the frozen sim.
 * z-order: touch overlay 40 < pause button 45 < pause menu 60 < garage 100.
 */

const CSS = `
.hh-pause{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:rgba(5,7,6,.72);
  font-family:var(--font-hud,'Share Tech Mono',monospace);color:var(--color-bone,#E8E2D0)}
.hh-pause-panel{min-width:min(320px,86vw);padding:22px 24px;border:1px solid #1F9E57;background:#0C130F;
  box-shadow:0 0 24px rgba(57,255,136,.18);display:flex;flex-direction:column;gap:14px}
.hh-pause h2{margin:0 0 4px;font-family:var(--font-display,'VT323',monospace);font-weight:400;font-size:40px;letter-spacing:.14em;color:#47FF9A;text-shadow:0 0 10px rgba(57,255,136,.5);text-align:center}
.hh-pause button{font:inherit;font-size:17px;letter-spacing:.1em;padding:10px 12px;background:transparent;color:#47FF9A;border:1px solid #1F9E57;cursor:pointer;min-height:44px}
.hh-pause button:hover,.hh-pause button:focus-visible{background:rgba(57,255,136,.1)}
.hh-pause .hh-quit{color:#FF8A3D;border-color:#8a4a22}
.hh-pause label{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:15px;letter-spacing:.08em;color:#8F9A92}
.hh-pause input[type=range]{flex:1;accent-color:#47FF9A;min-height:32px}
.hh-pause .hh-hint{font-size:12px;color:#5E6B74;text-align:center}
.hh-pause-btn{position:fixed;z-index:45;top:calc(34px + env(safe-area-inset-top));right:calc(10px + env(safe-area-inset-right));
  width:44px;height:44px;border:1px solid #1F9E57;background:rgba(10,13,11,.6);color:#47FF9A;font:16px/1 var(--font-hud,monospace);letter-spacing:-.1em;cursor:pointer}
`;

let styled = false;
function injectCss() {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);
}

/** Small top-right pause button, under HAUNT LV (phones). */
export function mountPauseButton(root, onPress) {
  injectCss();
  const b = document.createElement('button');
  b.className = 'hh-pause-btn';
  b.type = 'button';
  b.setAttribute('aria-label', 'Pause');
  b.textContent = '❚❚';
  b.addEventListener('click', (e) => { e.preventDefault(); onPress(); });
  root.appendChild(b);
  return { destroy: () => b.remove(), el: b };
}

/**
 * @param {HTMLElement} root
 * @param {{settings:{sfx:number,music:number,muted:boolean},
 *          onChange:Function, onResume:Function, onQuit:Function, onPreview?:Function}} o
 */
export function mountPauseMenu(root, { settings, onChange, onResume, onQuit, onPreview, touchUi = false }) {
  injectCss();
  let s = { ...settings };
  const el = document.createElement('div');
  el.className = 'hh-pause';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Paused');
  el.innerHTML = `
    <div class="hh-pause-panel">
      <h2>PAUSED</h2>
      <button type="button" class="hh-resume">RESUME</button>
      <label>SFX <input type="range" class="hh-sfx" min="0" max="100" step="5" aria-label="SFX volume"></label>
      <label>MUSIC <input type="range" class="hh-music" min="0" max="100" step="5" aria-label="Music volume"></label>
      <button type="button" class="hh-mute" aria-pressed="false"></button>
      <button type="button" class="hh-quit">QUIT TO GARAGE</button>
      ${touchUi ? '' : '<p class="hh-hint">ESC / P to resume</p>'}
    </div>`;
  const $ = (c) => el.querySelector(c);
  const sfx = $('.hh-sfx');
  const music = $('.hh-music');
  const mute = $('.hh-mute');
  function sync() {
    sfx.value = String(Math.round(s.sfx * 100));
    music.value = String(Math.round(s.music * 100));
    mute.textContent = s.muted ? 'SOUND: MUTED' : 'SOUND: ON';
    mute.setAttribute('aria-pressed', String(s.muted));
  }
  function set(patch) { s = { ...s, ...patch }; sync(); onChange(s); }
  sfx.addEventListener('input', () => set({ sfx: Number(sfx.value) / 100 }));
  sfx.addEventListener('change', () => onPreview && onPreview());
  music.addEventListener('input', () => set({ music: Number(music.value) / 100 }));
  mute.addEventListener('click', () => set({ muted: !s.muted }));
  $('.hh-resume').addEventListener('click', () => onResume());
  $('.hh-quit').addEventListener('click', () => onQuit());
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); e.stopPropagation(); onResume(); }
  });
  sync();
  root.appendChild(el);
  $('.hh-resume').focus({ preventScroll: true });
  return { destroy: () => el.remove() };
}
