/**
 * tests/engine/touch.test.js
 *
 * Pure tests for src/engine/touch.js (+ the DOM-free CSS export of
 * src/ui/touchControls.js). Runnable with plain Node:
 *
 *   node tests/engine/touch.test.js
 */

import assert from 'node:assert/strict';
import {
  TOUCH_LAYOUT,
  stickVectorFromPointer,
  hitTestTouchControl,
  stickRadiusPx,
  createTouchController,
  aimScreenFromDir,
  prefersTouchUi,
  mergeTouchActions,
} from '../../src/engine/touch.js';
import { TOUCH_CONTROLS_CSS } from '../../src/ui/touchControls.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !≈ ${b}`);

const PHONE = { width: 390, height: 844 };
const DESK  = { width: 1280, height: 800 };

/** Pixel centres of the buttons for a viewport. */
function centres({ width, height }) {
  return {
    fire: { x: TOUCH_LAYOUT.fire.cxFrac * width, y: TOUCH_LAYOUT.fire.cyFrac * height },
    dash: { x: TOUCH_LAYOUT.dash.cxFrac * width, y: TOUCH_LAYOUT.dash.cyFrac * height },
  };
}

// ── stickVectorFromPointer ───────────────────────────────────────────────────

console.log('\nsrc/engine/touch.js — stick vector\n');

test('null under the dead-zone (0.18 * radius)', () => {
  const r = 100;
  assert.equal(stickVectorFromPointer(0, 0, 0, 0, r), null);
  assert.equal(stickVectorFromPointer(0, 0, 17, 0, r), null);
  assert.ok(stickVectorFromPointer(0, 0, 19, 0, r) !== null);
});

test('invalid radius gives null', () => {
  assert.equal(stickVectorFromPointer(0, 0, 50, 0, 0), null);
});

test('magnitude clamps to 1 far past the base', () => {
  const v = stickVectorFromPointer(0, 0, 3000, 4000, 100);
  near(Math.hypot(v.dx, v.dy), 1);
  near(v.dx, 0.6);
  near(v.dy, 0.8);
});

test('partial pull keeps proportional magnitude', () => {
  const v = stickVectorFromPointer(10, 10, 60, 10, 100);
  near(v.dx, 0.5);
  near(v.dy, 0);
});

// ── hitTest ──────────────────────────────────────────────────────────────────

console.log('\nsrc/engine/touch.js — hitTestTouchControl\n');

for (const vp of [PHONE, DESK]) {
  const label = `${vp.width}x${vp.height}`;
  test(`${label}: fire / dash centres hit their buttons`, () => {
    const c = centres(vp);
    assert.equal(hitTestTouchControl(c.fire.x, c.fire.y, vp.width, vp.height), 'fire');
    assert.equal(hitTestTouchControl(c.dash.x, c.dash.y, vp.width, vp.height), 'dash');
  });
  test(`${label}: bottom-left is stick, top-right is null`, () => {
    assert.equal(hitTestTouchControl(vp.width * 0.2, vp.height * 0.8, vp.width, vp.height), 'stick');
    assert.equal(hitTestTouchControl(vp.width * 0.9, vp.height * 0.05, vp.width, vp.height), null);
  });
}

test('top-left (above the stick zone) is null', () => {
  assert.equal(hitTestTouchControl(50, 50, PHONE.width, PHONE.height), null);
});

test('390x844: dash is bottom row, clear of fire and the stick zone', () => {
  const { width: w, height: h } = PHONE;
  const min = Math.min(w, h);
  const d = TOUCH_LAYOUT.dash;
  const f = TOUCH_LAYOUT.fire;
  const dx = d.cxFrac * w, dy = d.cyFrac * h, dr = d.rFrac * min;
  const fx = f.cxFrac * w, fy = f.cyFrac * h, fr = f.rFrac * min;
  assert.ok(Math.hypot(dx - fx, dy - fy) > dr + fr, 'dash overlaps fire');
  const s = TOUCH_LAYOUT.stick;
  assert.ok(dx - dr > (s.xFrac + s.wFrac) * w, 'dash overlaps stick zone');
  assert.ok(dy + dr <= 0.95 * h, 'dash bottom edge below 95% height');
});

