/**
 * tests/ui/endCardView.test.js
 * Run: node tests/ui/endCardView.test.js
 */
import assert from 'node:assert/strict';
import { drawEndCardView, COUNT_UP_MS, countUpMs, stampText, endCardKeyAction } from '../../src/ui/endCardView.js';
import { formatArenaSpecStamp, countSpecTasks } from '../../src/ui/specStamp.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.error(`FAIL: ${name}\n  ${e.message}`); }
}

function fakeCtx() {
  const log = { saves: 0, restores: 0, texts: [], fills: [], fillCalls: [], strokeCalls: [] };
  const target = {
    save() { log.saves++; },
    restore() { log.restores++; },
    measureText(t) { return { width: String(t).length * 8 }; },
    fillText(t, x, y, w) {
      log.texts.push(String(t));
      log.fillCalls.push({ t: String(t), x, y, w, style: target.fillStyle, font: target.font });
    },
    strokeText(t, x, y, w) { log.strokeCalls.push({ t: String(t), x, y, w }); },
    fillRect() { log.fills.push(target.fillStyle); },
  };
  const ctx = new Proxy(target, {
    get(t, p) { return p in t ? t[p] : () => {}; },
    set(t, p, v) { t[p] = v; return true; },
  });
  return { ctx, log };
}

const win = { phase: 'win', elapsedMs: 65000 };
const lose = { phase: 'lose', elapsedMs: 65000 };
const draw = (state, opts, ready = true, focus = 0) => {
  const { ctx, log } = fakeCtx();
  const r = drawEndCardView(ctx, state, null, 1280, 800, ready, focus, opts);
  return { r, log };
};

test('retry id kept, label REDEPLOY; garage second', () => {
  const { r } = draw(win, {});
  assert.equal(r.buttons[0].id, 'retry');
  assert.equal(r.buttons[0].label, 'REDEPLOY');
  assert.equal(r.buttons[1].id, 'garage');
  assert.equal(r.buttons[1].label, 'GARAGE');
  assert.equal(r.buttons[0].w, 200);
  assert.equal(r.buttons[0].h, 52);
});

test('REDEPLOY is solid #39FF88', () => {
  const { log } = draw(win, {});
  assert.ok(log.fills.includes('#39FF88'));
});

test('count-up: 0:00 at t=0, final at t>=600', () => {
  const t0 = draw(win, { shownAtMs: 1000, nowMs: 1000 });
  assert.ok(t0.log.texts.includes('Time survived  0:00'), t0.log.texts.join('|'));
  const t1 = draw(win, { shownAtMs: 1000, nowMs: 1000 + COUNT_UP_MS });
  assert.ok(t1.log.texts.includes('Time survived  1:05'));
  const t2 = draw(win, { shownAtMs: 1000, nowMs: 99999 });
  assert.ok(t2.log.texts.includes('Time survived  1:05'));
  assert.equal(countUpMs(60000, 0, 300), 30000);
  assert.equal(countUpMs(60000), 60000);
});

test('stamp string drawn only when provided', () => {
  const s = 'built from .kiro/specs/03-arena-combat \u00b7 3/4 tasks [x]';
  assert.ok(draw(win, { specStamp: s }).log.texts.includes(s));
  assert.ok(!draw(win, { specStamp: null }).log.texts.some(t => t.includes('built from')));
  assert.ok(!draw(win, {}).log.texts.some(t => t.includes('built from')));
});

test('win/lose stamps and max-level stamp', () => {
  assert.equal(stampText('win'), 'EXORCISED');
  assert.equal(stampText('lose'), 'POSSESSED');
  assert.equal(stampText('win', { level: 5, maxLevel: 5 }), 'LAID TO REST');
  assert.equal(stampText('lose', { level: 5, maxLevel: 5 }), 'POSSESSED');
  assert.ok(draw(win, {}).log.texts.includes('EXORCISED'));
  assert.ok(draw(lose, {}).log.texts.includes('POSSESSED'));
  assert.ok(draw(win, { level: 5, maxLevel: 5 }).log.texts.includes('LAID TO REST'));
});

test('sublines and cause line', () => {
  const w = draw(win, {}).log.texts;
  assert.ok(w.includes('The haunt retreats... for now.'));
  assert.ok(w.includes('Spirit banished.'));
  const m = draw(win, { level: 5, maxLevel: 5 }).log.texts;
  assert.ok(m.includes('Nothing left to haunt. Yet.'));
  const l = draw(lose, {}).log.texts;
  assert.ok(l.includes('Your mech joins the haunt.'));
  assert.ok(l.includes('Your mech was destroyed.'));
});

test('stamp uses max width cardW - 40 on fillText and strokeText', () => {
  for (const [s, o] of [[win, {}], [lose, {}], [win, { level: 5, maxLevel: 5 }]]) {
    const { log } = draw(s, o);
    const stamp = stampText(s.phase, o);
    assert.ok(log.fillCalls.some(c => c.t === stamp && c.w === 480), stamp);
    assert.ok(log.strokeCalls.some(c => c.t === stamp && c.w === 480), stamp);
  }
});

