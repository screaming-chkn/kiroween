/**
 * tests/ui/garage.test.js
 *
 * Pure-function tests for the R8 "readable stats" chip formatters exported
 * from src/ui/garage.js. These helpers never touch the DOM, so they import
 * cleanly under Node (no browser, no framework):
 *
 *   node tests/ui/garage.test.js
 *
 * Uses only Node's built-in assert module and ES module imports.
 */

import assert from 'node:assert/strict';
import { formatDelta, statChipLabel } from '../../src/ui/garage.js';

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

// ── formatDelta ───────────────────────────────────────────────────────────────

console.log('\nsrc/ui/garage.js — formatDelta\n');

test('positive delta gets a leading +', () => {
  const r = formatDelta(3);
  assert.equal(r.text, '+3');
  assert.equal(r.cls, 'hh-delta--up');
});

test('negative delta keeps its minus sign', () => {
  const r = formatDelta(-2);
  assert.equal(r.text, '-2');
  assert.equal(r.cls, 'hh-delta--down');
});

test('zero delta renders as plus-minus zero', () => {
  const r = formatDelta(0);
  assert.equal(r.text, '±0');
  assert.equal(r.cls, 'hh-delta--same');
});

// ── statChipLabel ─────────────────────────────────────────────────────────────

console.log('\nsrc/ui/garage.js — statChipLabel\n');

test('uses unique 3-letter codes ARM/SPD/DMG/SEN', () => {
  assert.equal(statChipLabel('armor',  2), 'ARM +2');
  assert.equal(statChipLabel('speed', -1), 'SPD -1');
  assert.equal(statChipLabel('damage', 0), 'DMG ±0');
  assert.equal(statChipLabel('sensor', 4), 'SEN +4');
});

test('codes are all distinct (no first-letter collision)', () => {
  const keys = ['armor', 'speed', 'damage', 'sensor'];
  const codes = keys.map(k => statChipLabel(k, 0).split(' ')[0]);
  const unique = new Set(codes);
  assert.equal(unique.size, keys.length, `codes collide: ${codes.join(', ')}`);
});

test('label pairs a code with the signed delta text', () => {
  // Chip label must stay in sync with formatDelta's text.
  for (const d of [-5, -1, 0, 1, 7]) {
    assert.equal(statChipLabel('armor', d), `ARM ${formatDelta(d).text}`);
  }
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
