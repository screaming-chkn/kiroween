/**
 * tests/combat/hitFeedback.test.js
 *
 * Pure-function tests for R10 hit-feedback helpers.
 * Runnable with Node (no browser, no framework):
 *
 *   node tests/combat/hitFeedback.test.js
 *
 * Uses only Node's built-in assert module and ES module imports.
 */

import assert from 'node:assert/strict';
import {
  FLASH_DURATION_MS,
  FLASH_RETRIGGER_MS,
  createFlash,
  shouldCreateFlash,
  maybeCreateFlash,
  stepFlash,
  flashActive,
  flashIntensity,
  FLOAT_LIFETIME_MS,
  FLOAT_RISE,
  createFloatingNumber,
  stepFloatingNumber,
  floatingNumberAlpha,
  KICK_MIN_PX,
  KICK_MAX_PX,
  playerKickAmount,
} from '../../src/combat/hitFeedback.js';

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

// ── Flash duration ────────────────────────────────────────────────────────────

console.log('\nsrc/combat/hitFeedback.js — flash\n');

test('flash duration constant is 80 ms (R10)', () => {
  assert.equal(FLASH_DURATION_MS, 80);
});

test('createFlash starts with full duration remaining', () => {
  const f = createFlash();
  assert.equal(f.remainingMs, 80);
  assert.equal(f.durationMs, 80);
  assert.ok(flashActive(f));
  assert.ok(approxEq(flashIntensity(f), 1), `intensity=${flashIntensity(f)}`);
});

test('createFlash with a bad duration falls back to 80 ms', () => {
  assert.equal(createFlash(0).durationMs, 80);
  assert.equal(createFlash(-5).durationMs, 80);
  assert.equal(createFlash(NaN).durationMs, 80);
});

test('stepFlash decays remaining by dt (seconds → ms)', () => {
  const f  = createFlash();           // 80 ms
  const f1 = stepFlash(f, 0.040);     // 40 ms elapsed
  assert.ok(approxEq(f1.remainingMs, 40), `remaining=${f1.remainingMs}`);
  assert.ok(flashActive(f1));
  assert.ok(approxEq(flashIntensity(f1), 0.5), `intensity=${flashIntensity(f1)}`);
});

test('flash expires after exactly its duration (80 ms)', () => {
  const f  = createFlash();
  const f1 = stepFlash(f, 0.080);     // whole 80 ms
  assert.ok(approxEq(f1.remainingMs, 0), `remaining=${f1.remainingMs}`);
  assert.equal(flashActive(f1), false);
  assert.ok(approxEq(flashIntensity(f1), 0), `intensity=${flashIntensity(f1)}`);
});

test('stepFlash never goes negative past the duration', () => {
  const f  = createFlash();
  const f1 = stepFlash(f, 1.0);       // way past 80 ms
  assert.equal(f1.remainingMs, 0);
  assert.equal(flashActive(f1), false);
});

test('stepFlash is pure (does not mutate the input)', () => {
  const f = createFlash();
  stepFlash(f, 0.040);
  assert.equal(f.remainingMs, 80);
});

// ── Flash re-trigger rate limit (R10 flicker fix) ────────────────────────────

console.log('\nsrc/combat/hitFeedback.js — flash re-trigger rate limit\n');

test('retrigger window constant is 500 ms', () => {
  assert.equal(FLASH_RETRIGGER_MS, 500);
});

test('shouldCreateFlash always allows when there is no existing flash', () => {
  assert.equal(shouldCreateFlash(null, 0), true);
  assert.equal(shouldCreateFlash(undefined, 1234), true);
});

test('shouldCreateFlash allows when existing flash has no start time', () => {
  // A flash without a finite startedAtMs cannot be rate-limited → allow.
  assert.equal(shouldCreateFlash({}, 100), true);
  assert.equal(shouldCreateFlash({ startedAtMs: NaN }, 100), true);
});

test('shouldCreateFlash refuses within 500 ms of startedAtMs', () => {
  const flash = createFlash(FLASH_DURATION_MS, 1000); // started at t=1000 ms
  assert.equal(shouldCreateFlash(flash, 1000), false); // same instant
  assert.equal(shouldCreateFlash(flash, 1250), false); // 250 ms later
  assert.equal(shouldCreateFlash(flash, 1499), false); // 499 ms later
});

test('shouldCreateFlash allows after ≥ 500 ms have elapsed', () => {
  const flash = createFlash(FLASH_DURATION_MS, 1000);
  assert.equal(shouldCreateFlash(flash, 1500), true); // exactly 500 ms
  assert.equal(shouldCreateFlash(flash, 2000), true); // well past
});

test('maybeCreateFlash returns a fresh flash stamped with nowMs when allowed', () => {
  const fresh = maybeCreateFlash(null, 1234);
  assert.equal(fresh.remainingMs, FLASH_DURATION_MS);
  assert.equal(fresh.durationMs, FLASH_DURATION_MS);
  assert.equal(fresh.startedAtMs, 1234);
  assert.ok(flashActive(fresh));
});

