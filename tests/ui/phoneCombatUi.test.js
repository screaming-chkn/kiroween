/**
 * tests/ui/phoneCombatUi.test.js — pure tests for phone combat UI helpers.
 * Run: node tests/ui/phoneCombatUi.test.js
 */
import assert from 'node:assert/strict';
import {
  END_CARD_W, END_CARD_BTN_H, TOUCH_MIN_PX, HUD_PANEL_W, HUD_PANEL_H,
  PHONE_HUD_TOP, PHONE_HUD_SCALE,
  endCardScale, scaleRects, phoneHudScale, phoneHudViewportH, hudPanelRect, phoneHudRect,
  circleOverlapsRect, windupGlowStyle, drawWindupGlow, compactHpLayout, drawCompactHp,
} from '../../src/ui/phoneCombatUi.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.error(`FAIL: ${name}\n  ${e.message}`); }
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !~ ${b}`);

test('endCardScale desktop is 1,1', () => {
  assert.deepEqual(endCardScale({ touchUi: false, dpr: 3, cssW: 390 }), { sx: 1, sy: 1 });
});
test('endCardScale 390 @ dpr3 fits and buttons >= 44', () => {
  const { sx, sy } = endCardScale({ touchUi: true, dpr: 3, cssW: 390 });
  assert.ok(END_CARD_W * sx / 3 <= 374 + 1e-9);
  assert.ok(END_CARD_BTN_H * sy / 3 >= TOUCH_MIN_PX - 1e-9);
});
test('endCardScale 390 @ dpr1 buttons >= 44', () => {
  const { sy } = endCardScale({ touchUi: true, dpr: 1, cssW: 390 });
  assert.ok(END_CARD_BTN_H * sy >= TOUCH_MIN_PX - 1e-9);
});
test('endCardScale wide touch is uniform dpr', () => {
  assert.deepEqual(endCardScale({ touchUi: true, dpr: 2, cssW: 1024 }), { sx: 2, sy: 2 });
});
test('scaleRects maths and null', () => {
  const out = scaleRects([{ id: 'a', x: 1, y: 2, w: 3, h: 4 }], 2, 3);
  assert.deepEqual(out, [{ id: 'a', x: 2, y: 6, w: 6, h: 12 }]);
  assert.equal(scaleRects(null, 2, 2), null);
  assert.equal(scaleRects(undefined, 2, 2), null);
});
test('phoneHudViewportH puts panel top at PHONE_HUD_TOP', () => {
  assert.equal(hudPanelRect(phoneHudViewportH()).y, PHONE_HUD_TOP);
});
test('phone HUD fits width and clears stick zone at dpr 3', () => {
  const s = phoneHudScale(3);
  near(s, PHONE_HUD_SCALE * 3);
  const r = hudPanelRect(phoneHudViewportH());
  assert.ok((r.x + r.w) * s / 3 <= 390);
  assert.ok((r.y + r.h) * s / 3 < 0.45 * 844);
});
test('hudPanelRect(800)', () => {
  assert.deepEqual(hudPanelRect(800), { x: 20, y: 800 - 20 - HUD_PANEL_H, w: HUD_PANEL_W, h: HUD_PANEL_H });
});
test('circleOverlapsRect', () => {
  const r = { x: 10, y: 10, w: 20, h: 20 };
  assert.ok(circleOverlapsRect(20, 20, 1, r));
  assert.ok(circleOverlapsRect(5, 20, 5, r));
  assert.ok(!circleOverlapsRect(0, 20, 5, r));
});
test('windupGlowStyle null cases', () => {
  assert.equal(windupGlowStyle(0, 450), null);
  assert.equal(windupGlowStyle(undefined, 450), null);
  assert.equal(windupGlowStyle(100, 0), null);
});
test('windupGlowStyle values', () => {
  const a = windupGlowStyle(450, 450);
  near(a.progress, 0); near(a.radius, 22); near(a.lineWidth, 4); near(a.alpha, 0.6); near(a.haloAlpha, 0.12);
  const b = windupGlowStyle(0.001, 450);
  assert.ok(b.progress > 0.999);
  near(Math.round(b.radius * 1000) / 1000, 38);
  for (let ms = 1; ms <= 450; ms += 7) {
    const s = windupGlowStyle(ms, 450);
    assert.ok(s.alpha >= 0.6 && s.lineWidth >= 4);
  }
});
test('compactHpLayout', () => {
  const p = compactHpLayout('player');
  assert.equal(p.showText, false);
  assert.ok(p.w < 160);
  assert.equal(compactHpLayout('enemy').showText, true);
});

function fakeCtx() {
  const calls = [];
  const ctx = new Proxy({}, {
    get(_, k) { return (...a) => { calls.push(k); }; },
    set(_, k) { calls.push(`set:${String(k)}`); return true; },
  });
  return { ctx, calls };
}
test('drawWindupGlow smoke', () => {
  const { ctx, calls } = fakeCtx();
  drawWindupGlow(ctx, { x: 5, y: 5, windupRemainingMs: 200 }, 450);
  assert.equal(calls.filter(c => c === 'save').length, calls.filter(c => c === 'restore').length);
  assert.ok(calls.includes('arc'));
  const n = fakeCtx();
  drawWindupGlow(n.ctx, { x: 0, y: 0 }, 450);
  assert.equal(n.calls.length, 0);
});
test('drawCompactHp smoke', () => {
  const { ctx, calls } = fakeCtx();
  drawCompactHp(ctx, {
    player: { x: 1, y: 1, hp: 50, maxHp: 100 },
    enemy: { x: 9, y: 9, hp: 12.4, maxHp: 100 },
  });
  assert.equal(calls.filter(c => c === 'save').length, calls.filter(c => c === 'restore').length);
  assert.equal(calls.filter(c => c === 'fillText').length, 1);
});

test('phoneHudRect(3) is the scaled panel rect', () => {
  assert.deepEqual(phoneHudRect(3), { x: 60, y: 45, w: 720, h: 384 });
});
test('phoneHudRect overlap: inside overlaps, y = 0.6*2532 does not', () => {
  const r = phoneHudRect(3);
  assert.ok(circleOverlapsRect(100, 100, 30, r));
  assert.ok(!circleOverlapsRect(100, 0.6 * 2532, 30, r));
});
console.log(`phoneCombatUi: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
