/**
 * tests/ui/rotateGate.test.js — CSS-landscape force + remap + lock helper.
 *
 *   node tests/ui/rotateGate.test.js
 */

import assert from 'node:assert/strict';
import {
  isPortraitViewport,
  shouldForceCssLandscape,
  shouldShowRotateGate,
  tryLockLandscape,
  remapClientForCssLandscape,
  cssLandscapeSize,
} from '../../src/ui/rotateGate.js';

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

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

const PHONE_PORTRAIT = { width: 390, height: 844 };
const PHONE_LANDSCAPE = { width: 844, height: 390 };
const DESKTOP = { width: 1280, height: 800 };

test('desktop fine-pointer portrait window never forces CSS landscape', () => {
  assert.equal(shouldForceCssLandscape({ touchUi: false, width: 800, height: 1200 }), false);
  assert.equal(shouldForceCssLandscape({ touchUi: false, ...PHONE_PORTRAIT }), false);
  assert.equal(shouldForceCssLandscape({ ...PHONE_PORTRAIT }), false);
  assert.equal(shouldShowRotateGate({ touchUi: false, ...PHONE_PORTRAIT }), false);
});

test('touch + portrait size forces CSS landscape', () => {
  assert.equal(shouldForceCssLandscape({ touchUi: true, ...PHONE_PORTRAIT }), true);
});

test('touch + landscape size does not force CSS landscape', () => {
  assert.equal(shouldForceCssLandscape({ touchUi: true, ...PHONE_LANDSCAPE }), false);
  assert.equal(shouldForceCssLandscape({ touchUi: true, ...DESKTOP }), false);
});

test('square viewport is not portrait, so force stays off', () => {
  assert.equal(shouldForceCssLandscape({ touchUi: true, width: 800, height: 800 }), false);
  assert.equal(isPortraitViewport({ width: 800, height: 800 }), false);
});

test('clear landscape size wins over stale portrait orientationType (no double-rotate)', () => {
  assert.equal(shouldForceCssLandscape({
    touchUi: true,
    ...PHONE_LANDSCAPE,
    orientationType: 'portrait-primary',
  }), false);
  assert.equal(shouldForceCssLandscape({
    touchUi: true,
    ...PHONE_LANDSCAPE,
    orientationType: 'portrait-secondary',
  }), false);
});

test('clear portrait size wins over stale landscape orientationType', () => {
  assert.equal(shouldForceCssLandscape({
    touchUi: true,
    ...PHONE_PORTRAIT,
    orientationType: 'landscape-primary',
  }), true);
  assert.equal(shouldForceCssLandscape({
    touchUi: true,
    ...PHONE_PORTRAIT,
    orientationType: 'landscape-secondary',
  }), true);
});

test('orientationType still used when size is square / unknown', () => {
  assert.equal(shouldForceCssLandscape({
    touchUi: true,
    width: 800,
    height: 800,
    orientationType: 'portrait-primary',
  }), true);
  assert.equal(shouldForceCssLandscape({
    touchUi: true,
    width: 800,
    height: 800,
    orientationType: 'landscape-primary',
  }), false);
  assert.equal(isPortraitViewport({
    ...PHONE_LANDSCAPE,
    orientationType: 'portrait-primary',
  }), true);
});

test('legacy window.orientation 0/180 is portrait, ±90 is landscape', () => {
  assert.equal(isPortraitViewport({ windowOrientation: 0 }), true);
  assert.equal(isPortraitViewport({ windowOrientation: 180 }), true);
  assert.equal(isPortraitViewport({ windowOrientation: 90 }), false);
  assert.equal(isPortraitViewport({ windowOrientation: -90 }), false);
  // Clear portrait size still forces even if legacy orientation says landscape.
  assert.equal(shouldForceCssLandscape({
    touchUi: true,
    ...PHONE_PORTRAIT,
    windowOrientation: 90,
  }), true);
  assert.equal(shouldForceCssLandscape({
    touchUi: true,
    ...PHONE_LANDSCAPE,
    windowOrientation: 0,
  }), false);
});

