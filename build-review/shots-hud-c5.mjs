// C5 HUD shots + field-edge check. URL=... node shots-hud-c5.mjs
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, appendFileSync, copyFileSync, existsSync } from 'node:fs';

const URL_ = process.env.URL || 'http://127.0.0.1:8814/';
const HERE = new URL('.', import.meta.url).pathname;
const OUT = process.env.OUT || `${HERE}shots-hud-c5`;
const MIRROR = process.env.MIRROR || '';
mkdirSync(OUT, { recursive: true });
mkdirSync(MIRROR, { recursive: true });
writeFileSync(`${OUT}/FIELD-CHECK.md`,
  '# C5 field-edge check\n\nValues from `globalThis.__HH_HUD_Y__` (canvas px; gaps in CSS px).\n'
  + 'PASS when playerGapCss ≥ 4, enemyGapCss ≥ 4, and tauntGapCss ≥ 6 '
  + '(meters outside L/R borders; taunt above field top).\n\n');

const PORT = 9425;
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required', '--user-data-dir=/tmp/hh-hud-chrome-c5-' + Date.now(),
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
  const base = path.split('/').pop();
  try { copyFileSync(path, `${MIRROR}/${base}`); } catch {}
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
  const fieldCheck = async (name, required) => {
    await sleep(250);
    const y = await ev('globalThis.__HH_HUD_Y__ || globalThis.__HH_HUD_FIELD__');
    if (!y) {
      appendFileSync(`${OUT}/FIELD-CHECK.md`, `## ${name}\n\n_(no probe)_ — FAIL\n\n`);
      mirror(`${OUT}/FIELD-CHECK.md`);
      console.log('field-check FAIL (no probe)', name);
      return false;
    }
    const pg = Number(y.playerGapCss), eg = Number(y.enemyGapCss), tg = Number(y.tauntGapCss);
    const ok = pg >= 4 - 1e-6 && eg >= 4 - 1e-6 && tg >= 6 - 1e-6;
    const pass = ok ? 'PASS' : 'FAIL';
    const block = [
      `## ${name}`, '',
      `- scale: ${y.scale}`,
      `- lineTop: ${y.lineTop}  lineBottom: ${y.lineBottom}`,
      `- arena L/R: ${y.arenaLeft} / ${y.arenaRight}`,
      `- playerMeterRight: ${y.playerMeterRight} (gapCss ${pg.toFixed(2)})`,
      `- enemyMeterLeft: ${y.enemyMeterLeft} (gapCss ${eg.toFixed(2)})`,
      `- tauntBottom: ${y.tauntBottom} (gapCss ${tg.toFixed(2)})`,
      `- result: **${pass}**${required ? ' (required)' : ''}`, '',
    ].join('\n');
    appendFileSync(`${OUT}/FIELD-CHECK.md`, block);
    mirror(`${OUT}/FIELD-CHECK.md`);
    console.log('field-check', name, pass, [pg, eg, tg].map(g => g.toFixed(2)));
    return ok;
  };
  return { S, ev, shot, tap, click, go, fieldCheck, close: () => send('Target.closeTarget', { targetId }) };
}

const DESK = { name: 'desk', w: 1280, h: 720, dpr: 1, mobile: false };
const LAND = { name: 'phone-land', w: 844, h: 390, dpr: 2, mobile: true };

let fails = 0;

// (C5: no title shot required)

// 2) Landscape LV1 mid-fight with taunt
{
  const t = await context(LAND);
  await t.go('?lv=1&demo=1');
  await t.click('.hh-title-go');
  await sleep(1000);
  await t.ev(`globalThis.__HH_FORCE__='orange'`);
  await sleep(800);
  await t.shot('c5-phone-land-lv1-taunt');
  const ok = await t.fieldCheck('c5-phone-land-lv1-taunt', true);
  if (!ok) fails++;
  await t.close();
}

// 3) Landscape LV3 Sever Wall
{
  const t = await context(LAND);
  await t.go('?lv=3');
  await t.click('.hh-title-go');
  await sleep(1000);
  await t.ev(`globalThis.__HH_FORCE__='orange'`);
  await sleep(800);
  await t.shot('c5-phone-land-lv3-sever');
  const ok = await t.fieldCheck('c5-phone-land-lv3-sever', true);
  if (!ok) fails++;
  await t.close();
}

// 4) Desktop mid-fight
{
  const t = await context(DESK);
  await t.go('?lv=1&demo=1');
  await t.click('.hh-title-go');
  await sleep(1000);
  await t.ev(`globalThis.__HH_FORCE__='orange'`);
  await sleep(800);
  await t.shot('c5-desk-lv1-mid');
  const ok = await t.fieldCheck('c5-desk-lv1-mid', false);
  // desktop field-check is informational
  await t.close();
}

appendFileSync(`${OUT}/FIELD-CHECK.md`, `\n---\nRequired field-check FAILs: **${fails}**\n`);
mirror(`${OUT}/FIELD-CHECK.md`);
console.log('errors:', errors.length ? errors : 'none');
console.log('field-check fails:', fails);
chrome.kill();
process.exit(errors.length || fails ? 1 : 0);
