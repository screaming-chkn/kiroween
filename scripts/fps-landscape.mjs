/**
 * Mid-fight FPS probe for phone landscape (spec 14 R6).
 * Usage: URL=http://127.0.0.1:8835/ node scripts/fps-landscape.mjs
 * Writes JSON summary to stdout and optionally HOT-PERF.md path via OUT_MD.
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const URL_ = process.env.URL || 'http://127.0.0.1:8835/';
const OUT_MD = process.env.OUT_MD || '';
const OUT_JSON = process.env.OUT_JSON || '';
const PORT = Number(process.env.CDP_PORT || 9431);
const FRAME_PROBE = `globalThis.__HH_FT__=[];(function f(t){globalThis.__HH_FT__.push(t);requestAnimationFrame(f)})(performance.now());`;
const PROFILES = [
  { name: 'land-844x390@2', w: 844, h: 390, dpr: 2, mobile: true, cpu: 1 },
  { name: 'land-844x390@3', w: 844, h: 390, dpr: 3, mobile: true, cpu: 1 },
  { name: 'land-844x390@3-cpu4x', w: 844, h: 390, dpr: 3, mobile: true, cpu: 4 },
];

const chrome = spawn('google-chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run',
  '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required',
  '--user-data-dir=/tmp/hh-fps-land-' + Date.now(),
  '--use-gl=swiftshader', '--enable-unsafe-swiftshader', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ver;
for (let i = 0; i < 50; i++) {
  try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
  catch { await sleep(200); }
}
if (!ver) { console.error('chrome failed'); process.exit(1); }
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let id = 0;
const pend = new Map();
ws.onmessage = (e) => {
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

const results = [];
for (const p of PROFILES) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: s } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, q) => send(m, q, s);
  await S('Runtime.enable'); await S('Page.enable');
  await S('Emulation.setDeviceMetricsOverride', {
    width: p.w, height: p.h, deviceScaleFactor: p.dpr, mobile: p.mobile,
  });
  await S('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await S('Emulation.setUserAgentOverride', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const ev = async (x) => (await S('Runtime.evaluate', {
    expression: x, returnByValue: true, awaitPromise: true,
  })).result.value;
  const tap = async (x, y) => {
    await S('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await sleep(60);
    await S('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await S('Page.navigate', { url: URL_ + '?lv=1&demo=1' });
  await sleep(2500);
  const dep = await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/DEPLOY/.test(b.textContent));if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  if (dep) await tap(dep.x, dep.y);
  else await tap(p.w / 2, p.h / 2);
  await sleep(1200);
  await S('Emulation.setCPUThrottlingRate', { rate: p.cpu });
  await S('Performance.enable');
  const m0 = Object.fromEntries((await S('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  await ev(FRAME_PROBE);
  await sleep(6000);
  const ft = await ev('globalThis.__HH_FT__');
  const m1 = Object.fromEntries((await S('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  await S('Emulation.setCPUThrottlingRate', { rate: 1 });
  const d = [];
  for (let i = 1; i < (ft?.length || 0); i++) d.push(ft[i] - ft[i - 1]);
  const sorted = [...d].sort((a, b) => a - b);
  const meanFps = d.length ? +(1000 / (d.reduce((a, b) => a + b, 0) / d.length)).toFixed(1) : 0;
  const row = {
    profile: p.name, w: p.w, h: p.h, dpr: p.dpr, cpu: p.cpu,
    frames: d.length, meanFps,
    p50ms: d.length ? +sorted[Math.floor(d.length * 0.5)].toFixed(1) : null,
    p95ms: d.length ? +sorted[Math.floor(d.length * 0.95)].toFixed(1) : null,
    over20ms: d.filter((x) => x > 20).length,
    busyMsPerFrame: d.length ? +(((m1.TaskDuration - m0.TaskDuration) * 1000) / d.length).toFixed(2) : null,
  };
  console.log(JSON.stringify(row));
  results.push(row);
  await send('Target.closeTarget', { targetId });
}

const target = 55;
const worst = results.reduce((a, b) => (a.meanFps < b.meanFps ? a : b), results[0]);
const pass = results.every((r) => r.cpu > 1 || r.meanFps >= target);
const md = [
  '# HOT-PERF — phone landscape mid-fight FPS',
  '',
  `Measured against ${URL_} on tip of worktree (spec 14 R6 target ≥ ${target} FPS at 844×390 @3 class).`,
  'Headless Chrome + CDP; 6 s rAF sample after DEPLOY. Soft fixes only if unthrottled mean < 55.',
  '',
  '| profile | meanFps | p50ms | p95ms | over20ms | busyMs/frame |',
  '|---|---:|---:|---:|---:|---:|',
  ...results.map((r) => `| ${r.profile} | ${r.meanFps} | ${r.p50ms} | ${r.p95ms} | ${r.over20ms} | ${r.busyMsPerFrame} |`),
  '',
  `Unthrottled gate: **${pass ? 'PASS' : 'BELOW TARGET'}** (ignore cpu4x for soft-fix gate).`,
  `Worst unthrottled: ${results.filter((r) => r.cpu === 1).map((r) => `${r.profile}=${r.meanFps}`).join(', ')}.`,
  '',
  pass
    ? 'No soft perf changes applied (already ≥ 55 on unthrottled land profiles).'
    : 'Soft fixes needed: reduce phone-lite particle caps / skip draws — do not touch C5 layout or balance.',
  '',
].join('\n');

if (OUT_MD) {
  mkdirSync(OUT_MD.replace(/\/[^/]+$/, ''), { recursive: true });
  writeFileSync(OUT_MD, md);
}
if (OUT_JSON) writeFileSync(OUT_JSON, JSON.stringify({ url: URL_, target, results }, null, 2));
console.log(md);
ws.close(); chrome.kill();
process.exit(pass ? 0 : 2);
