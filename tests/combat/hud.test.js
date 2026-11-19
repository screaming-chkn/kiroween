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
  powerPulseAlpha,
  POWER_PULSE_HZ,
  stutterRingFraction,
  STUTTER_RING_STEPS,
} from '../../src/combat/hud.js';
import {
  formatFightClock, topBarCells, topBarLayout, topBarHeight, isNarrowTopBar,
  TOP_BAR_ORDER, TOP_BAR_HP_PLAYER_COLOR, TOP_BAR_HP_HOUND_COLOR, TOP_BAR_FONT, TOP_BAR,
} from '../../src/combat/topBarHud.js';

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

// ── powerPulseAlpha (R12 — Overdraw POWER pulse, ≤ 2 Hz) ──────────────────────

console.log('\nsrc/combat/hud.js — powerPulseAlpha\n');

test('pulse rate is capped at 2 Hz', () => {
  assert.equal(POWER_PULSE_HZ, 2);
});

test('pulse starts at the trough (0) at t = 0', () => {
  assert.ok(approxEq(powerPulseAlpha(0), 0));
});

test('pulse stays within [0, 1] across a full cycle', () => {
  // One 2 Hz cycle is 500 ms; sample finely across two cycles.
  for (let ms = 0; ms <= 1000; ms += 5) {
    const a = powerPulseAlpha(ms);
    assert.ok(a >= 0 && a <= 1, `alpha=${a} at t=${ms}ms`);
  }
});

test('pulse peaks once per cycle at ≤ 2 Hz (peak at 250 ms, 750 ms)', () => {
  // At 2 Hz the cosine peak (bright) lands at half a 500 ms cycle = 250 ms.
  assert.ok(approxEq(powerPulseAlpha(250), 1, 1e-9), `t=250 → ${powerPulseAlpha(250)}`);
  assert.ok(approxEq(powerPulseAlpha(750), 1, 1e-9), `t=750 → ${powerPulseAlpha(750)}`);
  // Troughs back at the cycle boundaries.
  assert.ok(approxEq(powerPulseAlpha(500), 0, 1e-9), `t=500 → ${powerPulseAlpha(500)}`);
  assert.ok(approxEq(powerPulseAlpha(1000), 0, 1e-9), `t=1000 → ${powerPulseAlpha(1000)}`);
});

test('flashes no more than 2 times per second (one peak per cycle)', () => {
  // Count distinct bright peaks (alpha crossing up through 0.99) in 1 second.
  let peaks = 0;
  let wasBright = false;
  for (let ms = 0; ms <= 1000; ms++) {
    const bright = powerPulseAlpha(ms) >= 0.99;
    if (bright && !wasBright) peaks++;
    wasBright = bright;
  }
  assert.ok(peaks <= 2, `expected ≤ 2 peaks/sec, got ${peaks}`);
});

test('a larger requested rate is clamped to 2 Hz', () => {
  // 10 Hz requested must behave exactly like 2 Hz (peak still at 250 ms).
  assert.ok(approxEq(powerPulseAlpha(250, 10), powerPulseAlpha(250, 2), 1e-9));
});

test('non-finite / negative time is treated as 0 (trough)', () => {
  assert.ok(approxEq(powerPulseAlpha(NaN), 0));
  assert.ok(approxEq(powerPulseAlpha(-100), 0));
});

// ── stutterRingFraction (R12 — ring skips on stuttered shots) ─────────────────

console.log('\nsrc/combat/hud.js — stutterRingFraction\n');

test('not stuttering passes the smooth fraction through unchanged', () => {
  assert.ok(approxEq(stutterRingFraction(0.37, false), 0.37));
  assert.ok(approxEq(stutterRingFraction(0.0, false), 0));
  assert.ok(approxEq(stutterRingFraction(1.0, false), 1));
});

test('stuttering snaps the fraction to discrete steps (visible skip)', () => {
  // Default 4 steps → boundaries at 0, .25, .5, .75, 1.
  assert.ok(approxEq(stutterRingFraction(0.10, true), 0));
  assert.ok(approxEq(stutterRingFraction(0.30, true), 0.25));
  assert.ok(approxEq(stutterRingFraction(0.60, true), 0.5));
  assert.ok(approxEq(stutterRingFraction(0.99, true), 0.75));
  assert.ok(approxEq(stutterRingFraction(1.00, true), 1));
});

test('stutter default uses STUTTER_RING_STEPS', () => {
  assert.equal(STUTTER_RING_STEPS, 4);
});

test('result is always within [0, 1] and clamps out-of-range input', () => {
  assert.ok(approxEq(stutterRingFraction(1.5, true), 1));
  assert.ok(approxEq(stutterRingFraction(-0.5, true), 0));
  assert.ok(approxEq(stutterRingFraction(NaN, false), 0));
});

// ── Top strip (HUD C3) ───────────────────────────────────────────────────────

console.log('\nsrc/combat/topBarHud.js\n');