test('level-up line: win below max only, ember 15px, max width cardW - 24', () => {
  const line = 'THE HAUNT RISES \u00b7 HAUNT LV 3. It remembers you.';
  const { log } = draw(win, { level: 2, maxLevel: 5 });
  const c = log.fillCalls.find(x => x.t === line);
  assert.ok(c, log.texts.join('|'));
  assert.equal(c.w, 496);
  assert.equal(c.style, '#FF8A3D');
  assert.ok(c.font.startsWith('15px "Share Tech Mono"'));
  assert.ok(!draw(win, { level: 5, maxLevel: 5 }).log.texts.some(t => t.includes('HAUNT RISES')));
  assert.ok(!draw(lose, { level: 2, maxLevel: 5 }).log.texts.some(t => t.includes('HAUNT RISES')));
  assert.ok(!draw(win, {}).log.texts.some(t => t.includes('HAUNT RISES')));
});

test('level-up line sits between time line and spec stamp, above buttons', () => {
  const s = 'built from .kiro/specs/03-arena-combat \u00b7 3/4 tasks [x]';
  const { r, log } = draw(win, { level: 1, maxLevel: 5, specStamp: s });
  const y = (t) => log.fillCalls.find(c => c.t === t).y;
  const rise = y('THE HAUNT RISES \u00b7 HAUNT LV 2. It remembers you.');
  assert.ok(y('Time survived  1:05') < rise);
  assert.ok(rise < y(s));
  assert.ok(y(s) < r.buttons[0].y);
});

test('no throw without opts; null while playing; null in grace', () => {
  const { ctx } = fakeCtx();
  assert.doesNotThrow(() => drawEndCardView(ctx, win, null, 1280, 800, true, 0));
  assert.equal(drawEndCardView(ctx, { phase: 'playing' }, null, 1280, 800, true, 0), null);
  assert.equal(draw(win, {}, false).r, null);
});

test('balanced save/restore', () => {
  for (const [s, ready] of [[win, true], [lose, true], [win, false]]) {
    const { log } = draw(s, { specStamp: 'x' }, ready, 1);
    assert.equal(log.saves, log.restores);
  }
});

// ── specStamp ────────────────────────────────────────────────────────────────

test('formatArenaSpecStamp uses real counts only', () => {
  const rows = [
    { spec: '03-arena-combat', done: true },
    { spec: '03-arena-combat', done: true },
    { spec: '03-arena-combat', done: false },
    { spec: '01-core-engine', done: true },
  ];
  assert.deepEqual(countSpecTasks(rows), { done: 2, total: 3 });
  assert.equal(formatArenaSpecStamp(rows),
    'built from .kiro/specs/03-arena-combat \u00b7 2/3 tasks [x]');
});

test('formatArenaSpecStamp returns null on empty / missing data', () => {
  assert.equal(formatArenaSpecStamp([]), null);
  assert.equal(formatArenaSpecStamp(null), null);
  assert.equal(formatArenaSpecStamp(undefined), null);
  assert.equal(formatArenaSpecStamp({}), null);
  assert.equal(formatArenaSpecStamp([{ spec: '01-core-engine', done: true }]), null);
});


test('loss shows consolation payout', () => {
  const { log } = draw(lose, { winCredits: 1 });
  assert.ok(log.texts.some((t) => /\+1 consolation/.test(t)), log.texts.join('|'));
});

test('win still shows win payout', () => {
  const { log } = draw(win, { winCredits: 3 });
  assert.ok(log.texts.some((t) => /\+3 win/.test(t)), log.texts.join('|'));
});


test('Enter and Space activate the focused button', () => {
  assert.deepEqual(endCardKeyAction('Enter', 0), { type: 'activate', id: 'retry' });
  assert.deepEqual(endCardKeyAction(' ', 0), { type: 'activate', id: 'retry' });
  assert.deepEqual(endCardKeyAction('Enter', 1), { type: 'activate', id: 'garage' });
  assert.deepEqual(endCardKeyAction(' ', 1), { type: 'activate', id: 'garage' });
});

test('R always redeploys; G always opens garage', () => {
  assert.deepEqual(endCardKeyAction('r', 1), { type: 'activate', id: 'retry' });
  assert.deepEqual(endCardKeyAction('R', 1), { type: 'activate', id: 'retry' });
  assert.deepEqual(endCardKeyAction('g', 0), { type: 'activate', id: 'garage' });
  assert.deepEqual(endCardKeyAction('G', 0), { type: 'activate', id: 'garage' });
});

test('arrows and Tab move focus; a/d stay unbound', () => {
  assert.deepEqual(endCardKeyAction('ArrowLeft', 1), { type: 'focus', index: 0 });
  assert.deepEqual(endCardKeyAction('ArrowRight', 0), { type: 'focus', index: 1 });
  assert.deepEqual(endCardKeyAction('Tab', 0), { type: 'focus', index: 1 });
  assert.deepEqual(endCardKeyAction('Tab', 1), { type: 'focus', index: 0 });
  assert.equal(endCardKeyAction('a', 0), null);
  assert.equal(endCardKeyAction('d', 0), null);
});

console.log(`endCardView: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