test('maybeCreateFlash keeps the existing flash unchanged inside the window', () => {
  const existing = createFlash(FLASH_DURATION_MS, 1000);
  const result = maybeCreateFlash(existing, 1200); // only 200 ms later
  assert.equal(result, existing);                  // same object, not re-triggered
  assert.equal(result.startedAtMs, 1000);
});

test('maybeCreateFlash re-triggers once the window has passed', () => {
  const existing = createFlash(FLASH_DURATION_MS, 1000);
  const result = maybeCreateFlash(existing, 1600); // 600 ms later
  assert.notEqual(result, existing);
  assert.equal(result.startedAtMs, 1600);
  assert.equal(result.remainingMs, FLASH_DURATION_MS);
});

// ── Floating damage number spawn / step ─────────────────────────────────────

console.log('\nsrc/combat/hitFeedback.js — floating number\n');

test('createFloatingNumber captures position, amount, and defaults', () => {
  const fn = createFloatingNumber({ x: 100, y: 200, amount: 20 });
  assert.equal(fn.x, 100);
  assert.equal(fn.y, 200);
  assert.equal(fn.startY, 200);
  assert.equal(fn.amount, 20);
  assert.equal(fn.ageMs, 0);
  assert.equal(fn.lifetimeMs, FLOAT_LIFETIME_MS);
  assert.equal(fn.rise, FLOAT_RISE);
  assert.equal(fn.dead, false);
  assert.ok(approxEq(floatingNumberAlpha(fn), 1), `alpha=${floatingNumberAlpha(fn)}`);
});

test('stepFloatingNumber rises (y decreases) and ages', () => {
  const fn  = createFloatingNumber({ x: 0, y: 100, amount: 15, lifetimeMs: 1000, rise: 40 });
  const fn1 = stepFloatingNumber(fn, 0.5);   // half life
  assert.ok(approxEq(fn1.ageMs, 500), `age=${fn1.ageMs}`);
  // Risen half of 40 wu upward → y = 100 - 20 = 80.
  assert.ok(approxEq(fn1.y, 80), `y=${fn1.y}`);
  assert.equal(fn1.dead, false);
  assert.ok(approxEq(floatingNumberAlpha(fn1), 0.5), `alpha=${floatingNumberAlpha(fn1)}`);
});

test('floating number reaches full rise and dies at end of life', () => {
  const fn  = createFloatingNumber({ x: 0, y: 100, amount: 15, lifetimeMs: 1000, rise: 40 });
  const fn1 = stepFloatingNumber(fn, 1.0);   // whole life
  assert.ok(approxEq(fn1.y, 60), `y=${fn1.y}`);      // 100 - 40
  assert.ok(approxEq(fn1.ageMs, 1000), `age=${fn1.ageMs}`);
  assert.equal(fn1.dead, true);
  assert.ok(approxEq(floatingNumberAlpha(fn1), 0), `alpha=${floatingNumberAlpha(fn1)}`);
});

test('age is clamped to lifetime (overshoot does not exceed)', () => {
  const fn  = createFloatingNumber({ x: 0, y: 100, amount: 15, lifetimeMs: 1000, rise: 40 });
  const fn1 = stepFloatingNumber(fn, 5.0);   // massive overshoot
  assert.equal(fn1.ageMs, 1000);
  assert.ok(approxEq(fn1.y, 60), `y=${fn1.y}`);      // never past full rise
  assert.equal(fn1.dead, true);
});

test('stepFloatingNumber is pure (does not mutate the input)', () => {
  const fn = createFloatingNumber({ x: 0, y: 100, amount: 15 });
  stepFloatingNumber(fn, 0.1);
  assert.equal(fn.ageMs, 0);
  assert.equal(fn.y, 100);
});

// ── Player screen kick under reduced motion ─────────────────────────────────

console.log('\nsrc/combat/hitFeedback.js — player kick\n');

test('kick is OFF (0 px) under reduced motion (R10 / closes task 13)', () => {
  assert.equal(playerKickAmount(true), 0);
  assert.equal(playerKickAmount(true, 1), 0);
  assert.equal(playerKickAmount(true, 0.5), 0);
});

test('kick is within the 2–4 px band when motion is allowed', () => {
  const full = playerKickAmount(false);          // default intensity = 1
  assert.ok(full >= KICK_MIN_PX && full <= KICK_MAX_PX, `full=${full}`);
  assert.equal(full, KICK_MAX_PX);               // default is a full 4 px

  const half = playerKickAmount(false, 0.5);     // midpoint of the band
  assert.ok(approxEq(half, 3), `half=${half}`);  // 2 + (4-2)*0.5 = 3

  const min = playerKickAmount(false, 0);
  assert.equal(min, KICK_MIN_PX);                // 2 px floor
});

test('kick intensity is clamped to [0,1]', () => {
  assert.equal(playerKickAmount(false, -1), KICK_MIN_PX);
  assert.equal(playerKickAmount(false, 5),  KICK_MAX_PX);
  assert.equal(playerKickAmount(false, NaN), KICK_MAX_PX); // non-finite → full
});

test('kick band constants are 2 and 4 px', () => {
  assert.equal(KICK_MIN_PX, 2);
  assert.equal(KICK_MAX_PX, 4);
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
