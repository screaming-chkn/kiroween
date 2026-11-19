/**
 * tests/ui/tellCaption.test.js
 * Run: node tests/ui/tellCaption.test.js
 */
import assert from 'node:assert/strict';
import {
  createTellCaption, tellCaptionText, drawTellCaption, TELL_CAPTION_KEY, TELL_CAPTION_MS,
} from '../../src/ui/tellCaption.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.error(`FAIL: ${name}\n  ${e.message}`); }
}
const memStore = () => {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

test('first windup shows the caption, then it hides after TELL_CAPTION_MS', () => {
  const c = createTellCaption({ storage: memStore() });
  assert.equal(c.current(0), '');
  assert.equal(c.onWindup(1000), true);
  assert.equal(c.current(1000), tellCaptionText(false));
  assert.equal(c.current(1000 + TELL_CAPTION_MS - 1), tellCaptionText(false));
  assert.equal(c.current(1000 + TELL_CAPTION_MS), '');
});

test('later windups in the same duel do not restart it', () => {
  const c = createTellCaption({ storage: memStore() });
  c.onWindup(0);
  assert.equal(c.onWindup(2000), false);
  assert.equal(c.current(TELL_CAPTION_MS + 10), '');
});

test('a second duel or reload (same storage) never shows it', () => {
  const s = memStore();
  createTellCaption({ storage: s }).onWindup(0);
  assert.equal(s.getItem(TELL_CAPTION_KEY), '1');
  const next = createTellCaption({ storage: s });
  assert.equal(next.onWindup(5000), false);
  assert.equal(next.current(5000), '');
});

test('no storage (or throwing storage) still shows once per match', () => {
  const c = createTellCaption({ storage: null });
  assert.equal(c.onWindup(0), true);
  assert.equal(c.onWindup(100), false);
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  const d = createTellCaption({ storage: bad });
  assert.equal(d.onWindup(0), true);
  assert.equal(d.current(10), tellCaptionText(false));
});

test('caption key is versioned so a retune can re-teach once', () => {
  assert.match(TELL_CAPTION_KEY, /^hh-tell-caption-seen-v\d+$/);
});

test('text names the real dash control per input', () => {
  assert.match(tellCaptionText(false), /RED RING = INCOMING SHOT/);
  assert.match(tellCaptionText(false), /SHIFT/);
  assert.match(tellCaptionText(true), /DASH/);
  assert.doesNotMatch(tellCaptionText(true), /SHIFT/);
  assert.equal(tellCaptionText(false), 'RED RING = INCOMING SHOT - SHIFT TO DASH NOW');
  assert.equal(tellCaptionText(true), 'RED RING = INCOMING SHOT - TAP DASH NOW');
  assert.equal(createTellCaption({ storage: memStore(), touchUi: true }).onWindup(0), true);
});

test('drawTellCaption: draws once, balanced save/restore, skips empty', () => {
  const log = { saves: 0, restores: 0, texts: [] };
  const ctx = { save() { log.saves++; }, restore() { log.restores++; },
    strokeText() {}, fillText(t) { log.texts.push(t); } };
  drawTellCaption(ctx, '', { x: 0, y: 0 });
  assert.equal(log.saves, 0);
  drawTellCaption(ctx, 'HI', { x: 10, y: 20, scale: 2 });
  assert.deepEqual(log.texts, ['HI']);
  assert.equal(log.saves, log.restores);
});

console.log(`tellCaption: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