// ── controller multi-touch ───────────────────────────────────────────────────

console.log('\nsrc/engine/touch.js — controller\n');

function mk(vp = PHONE) {
  return createTouchController({ getViewport: () => vp });
}

test('sample shape is {move, fire, dash, aimScreen}', () => {
  const s = mk().sample();
  assert.deepEqual(Object.keys(s).sort(), ['aimScreen', 'dash', 'fire', 'move']);
  assert.equal(s.move, null);
  assert.equal(s.fire, false);
  assert.equal(s.dash, false);
  assert.equal(typeof s.aimScreen.x, 'number');
  assert.equal(typeof s.aimScreen.y, 'number');
});

test('stick + fire + dash fingers work simultaneously', () => {
  const c = mk();
  const ctr = centres(PHONE);
  c.onPointerDown({ pointerId: 1, clientX: 80, clientY: 650 });
  c.onPointerDown({ pointerId: 2, clientX: ctr.fire.x, clientY: ctr.fire.y });
  c.onPointerDown({ pointerId: 3, clientX: ctr.dash.x, clientY: ctr.dash.y });
  c.onPointerMove({ pointerId: 1, clientX: 140, clientY: 650 });
  const s = c.sample();
  assert.ok(s.move && s.move.dx > 0);
  assert.equal(s.fire, true);
  assert.equal(s.dash, true);
});

test('pointer up releases only its own control', () => {
  const c = mk();
  const ctr = centres(PHONE);
  c.onPointerDown({ pointerId: 1, clientX: 80, clientY: 650 });
  c.onPointerDown({ pointerId: 2, clientX: ctr.fire.x, clientY: ctr.fire.y });
  c.onPointerDown({ pointerId: 3, clientX: ctr.dash.x, clientY: ctr.dash.y });
  c.onPointerUp({ pointerId: 2 });
  let s = c.sample();
  assert.equal(s.fire, false);
  assert.equal(s.dash, true);
  c.onPointerUp({ pointerId: 3 });
  c.onPointerUp({ pointerId: 1 });
  s = c.sample();
  assert.equal(s.dash, false);
  assert.equal(s.move, null);
});

test('dash stays true while held across samples', () => {
  const c = mk();
  const ctr = centres(PHONE);
  c.onPointerDown({ pointerId: 5, clientX: ctr.dash.x, clientY: ctr.dash.y });
  assert.equal(c.sample().dash, true);
  assert.equal(c.sample().dash, true);
});

test('cancel behaves like release; reset clears everything', () => {
  const c = mk();
  const ctr = centres(PHONE);
  c.onPointerDown({ pointerId: 1, clientX: 80, clientY: 650 });
  c.onPointerDown({ pointerId: 2, clientX: ctr.fire.x, clientY: ctr.fire.y });
  c.onPointerCancel({ pointerId: 2 });
  assert.equal(c.sample().fire, false);
  c.onPointerDown({ pointerId: 3, clientX: ctr.dash.x, clientY: ctr.dash.y });
  c.reset();
  const s = c.sample();
  assert.equal(s.move, null);
  assert.equal(s.fire, false);
  assert.equal(s.dash, false);
  assert.equal(c.activeStickId, null);
});

test('second finger on an occupied control is ignored', () => {
  const c = mk();
  const ctr = centres(PHONE);
  c.onPointerDown({ pointerId: 2, clientX: ctr.fire.x, clientY: ctr.fire.y });
  c.onPointerDown({ pointerId: 9, clientX: ctr.fire.x, clientY: ctr.fire.y });
  c.onPointerUp({ pointerId: 9 });
  assert.equal(c.sample().fire, true);
});

// ── aim rules ────────────────────────────────────────────────────────────────

console.log('\nsrc/engine/touch.js — aim\n');

