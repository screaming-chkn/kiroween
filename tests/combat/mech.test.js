/**
 * tests/combat/mech.test.js
 *
 * Pure-function tests for src/combat/mech.js.
 * Runnable with Node (no browser, no framework):
 *
 *   node tests/combat/mech.test.js
 *
 * Uses only Node's built-in assert module and ES module imports.
 */

import assert from 'node:assert/strict';
import { createMech, moveMech, aimMech, clampMechToArena } from '../../src/combat/mech.js';
import { MECH_RADIUS, MECH_CORNER_MARGIN } from '../../src/combat/config.js';

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

/** Helper: create a default mech at a given position. */
function mech(x, y, opts = {}) {
  return createMech({
    id:           opts.id   ?? 'test',
    x,
    y,
    hp:           opts.hp   ?? 100,
    maxHp:        opts.maxHp ?? 100,
    speedPenalty: opts.speedPenalty ?? 0,
    owner:        opts.owner ?? 'player',
  });
}

const ARENA = { width: 1200, height: 900 };

// ── createMech ────────────────────────────────────────────────────────────────

console.log('\nsrc/combat/mech.js — createMech\n');

test('createMech stores supplied fields', () => {
  const m = createMech({
    id: 'p1', x: 100, y: 200, hp: 300, maxHp: 300,
    speedPenalty: 0.2, owner: 'player',
  });
  assert.equal(m.id,           'p1');
  assert.equal(m.x,            100);
  assert.equal(m.y,            200);
  assert.equal(m.hp,           300);
  assert.equal(m.maxHp,        300);
  assert.equal(m.speedPenalty, 0.2);
  assert.equal(m.owner,        'player');
});

test('createMech defaults angle and fireCooldown to 0', () => {
  const m = mech(0, 0);
  assert.equal(m.angle,        0);
  assert.equal(m.fireCooldown, 0);
});

// ── moveMech ──────────────────────────────────────────────────────────────────

console.log('\nsrc/combat/mech.js — moveMech\n');

test('moveMech zero direction returns same position', () => {
  const m = mech(200, 450);
  const r = moveMech(m, { dx: 0, dy: 0 }, 1 / 60, ARENA);
  assert.equal(r.x, m.x);
  assert.equal(r.y, m.y);
});

test('moveMech moves in the given direction', () => {
  const m = mech(600, 450);
  const r = moveMech(m, { dx: 1, dy: 0 }, 1 / 60, ARENA);
  assert.ok(r.x > 600, `x=${r.x} should have increased`);
  assert.equal(r.y, 450);
});

test('moveMech does not mutate input mech', () => {
  const m = mech(600, 450);
  moveMech(m, { dx: 1, dy: 0 }, 1 / 60, ARENA);
  assert.equal(m.x, 600);
});

test('moveMech clamps to MECH_CORNER_MARGIN on all walls', () => {
  // Try to move far past each wall; expect clamp at MECH_CORNER_MARGIN.
  const margin = MECH_CORNER_MARGIN;

  // Left wall
  const left = moveMech(mech(margin, 450), { dx: -1, dy: 0 }, 10, ARENA);
  assert.equal(left.x, margin, `left.x=${left.x}`);

  // Right wall
  const right = moveMech(mech(ARENA.width - margin, 450), { dx: 1, dy: 0 }, 10, ARENA);
  assert.equal(right.x, ARENA.width - margin, `right.x=${right.x}`);

  // Top wall
  const top = moveMech(mech(600, margin), { dx: 0, dy: -1 }, 10, ARENA);
  assert.equal(top.y, margin, `top.y=${top.y}`);

  // Bottom wall
  const bottom = moveMech(mech(600, ARENA.height - margin), { dx: 0, dy: 1 }, 10, ARENA);
  assert.equal(bottom.y, ARENA.height - margin, `bottom.y=${bottom.y}`);
});

