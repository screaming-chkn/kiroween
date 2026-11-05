/**
 * tests/combat/enemyShot.test.js
 *
 * Pure-function tests for R10 enemy-shot visuals:
 *   - enemy projectile draw radius > player draw radius (bigger)
 *   - projectileTrail produces a short trail behind the projectile
 *
 * Runnable with Node (no browser, no framework):
 *
 *   node tests/combat/enemyShot.test.js
 *
 * Uses only Node's built-in assert module and ES module imports.
 */

import assert from 'node:assert/strict';
import {
  projectileDrawRadius,
  projectileTrail,
} from '../../src/combat/projectile.js';
import {
  PLAYER_PROJECTILE_RADIUS,
  ENEMY_PROJECTILE_RADIUS,
} from '../../src/combat/config.js';

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

// ── Radius: enemy bigger than player (R10) ───────────────────────────────────

test('enemy projectile radius > player projectile radius (constants)', () => {
  assert.ok(
    ENEMY_PROJECTILE_RADIUS > PLAYER_PROJECTILE_RADIUS,
    `enemy ${ENEMY_PROJECTILE_RADIUS} must exceed player ${PLAYER_PROJECTILE_RADIUS}`,
  );
});

test('projectileDrawRadius("enemy") > projectileDrawRadius("player")', () => {
  const enemy  = projectileDrawRadius('enemy');
  const player = projectileDrawRadius('player');
  assert.ok(enemy > player, `enemy ${enemy} must exceed player ${player}`);
});

test('projectileDrawRadius maps owners to their configured radii', () => {
  assert.equal(projectileDrawRadius('enemy'),  ENEMY_PROJECTILE_RADIUS);
  assert.equal(projectileDrawRadius('player'), PLAYER_PROJECTILE_RADIUS);
});

test('projectileDrawRadius defaults non-enemy owners to player radius', () => {
  assert.equal(projectileDrawRadius(undefined), PLAYER_PROJECTILE_RADIUS);
});

// ── Trail helper (R10 — short trail) ─────────────────────────────────────────

test('projectileTrail returns the requested number of points', () => {
  const proj = { x: 100, y: 100, vx: 600, vy: 0 };
  assert.equal(projectileTrail(proj, 3).length, 3);
  assert.equal(projectileTrail(proj, 5).length, 5);
});

test('projectileTrail points sit behind the projectile along -velocity', () => {
  // Moving +x only: trail points must be at x < proj.x, same y.
  const proj = { x: 100, y: 50, vx: 600, vy: 0 };
  const trail = projectileTrail(proj, 3);
  for (const p of trail) {
    assert.ok(p.x < proj.x, `trail x ${p.x} should be behind proj x ${proj.x}`);
    assert.ok(Math.abs(p.y - proj.y) < 1e-9, `trail y ${p.y} should equal ${proj.y}`);
  }
});

test('projectileTrail points recede monotonically from the head', () => {
  const proj = { x: 0, y: 0, vx: 0, vy: 600 };
  const trail = projectileTrail(proj, 4);
  // Moving +y: each later point should be further in -y.
  for (let i = 1; i < trail.length; i++) {
    assert.ok(
      trail[i].y < trail[i - 1].y,
      `point ${i} (y=${trail[i].y}) should be further back than ${i - 1} (y=${trail[i - 1].y})`,
    );
  }
});

test('projectileTrail is short (spans a small fraction of a second of travel)', () => {
  // With default spacing, the furthest point is < 0.05 s of travel behind.
  const proj = { x: 0, y: 0, vx: 600, vy: 0 };
  const trail = projectileTrail(proj);
  const tail = trail[trail.length - 1];
  const dist = Math.hypot(proj.x - tail.x, proj.y - tail.y);
  const speed = Math.hypot(proj.vx, proj.vy);
  assert.ok(dist / speed < 0.05, `trail spans ${(dist / speed).toFixed(3)}s, expected < 0.05s`);
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
