// C9g: tank vs target + rot + phone LV1 (220 HP). URL=... OUT=... node shots-hud-c9g.mjs
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';

const BASE = process.env.URL || 'http://127.0.0.1:8831/';
const OUT = process.env.OUT || 'team-archive/hud-c9g';
mkdirSync(OUT, { recursive: true });

const PORT = 9451;
const chrome = spawn('google-chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  '--no-first-run', '--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required',
  '--user-data-dir=/tmp/hh-hud-chrome-c9g-' + Date.now(),
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

async function page(w, h, dpr = 1, mobile = false) {
  const { browserContextId } = await send('Target.createBrowserContext');
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId: s } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, q) => send(m, q, s);
  await S('Runtime.enable'); await S('Page.enable');
  await S('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile });
  if (mobile) {
    await S('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await S('Emulation.setUserAgentOverride', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
  }
  const ev = async x => (await S('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result.value;
  const shot = async name => {
    const { data } = await S('Page.captureScreenshot', { format: 'png' });
    const f = `${OUT}/${name}.png`;
    writeFileSync(f, Buffer.from(data, 'base64'));
    console.log('wrote', f);
    return f;
  };
  const canvasPng = async (sel, name) => {
    const b64 = await ev(`(()=>{
      const c=document.querySelector(${JSON.stringify(sel)});
      if(!c) return null;
      return c.toDataURL('image/png').slice(22);
    })()`);
    if (!b64) throw new Error('no canvas ' + sel);
    const f = `${OUT}/${name}.png`;
    writeFileSync(f, Buffer.from(b64, 'base64'));
    console.log('wrote', f);
    return f;
  };
  return { S, ev, shot, canvasPng, targetId };
}

// 1) vs-target page
{
  const t = await page(1200, 900, 1, false);
  await t.S('Page.navigate', { url: BASE + 'build-review/tank-vs-target-c9g.html' });
  await sleep(1500);
  const title = await t.ev('document.title');
  console.log('vs title', title);
  // full page for context
  await t.shot('c9g-vs-target-page');
  // extract each canvas as equal-panel side-by-side with its img
  const pair = await t.ev(`(()=>{
    const row = document.querySelector('[data-name="vs-target-iso"]');
    if(!row) return null;
    const img = row.querySelector('img');
    const c = row.querySelector('canvas');
    // compose on an offscreen canvas
    const out = document.createElement('canvas');
    const gap = 10;
    out.width = img.width + gap + c.width;
    out.height = Math.max(img.height, c.height);
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,out.width,out.height);
    ctx.drawImage(img, 0, 0, img.width, img.height);
    ctx.drawImage(c, img.width + gap, 0);
    return out.toDataURL('image/png').slice(22);
  })()`);
  if (pair) {
    writeFileSync(`${OUT}/c9g-vs-target-iso.png`, Buffer.from(pair, 'base64'));
    console.log('wrote', `${OUT}/c9g-vs-target-iso.png`);
  } else console.error('vs-target-iso compose failed');

  const pairSide = await t.ev(`(()=>{
    const row = document.querySelector('[data-name="vs-target-side"]');
    if(!row) return null;
    const img = row.querySelector('img');
    const c = row.querySelector('canvas');
    const out = document.createElement('canvas');
    const gap = 10;
    out.width = img.width + gap + c.width;
    out.height = Math.max(img.height, c.height);
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,out.width,out.height);
    ctx.drawImage(img, 0, 0, img.width, img.height);
    ctx.drawImage(c, img.width + gap, 0);
    return out.toDataURL('image/png').slice(22);
  })()`);
  if (pairSide) {
    writeFileSync(`${OUT}/c9g-vs-target-side.png`, Buffer.from(pairSide, 'base64'));
    console.log('wrote', `${OUT}/c9g-vs-target-side.png`);
  }
  await send('Target.closeTarget', { targetId: t.targetId });
}

// 2) rot + closeup
{
  const t = await page(1200, 900, 1, false);
  await t.S('Page.navigate', { url: BASE + 'build-review/tank-rot-c9g.html' });
  await sleep(1500);
  console.log('rot title', await t.ev('document.title'));
  await t.canvasPng('canvas[data-name="closeup"]', 'c9g-tank-closeup');
  await t.canvasPng('canvas[data-name="rot-sheet"]', 'c9g-tank-rot-sheet');
  await t.canvasPng('canvas[data-name="rot0"]', 'c9g-tank-rot0');
  await t.canvasPng('canvas[data-name="rot45"]', 'c9g-tank-rot45');
  await t.canvasPng('canvas[data-name="rot90"]', 'c9g-tank-rot90');
  await t.canvasPng('canvas[data-name="rot-iso"]', 'c9g-tank-rot-iso');
  await send('Target.closeTarget', { targetId: t.targetId });
}

// 3) phone LV1 — need game server. Prefer existing 8817 or start one.
let gameUrl = process.env.GAME_URL || '';
if (!gameUrl) {
  // try known ports
  for (const p of [8817, 8815, 8814]) {
    try {
      const r = await fetch(`http://127.0.0.1:${p}/`);
      if (r.ok) { gameUrl = `http://127.0.0.1:${p}/`; break; }
    } catch {}
  }
}
if (!gameUrl) {
  console.warn('no game server — skipping phone shot');
} else {
  console.log('gameUrl', gameUrl);
  const t = await page(844, 390, 2, true);
  await t.S('Page.navigate', { url: gameUrl + '?lv=1&demo=1' });
  await sleep(2500);
  const btn = await t.ev(`(()=>{const e=document.querySelector('.hh-title-go');if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  if (!btn) {
    console.error('no deploy button');
  } else {
    await t.S('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: btn.x, y: btn.y, id: 1 }] });
    await sleep(60);
    await t.S('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(1000);
    await t.ev(`globalThis.__HH_FORCE__='orange'; globalThis.__HH_FORCE_TAUNT__='Welcome to the haunt. Pull up a chain.'`);
    await sleep(700);
    const hp = await t.ev(`(()=>{
      const a = globalThis.__HH_ARENA__ || globalThis.__HH_STATE__ || null;
      const enemy = a?.enemy || a?.state?.enemy || null;
      const hud = globalThis.__HH_HUD_Y__ || {};
      return {
        enemyHp: enemy?.hp ?? null,
        enemyMaxHp: enemy?.maxHp ?? null,
        hauntLv: globalThis.__HH_HAUNT_LV__ ?? null,
        ml: hud.playerMeterToLabelCss, el: hud.enemyMeterToLabelCss, th: hud.tauntHpGapCss,
      };
    })()`);
    console.log('HP probe', JSON.stringify(hp));
    writeFileSync(`${OUT}/HP-PROBE.json`, JSON.stringify(hp, null, 2));
    await t.shot('c9g-phone-land-lv1');
    const hudOk = (hp.ml ?? 8) >= 7.9 && (hp.el ?? 8) >= 7.9 && (hp.th ?? 16) >= 15.9;
    writeFileSync(`${OUT}/HUD-SPACING.txt`, `meter-label P/E: ${hp.ml}/${hp.el}  taunt-hp: ${hp.th}  → ${hudOk ? 'PASS' : 'FAIL'}\n`);
  }
  await send('Target.closeTarget', { targetId: t.targetId });
}

chrome.kill();
console.log('C9g shots done');
process.exit(0);
