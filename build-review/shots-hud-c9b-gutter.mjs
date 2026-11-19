// C9b gutter haunt variants. URL=... STYLE=silver|purple node shots-hud-c9b-gutter.mjs
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, appendFileSync, copyFileSync } from 'node:fs';

const STYLE = (process.env.STYLE || 'silver').toLowerCase();
const URL_ = process.env.URL || 'http://127.0.0.1:8814/';
const HERE = new URL('.', import.meta.url).pathname;
const OUT = process.env.OUT || `${HERE}shots-hud-c9b`;
const MIRROR = process.env.MIRROR || '';
mkdirSync(OUT, { recursive: true });
if (MIRROR) mkdirSync(MIRROR, { recursive: true });

const PORT = 9427 + (STYLE === 'purple' ? 1 : 0);
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required', '--user-data-dir=/tmp/hh-hud-chrome-c9b-' + STYLE + '-' + Date.now(),
  '--use-gl=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ver; for (let i = 0; i < 50; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; } catch { await sleep(200); } }
if (!ver) { console.error('chrome failed'); process.exit(1); }
const ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const errors = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
  else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); };
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });

function mirror(path) {
  if (!MIRROR) return;
  try { copyFileSync(path, `${MIRROR}/${path.split('/').pop()}`); } catch {}
}

async function context(p) {
  const { browserContextId } = await send('Target.createBrowserContext');
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId: s } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, q) => send(m, q, s);
  await S('Runtime.enable'); await S('Page.enable');
  await S('Emulation.setDeviceMetricsOverride', { width: p.w, height: p.h, deviceScaleFactor: p.dpr, mobile: p.mobile });
  if (p.mobile) {
    await S('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await S('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  }
  const ev = async x => (await S('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result.value;
  const shot = async name => {
    const { data } = await S('Page.captureScreenshot', { format: 'png' });
    const f = `${OUT}/${name}.png`;
    writeFileSync(f, Buffer.from(data, 'base64'));
    mirror(f);
    console.log('wrote', f);
    return f;
  };
  const tap = async (x, y) => {
    if (p.mobile) {
      await S('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      await sleep(60);
      await S('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await S('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await S('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    }
  };
  const click = async sel => {
    const c = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    if (!c) throw new Error('missing ' + sel);
    await tap(c.x, c.y);
  };
  const go = async q => {
    const sep = q.includes('?') ? '&' : (q ? '?' : '?');
    let url = URL_ + (q || '') + (q.includes('gutter=') ? '' : `${sep}gutter=${STYLE}`);
    const ga = process.env.GUTTER_ALPHA;
    if (ga && !url.includes('gutterAlpha=')) url += `&gutterAlpha=${ga}`;
    await S('Page.navigate', { url }); await sleep(2500);
  };
  return { S, ev, shot, tap, click, go, close: () => send('Target.closeTarget', { targetId }) };
}

const DESK = { name: 'desk', w: 1280, h: 720, dpr: 1, mobile: false };
const LAND = { name: 'phone-land', w: 844, h: 390, dpr: 2, mobile: true };
const tag = STYLE; // silver | purple

{
  const t = await context(LAND);
  await t.go('?lv=1&demo=1');
  await t.click('.hh-title-go');
  await sleep(1000);
  await t.ev(`globalThis.__HH_FORCE__='orange'; globalThis.__HH_FORCE_TAUNT__='Fresh metal. I can smell the warranty. Hold still.'; if (globalThis.__HH_SET_GUTTER__) globalThis.__HH_SET_GUTTER__('${STYLE}'); if (globalThis.__HH_GUTTER_ALPHA_SET__) {} ; const __a=Number(new URLSearchParams(location.search).get('gutterAlpha')); if (Number.isFinite(__a)) globalThis.__HH_GUTTER_ALPHA__=__a;`);
  await sleep(800);
  await t.shot(`c9b-phone-land-lv1-${tag}`);
  await t.close();
}
{
  const t = await context(LAND);
  await t.go('?lv=3');
  await t.click('.hh-title-go');
  await sleep(1000);
  await t.ev(`globalThis.__HH_FORCE__='orange'; globalThis.__HH_FORCE_TAUNT__='Fresh metal. I can smell the warranty. Hold still.'; if (globalThis.__HH_SET_GUTTER__) globalThis.__HH_SET_GUTTER__('${STYLE}'); if (globalThis.__HH_GUTTER_ALPHA_SET__) {} ; const __a=Number(new URLSearchParams(location.search).get('gutterAlpha')); if (Number.isFinite(__a)) globalThis.__HH_GUTTER_ALPHA__=__a;`);
  await sleep(800);
  await t.shot(`c9b-phone-land-lv3-${tag}`);
  await t.close();
}
{
  const t = await context(DESK);
  await t.go('?lv=1&demo=1');
  await t.click('.hh-title-go');
  await sleep(1000);
  await t.ev(`globalThis.__HH_FORCE__='orange'; globalThis.__HH_FORCE_TAUNT__='Fresh metal. I can smell the warranty. Hold still.'; if (globalThis.__HH_SET_GUTTER__) globalThis.__HH_SET_GUTTER__('${STYLE}'); if (globalThis.__HH_GUTTER_ALPHA_SET__) {} ; const __a=Number(new URLSearchParams(location.search).get('gutterAlpha')); if (Number.isFinite(__a)) globalThis.__HH_GUTTER_ALPHA__=__a;`);
  await sleep(800);
  await t.shot(`c9b-desk-lv1-${tag}`);
  await t.close();
}
{
  const t = await context(LAND);
  await t.go('?lv=1&demo=1');
  await t.click('.hh-title-go');
  await sleep(600);
  await t.ev(`if (globalThis.__HH_SET_GUTTER__) globalThis.__HH_SET_GUTTER__('${STYLE}'); if (globalThis.__HH_GUTTER_ALPHA_SET__) {} ; const __a=Number(new URLSearchParams(location.search).get('gutterAlpha')); if (Number.isFinite(__a)) globalThis.__HH_GUTTER_ALPHA__=__a;`);
  await sleep(400);
  const clip = await t.ev(`(()=>{
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    const ps = globalThis.__HH_PLAYER_SCREEN__;
    const y = globalThis.__HH_HUD_Y__;
    let cx, cy;
    if (ps && Number.isFinite(ps.x) && Number.isFinite(ps.y)) { cx = r.x + ps.x; cy = r.y + ps.y; }
    else if (y) {
      const s = y.scale || 1;
      const left = y.arenaLeft / s, right = y.arenaRight / s;
      const top = (y.lineBottom || 0) / s, bot = (y.fieldBottom || 0) / s;
      cx = r.x + left + (right - left) * 0.2;
      cy = r.y + top + (bot - top) * 0.55;
    } else { cx = r.x + r.width * 0.32; cy = r.y + r.height * 0.55; }
    const side = 160;
    return { x: Math.max(0, Math.round(cx - side / 2)), y: Math.max(0, Math.round(cy - side / 2)), width: side, height: side, scale: 1 };
  })()`);
  if (clip) {
    const { data } = await t.S('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } });
    const f = `${OUT}/c9b-tank-closeup-${tag}.png`;
    writeFileSync(f, Buffer.from(data, 'base64'));
    mirror(f);
    console.log('wrote', f, clip);
  }
  await t.close();
}

console.log('errors:', errors.length ? errors : 'none');
chrome.kill();
process.exit(errors.length ? 1 : 0);
