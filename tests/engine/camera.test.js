/**
 * tests/engine/camera.test.js
 *
 * Pure-function tests for src/engine/camera.js.
 * Runnable with Node (no browser, no framework):
 *
 *   node tests/engine/camera.test.js
 *
 * Uses only Node's built-in assert module and the ES module import.
 */

import assert from 'node:assert/strict';
import {
  createCamera,
  followTarget,
  addTrauma,
  tickShake,
  worldToScreen,
  screenToWorld,
  updateCamera,
  pinArenaCentre,
  clampToArena,
  lerp,
  clamp,
  seededRandom,
  SHAKE_MAX_FULL,
  SHAKE_MAX_REDUCED,
  TRAUMA_DECAY,
  FOLLOW_SPEED,
} from '../../src/engine/camera.js';

// ── Minimal test harness ─────────────────────────────────────────────────────

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

/** Floating-point equality within epsilon. */
function approxEq(a, b, eps = 1e-9) {
  return Math.abs(a - b) < eps;
}

// ── lerp ─────────────────────────────────────────────────────────────────────

console.log('\nsrc/engine/camera.js — lerp\n');

test('lerp t=0 returns a', () => {
  assert.ok(approxEq(lerp(3, 7, 0), 3));
});

test('lerp t=1 returns b', () => {
  assert.ok(approxEq(lerp(3, 7, 1), 7));
});

test('lerp t=0.5 returns midpoint', () => {
  assert.ok(approxEq(lerp(0, 10, 0.5), 5));
});

test('lerp is linear in t', () => {
  assert.ok(approxEq(lerp(10, 20, 0.25), 12.5));
});

// ── clamp ─────────────────────────────────────────────────────────────────────

console.log('\nsrc/engine/camera.js — clamp\n');

test('clamp below min returns min', () => {
  assert.equal(clamp(-5, 0, 1), 0);
});

test('clamp above max returns max', () => {
  assert.equal(clamp(5, 0, 1), 1);
});

test('clamp within range returns value', () => {
  assert.equal(clamp(0.5, 0, 1), 0.5);
});

test('clamp at boundary values is inclusive', () => {
  assert.equal(clamp(0, 0, 1), 0);
  assert.equal(clamp(1, 0, 1), 1);
});

// ── seededRandom ──────────────────────────────────────────────────────────────

console.log('\nsrc/engine/camera.js — seededRandom\n');

test('seededRandom returns value in [−1, 1)', () => {
  for (let seed = 0; seed < 20; seed++) {
    const { value } = seededRandom(seed * 12345);
    assert.ok(value >= -1 && value < 1, `value=${value} seed=${seed}`);
  }
});

test('seededRandom is deterministic (same seed → same value)', () => {
  const r1 = seededRandom(42);
  const r2 = seededRandom(42);
  assert.equal(r1.value, r2.value);
  assert.equal(r1.nextSeed, r2.nextSeed);
});

test('seededRandom advances seed each call', () => {
  const r1 = seededRandom(0);
  const r2 = seededRandom(r1.nextSeed);
  // Seeds and values must differ after advancing
  assert.notEqual(r1.nextSeed, r2.nextSeed);
});

// ── createCamera ──────────────────────────────────────────────────────────────

console.log('\nsrc/engine/camera.js — createCamera\n');

test('createCamera defaults', () => {
  const cam = createCamera();
  assert.equal(cam.x, 0);
  assert.equal(cam.y, 0);
  assert.equal(cam.zoom, 1);
  assert.equal(cam.trauma, 0);
  assert.equal(cam.reducedMotion, false);
});

test('createCamera accepts initial position', () => {
  const cam = createCamera({ x: 100, y: 200 });
  assert.equal(cam.x, 100);
  assert.equal(cam.y, 200);
});

test('createCamera clamps trauma to [0, 1]', () => {
  assert.equal(createCamera({ trauma:  2 }).trauma, 1);
  assert.equal(createCamera({ trauma: -1 }).trauma, 0);
});

test('createCamera stores reducedMotion flag', () => {
  assert.equal(createCamera({ reducedMotion: true }).reducedMotion, true);
});

// ── followTarget ──────────────────────────────────────────────────────────────

console.log('\nsrc/engine/camera.js — followTarget\n');

