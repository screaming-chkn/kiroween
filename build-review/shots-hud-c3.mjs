// Layout C3 preview shots + y-check. URL=... node shots-hud-c3.mjs
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, appendFileSync } from 'node:fs';

const URL_ = process.env.URL || 'http://127.0.0.1:8811/';
const OUT = 'build-host/kiroween/build-review/shots-hud-c3';
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/y-measurements.md`,
  '# C3 HUD y-check\n\nAll values from `globalThis.__HH_HUD_Y__` (canvas px; `scale` = canvas/CSS).\n'
  + 'PASS when playerGapCss, houndGapCss, and tauntGapCss are all ≥ 6.\n\n');

const PORT = 9423;
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required', '--user-data-dir=/tmp/hh-hud-chrome-c3-' + Date.now(),
  '--use-gl=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ver; for (let i = 0; i < 50; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; } catch { await sleep(200); } }
if (!ver) { console.error('chrome failed'); process.exit(1); }
const ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const errors = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
  else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); };
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });

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
  const yCheck = async (name, required) => {
    // wait a couple frames so OVERLAY writes __HH_HUD_Y__
    await sleep(200);
    const y = await ev('globalThis.__HH_HUD_Y__');
    if (!y) {
      const line = `| ${name} | _(no probe)_ | — | FAIL |\n`;
      appendFileSync(`${OUT}/y-measurements.md`, line);
      console.log('y-check FAIL (no probe)', name);
      return false;
    }
    const gaps = [y.playerGapCss, y.houndGapCss, y.tauntGapCss];
    const ok = gaps.every(g => typeof g === 'number' && g >= 6 - 1e-6);
    const pass = ok ? 'PASS' : 'FAIL';
    const block = [
      `## ${name}`,
      '',
      `- unit: ${y.unit} (gaps reported in CSS px = canvas/scale)`,
      `- scale: ${y.scale}`,
      `- lineBottom: ${y.lineBottom}`,
      `- playerMeterTop: ${y.playerMeterTop} (gapCss ${Number(y.playerGapCss).toFixed(2)})`,
      `- houndMeterTop: ${y.houndMeterTop} (gapCss ${Number(y.houndGapCss).toFixed(2)})`,
      `- tauntTop: ${y.tauntTop} (gapCss ${Number(y.tauntGapCss).toFixed(2)})`,
      `- result: **${pass}**${required ? ' (required)' : ''}`,
      '',
    ].join('\n');
    appendFileSync(`${OUT}/y-measurements.md`, block);
    console.log('y-check', name, pass, gaps.map(g => Number(g).toFixed(2)));
    return ok;
  };
  return { S, ev, shot, tap, click, go, yCheck, close: () => send('Target.closeTarget', { targetId }) };
}

const DESK = { name: 'desk', w: 1280, h: 800, dpr: 1, mobile: false };
const PHONE = { name: 'phone', w: 390, h: 844, dpr: 2, mobile: true };
const LAND = { name: 'phone-land', w: 844, h: 390, dpr: 2, mobile: true };
const FORCES = [
  { force: 'orange', tag: 'orange' },
  { force: 'red', tag: 'red' },
  { force: 'ghost', tag: 'ghost' },
];

let fails = 0;

async function forceShot(p, force, tag, { query = '?lv=1', yRequired = false } = {}) {
  const t = await context(p);
  await t.go(query);
  await t.click('.hh-title-go');
  await sleep(1200);
  await t.ev(`globalThis.__HH_FORCE__=${JSON.stringify(force)}`);
  await sleep(900);
  const name = `c3-${p.name}-${tag}`;
  await t.shot(name);
  if (p.mobile) {
    const ok = await t.yCheck(name, yRequired);
    if (yRequired && !ok) fails++;
  }
  await t.close();
}

// Desk twins (orange/red/ghost) — no y-check required
for (const f of FORCES) {
  await forceShot(DESK, f.force, f.tag);
}

// Phone portrait — all must PASS y-check
for (const f of FORCES) {
  await forceShot(PHONE, f.force, f.tag, { yRequired: true });
}

// Phone portrait HOUND taunt
{
  const t = await context(PHONE);
  await t.go('?lv=1&demo=1');
  await t.click('.hh-title-go');
  await sleep(900);
  await t.ev(`globalThis.__HH_FORCE__='orange'`);
  await sleep(700);
  const name = 'c3-phone-hound-taunt';
  await t.shot(name);
  const ok = await t.yCheck(name, true);
  if (!ok) fails++;
  await t.close();
}

// Landscape phone: orange, red, hound-taunt
await forceShot(LAND, 'orange', 'orange', { yRequired: true });
await forceShot(LAND, 'red', 'red', { yRequired: true });
{
  const t = await context(LAND);
  await t.go('?lv=1&demo=1');
  await t.click('.hh-title-go');
  await sleep(900);
  await t.ev(`globalThis.__HH_FORCE__='orange'`);
  await sleep(700);
  const name = 'c3-phone-land-hound-taunt';
  await t.shot(name);
  const ok = await t.yCheck(name, true);
  if (!ok) fails++;
  await t.close();
}

// Optional Sever Wall peek (LV3)
await forceShot(PHONE, 'orange', 'lv3-sever', { query: '?lv=3', yRequired: true });
await forceShot(LAND, 'orange', 'lv3-sever', { query: '?lv=3', yRequired: true });

appendFileSync(`${OUT}/y-measurements.md`, `\n---\nRequired phone y-checks with FAIL: **${fails}**\n`);
console.log('errors:', errors.length ? errors : 'none');
console.log('y-check fails:', fails);
chrome.kill();
process.exit(errors.length || fails ? 1 : 0);
