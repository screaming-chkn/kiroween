import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.URL || 'http://127.0.0.1:8834/';
const OUT = process.env.OUT || 'team-archive/tank-fresh4';
mkdirSync(OUT, { recursive: true });
const PORT = 9462;
const chrome = spawn('google-chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=/tmp/hh-fresh4-' + Date.now(),
  '--use-gl=swiftshader', '--enable-unsafe-swiftshader', 'about:blank',
], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ver; for (let i = 0; i < 50; i++) {
  try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
  catch { await sleep(200); }
}
if (!ver) { console.error('chrome failed'); process.exit(1); }
const ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) {
    const p = pend.get(m.id); pend.delete(m.id);
    m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
  }
};
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const i = ++id; pend.set(i, { res, rej });
  ws.send(JSON.stringify({ id: i, method, params, sessionId }));
});

const { browserContextId } = await send('Target.createBrowserContext');
const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
const { sessionId: s } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, q) => send(m, q, s);
await S('Runtime.enable'); await S('Page.enable');
await S('Emulation.setDeviceMetricsOverride', { width: 1400, height: 2200, deviceScaleFactor: 1, mobile: false });
await S('Page.navigate', { url: BASE + 'build-review/tank-fresh4-plates.html' });
await sleep(2000);
const title = (await S('Runtime.evaluate', { expression: 'document.title', returnByValue: true })).result.value;
console.log('title', title);
if (title !== 'fresh4-ready') {
  const err = (await S('Runtime.evaluate', { expression: 'window.__err||document.body.innerText.slice(0,500)', returnByValue: true })).result.value;
  console.error('not ready', err);
}

const dumps = (await S('Runtime.evaluate', { expression: `(()=>{
  const out={};
  for (const c of document.querySelectorAll('canvas')) {
    const id=c.dataset.id||'x';
    const kind=c.dataset.kind||'unk';
    out[kind+'-'+id]=c.toDataURL('image/png').slice(22);
  }
  return out;
})()`, returnByValue: true, awaitPromise: true })).result.value;

for (const [k,b64] of Object.entries(dumps || {})) {
  const f = `${OUT}/${k}.png`;
  writeFileSync(f, Buffer.from(b64, 'base64'));
  console.log('wrote', f);
}
chrome.kill();
process.exit(0);