test('followTarget with dt=0 does not move camera', () => {
  const cam = createCamera({ x: 0, y: 0 });
  const result = followTarget(cam, { x: 100, y: 100 }, 0);
  // FOLLOW_SPEED * 0 = 0 → lerp t=0 → stays at origin
  assert.ok(approxEq(result.x, 0), `x=${result.x}`);
  assert.ok(approxEq(result.y, 0), `y=${result.y}`);
});

test('followTarget with large dt snaps camera to target', () => {
  const cam = createCamera({ x: 0, y: 0 });
  // dt=1 → t = clamp(FOLLOW_SPEED * 1, 0, 1) = 1 → fully at target
  const result = followTarget(cam, { x: 50, y: 80 }, 1);
  assert.ok(approxEq(result.x, 50), `x=${result.x}`);
  assert.ok(approxEq(result.y, 80), `y=${result.y}`);
});

test('followTarget moves camera toward target', () => {
  const cam = createCamera({ x: 0, y: 0 });
  const dt = 1 / 60;
  const result = followTarget(cam, { x: 100, y: 0 }, dt);
  // Must have moved closer but not all the way
  assert.ok(result.x > 0 && result.x < 100, `x=${result.x}`);
});

test('followTarget does not mutate input camera', () => {
  const cam = createCamera({ x: 10, y: 20 });
  followTarget(cam, { x: 999, y: 999 }, 1);
  assert.equal(cam.x, 10);
  assert.equal(cam.y, 20);
});

test('followTarget when already at target stays put', () => {
  const cam = createCamera({ x: 50, y: 50 });
  const result = followTarget(cam, { x: 50, y: 50 }, 1 / 60);
  assert.ok(approxEq(result.x, 50), `x=${result.x}`);
  assert.ok(approxEq(result.y, 50), `y=${result.y}`);
});

// ── addTrauma ─────────────────────────────────────────────────────────────────

console.log('\nsrc/engine/camera.js — addTrauma\n');

test('addTrauma increases trauma', () => {
  const cam = createCamera({ trauma: 0 });
  const result = addTrauma(cam, 0.5);
  assert.ok(approxEq(result.trauma, 0.5));
});

test('addTrauma clamps at 1', () => {
  const cam = createCamera({ trauma: 0.8 });
  const result = addTrauma(cam, 0.5);
  assert.ok(approxEq(result.trauma, 1));
});

test('addTrauma of 0 leaves trauma unchanged', () => {
  const cam = createCamera({ trauma: 0.3 });
  const result = addTrauma(cam, 0);
  assert.ok(approxEq(result.trauma, 0.3));
});

test('addTrauma does not mutate input', () => {
  const cam = createCamera({ trauma: 0 });
  addTrauma(cam, 1);
  assert.equal(cam.trauma, 0);
});

// ── tickShake ─────────────────────────────────────────────────────────────────

console.log('\nsrc/engine/camera.js — tickShake\n');

test('tickShake with zero trauma returns zero shake', () => {
  const cam = createCamera({ trauma: 0 });
  const { shakeX, shakeY } = tickShake(cam, 1 / 60);
  // trauma=0 → magnitude=0 → shake=0
  assert.ok(approxEq(shakeX, 0), `shakeX=${shakeX}`);
  assert.ok(approxEq(shakeY, 0), `shakeY=${shakeY}`);
});

test('tickShake decays trauma over time', () => {
  const cam = createCamera({ trauma: 1 });
  const dt = 1 / 60;
  const { camera: next } = tickShake(cam, dt);
  const expected = Math.max(0, 1 - TRAUMA_DECAY * dt);
  assert.ok(approxEq(next.trauma, expected, 1e-9), `trauma=${next.trauma}`);
});

test('tickShake trauma never goes negative', () => {
  const cam = createCamera({ trauma: 0.01 });
  const { camera: next } = tickShake(cam, 10); // large dt
  assert.ok(next.trauma >= 0, `trauma=${next.trauma}`);
});

test('tickShake full-motion shake stays within SHAKE_MAX_FULL', () => {
  const cam = createCamera({ trauma: 1, reducedMotion: false });
  for (let i = 0; i < 100; i++) {
    const { shakeX, shakeY } = tickShake({ ...cam, seed: i * 7919 }, 0);
    assert.ok(Math.abs(shakeX) <= SHAKE_MAX_FULL, `shakeX=${shakeX}`);
    assert.ok(Math.abs(shakeY) <= SHAKE_MAX_FULL, `shakeY=${shakeY}`);
  }
});