test('moveMech MECH_CORNER_MARGIN > MECH_RADIUS (body always inside)', () => {
  assert.ok(
    MECH_CORNER_MARGIN > MECH_RADIUS,
    `MECH_CORNER_MARGIN(${MECH_CORNER_MARGIN}) must be > MECH_RADIUS(${MECH_RADIUS})`,
  );
});

test('moveMech diagonal speed equals cardinal (normalisation)', () => {
  const m    = mech(600, 450);
  const diag = moveMech(m, { dx: 1, dy: 1 }, 1 / 60, ARENA);
  const card = moveMech(m, { dx: 1, dy: 0 }, 1 / 60, ARENA);
  // Distance from start should be the same
  const distDiag = Math.hypot(diag.x - 600, diag.y - 450);
  const distCard = Math.hypot(card.x - 600, card.y - 450);
  assert.ok(Math.abs(distDiag - distCard) < 1e-6,
    `diag dist ${distDiag} ≠ card dist ${distCard}`);
});

// ── aimMech ───────────────────────────────────────────────────────────────────

console.log('\nsrc/combat/mech.js — aimMech\n');

test('aimMech facing right sets angle ≈ 0', () => {
  const m = mech(0, 0);
  const r = aimMech(m, { x: 100, y: 0 });
  assert.ok(Math.abs(r.angle - 0) < 1e-9, `angle=${r.angle}`);
});

test('aimMech facing down sets angle ≈ π/2', () => {
  const m = mech(0, 0);
  const r = aimMech(m, { x: 0, y: 100 });
  assert.ok(Math.abs(r.angle - Math.PI / 2) < 1e-9, `angle=${r.angle}`);
});

test('aimMech does not mutate input', () => {
  const m = mech(0, 0);
  const origAngle = m.angle;
  aimMech(m, { x: 100, y: 0 });
  assert.equal(m.angle, origAngle);
});

// ── clampMechToArena ──────────────────────────────────────────────────────────

console.log('\nsrc/combat/mech.js — clampMechToArena\n');

test('clampMechToArena places a mech outside left wall at MECH_CORNER_MARGIN', () => {
  const m = mech(0, 450);
  const r = clampMechToArena(m, ARENA);
  assert.equal(r.x, MECH_CORNER_MARGIN, `x=${r.x}`);
});

test('clampMechToArena places a mech outside right wall at width − MECH_CORNER_MARGIN', () => {
  const m = mech(ARENA.width + 100, 450);
  const r = clampMechToArena(m, ARENA);
  assert.equal(r.x, ARENA.width - MECH_CORNER_MARGIN, `x=${r.x}`);
});

test('clampMechToArena places a mech outside top wall at MECH_CORNER_MARGIN', () => {
  const m = mech(600, 0);
  const r = clampMechToArena(m, ARENA);
  assert.equal(r.y, MECH_CORNER_MARGIN, `y=${r.y}`);
});

test('clampMechToArena places a mech outside bottom wall at height − MECH_CORNER_MARGIN', () => {
  const m = mech(600, ARENA.height + 100);
  const r = clampMechToArena(m, ARENA);
  assert.equal(r.y, ARENA.height - MECH_CORNER_MARGIN, `y=${r.y}`);
});

test('clampMechToArena leaves mech inside arena unchanged', () => {
  const m = mech(600, 450);
  const r = clampMechToArena(m, ARENA);
  assert.equal(r.x, 600);
  assert.equal(r.y, 450);
});

test('clampMechToArena does not mutate input', () => {
  const m = mech(0, 0);
  clampMechToArena(m, ARENA);
  assert.equal(m.x, 0);
  assert.equal(m.y, 0);
});

// HP bar half-width is 80 wu (combatRenderer HP_BAR_W/2 = 160/2).
// Barrel tip is MECH_RADIUS + 30 = 50 wu.
// Both must stay inside arena: margin must be >= 80.
test('MECH_CORNER_MARGIN ≥ 80 (HP bar half-width stays inside wall)', () => {
  assert.ok(MECH_CORNER_MARGIN >= 80,
    `MECH_CORNER_MARGIN=${MECH_CORNER_MARGIN} must be ≥ 80`);
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
