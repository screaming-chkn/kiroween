/**
 * tests/mech/pbt.test.js
 *
 * Property-based tests for the mech builder (R3, R4).
 * Runnable with Node (no browser, no framework):
 *
 *   node tests/mech/pbt.test.js
 *
 * No npm dependencies — plain Node assert + a tiny seeded PRNG,
 * matching the style of tests/mech/weight.test.js and tests/engine/loop.test.js.
 *
 * Properties:
 *   1. Any legal loadout (all 6 slots filled from PARTS_BY_ID) has load% ≤ 115,
 *      and canDeploy(loadPct) is true.
 *   2. speedPenalty is monotonic non-decreasing across a sorted sweep of
 *      loadPct samples and always stays within [0, 0.45].
 *   3. For any loadout, totals(...).balance === powerOut − powerDraw (identity).
 */

import assert from 'node:assert/strict';
import { speedPenalty, canDeploy } from '../../src/mech/weight.js';
import { totals, SLOTS } from '../../src/mech/loadout.js';
import { PARTS, PARTS_BY_ID } from '../../src/data/parts.js';

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

// ── Part index by slot ────────────────────────────────────────────────────────

/** slot → Part[] available for that slot. */
const PARTS_BY_SLOT = Object.fromEntries(SLOTS.map((slot) => [slot, []]));
for (const part of PARTS) {
  if (PARTS_BY_SLOT[part.slot]) PARTS_BY_SLOT[part.slot].push(part);
}

/** Pick one part id uniformly at random for each of the 6 slots. */
function randomLoadout(rng) {
  const loadout = {};
  for (const slot of SLOTS) {
    const options = PARTS_BY_SLOT[slot];
    const idx = Math.floor(rng() * options.length);
    loadout[slot] = options[idx].id;
  }
  return loadout;
}

// ── Property 1: every legal loadout deploys ──────────────────────────────────

console.log('\nsrc/mech — PBT: legal loadouts deploy (R3)\n');

test('every slot has at least one part to pick from', () => {
  for (const slot of SLOTS) {
    assert.ok(
      PARTS_BY_SLOT[slot].length >= 1,
      `slot ${slot} has no parts`,
    );
  }
});

test('random full loadouts (6 slots filled) have load% ≤ 115 and canDeploy', () => {
  const SAMPLE_COUNT = 1000;
  const SEED         = 0xbadc_0ffe;
  const rng          = makePrng(SEED);

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const loadout = randomLoadout(rng);

    // All 6 slots filled from PARTS_BY_ID.
    for (const slot of SLOTS) {
      assert.ok(PARTS_BY_ID[loadout[slot]], `slot ${slot} not filled from PARTS_BY_ID`);
    }

    const { loadPct } = totals(loadout, PARTS_BY_ID);
    assert.ok(
      loadPct <= 115 + 1e-9,
      `load% exceeded 115: ${loadPct.toFixed(4)} for ${JSON.stringify(loadout)}`,
    );
    assert.ok(
      canDeploy(loadPct),
      `canDeploy false for load% ${loadPct.toFixed(4)}: ${JSON.stringify(loadout)}`,
    );
  }
});

// ── Property 2: penalty monotonic + bounded ──────────────────────────────────

console.log('\nsrc/mech — PBT: speedPenalty monotonic & bounded (R3)\n');

test('speedPenalty is monotonic non-decreasing across a sorted sweep', () => {
  const SAMPLE_COUNT = 800;
  const SEED         = 0x5eed_1234;
  const rng          = makePrng(SEED);

  // Sample load% across the full meaningful range (and a bit past the cap),
  // then sort ascending and check adjacent pairs.
  const loads = Array
    .from({ length: SAMPLE_COUNT }, () => rng() * 130)
    .sort((a, b) => a - b);

  for (let i = 1; i < loads.length; i++) {
    const a  = loads[i - 1];
    const b  = loads[i];
    const pa = speedPenalty(a);
    const pb = speedPenalty(b);
    assert.ok(
      pb >= pa - 1e-12,
      `monotonicity violated: penalty(${a.toFixed(4)})=${pa} > penalty(${b.toFixed(4)})=${pb}`,
    );
  }
});

test('speedPenalty stays within [0, 0.45] for every sample', () => {
  const SAMPLE_COUNT = 800;
  const SEED         = 0x5eed_abcd;
  const rng          = makePrng(SEED);

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const load = rng() * 130;
    const p    = speedPenalty(load);
    assert.ok(
      p >= 0 && p <= 0.45 + 1e-12,
      `out of bounds: penalty(${load.toFixed(4)}) = ${p}`,
    );
  }
});

// ── Property 3: balance identity ──────────────────────────────────────────────

console.log('\nsrc/mech — PBT: balance identity powerOut − powerDraw (R4)\n');

test('totals(...).balance === powerOut − powerDraw for random loadouts', () => {
  const SAMPLE_COUNT = 1000;
  const SEED         = 0xfeed_face;
  const rng          = makePrng(SEED);

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const loadout = randomLoadout(rng);
    const { powerOut, powerDraw, balance } = totals(loadout, PARTS_BY_ID);
    assert.ok(
      approxEq(balance, powerOut - powerDraw),
      `balance identity broken: balance=${balance}, powerOut−powerDraw=${powerOut - powerDraw} for ${JSON.stringify(loadout)}`,
    );
  }
});

test('balance identity holds for partial loadouts (some slots empty)', () => {
  const SAMPLE_COUNT = 500;
  const SEED         = 0x0ddba11;
  const rng          = makePrng(SEED);

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const loadout = randomLoadout(rng);
    // Randomly clear some slots to exercise the skip-missing path.
    for (const slot of SLOTS) {
      if (rng() < 0.3) loadout[slot] = null;
    }
    const { powerOut, powerDraw, balance } = totals(loadout, PARTS_BY_ID);
    assert.ok(
      approxEq(balance, powerOut - powerDraw),
      `balance identity broken: balance=${balance}, powerOut−powerDraw=${powerOut - powerDraw} for ${JSON.stringify(loadout)}`,
    );
  }
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
