/**
 * tests/ui/title.test.js — pure titleChoice + visualViewport sync tests (no DOM mount):
 *
 *   node tests/ui/title.test.js
 */

import assert from 'node:assert/strict';
import { titleChoice, syncTitleToVisualViewport } from '../../src/ui/title.js';

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

test('click deploys', () => {
  assert.equal(titleChoice({ type: 'click' }), 'deploy');
});
test('pointerup deploys', () => {
  assert.equal(titleChoice({ type: 'pointerup' }), 'deploy');
});
test('touchend deploys', () => {
  assert.equal(titleChoice({ type: 'touchend' }), 'deploy');
});
test('Enter deploys', () => {
  assert.equal(titleChoice({ type: 'keydown', key: 'Enter' }), 'deploy');
});
test('g and G open the garage', () => {
  assert.equal(titleChoice({ type: 'keydown', key: 'g' }), 'garage');
  assert.equal(titleChoice({ type: 'keydown', key: 'G' }), 'garage');
});
test('Tab and Shift do nothing', () => {
  assert.equal(titleChoice({ type: 'keydown', key: 'Tab' }), null);
  assert.equal(titleChoice({ type: 'keydown', key: 'Shift' }), null);
});
test('garage button opens the garage', () => {
  assert.equal(titleChoice({ type: 'click', onGarageButton: true }), 'garage');
  assert.equal(titleChoice({ type: 'pointerup', onGarageButton: true }), 'garage');
  assert.equal(titleChoice({ type: 'touchend', onGarageButton: true }), 'garage');
});
test('syncTitleToVisualViewport pins style from visualViewport', () => {
  const styles = {};
  const el = { style: styles };
  const prev = globalThis.window;
  globalThis.window = {
    visualViewport: { offsetTop: 12, offsetLeft: 3, width: 844, height: 340 },
  };
  try {
    syncTitleToVisualViewport(el);
    assert.equal(styles.top, '12px');
    assert.equal(styles.left, '3px');
    assert.equal(styles.width, '844px');
    assert.equal(styles.height, '340px');
    assert.equal(styles.right, 'auto');
    assert.equal(styles.bottom, 'auto');
  } finally {
    if (prev === undefined) delete globalThis.window;
    else globalThis.window = prev;
  }
});
test('syncTitleToVisualViewport no-ops without visualViewport', () => {
  const styles = {};
  const el = { style: styles };
  const prev = globalThis.window;
  globalThis.window = {};
  try {
    syncTitleToVisualViewport(el);
    assert.equal(Object.keys(styles).length, 0);
  } finally {
    if (prev === undefined) delete globalThis.window;
    else globalThis.window = prev;
  }
});


test('syncTitleToVisualViewport fills the CSS-landscape shell', () => {
  const styles = {};
  const el = {
    style: styles,
    closest: (sel) => (sel === '#hh-shell.hh-css-landscape' ? {} : null),
  };
  const prev = globalThis.window;
  globalThis.window = {
    visualViewport: { offsetTop: 12, offsetLeft: 3, width: 390, height: 844 },
  };
  try {
    syncTitleToVisualViewport(el);
    assert.equal(styles.top, '0');
    assert.equal(styles.left, '0');
    assert.equal(styles.width, '100%');
    assert.equal(styles.height, '100%');
  } finally {
    if (prev === undefined) delete globalThis.window;
    else globalThis.window = prev;
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