test('tickShake reduced-motion shake stays within SHAKE_MAX_REDUCED', () => {
  const cam = createCamera({ trauma: 1, reducedMotion: true });
  for (let i = 0; i < 100; i++) {
    const { shakeX, shakeY } = tickShake({ ...cam, seed: i * 7919 }, 0);
    assert.ok(Math.abs(shakeX) <= SHAKE_MAX_REDUCED, `shakeX=${shakeX}`);
    assert.ok(Math.abs(shakeY) <= SHAKE_MAX_REDUCED, `shakeY=${shakeY}`);
  }
});

test('tickShake reduced-motion max is less than full max', () => {
  assert.ok(SHAKE_MAX_REDUCED < SHAKE_MAX_FULL,
    `SHAKE_MAX_REDUCED(${SHAKE_MAX_REDUCED}) should be < SHAKE_MAX_FULL(${SHAKE_MAX_FULL})`);
});

test('tickShake does not mutate input camera', () => {
  const cam = createCamera({ trauma: 0.8 });
  tickShake(cam, 1 / 60);
  assert.ok(approxEq(cam.trauma, 0.8));
});

// ── worldToScreen ─────────────────────────────────────────────────────────────

console.log('\nsrc/engine/camera.js — worldToScreen\n');

test('worldToScreen: camera at origin, target at origin → canvas centre', () => {
  const cam = createCamera({ x: 0, y: 0, zoom: 1 });
  const { sx, sy } = worldToScreen(0, 0, cam, 800, 600);
  assert.ok(approxEq(sx, 400), `sx=${sx}`);
  assert.ok(approxEq(sy, 300), `sy=${sy}`);
});

test('worldToScreen: world point offset maps to screen offset by zoom', () => {
  const cam = createCamera({ x: 0, y: 0, zoom: 2 });
  // wx=10 → sx = (10-0)*2 + 400 = 420
  const { sx, sy } = worldToScreen(10, 5, cam, 800, 600);
  assert.ok(approxEq(sx, 420), `sx=${sx}`);
  assert.ok(approxEq(sy, 310), `sy=${sy}`);
});

test('worldToScreen: camera pan shifts screen coords', () => {
  const cam = createCamera({ x: 100, y: 0, zoom: 1 });
  // wx=100, camera centred on 100 → screen centre → sx=400
  const { sx } = worldToScreen(100, 0, cam, 800, 600);
  assert.ok(approxEq(sx, 400), `sx=${sx}`);
});

test('worldToScreen: shake offset added', () => {
  const cam = createCamera({ x: 0, y: 0, zoom: 1 });
  const { sx, sy } = worldToScreen(0, 0, cam, 800, 600, 5, -3);
  assert.ok(approxEq(sx, 405), `sx=${sx}`);
  assert.ok(approxEq(sy, 297), `sy=${sy}`);
});

// ── screenToWorld ─────────────────────────────────────────────────────────────

console.log('\nsrc/engine/camera.js — screenToWorld\n');

test('screenToWorld: canvas centre → world origin when camera at origin', () => {
  const cam = createCamera({ x: 0, y: 0, zoom: 1 });
  const { wx, wy } = screenToWorld(400, 300, cam, 800, 600);
  assert.ok(approxEq(wx, 0), `wx=${wx}`);
  assert.ok(approxEq(wy, 0), `wy=${wy}`);
});

test('screenToWorld is inverse of worldToScreen (no shake)', () => {
  const cam = createCamera({ x: 50, y: -30, zoom: 1.5 });
  const wx0 = 120, wy0 = 80;
  const { sx, sy } = worldToScreen(wx0, wy0, cam, 800, 600);
  const { wx, wy } = screenToWorld(sx, sy, cam, 800, 600);
  assert.ok(approxEq(wx, wx0, 1e-6), `wx=${wx}`);
  assert.ok(approxEq(wy, wy0, 1e-6), `wy=${wy}`);
});

test('screenToWorld is inverse of worldToScreen (with shake)', () => {
  const cam = createCamera({ x: 0, y: 0, zoom: 1 });
  const shakeX = 4, shakeY = -2;
  const wx0 = 30, wy0 = 70;
  const { sx, sy } = worldToScreen(wx0, wy0, cam, 800, 600, shakeX, shakeY);
  const { wx, wy } = screenToWorld(sx, sy, cam, 800, 600, shakeX, shakeY);
  assert.ok(approxEq(wx, wx0, 1e-9), `wx=${wx}`);
  assert.ok(approxEq(wy, wy0, 1e-9), `wy=${wy}`);
});

