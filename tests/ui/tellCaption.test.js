/**
 * tests/ui/tellCaption.test.js
 * Run: node tests/ui/tellCaption.test.js
 */
import assert from 'node:assert/strict';
import {
  createTellCaption, tellCaptionText, drawTellCaption, TELL_CAPTION_KEY, TELL_CAPTION_MS,
  TEACH_FIRE_GRACE_MS, TELL_CAPTION_FONT_PX, TELL_CAPTION_MIN_PX, TELL_CAPTION_FILL,
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

test('fight-start shows the caption before any windup', () => {
  const c = createTellCaption({ storage: memStore() });
  assert.equal(c.current(0), '');
  assert.equal(c.onFightStart(500), true);
  assert.equal(c.current(500), tellCaptionText(false));
  assert.equal(c.onWindup(800), false);
  assert.equal(c.current(500 + TELL_CAPTION_MS - 1), tellCaptionText(false));
  assert.equal(c.current(500 + TELL_CAPTION_MS), '');
});

test('first windup shows the caption when fight-start was skipped', () => {
  const c = createTellCaption({ storage: memStore() });
  assert.equal(c.onWindup(1000), true);
  assert.equal(c.current(1000), tellCaptionText(false));
  assert.equal(c.current(1000 + TELL_CAPTION_MS - 1), tellCaptionText(false));
  assert.equal(c.current(1000 + TELL_CAPTION_MS), '');
});

test('later windups in the same duel do not restart it', () => {
  const c = createTellCaption({ storage: memStore() });
  c.onFightStart(0);
  assert.equal(c.onWindup(2000), false);
  assert.equal(c.current(TELL_CAPTION_MS + 10), '');
});

test('a second duel or reload (same storage) never shows it', () => {
  const s = memStore();
  createTellCaption({ storage: s }).onFightStart(0);
  assert.equal(s.getItem(TELL_CAPTION_KEY), '1');
  const next = createTellCaption({ storage: s });
  assert.equal(next.onFightStart(5000), false);
  assert.equal(next.onWindup(5000), false);
  assert.equal(next.current(5000), '');
});

test('no storage (or throwing storage) still shows once per match', () => {
  const c = createTellCaption({ storage: null });
  assert.equal(c.onFightStart(0), true);
  assert.equal(c.onWindup(100), false);
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  const d = createTellCaption({ storage: bad });
  assert.equal(d.onFightStart(0), true);
  assert.equal(d.current(10), tellCaptionText(false));
});

test('caption key is versioned so a retune can re-teach once', () => {
  assert.match(TELL_CAPTION_KEY, /^hh-tell-caption-seen-v\d+$/);
  assert.ok(TELL_CAPTION_KEY.endsWith('v3'));
});

test('teach fire grace is 2–3 seconds', () => {
  assert.ok(TEACH_FIRE_GRACE_MS >= 2000 && TEACH_FIRE_GRACE_MS <= 3000);
});

test('text names the real dash control per input', () => {
  assert.match(tellCaptionText(false), /RED RING = INCOMING SHOT/);
  assert.match(tellCaptionText(false), /SHIFT/);
  assert.match(tellCaptionText(true), /DASH/);
  assert.doesNotMatch(tellCaptionText(true), /SHIFT/);
  assert.equal(tellCaptionText(false), 'RED RING = INCOMING SHOT - SHIFT TO DASH NOW');
  assert.equal(tellCaptionText(true), 'RED RING = INCOMING SHOT - TAP DASH NOW');
  assert.equal(createTellCaption({ storage: memStore(), touchUi: true }).onFightStart(0), true);
});

test('drawTellCaption: draws once, balanced save/restore, skips empty', () => {
  const log = { saves: 0, restores: 0, texts: [], fonts: [], fills: [], rects: 0 };
  const ctx = {
    save() { log.saves++; }, restore() { log.restores++; },
    strokeText() {}, fillText(t) { log.texts.push(t); },
    measureText(t) { return { width: String(t).length * 12 }; },
    fillRect() { log.rects++; },
    set font(v) { log.fonts.push(v); }, get font() { return log.fonts.at(-1) || ''; },
    set fillStyle(v) { log.fills.push(v); }, get fillStyle() { return log.fills.at(-1) || ''; },
  };
  drawTellCaption(ctx, '', { x: 0, y: 0 });
  assert.equal(log.saves, 0);
  drawTellCaption(ctx, 'HI', { x: 10, y: 20, scale: 2 });
  assert.deepEqual(log.texts, ['HI']);
  assert.equal(log.saves, log.restores);
  assert.ok(log.fonts.some((f) => f.includes(`${TELL_CAPTION_FONT_PX * 2}px`)));
  assert.equal(log.fills.at(-1), TELL_CAPTION_FILL);
  assert.equal(log.rects, 1);
});

test('drawTellCaption: shrinks to fit maxWidth but stays at or above the floor', () => {
  const log = { fonts: [] };
  const ctx = {
    save() {}, restore() {}, strokeText() {}, fillText() {}, fillRect() {},
    measureText() { return { width: 400 }; },
    set font(v) { log.fonts.push(v); }, get font() { return log.fonts.at(-1) || ''; },
    set fillStyle(v) {}, get fillStyle() { return ''; },
  };
  drawTellCaption(ctx, 'HI', { x: 0, y: 0, scale: 1, maxWidth: 200 });
  const px = log.fonts.map((f) => Number((/(\d+)px/.exec(f) || [])[1])).filter(Boolean);
  assert.ok(px.at(-1) >= TELL_CAPTION_MIN_PX);
  assert.ok(px.at(-1) < TELL_CAPTION_FONT_PX);
});

console.log(`tellCaption: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
