/**
 * tests/engine/pointer.test.js — pointer → canvas mapping at DPR 1, 1.5, 2
 * (M4.8 mouse-aim fix). Mouse and touch share clientToCanvas(); the aim
 * angle must point at the cursor's world position whatever the DPR.
 *
 *   node tests/engine/pointer.test.js
 */
import assert from 'node:assert/strict';
import { clientToCanvas, clientToCanvasEl, clientToCanvasLayout } from '../../src/engine/pointer.js';
import { createInputState } from '../../src/engine/input.js';
import { buildPlayerActions } from '../../src/combat/actions.js';
import { createCamera, worldToScreen } from '../../src/engine/camera.js';
import { aimMech } from '../../src/combat/mech.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); failed++; }
}
const near = (a, b, eps = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} vs ${b}`);

/** A fake canvas laid out at (left, top) with CSS size cssW×cssH at a DPR. */
function fakeCanvas(dpr, cssW = 800, cssH = 600, left = 0, top = 0) {
  return {
    width: Math.round(cssW * dpr), height: Math.round(cssH * dpr),
    getBoundingClientRect: () => ({ left, top, width: cssW, height: cssH, right: left + cssW, bottom: top + cssH }),
  };
}

console.log('\nsrc/engine/pointer.js — clientToCanvas\n');

for (const dpr of [1, 1.5, 2]) {
  test(`DPR ${dpr}: CSS px scale to canvas px`, () => {
    const c = fakeCanvas(dpr);
    const p = clientToCanvas(400, 300, c.getBoundingClientRect(), c.width, c.height);
    near(p.x, 400 * dpr); near(p.y, 300 * dpr);
    const q = clientToCanvasEl(0, 0, c);
    near(q.x, 0); near(q.y, 0);
  });

  test(`DPR ${dpr}: canvas offset on the page is subtracted before scaling`, () => {
    const c = fakeCanvas(dpr, 640, 480, 30, 12);
    const p = clientToCanvasEl(30 + 100, 12 + 50, c);
    near(p.x, 100 * dpr); near(p.y, 50 * dpr);
  });

  test(`DPR ${dpr}: onMouseMove(event, canvas) stores canvas px, not CSS px`, () => {
    const c = fakeCanvas(dpr);
    const s = createInputState();
    s.onMouseMove({ clientX: 200, clientY: 150, offsetX: 200, offsetY: 150 }, c);
    near(s.aimX, 200 * dpr); near(s.aimY, 150 * dpr);
  });

  test(`DPR ${dpr}: aim angle points at the cursor's world position`, () => {
    const c = fakeCanvas(dpr);
    const cam = createCamera({ x: 500, y: 400, zoom: 0.8 * dpr });   // game zoom scales with DPR
    const player = { x: 470, y: 420, angle: 0 };
    const target = { x: 610, y: 330 };                                 // world point under the cursor
    const sp = worldToScreen(target.x, target.y, cam, c.width, c.height, 0, 0);
    const clientX = sp.sx / dpr, clientY = sp.sy / dpr;                 // the cursor in CSS px
    const s = createInputState();
    s.onMouseMove({ clientX, clientY, offsetX: clientX, offsetY: clientY }, c);
    const act = buildPlayerActions(s, cam, c.width, c.height);
    near(act.aim.x, target.x, 1e-6, 'aim x'); near(act.aim.y, target.y, 1e-6, 'aim y');
    const want = Math.atan2(target.y - player.y, target.x - player.x);
    near(aimMech(player, act.aim).angle, want, 1e-9, 'angle');
  });
}

test('degenerate zero-size rect falls back to scale 1', () => {
  const p = clientToCanvas(10, 20, { left: 0, top: 0, width: 0, height: 0 }, 0, 0);
  assert.deepEqual(p, { x: 10, y: 20 });
});


test('clientToCanvasLayout maps logical CSS px without getBoundingClientRect', () => {
  const c = {
    width: 1688, height: 780,
    clientWidth: 844, clientHeight: 390,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 844 }), // post-transform AABB (wrong)
  };
  const p = clientToCanvasLayout(422, 195, c);
  near(p.x, 422 * 2); near(p.y, 195 * 2);
});

test('clientToCanvasLayout falls back to backing store when client size is 0', () => {
  const c = { width: 100, height: 50, clientWidth: 0, clientHeight: 0 };
  const p = clientToCanvasLayout(10, 5, c);
  near(p.x, 10); near(p.y, 5);
});

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
