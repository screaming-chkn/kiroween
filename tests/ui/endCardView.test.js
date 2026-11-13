/**
 * tests/ui/endCardView.test.js
 * Run: node tests/ui/endCardView.test.js
 */
import assert from 'node:assert/strict';
import { drawEndCardView, COUNT_UP_MS, countUpMs, stampText } from '../../src/ui/endCardView.js';
import { formatArenaSpecStamp, countSpecTasks } from '../../src/ui/specStamp.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.error(`FAIL: ${name}\n  ${e.message}`); }
}

function fakeCtx() {
  const log = { saves: 0, restores: 0, texts: [], fills: [] };
  const target = {
    save() { log.saves++; },
    restore() { log.restores++; },
    fillText(t) { log.texts.push(String(t)); },
    strokeText() {},
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

test('win/lose titles', () => {
  assert.equal(stampText('win'), 'WIN');
  assert.equal(stampText('lose'), 'LOSS');
  assert.ok(draw(win, {}).log.texts.includes('WIN'));
  assert.ok(draw(lose, {}).log.texts.includes('LOSS'));
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

console.log(`endCardView: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