test('unknown size and orientation does not force CSS landscape', () => {
  assert.equal(shouldForceCssLandscape({ touchUi: true }), false);
  assert.equal(shouldForceCssLandscape({ touchUi: true, width: 0, height: 0 }), false);
  assert.equal(isPortraitViewport({}), false);
});

test('cssLandscapeSize swaps physical portrait into logical landscape', () => {
  assert.deepEqual(cssLandscapeSize(390, 844), { width: 844, height: 390 });
  assert.deepEqual(cssLandscapeSize(844, 390), { width: 390, height: 844 });
});

test('remap: physical top-right → logical top-left', () => {
  const p = remapClientForCssLandscape(390, 0, { physW: 390 });
  assert.deepEqual(p, { x: 0, y: 0 });
});

test('remap: physical top-left → logical bottom-left', () => {
  const p = remapClientForCssLandscape(0, 0, { physW: 390 });
  assert.deepEqual(p, { x: 0, y: 390 });
});

test('remap: physical bottom-right → logical top-right', () => {
  const p = remapClientForCssLandscape(390, 844, { physW: 390 });
  assert.deepEqual(p, { x: 844, y: 0 });
});

test('remap: physical bottom-left → logical bottom-right', () => {
  const p = remapClientForCssLandscape(0, 844, { physW: 390 });
  assert.deepEqual(p, { x: 844, y: 390 });
});

test('remap: physical centre → logical centre', () => {
  const p = remapClientForCssLandscape(195, 422, { physW: 390 });
  assert.deepEqual(p, { x: 422, y: 195 });
});

test('remap: visualViewport offsets shift the logical origin', () => {
  const p = remapClientForCssLandscape(10, 20, { physW: 390, offsetLeft: 5, offsetTop: 8 });
  // lx = 20 - 8 = 12; ly = (5+390) - 10 = 385
  assert.deepEqual(p, { x: 12, y: 385 });
});

test('remap: invalid physW is identity', () => {
  assert.deepEqual(remapClientForCssLandscape(12, 34, { physW: 0 }), { x: 12, y: 34 });
});

test('remap round-trip: logical corners map back via the forward formula', () => {
  // Forward: sx = offsetLeft+physW - ly, sy = offsetTop + lx
  const physW = 390;
  const samples = [
    { x: 0, y: 0 },
    { x: 844, y: 0 },
    { x: 0, y: 390 },
    { x: 844, y: 390 },
    { x: 100, y: 50 },
  ];
  for (const local of samples) {
    const sx = physW - local.y;
    const sy = local.x;
    const back = remapClientForCssLandscape(sx, sy, { physW });
    assert.deepEqual(back, local);
  }
});

await testAsync('tryLockLandscape no-ops without a lock function', async () => {
  assert.equal(await tryLockLandscape(null), false);
  assert.equal(await tryLockLandscape({}), false);
});

await testAsync('tryLockLandscape prefers landscape and reports success', async () => {
  const calls = [];
  const api = { lock: async (type) => { calls.push(type); } };
  assert.equal(await tryLockLandscape(api), true);
  assert.deepEqual(calls, ['landscape']);
});

await testAsync('tryLockLandscape falls back to landscape-primary', async () => {
  const calls = [];
  const api = {
    lock: async (type) => {
      calls.push(type);
      if (type === 'landscape') throw new Error('NotSupportedError');
    },
  };
  assert.equal(await tryLockLandscape(api), true);
  assert.deepEqual(calls, ['landscape', 'landscape-primary']);
});

await testAsync('tryLockLandscape swallows errors and returns false', async () => {
  const api = { lock: async () => { throw new Error('NotAllowedError'); } };
  assert.equal(await tryLockLandscape(api), false);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