test('screenToWorld zoom scaling', () => {
  const cam = createCamera({ x: 0, y: 0, zoom: 2 });
  // screen centre (400,300) → world (0,0) regardless of zoom
  const { wx, wy } = screenToWorld(400, 300, cam, 800, 600);
  assert.ok(approxEq(wx, 0), `wx=${wx}`);
  assert.ok(approxEq(wy, 0), `wy=${wy}`);
});

// ── updateCamera ──────────────────────────────────────────────────────────────

console.log('\nsrc/engine/camera.js — updateCamera\n');

test('updateCamera returns camera, shakeX, shakeY', () => {
  const cam = createCamera();
  const result = updateCamera(cam, { x: 0, y: 0 }, 1 / 60);
  assert.ok('camera' in result);
  assert.ok('shakeX' in result);
  assert.ok('shakeY' in result);
});

test('updateCamera moves camera toward target', () => {
  const cam = createCamera({ x: 0, y: 0 });
  const { camera: next } = updateCamera(cam, { x: 100, y: 0 }, 1);
  // dt=1 → follow snaps (t=1) then trauma=0 shake=0
  assert.ok(approxEq(next.x, 100), `x=${next.x}`);
});

test('updateCamera with zero trauma gives zero shake', () => {
  const cam = createCamera({ trauma: 0 });
  const { shakeX, shakeY } = updateCamera(cam, { x: 0, y: 0 }, 1 / 60);
  assert.ok(approxEq(shakeX, 0), `shakeX=${shakeX}`);
  assert.ok(approxEq(shakeY, 0), `shakeY=${shakeY}`);
});

test('updateCamera with reducedMotion shake bounded at 2px', () => {
  const cam = createCamera({ trauma: 1, reducedMotion: true });
  for (let i = 0; i < 50; i++) {
    const { shakeX, shakeY } = updateCamera({ ...cam, seed: i * 1337 }, { x: 0, y: 0 }, 0);
    assert.ok(Math.abs(shakeX) <= SHAKE_MAX_REDUCED,
      `shakeX=${shakeX} exceeds SHAKE_MAX_REDUCED=${SHAKE_MAX_REDUCED}`);
    assert.ok(Math.abs(shakeY) <= SHAKE_MAX_REDUCED,
      `shakeY=${shakeY} exceeds SHAKE_MAX_REDUCED=${SHAKE_MAX_REDUCED}`);
  }
});

// ── pinArenaCentre ────────────────────────────────────────────────────────────

console.log('\nsrc/engine/camera.js — pinArenaCentre\n');

test('pinArenaCentre sets camera to arena centre', () => {
  const cam    = createCamera({ x: 0, y: 0 });
  const arena  = { width: 1200, height: 900 };
  const result = pinArenaCentre(cam, arena);
  assert.ok(approxEq(result.x, 600), `x=${result.x}`);
  assert.ok(approxEq(result.y, 450), `y=${result.y}`);
});

test('pinArenaCentre preserves other camera fields', () => {
  const cam    = createCamera({ x: 0, y: 0, zoom: 0.75, trauma: 0.2 });
  const result = pinArenaCentre(cam, { width: 800, height: 600 });
  assert.ok(approxEq(result.zoom, 0.75));
  assert.ok(approxEq(result.trauma, 0.2));
});

test('pinArenaCentre does not mutate input', () => {
  const cam = createCamera({ x: 0, y: 0 });
  pinArenaCentre(cam, { width: 400, height: 300 });
  assert.ok(approxEq(cam.x, 0));
  assert.ok(approxEq(cam.y, 0));
});

// ── clampToArena ──────────────────────────────────────────────────────────────

console.log('\nsrc/engine/camera.js — clampToArena\n');

test('clampToArena keeps camera inside arena when close to edge', () => {
  // Arena 1200×900, zoom 1, viewport 800×600
  // halfWorldW = 400, halfWorldH = 300 → clamp x in [400, 800], y in [300, 600]
  const arena  = { width: 1200, height: 900 };
  const cam    = createCamera({ x: 50, y: 50, zoom: 1 });
  const result = clampToArena(cam, arena, 800, 600);
  assert.ok(approxEq(result.x, 400), `x=${result.x}`);  // min x
  assert.ok(approxEq(result.y, 300), `y=${result.y}`);  // min y
});

