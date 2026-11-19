/**
 * tests/ui/title.test.js — pure titleChoice tests (no DOM):
 *
 *   node tests/ui/title.test.js
 */

import assert from 'node:assert/strict';
import { titleChoice } from '../../src/ui/title.js';

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
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