test('formatFightClock: zero-padded MM:SS counting up', () => {
  assert.equal(formatFightClock(0), '00:00');
  assert.equal(formatFightClock(999), '00:00');
  assert.equal(formatFightClock(1000), '00:01');
  assert.equal(formatFightClock(65000), '01:05');
  assert.equal(formatFightClock(600000), '10:00');
  assert.equal(formatFightClock(NaN), '00:00');
  assert.equal(formatFightClock(-5), '00:00');
  assert.equal(formatFightClock(undefined), '00:00');
});

const FIGHT = {
  elapsedMs: 83000,
  player: { hp: 77, maxHp: 140, energy: 50, maxEnergy: 80, powerBalance: 2, fireCooldown: 0 },
  enemy: { hp: 272, maxHp: 440 },
};

test('topBarCells: all cells in order, HP green / HOUND red, timer text', () => {
  const cells = topBarCells(FIGHT, { hauntLv: 3 });
  assert.deepEqual(cells.map(c => c.id), [...TOP_BAR_ORDER]);
  assert.deepEqual([...TOP_BAR_ORDER], ['hp', 'en', 'power', 'ready', 'timer', 'hound', 'lv']);
  const by = Object.fromEntries(cells.map(c => [c.id, c]));
  assert.equal(TOP_BAR_HP_PLAYER_COLOR, '#39FF88');
  assert.equal(TOP_BAR_HP_HOUND_COLOR, '#FF4D5E');
  assert.equal(by.hp.color, TOP_BAR_HP_PLAYER_COLOR);
  assert.equal(by.hound.color, TOP_BAR_HP_HOUND_COLOR);
  assert.ok(by.hp.text.includes('77/140'), by.hp.text);
  assert.ok(by.hound.text.includes('272/440'), by.hound.text);
  assert.ok(by.en.text.includes('50/80'), by.en.text);
  assert.equal(by.timer.text, '01:23');
  assert.equal(by.power.text, 'POWER OK');
  assert.equal(by.lv.text, 'HAUNT LV 3');
  assert.equal(by.ready.text, 'READY');
});

test('topBarCells: stutter and reload read as words, not colour alone', () => {
  const s = topBarCells({ ...FIGHT, player: { ...FIGHT.player, powerBalance: -3, fireCooldown: 150 } });
  const by = Object.fromEntries(s.map(c => [c.id, c]));
  assert.ok(by.power.text.includes('STUTTER'));
  assert.equal(by.power.stutter, true);
  assert.equal(by.ready.text, 'RELOAD');
});

test('topBarCells: narrow drops prefixes so phone cells fit', () => {
  const by = Object.fromEntries(topBarCells(FIGHT, { hauntLv: 2, narrow: true }).map(c => [c.id, c]));
  assert.equal(by.hp.text, '77/140');
  assert.equal(by.hound.text, '272/440');
  assert.equal(by.lv.text, 'LV 2');
});

test('topBarLayout: desktop is one row, order left to right, timer centred', () => {
  const L = topBarLayout(1280, 1);
  assert.equal(L.narrow, false);
  assert.equal(L.rows.length, 1);
  assert.deepEqual(L.cells.map(c => c.id), [...TOP_BAR_ORDER]);
  for (let i = 1; i < L.cells.length; i++) {
    assert.ok(L.cells[i].x >= L.cells[i - 1].x + L.cells[i - 1].w, `cell ${L.cells[i].id} overlaps`);
  }
  const t = L.cells.find(c => c.id === 'timer');
  assert.ok(approxEq(t.x + t.w / 2, 640, 1e-6));
  assert.equal(L.h, TOP_BAR.rowH);
  for (const c of L.cells) assert.ok(c.x >= 0 && c.x + c.w <= 1280);
});

test('topBarLayout: phone is two rows, clears the pause button, includes safe inset', () => {
  assert.equal(isNarrowTopBar(390, 1), true);
  const L = topBarLayout(390 * 3, 3, { insetTop: 10, pauseReserve: TOP_BAR.pauseReserve });
  assert.equal(L.narrow, true);
  assert.equal(L.rows.length, 2);
  assert.equal(L.h, (10 + TOP_BAR.narrowRow0H + TOP_BAR.narrowRow1H) * 3);
  assert.equal(topBarHeight(390 * 3, 3, { insetTop: 10, pauseReserve: TOP_BAR.pauseReserve }), L.h);
  const hound = L.cells.find(c => c.id === 'hound');
  assert.ok(hound.x + hound.w <= (390 - TOP_BAR.pauseReserve) * 3 + 1e-6, 'HOUND HP clear of pause');
  const t = L.cells.find(c => c.id === 'timer');
  assert.ok(approxEq(t.x + t.w / 2, 390 * 3 / 2, 1e-6));
  assert.deepEqual(L.cells.map(c => c.id), [...TOP_BAR_ORDER]);
});

test('top strip font is Orbitron; strip text is at least 14px', () => {
  assert.ok(TOP_BAR_FONT.startsWith('Orbitron'));
  assert.ok(TOP_BAR.fontPx >= 14);
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
