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
import { formatDelta, statChipLabel, overdrawPenaltyPct } from '../../src/ui/garage.js';

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

// ── overdrawPenaltyPct ────────────────────────────────────────────────────────

console.log('\nsrc/ui/garage.js — overdrawPenaltyPct\n');

test('no penalty when output meets or exceeds draw', () => {
  assert.equal(overdrawPenaltyPct(10, 10), 0);
  assert.equal(overdrawPenaltyPct(12, 10), 0);
});

test('no penalty when there is no draw', () => {
  assert.equal(overdrawPenaltyPct(0, 0), 0);
  assert.equal(overdrawPenaltyPct(5, 0), 0);
});

test('penalty is (1 - output/draw) rounded to whole percent', () => {
  // output 8 / draw 10 → scale 0.8 → 20% reduction
  assert.equal(overdrawPenaltyPct(8, 10), 20);
  // output 5 / draw 10 → 50%
  assert.equal(overdrawPenaltyPct(5, 10), 50);
  // output 7 / draw 9 → 1 - 0.7777.. = 0.2222.. → 22%
  assert.equal(overdrawPenaltyPct(7, 9), 22);
});

test('zero output with positive draw is a full 100% penalty', () => {
  assert.equal(overdrawPenaltyPct(0, 10), 100);
});

test('negative output is clamped (never exceeds 100%)', () => {
  assert.equal(overdrawPenaltyPct(-5, 10), 100);
});

test('result is always within [0, 100]', () => {
  const cases = [[10, 10], [8, 10], [0, 10], [-3, 4], [1, 100], [99, 100]];
  for (const [out, draw] of cases) {
    const pct = overdrawPenaltyPct(out, draw);
    assert.ok(pct >= 0 && pct <= 100, `pct=${pct} for out=${out} draw=${draw}`);
    assert.ok(Number.isInteger(pct), `pct must be whole, got ${pct}`);
  }
});

test('penalty is monotonic non-decreasing as output falls (fixed draw)', () => {
  const draw = 10;
  let prev = -1;
  for (const out of [10, 9, 8, 5, 2, 0]) {
    const pct = overdrawPenaltyPct(out, draw);
    assert.ok(pct >= prev, `pct=${pct} should be ≥ previous ${prev} (out=${out})`);
    prev = pct;
  }
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
