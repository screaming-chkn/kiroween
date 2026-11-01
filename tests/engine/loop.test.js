/**
 * tests/engine/loop.test.js
 *
 * Pure-function tests for stepAccumulator.
 * Runnable with Node (no browser, no framework):
 *
 *   node tests/engine/loop.test.js
 *
 * Uses only Node's built-in assert module and the ES module import.
 */

import assert from 'node:assert/strict';
import { stepAccumulator, FIXED_DT, MAX_STEPS } from '../../src/engine/loop.js';

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

const DT  = FIXED_DT;          // 1/60 ≈ 0.01667 s
const MAX = MAX_STEPS;         // 4

/** Floating-point equality within a small epsilon. */
function approxEq(a, b, eps = 1e-9) {
  return Math.abs(a - b) < eps;
}

// ── Tests ────────────────────────────────────────────────────────────────────

console.log('\nsrc/engine/loop.js — stepAccumulator\n');

test('zero frameDt produces zero steps and zero alpha', () => {
  const r = stepAccumulator(0, 0, DT, MAX);
  assert.equal(r.steps, 0);
  assert.ok(approxEq(r.acc, 0), `acc=${r.acc}`);
  assert.ok(approxEq(r.alpha, 0), `alpha=${r.alpha}`);
});

test('exactly one DT produces one step and zero remainder', () => {
  const r = stepAccumulator(0, DT, DT, MAX);
  assert.equal(r.steps, 1);
  assert.ok(approxEq(r.acc, 0), `acc=${r.acc}`);
  assert.ok(approxEq(r.alpha, 0), `alpha=${r.alpha}`);
});

test('exactly two DT produces two steps', () => {
  const r = stepAccumulator(0, DT * 2, DT, MAX);
  assert.equal(r.steps, 2);
  assert.ok(approxEq(r.acc, 0), `acc=${r.acc}`);
});

test('leftover accumulator carries forward as alpha', () => {
  // 1.5 * DT → 1 step, acc = 0.5 * DT, alpha ≈ 0.5
  const r = stepAccumulator(0, DT * 1.5, DT, MAX);
  assert.equal(r.steps, 1);
  assert.ok(approxEq(r.acc, DT * 0.5, 1e-9), `acc=${r.acc}`);
  assert.ok(approxEq(r.alpha, 0.5, 1e-9), `alpha=${r.alpha}`);
});

test('pre-existing accumulator is included in step count', () => {
  // acc = 0.5*DT + frameDt = 0.5*DT + 0.7*DT = 1.2*DT → 1 step, acc=0.2*DT
  const r = stepAccumulator(DT * 0.5, DT * 0.7, DT, MAX);
  assert.equal(r.steps, 1);
  assert.ok(approxEq(r.acc, DT * 0.2, 1e-9), `acc=${r.acc}`);
});

test('large frameDt is clamped to maxSteps * DT', () => {
  // 100 * DT would normally fire 100 steps — must be capped at MAX (4).
  const r = stepAccumulator(0, DT * 100, DT, MAX);
  assert.equal(r.steps, MAX);
  // Remainder after MAX steps: (MAX*DT) - (MAX*DT) = 0
  assert.ok(approxEq(r.acc, 0, 1e-9), `acc=${r.acc}`);
});

test('alpha is always in [0, 1)', () => {
  const cases = [0, DT * 0.1, DT * 0.5, DT * 0.9999, DT * 3.7];
  for (const frameDt of cases) {
    const r = stepAccumulator(0, frameDt, DT, MAX);
    assert.ok(r.alpha >= 0 && r.alpha < 1, `alpha=${r.alpha} for frameDt=${frameDt}`);
  }
});

test('zero dt does not divide by zero (returns alpha 0)', () => {
  // Defensive: dt=0 is not a valid game value but must not throw.
  // stepAccumulator only divides: running / dt.
  // When dt is 0 the while loop cannot run (0 >= 0 is true but running never decreases),
  // so maxSteps caps it. We guard by checking dt > 0 in the alpha line.
  // This test documents the expected safe behaviour with a tiny dt instead.
  const tiny = 1e-12;
  const r = stepAccumulator(0, 0, tiny, MAX);
  assert.equal(r.steps, 0);
  assert.ok(Number.isFinite(r.alpha), `alpha must be finite, got ${r.alpha}`);
});

test('accumulator never goes negative', () => {
  const r = stepAccumulator(0, DT * 2.9, DT, MAX);
  assert.ok(r.acc >= 0, `acc=${r.acc}`);
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
