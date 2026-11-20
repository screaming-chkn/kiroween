// Haunt Factory shots: phone-land + desk with ?tauntPack=factory (no demo).
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs';

const URL_ = process.env.URL || 'http://127.0.0.1:8815/';
const HERE = new URL('.', import.meta.url).pathname;
const OUT = process.env.OUT || `${HERE}shots-haunt-factory`;
const MIRROR = process.env.MIRROR || 'team-archive/haunt-factory';
mkdirSync(OUT, { recursive: true });
mkdirSync(MIRROR, { recursive: true });

const PORT = 9426;
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required', '--user-data-dir=/tmp/hh-haunt-chrome-' + Date.now(),
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
  const go = async q => { await S('Page.navigate', { url: URL_ + (q || '') }); await sleep(2500); };
  return { S, ev, shot, tap, click, go, close: () => send('Target.closeTarget', { targetId }) };
}

const DESK = { name: 'desk', w: 1280, h: 720, dpr: 1, mobile: false };
const LAND = { name: 'phone-land', w: 844, h: 390, dpr: 2, mobile: true };

// Factory pack ON — spawn taunt (no demo; demo would override pack)
{
  const t = await context(LAND);
  await t.go('?lv=1&tauntPack=factory');
  await t.click('.hh-title-go');
  // Wait for typewriter (~25 chars * 32ms) + hold window
  await sleep(1600);
  await t.shot('hf-phone-land-factory-taunt');
  const textProbe = await t.ev(`(()=>{
    // Best-effort: look for canvas-drawn text via no DOM; return pack flag from URL
    return { search: location.search, pack: new URLSearchParams(location.search).get('tauntPack') };
  })()`);
  writeFileSync(`${OUT}/probe-factory.json`, JSON.stringify(textProbe, null, 2));
  mirror(`${OUT}/probe-factory.json`);
  await t.close();
}

// Default bank control (no flag) — same layout shot for contrast
{
  const t = await context(LAND);
  await t.go('?lv=1');
  await t.click('.hh-title-go');
  await sleep(1600);
  await t.shot('hf-phone-land-default-taunt');
  await t.close();
}

// Desk duel with factory pack
{
  const t = await context(DESK);
  await t.go('?lv=1&tauntPack=factory');
  await t.click('.hh-title-go');
  await sleep(1600);
  await t.shot('hf-desk-factory-taunt');
  await t.close();
}

// Factory + haunt-factory alias
{
  const t = await context(LAND);
  await t.go('?lv=1&tauntPack=haunt-factory');
  await t.click('.hh-title-go');
  await sleep(1600);
  await t.shot('hf-phone-land-haunt-factory-alias');
  await t.close();
}

console.log('errors:', errors.length ? errors : 'none');
chrome.kill();
process.exit(errors.length ? 1 : 0);