test('aimScreenFromDir: centre + dir * 0.35 * min(vp)', () => {
  const p = aimScreenFromDir({ x: 1, y: 0 }, 390, 844);
  near(p.x, 195 + 0.35 * 390);
  near(p.y, 422);
  const q = aimScreenFromDir({ x: 0, y: -1 }, 1280, 800);
  near(q.x, 640);
  near(q.y, 400 - 0.35 * 800);
});

test('initial aim is right ({1,0}) and never null', () => {
  const s = mk().sample();
  assert.deepEqual(s.aimScreen, aimScreenFromDir({ x: 1, y: 0 }, 390, 844));
});

test('fire drag beyond deadzone aims along the drag', () => {
  const c = mk();
  const f = centres(PHONE).fire;
  c.onPointerDown({ pointerId: 2, clientX: f.x, clientY: f.y });
  c.onPointerMove({ pointerId: 2, clientX: f.x, clientY: f.y - 30 }); // up
  const s = c.sample();
  assert.deepEqual(s.aimScreen, aimScreenFromDir({ x: 0, y: -1 }, 390, 844));
});

test('fire drag within deadzone does not change aim', () => {
  const c = mk();
  const f = centres(PHONE).fire;
  c.onPointerDown({ pointerId: 2, clientX: f.x, clientY: f.y });
  c.onPointerMove({ pointerId: 2, clientX: f.x, clientY: f.y - 2 });
  assert.deepEqual(c.sample().aimScreen, aimScreenFromDir({ x: 1, y: 0 }, 390, 844));
});

test('stick direction is the aim fallback (not the fire corner)', () => {
  const c = mk();
  const f = centres(PHONE).fire;
  c.onPointerDown({ pointerId: 1, clientX: 100, clientY: 600 });
  c.onPointerMove({ pointerId: 1, clientX: 100, clientY: 650 }); // down
  c.onPointerDown({ pointerId: 2, clientX: f.x, clientY: f.y });  // fire, no drag
  const s = c.sample();
  assert.equal(s.fire, true);
  assert.deepEqual(s.aimScreen, aimScreenFromDir({ x: 0, y: 1 }, 390, 844));
});

test('fire drag wins over stick direction', () => {
  const c = mk();
  const f = centres(PHONE).fire;
  c.onPointerDown({ pointerId: 1, clientX: 100, clientY: 600 });
  c.onPointerMove({ pointerId: 1, clientX: 100, clientY: 650 }); // stick down
  c.onPointerDown({ pointerId: 2, clientX: f.x, clientY: f.y });
  c.onPointerMove({ pointerId: 2, clientX: f.x - 30, clientY: f.y }); // fire left
  assert.deepEqual(c.sample().aimScreen, aimScreenFromDir({ x: -1, y: 0 }, 390, 844));
});

test('last aim direction persists after all fingers lift', () => {
  const c = mk();
  c.onPointerDown({ pointerId: 1, clientX: 100, clientY: 600 });
  c.onPointerMove({ pointerId: 1, clientX: 50, clientY: 600 }); // left
  c.sample();
  c.onPointerUp({ pointerId: 1 });
  const s = c.sample();
  assert.equal(s.move, null);
  assert.deepEqual(s.aimScreen, aimScreenFromDir({ x: -1, y: 0 }, 390, 844));
});

test('reset clears fire origin (no phantom drag on next touch)', () => {
  const c = mk();
  const f = centres(PHONE).fire;
  c.onPointerDown({ pointerId: 2, clientX: f.x, clientY: f.y });
  c.onPointerMove({ pointerId: 2, clientX: f.x, clientY: f.y - 30 });
  c.sample();
  c.reset();
  c.onPointerDown({ pointerId: 3, clientX: f.x, clientY: f.y });
  // Fire origin = new touch-down point, so aim stays at the last direction.
  assert.deepEqual(c.sample().aimScreen, aimScreenFromDir({ x: 0, y: -1 }, 390, 844));
});

// ── prefersTouchUi ───────────────────────────────────────────────────────────

console.log('\nsrc/engine/touch.js — prefersTouchUi\n');

