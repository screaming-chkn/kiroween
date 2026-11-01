/**
 * tests/mech/weight.test.js
 *
 * Unit + property tests for src/mech/weight.js.
 * Runnable with Node (no browser, no framework):
 *
 *   node tests/mech/weight.test.js
 *
 * Covers:
 *   - Breakpoints at 80, 100, 115, 115.01 (R3)
 *   - dashCooldownMult threshold
 *   - canDeploy threshold
 *   - Seeded mini-PBT: penalty is monotonic non-decreasing and stays in [0, 0.45]
 */

import assert from 'node:assert/strict';
import { speedPenalty, dashCooldownMult, canDeploy } from '../../src/mech/weight.js';

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

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Floating-point equality within a small epsilon. */
function approxEq(a, b, eps = 1e-9) {
  return Math.abs(a - b) < eps;
}

/**
 * Tiny seeded PRNG (mulberry32) — no dependencies, deterministic.
 * Returns floats in [0, 1).
 */
function makePrng(seed) {
  let s = seed >>> 0;
  return function next() {
    s  = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t  = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

// ── speedPenalty — breakpoints ───────────────────────────────────────────────

console.log('\nsrc/mech/weight.js — speedPenalty breakpoints\n');

test('load% = 0 → penalty 0', () => {
  assert.ok(approxEq(speedPenalty(0), 0), `got ${speedPenalty(0)}`);
});

test('load% = 80 → penalty 0 (still free)', () => {
  assert.ok(approxEq(speedPenalty(80), 0), `got ${speedPenalty(80)}`);
});

test('load% just above 80 → penalty just above 0', () => {
  const p = speedPenalty(80.001);
  assert.ok(p > 0 && p < 0.15, `got ${p}`);
});

test('load% = 90 → penalty 0.075 (midpoint of first segment)', () => {
  // Midpoint between 80 and 100 → half of 0.15
  assert.ok(approxEq(speedPenalty(90), 0.075, 1e-9), `got ${speedPenalty(90)}`);
});

test('load% = 100 → penalty exactly 0.15', () => {
  assert.ok(approxEq(speedPenalty(100), 0.15), `got ${speedPenalty(100)}`);
});

test('load% just above 100 → penalty just above 0.15', () => {
  const p = speedPenalty(100.001);
  assert.ok(p > 0.15 && p < 0.45, `got ${p}`);
});

test('load% = 107.5 → penalty 0.30 (midpoint of second segment)', () => {
  // Midpoint between 100 and 115 → 0.15 + half of (0.45 - 0.15) = 0.30
  assert.ok(approxEq(speedPenalty(107.5), 0.30, 1e-9), `got ${speedPenalty(107.5)}`);
});

test('load% = 115 → penalty exactly 0.45', () => {
  assert.ok(approxEq(speedPenalty(115), 0.45), `got ${speedPenalty(115)}`);
});

test('load% = 115.01 → penalty 0.45 (saturates, deploy blocked)', () => {
  // Above the hard cap the value saturates — canDeploy handles the block.
  assert.ok(approxEq(speedPenalty(115.01), 0.45), `got ${speedPenalty(115.01)}`);
});

test('load% = 200 → penalty still 0.45 (no blow-up)', () => {
  assert.ok(approxEq(speedPenalty(200), 0.45), `got ${speedPenalty(200)}`);
});

// ── dashCooldownMult ─────────────────────────────────────────────────────────

console.log('\nsrc/mech/weight.js — dashCooldownMult\n');

test('load% ≤ 100 → multiplier 1.0', () => {
  assert.equal(dashCooldownMult(0),   1.0);
  assert.equal(dashCooldownMult(80),  1.0);
  assert.equal(dashCooldownMult(100), 1.0);
});

test('load% > 100 → multiplier 2.0', () => {
  assert.equal(dashCooldownMult(100.001), 2.0);
  assert.equal(dashCooldownMult(115),     2.0);
  assert.equal(dashCooldownMult(115.01),  2.0);
});

// ── canDeploy ────────────────────────────────────────────────────────────────

console.log('\nsrc/mech/weight.js — canDeploy\n');

test('load% = 0 → can deploy', () => {
  assert.ok(canDeploy(0));
});

test('load% = 115 → can deploy (boundary is inclusive)', () => {
  assert.ok(canDeploy(115));
});

test('load% = 115.01 → cannot deploy ("Too heavy to walk.")', () => {
  assert.ok(!canDeploy(115.01));
});

test('load% = 200 → cannot deploy', () => {
  assert.ok(!canDeploy(200));
});

// ── Property-based tests (seeded, no deps) ───────────────────────────────────

console.log('\nsrc/mech/weight.js — property tests (seeded)\n');

/**
 * PBT: penalty is monotonic non-decreasing over [0, 200].
 *
 * Strategy: generate SAMPLE_COUNT random load% values in [0, 200],
 * sort them, then verify adjacent pairs satisfy penalty(a) ≤ penalty(b).
 */
test('penalty is monotonic non-decreasing over [0, 200]', () => {
  const SAMPLE_COUNT = 500;
  const SEED         = 0xdead_beef;
  const rng          = makePrng(SEED);

  const loads = Array.from({ length: SAMPLE_COUNT }, () => rng() * 200).sort((a, b) => a - b);

  for (let i = 1; i < loads.length; i++) {
    const a = loads[i - 1];
    const b = loads[i];
    const pa = speedPenalty(a);
    const pb = speedPenalty(b);
    assert.ok(
      pb >= pa - 1e-12,   // tiny epsilon for floating-point rounding
      `monotonicity violated: penalty(${a.toFixed(4)})=${pa} > penalty(${b.toFixed(4)})=${pb}`,
    );
  }
});

/**
 * PBT: penalty is always within [0, 0.45] for any load% in [0, 200].
 */
test('penalty is always within [0, 0.45] for load% in [0, 200]', () => {
  const SAMPLE_COUNT = 500;
  const SEED         = 0xcafe_1234;
  const rng          = makePrng(SEED);

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const load = rng() * 200;
    const p    = speedPenalty(load);
    assert.ok(
      p >= 0 && p <= 0.45 + 1e-12,
      `out of bounds: penalty(${load.toFixed(4)}) = ${p}`,
    );
  }
});

/**
 * PBT: canDeploy is exactly the set load% ≤ 115.
 * Samples load% uniformly in [0, 200], checks agreement with threshold.
 */
test('canDeploy matches load% ≤ 115 for all samples', () => {
  const SAMPLE_COUNT = 300;
  const SEED         = 0x1337_c0de;
  const rng          = makePrng(SEED);

  // Always include the exact boundary values
  const loads = [115, 115.01, ...Array.from({ length: SAMPLE_COUNT }, () => rng() * 200)];

  for (const load of loads) {
    const expected = load <= 115;
    const actual   = canDeploy(load);
    assert.equal(
      actual,
      expected,
      `canDeploy(${load.toFixed(4)}) expected ${expected}, got ${actual}`,
    );
  }
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