test('clampToArena clamps camera past far edge', () => {
  const arena  = { width: 1200, height: 900 };
  const cam    = createCamera({ x: 1200, y: 900, zoom: 1 });
  const result = clampToArena(cam, arena, 800, 600);
  assert.ok(approxEq(result.x, 800), `x=${result.x}`);  // max x = 1200-400
  assert.ok(approxEq(result.y, 600), `y=${result.y}`);  // max y = 900-300
});

test('clampToArena allows camera to stay in mid-arena', () => {
  const arena  = { width: 1200, height: 900 };
  const cam    = createCamera({ x: 600, y: 450, zoom: 1 });
  const result = clampToArena(cam, arena, 800, 600);
  assert.ok(approxEq(result.x, 600), `x=${result.x}`);
  assert.ok(approxEq(result.y, 450), `y=${result.y}`);
});

test('clampToArena pins to centre when arena narrower than viewport on an axis', () => {
  // zoom 0.1 → viewport in world units = 8000 × 6000, arena 1200×900
  // halfWorldW = 4000, halfWorldH = 3000 → minX > maxX → pin to centre
  const arena  = { width: 1200, height: 900 };
  const cam    = createCamera({ x: 0, y: 0, zoom: 0.1 });
  const result = clampToArena(cam, arena, 800, 600);
  assert.ok(approxEq(result.x, 600), `x=${result.x}`);
  assert.ok(approxEq(result.y, 450), `y=${result.y}`);
});

test('clampToArena accounts for zoom (zoom 2 — viewport covers less world)', () => {
  // zoom 2, viewport 800×600 → halfWorldW = 200, halfWorldH = 150
  // clamp x in [200, 1000], y in [150, 750]
  const arena  = { width: 1200, height: 900 };
  const cam    = createCamera({ x: 0, y: 0, zoom: 2 });
  const result = clampToArena(cam, arena, 800, 600);
  assert.ok(approxEq(result.x, 200), `x=${result.x}`);
  assert.ok(approxEq(result.y, 150), `y=${result.y}`);
});

test('clampToArena does not mutate input camera', () => {
  const cam = createCamera({ x: 0, y: 0, zoom: 1 });
  clampToArena(cam, { width: 1200, height: 900 }, 800, 600);
  assert.ok(approxEq(cam.x, 0));
  assert.ok(approxEq(cam.y, 0));
});

// ── updateCamera with arena bounds ────────────────────────────────────────────

console.log('\nsrc/engine/camera.js — updateCamera (arena framing)\n');

test('updateCamera pins to arena centre when arena fits viewport', () => {
  // fitZoom = min(1280/1200, 800/900) * 0.95 ≈ 0.844 (arena fits at that zoom)
  // At zoom 0.844: arenaScreenW = 1200*0.844 ≈ 1013 < 1280, fits.
  const arena = { width: 1200, height: 900 };
  const vpW   = 1280;
  const vpH   = 800;
  const zoom  = Math.min(vpW / arena.width, vpH / arena.height) * 0.95;
  const cam   = createCamera({ x: 0, y: 0, zoom });
  const { camera: next } = updateCamera(cam, { x: 200, y: 450 }, 1 / 60, arena, vpW, vpH);
  // Should be pinned to arena centre, not following the target at (200, 450).
  assert.ok(approxEq(next.x, 600, 0.01), `x=${next.x} expected 600`);
  assert.ok(approxEq(next.y, 450, 0.01), `y=${next.y} expected 450`);
});

test('updateCamera follows + clamps when arena larger than viewport', () => {
  // zoom 1 → arenaScreenW = 1200 > 800 → large-arena path.
  const arena  = { width: 1200, height: 900 };
  const vpW    = 800;
  const vpH    = 600;
  const cam    = createCamera({ x: 600, y: 450, zoom: 1 });
  // Player way off at top-left corner — camera should clamp, not go to (0,0).
  const { camera: next } = updateCamera(cam, { x: 10, y: 10 }, 10, arena, vpW, vpH);
  // halfWorldW=400, halfWorldH=300 → min x=400, min y=300
  assert.ok(next.x >= 400, `x=${next.x} should be ≥ 400`);
  assert.ok(next.y >= 300, `y=${next.y} should be ≥ 300`);
});

test('updateCamera without arena falls back to plain follow', () => {
  const cam = createCamera({ x: 0, y: 0 });
  const { camera: next } = updateCamera(cam, { x: 100, y: 0 }, 1);
  // dt=1 → t=1 → snaps to target
  assert.ok(approxEq(next.x, 100), `x=${next.x}`);
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