test('coarse pointer → true regardless of width', () => {
  assert.equal(prefersTouchUi({ matchMediaCoarse: true, width: 1920 }), true);
});

test('touch points + narrow width → true', () => {
  assert.equal(prefersTouchUi({ maxTouchPoints: 5, matchMediaCoarse: false, width: 390 }), true);
});

test('touch points + wide width (touch laptop) → false', () => {
  assert.equal(prefersTouchUi({ maxTouchPoints: 10, matchMediaCoarse: false, width: 1280 }), false);
});

test('narrow desktop mouse window → false', () => {
  assert.equal(prefersTouchUi({ maxTouchPoints: 0, matchMediaCoarse: false, width: 500 }), false);
});

test('no args → false', () => {
  assert.equal(prefersTouchUi(), false);
});

// ── mergeTouchActions ────────────────────────────────────────────────────────

console.log('\nsrc/engine/touch.js — mergeTouchActions\n');

const base = { move: { dx: 1, dy: 0 }, aim: { x: 10, y: 20 }, fire: false, dash: false };
const idle = { move: null, fire: false, dash: false, aimScreen: { x: 5, y: 6 } };
const toWorld = p => ({ x: p.x * 2, y: p.y * 2 });

test('idle touch leaves base actions intact (new object)', () => {
  const out = mergeTouchActions(base, idle, toWorld);
  assert.notEqual(out, base);
  assert.deepEqual(out, base);
});

test('touch move overrides base move; null falls back', () => {
  const out = mergeTouchActions(base, { ...idle, move: { dx: 0, dy: -1 } }, toWorld);
  assert.deepEqual(out.move, { dx: 0, dy: -1 });
  assert.deepEqual(mergeTouchActions(base, idle, toWorld).move, base.move);
});

test('fire and dash are OR-ed', () => {
  assert.equal(mergeTouchActions(base, { ...idle, fire: true }, toWorld).fire, true);
  assert.equal(mergeTouchActions(base, { ...idle, dash: true }, toWorld).dash, true);
  assert.equal(mergeTouchActions({ ...base, fire: true, dash: true }, idle, toWorld).fire, true);
  assert.equal(mergeTouchActions({ ...base, fire: true, dash: true }, idle, toWorld).dash, true);
});

test('aim uses touch when touch move or fire is active', () => {
  const m = mergeTouchActions(base, { ...idle, move: { dx: 1, dy: 0 } }, toWorld);
  assert.deepEqual(m.aim, { x: 10, y: 12 });
  const f = mergeTouchActions(base, { ...idle, fire: true }, toWorld);
  assert.deepEqual(f.aim, { x: 10, y: 12 });
  // dash alone does not take over aim
  const d = mergeTouchActions(base, { ...idle, dash: true }, toWorld);
  assert.deepEqual(d.aim, base.aim);
});

test('does not mutate inputs', () => {
  const b = JSON.stringify(base);
  mergeTouchActions(base, { ...idle, fire: true }, toWorld);
  assert.equal(JSON.stringify(base), b);
});

// ── TOUCH_CONTROLS_CSS ───────────────────────────────────────────────────────

console.log('\nsrc/ui/touchControls.js — CSS\n');

test('overlay sits at z-index 40 (below garage 100) with touch-action none', () => {
  assert.ok(/z-index:\s*40/.test(TOUCH_CONTROLS_CSS));
  assert.ok(/touch-action:\s*none/.test(TOUCH_CONTROLS_CSS));
  assert.ok(/user-select:\s*none/.test(TOUCH_CONTROLS_CSS));
  assert.ok(/-webkit-tap-highlight-color:\s*transparent/.test(TOUCH_CONTROLS_CSS));
  assert.ok(/env\(safe-area-inset-bottom\)/.test(TOUCH_CONTROLS_CSS));
});

test('stickRadiusPx scales with the smaller viewport side', () => {
  near(stickRadiusPx(390, 844), TOUCH_LAYOUT.stickRadiusFrac * 390);
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
