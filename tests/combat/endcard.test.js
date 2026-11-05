/**
 * tests/combat/endcard.test.js
 *
 * Pure-function tests for the R8 end-card text helpers.
 * Runnable with Node (no browser, no framework):
 *
 *   node tests/combat/endcard.test.js
 *
 * Uses only Node's built-in assert module and ES module import.
 */

import assert from 'node:assert/strict';
import {
  formatTimeSurvived,
  titleText,
  subtitleText,
  causeText,
  timeSurvivedLine,
  endCardText,
} from '../../src/combat/endcard.js';

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

// ── formatTimeSurvived ───────────────────────────────────────────────────────

console.log('\nsrc/combat/endcard.js — formatTimeSurvived\n');

test('zero ms is 0:00', () => {
  assert.equal(formatTimeSurvived(0), '0:00');
});

test('sub-second floors to 0:00', () => {
  assert.equal(formatTimeSurvived(999), '0:00');
});

test('seconds are zero-padded to two digits', () => {
  assert.equal(formatTimeSurvived(7000), '0:07');
});

test('partial seconds are floored, not rounded', () => {
  assert.equal(formatTimeSurvived(7999), '0:07');
});

test('minute rollover', () => {
  assert.equal(formatTimeSurvived(65000), '1:05');
});

test('many minutes, minutes are not padded', () => {
  assert.equal(formatTimeSurvived(12 * 60000 + 30000), '12:30');
});

test('exactly one minute', () => {
  assert.equal(formatTimeSurvived(60000), '1:00');
});

test('negative input clamps to 0:00', () => {
  assert.equal(formatTimeSurvived(-5000), '0:00');
});

test('NaN input clamps to 0:00', () => {
  assert.equal(formatTimeSurvived(NaN), '0:00');
});

test('Infinity input clamps to 0:00', () => {
  assert.equal(formatTimeSurvived(Infinity), '0:00');
});

// ── Phase → text ─────────────────────────────────────────────────────────────

console.log('\nsrc/combat/endcard.js — phase text\n');

test('win title is VICTORY', () => {
  assert.equal(titleText('win'), 'VICTORY');
});

test('lose title is DESTROYED', () => {
  assert.equal(titleText('lose'), 'DESTROYED');
});

test('non-win phase title is DESTROYED (safe default)', () => {
  assert.equal(titleText('playing'), 'DESTROYED');
});

test('win subtitle is MISSION COMPLETE', () => {
  assert.equal(subtitleText('win'), 'MISSION COMPLETE');
});

test('lose subtitle is MISSION FAILED', () => {
  assert.equal(subtitleText('lose'), 'MISSION FAILED');
});

test('win cause line', () => {
  assert.equal(causeText('win'), 'Enemy mech disabled.');
});

test('lose cause line', () => {
  assert.equal(causeText('lose'), 'Your mech was destroyed.');
});

test('cause copy never says "AI" (product rule: say SI)', () => {
  assert.ok(!/\bAI\b/.test(causeText('win')));
  assert.ok(!/\bAI\b/.test(causeText('lose')));
});

test('timeSurvivedLine combines label and value', () => {
  assert.equal(timeSurvivedLine(65000), 'Time survived  1:05');
});

// ── endCardText aggregator ───────────────────────────────────────────────────

console.log('\nsrc/combat/endcard.js — endCardText\n');

test('win aggregate', () => {
  const t = endCardText('win', 65000);
  assert.deepEqual(t, {
    isWin:    true,
    title:    'VICTORY',
    subtitle: 'MISSION COMPLETE',
    cause:    'Enemy mech disabled.',
    timeLine: 'Time survived  1:05',
  });
});

test('lose aggregate', () => {
  const t = endCardText('lose', 0);
  assert.deepEqual(t, {
    isWin:    false,
    title:    'DESTROYED',
    subtitle: 'MISSION FAILED',
    cause:    'Your mech was destroyed.',
    timeLine: 'Time survived  0:00',
  });
});

test('endCardText handles missing/undefined elapsed as 0:00', () => {
  const t = endCardText('win', undefined);
  assert.equal(t.timeLine, 'Time survived  0:00');
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
