/**
 * tests/ui/rotateGate.test.js — pure show/hide + lock-helper tests (no DOM mount):
 *
 *   node tests/ui/rotateGate.test.js
 */

import assert from 'node:assert/strict';
import { isPortraitViewport, shouldShowRotateGate, tryLockLandscape } from '../../src/ui/rotateGate.js';

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

test('desktop fine-pointer portrait window never shows the gate', () => {
  assert.equal(shouldShowRotateGate({ touchUi: false, width: 800, height: 1200 }), false);
  assert.equal(shouldShowRotateGate({ touchUi: false, ...PHONE_PORTRAIT }), false);
  assert.equal(shouldShowRotateGate({ ...PHONE_PORTRAIT }), false);
});

test('touch + portrait size shows the gate', () => {
  assert.equal(shouldShowRotateGate({ touchUi: true, ...PHONE_PORTRAIT }), true);
});

test('touch + landscape size hides the gate', () => {
  assert.equal(shouldShowRotateGate({ touchUi: true, ...PHONE_LANDSCAPE }), false);
  assert.equal(shouldShowRotateGate({ touchUi: true, ...DESKTOP }), false);
});

test('square viewport is not portrait, so the gate stays hidden', () => {
  assert.equal(shouldShowRotateGate({ touchUi: true, width: 800, height: 800 }), false);
  assert.equal(isPortraitViewport({ width: 800, height: 800 }), false);
});

test('orientationType portrait wins over stale landscape sizes', () => {
  assert.equal(shouldShowRotateGate({
    touchUi: true,
    ...PHONE_LANDSCAPE,
    orientationType: 'portrait-primary',
  }), true);
  assert.equal(shouldShowRotateGate({
    touchUi: true,
    ...PHONE_LANDSCAPE,
    orientationType: 'portrait-secondary',
  }), true);
});

test('orientationType landscape wins over stale portrait sizes', () => {
  assert.equal(shouldShowRotateGate({
    touchUi: true,
    ...PHONE_PORTRAIT,
    orientationType: 'landscape-primary',
  }), false);
  assert.equal(shouldShowRotateGate({
    touchUi: true,
    ...PHONE_PORTRAIT,
    orientationType: 'landscape-secondary',
  }), false);
});

test('legacy window.orientation 0/180 is portrait, ±90 is landscape', () => {
  assert.equal(isPortraitViewport({ windowOrientation: 0 }), true);
  assert.equal(isPortraitViewport({ windowOrientation: 180 }), true);
  assert.equal(isPortraitViewport({ windowOrientation: 90 }), false);
  assert.equal(isPortraitViewport({ windowOrientation: -90 }), false);
  assert.equal(shouldShowRotateGate({
    touchUi: true,
    ...PHONE_PORTRAIT,
    windowOrientation: 90,
  }), false);
});

test('unknown size and orientation does not show the gate', () => {
  assert.equal(shouldShowRotateGate({ touchUi: true }), false);
  assert.equal(shouldShowRotateGate({ touchUi: true, width: 0, height: 0 }), false);
  assert.equal(isPortraitViewport({}), false);
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
