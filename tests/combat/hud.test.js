/**
 * tests/combat/hud.test.js
 *
 * Pure-function tests for the R9 fixed-HUD helpers in src/combat/hud.js.
 * Runnable with Node (no browser, no framework):
 *
 *   node tests/combat/hud.test.js
 *
 * Uses only Node's built-in assert module and ES module imports.
 */

import assert from 'node:assert/strict';
import {
  formatHudStat,
  powerStateLabel,
  isPowerStutter,
  cooldownReadyFraction,
} from '../../src/combat/hud.js';

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

function approxEq(a, b, eps = 1e-9) {
  return Math.abs(a - b) < eps;
}

// ── formatHudStat ─────────────────────────────────────────────────────────────

console.log('\nsrc/combat/hud.js — formatHudStat\n');

test('full stat formats as cur/max', () => {
  assert.equal(formatHudStat(300, 300), '300/300');
});

test('partial stat formats as cur/max', () => {
  assert.equal(formatHudStat(120, 300), '120/300');
});

test('fractional current rounds up so 1-left never shows 0', () => {
  assert.equal(formatHudStat(0.1, 300), '1/300');
  assert.equal(formatHudStat(299.2, 300), '300/300');
});

test('current is clamped to max', () => {
  assert.equal(formatHudStat(999, 300), '300/300');
});

test('negative current clamps to 0', () => {
  assert.equal(formatHudStat(-50, 300), '0/300');
});

test('non-finite current clamps to 0', () => {
  assert.equal(formatHudStat(NaN, 300), '0/300');
  assert.equal(formatHudStat(Infinity, 300), '0/300');
});

test('zero / non-finite max yields x/0 with current clamped to 0', () => {
  assert.equal(formatHudStat(0, 0), '0/0');
  assert.equal(formatHudStat(50, 0), '0/0');
  assert.equal(formatHudStat(50, NaN), '0/0');
});

test('max is rounded to a whole number', () => {
  assert.equal(formatHudStat(5, 10.6), '5/11');
});

// ── powerStateLabel / isPowerStutter ──────────────────────────────────────────

console.log('\nsrc/combat/hud.js — powerStateLabel / isPowerStutter\n');

test('non-negative balance is OK', () => {
  assert.equal(powerStateLabel(4), 'OK');
  assert.equal(powerStateLabel(0), 'OK');
});

test('negative balance is STUTTER', () => {
  assert.equal(powerStateLabel(-1), 'STUTTER');
  assert.equal(powerStateLabel(-12), 'STUTTER');
});

test('non-finite balance defaults to OK (no false fault)', () => {
  assert.equal(powerStateLabel(NaN), 'OK');
  assert.equal(powerStateLabel(undefined), 'OK');
});

test('isPowerStutter mirrors the label', () => {
  assert.equal(isPowerStutter(-1), true);
  assert.equal(isPowerStutter(0), false);
  assert.equal(isPowerStutter(5), false);
  assert.equal(isPowerStutter(NaN), false);
});

// ── cooldownReadyFraction ─────────────────────────────────────────────────────

console.log('\nsrc/combat/hud.js — cooldownReadyFraction\n');

test('zero remaining cooldown is fully ready (1)', () => {
  assert.ok(approxEq(cooldownReadyFraction(0, 300), 1));
});

test('full cooldown just fired is empty (0)', () => {
  assert.ok(approxEq(cooldownReadyFraction(300, 300), 0));
});

test('half cooldown is half ready', () => {
  assert.ok(approxEq(cooldownReadyFraction(150, 300), 0.5));
});

test('remaining above total clamps to 0 (not negative)', () => {
  assert.ok(approxEq(cooldownReadyFraction(900, 300), 0));
});

test('negative / non-finite remaining is treated as ready', () => {
  assert.ok(approxEq(cooldownReadyFraction(-5, 300), 1));
  assert.ok(approxEq(cooldownReadyFraction(NaN, 300), 1));
});

test('non-positive / non-finite total duration returns ready (1)', () => {
  assert.ok(approxEq(cooldownReadyFraction(100, 0), 1));
  assert.ok(approxEq(cooldownReadyFraction(100, -1), 1));
  assert.ok(approxEq(cooldownReadyFraction(100, NaN), 1));
});

test('result is always within [0, 1]', () => {
  const cases = [
    [0, 300], [75, 300], [150, 300], [300, 300], [450, 300], [-10, 300],
  ];
  for (const [rem, total] of cases) {
    const r = cooldownReadyFraction(rem, total);
    assert.ok(r >= 0 && r <= 1, `fraction=${r} for rem=${rem}, total=${total}`);
  }
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
