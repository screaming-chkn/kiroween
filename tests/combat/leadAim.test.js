/**
 * tests/combat/leadAim.test.js
 *
 * Expect-style unit tests for the feel-pass (11/5) enemy lead-aim pass, updated for
 * the POINT-lock bug fix:
 *
 *   1) leadAimPoint(ex,ey,px,py,pvx,pvy,speed,leadFrac) returns a world {x,y}
 *      AHEAD of a moving target so a steady strafe gets clipped. A stationary
 *      target → the aim point equals the target's current position.
 *   2) The enemy LOCKS a lead POINT (enemy.lockedAim = {x,y}) when the windup
 *      STARTS, from the player's velocity at lock time.
 *   3) The fired shot flies toward the LOCKED POINT from the enemy's CURRENT
 *      position — even though the enemy keeps strafing during the windup, and
 *      even if the player changes velocity (dash) mid-windup. This is the bug
 *      fix: locking an angle fired from the new strafe position missed; locking
 *      the point makes the shot still head at the predicted point.
 *   4) A stationary player → aim point ≈ player pos, and the shot fired from
 *      wherever the enemy drifted still heads at the player.
 *   5) Cancelling the windup (leaving SHOOT) clears the lock.
 *   6) arena.updateArena threads the player's finite-difference velocity into
 *      the enemy so the locked point leads a strafing player.
 *
 * Plain Node + assert, same harness style as tests/engine/loop.test.js.
 * No browser, no framework.
 *
 *   node tests/combat/leadAim.test.js
 */

import assert from 'node:assert/strict';

import {
  createEnemy,
  stepEnemy,
  leadAimAngle,
  leadAimPoint,
  STATE_SHOOT,
} from '../../src/combat/enemy.js';
import {
  PROJECTILE_SPEED,
  ENEMY_FIRE_RANGE,
  ENEMY_SHOT_WINDUP_MS,
  PLAYER_MAX_HP,
  ARENA_WIDTH,
  ARENA_HEIGHT,
} from '../../src/combat/config.js';
import { createArena, updateArena } from '../../src/combat/arena.js';

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

const DT = 1 / 60;

/** Signed smallest difference between two angles, in (−π, π]. */
function angleDelta(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// ── 1. leadAimPoint leads a moving target ─────────────────────────────────────

console.log('\n── 1. leadAimPoint leads a moving target ──\n');

test('leadAimPoint biases ahead of a target strafing +y', () => {
  // Enemy at (0,0); player 300 wu to the right strafing "down" (+y) at 90 wu/s.
  // The player's current pos is (300,0); the lead point must sit AHEAD in +y.
  const p = leadAimPoint(0, 0, 300, 0, 0, 90, PROJECTILE_SPEED);
  assert.ok(p.y > 0, `lead point y ${p.y} should be ahead of the target (>0)`);
  assert.equal(p.x, 300, `lead point x should stay at the target x, got ${p.x}`);
});

test('leadAimPoint leads the correct direction for −y strafe', () => {
  const p = leadAimPoint(0, 0, 300, 0, 0, -90, PROJECTILE_SPEED);
  assert.ok(p.y < 0, `lead point y ${p.y} should be negative for −y strafe`);
});

test('leadAimPoint default leadFrac is 0.8 (partial lead, not full)', () => {
  // Full-lead (1.0) leads further ahead than the 0.8 default, so the 0.8 point
  // sits strictly between the target pos (y=0) and the full-lead point.
  const partial = leadAimPoint(0, 0, 300, 0, 0, 90, PROJECTILE_SPEED);        // 0.8
  const full    = leadAimPoint(0, 0, 300, 0, 0, 90, PROJECTILE_SPEED, 1.0);
  assert.ok(partial.y > 0 && partial.y < full.y,
    `0.8 lead y ${partial.y} should be between 0 and full ${full.y}`);
});

test('leadAimPoint with a stationary player equals the player position', () => {
  const p = leadAimPoint(0, 0, 250, 100, 0, 0, PROJECTILE_SPEED);
  assert.ok(Math.abs(p.x - 250) < 1e-12 && Math.abs(p.y - 100) < 1e-12,
    `stationary lead point ${JSON.stringify(p)} should equal player (250,100)`);
});

test('leadAimPoint tolerates missing velocity (treats as stationary)', () => {
  const p = leadAimPoint(0, 0, 250, 100, undefined, undefined, PROJECTILE_SPEED);
  assert.ok(Math.abs(p.x - 250) < 1e-12 && Math.abs(p.y - 100) < 1e-12,
    `undefined velocity should behave as stationary, got ${JSON.stringify(p)}`);
});

test('leadAimAngle still points toward the leadAimPoint (helpers agree)', () => {
  // The angle helper is retained; its direction must match the point helper.
  const ang = leadAimAngle(0, 0, 300, 0, 0, 90, PROJECTILE_SPEED);
  const p   = leadAimPoint(0, 0, 300, 0, 0, 90, PROJECTILE_SPEED);
  const fromPoint = Math.atan2(p.y - 0, p.x - 0);
  assert.ok(Math.abs(angleDelta(ang, fromPoint)) < 1e-12,
    `leadAimAngle ${ang} should match atan2 of leadAimPoint ${fromPoint}`);
});

// ── 2. The enemy locks a POINT at windup start ───────────────────────────────

console.log('\n── 2. Windup start locks a lead POINT ──\n');

/** Run stepEnemy through a full windup, returning the fired projectile. */
function fireAfterWindup(enemyAtWindupStart, playerDuringWindup) {
  let r = { enemy: enemyAtWindupStart, projectile: null };
  for (let i = 0; i < 120; i++) {
    r = stepEnemy(r.enemy, playerDuringWindup, DT);
    if (r.projectile) return r.projectile;
  }
  return null;
}

test('windup start locks a lead POINT for a strafing player', () => {
  // Enemy at (500,450); player to the right at (700,450) strafing +y at 120.
  const e = { ...createEnemy({ x: 500, y: 450 }), aiState: STATE_SHOOT, fireCooldown: 0 };
  const player = { x: 700, y: 450, hp: PLAYER_MAX_HP, vx: 0, vy: 120 };
  const r = stepEnemy(e, player, DT);
  assert.ok(r.enemy.windupRemainingMs > 0, 'windup active after lock tick');
  // The lock uses the enemy's POST-strafe position on the lock tick, so
  // recompute leadAimPoint with the same positions the lock used.
  assert.ok(r.enemy.lockedAim != null, `lockedAim should be set, got ${r.enemy.lockedAim}`);
  assert.ok(Number.isFinite(r.enemy.lockedAim.x) && Number.isFinite(r.enemy.lockedAim.y),
    `lockedAim coords should be finite, got ${JSON.stringify(r.enemy.lockedAim)}`);
  const expected = leadAimPoint(r.enemy.x, r.enemy.y, 700, 450, 0, 120, PROJECTILE_SPEED);
  assert.ok(Math.abs(r.enemy.lockedAim.x - expected.x) < 1e-9 &&
            Math.abs(r.enemy.lockedAim.y - expected.y) < 1e-9,
    `lockedAim ${JSON.stringify(r.enemy.lockedAim)} should match leadAimPoint ${JSON.stringify(expected)}`);
  // And the lock must LEAD (its y sits ahead of the player's y=450).
  assert.ok(r.enemy.lockedAim.y > 450, 'lock should lead ahead of the player, not aim direct');
});

// ── 3. Fired shot heads at the LOCKED POINT from the CURRENT enemy pos ────────

console.log('\n── 3. Fired shot heads at the locked point from the current pos ──\n');

test('fired projectile heads at the LOCKED POINT from the enemy CURRENT pos', () => {
  // This is the bug-fix assertion. Lock the point on tick 1, then finish the
  // windup. The enemy strafes the whole time, so its firing position differs
  // from the lock-time position. The shot's direction must point from the
  // enemy's FINAL (fire-time) position toward the locked point — NOT the angle
  // computed at lock time from the lock-time position.
  const e = { ...createEnemy({ x: 500, y: 450 }), aiState: STATE_SHOOT, fireCooldown: 0 };
  const lockPlayer = { x: 700, y: 450, hp: PLAYER_MAX_HP, vx: 0, vy: 120 };

  // Tick 1 locks the point.
  const locked = stepEnemy(e, lockPlayer, DT);
  const lockedAim = locked.enemy.lockedAim;
  assert.ok(lockedAim != null, 'point locked at windup start');
  // The angle you'd have locked from the lock-time position (the OLD buggy way).
  const staleAngle = Math.atan2(lockedAim.y - locked.enemy.y, lockedAim.x - locked.enemy.x);

  // Finish the windup while the player sits still so we isolate the enemy's
  // own strafe drift. The shot must still point at the locked POINT.
  const stillPlayer = { x: 700, y: 450, hp: PLAYER_MAX_HP, vx: 0, vy: 0 };
  let r = { enemy: locked.enemy, projectile: null };
  let fireEnemyBefore = locked.enemy;
  for (let i = 0; i < 120; i++) {
    fireEnemyBefore = r.enemy;            // enemy pos entering the firing tick
    r = stepEnemy(r.enemy, stillPlayer, DT);
    if (r.projectile) break;
  }
  const shot = r.projectile;
  assert.ok(shot !== null, 'a projectile should fire after the windup');

  // Shot direction must match atan2(lockedAim - firePos). The projectile spawns
  // at the enemy's fire-time position, so the shot origin == that position.
  const shotAngle = Math.atan2(shot.vy, shot.vx);
  const expectAngle = Math.atan2(lockedAim.y - shot.y, lockedAim.x - shot.x);
  assert.ok(Math.abs(angleDelta(shotAngle, expectAngle)) < 1e-6,
    `shot angle ${shotAngle} should point from fire pos to locked point ${expectAngle}`);

  // And the enemy actually moved during the windup, so the fire-time angle
  // differs from the stale lock-time angle — proving the point-lock fix.
  const moved = Math.hypot(shot.x - locked.enemy.x, shot.y - locked.enemy.y);
  assert.ok(moved > 1e-6, `enemy should have strafed during windup, moved ${moved}`);
  assert.ok(Math.abs(angleDelta(shotAngle, staleAngle)) > 1e-6,
    'fire-time angle should differ from the stale lock-time angle (point, not angle, locked)');
});

test('locked point is kept even if the player changes velocity mid-windup', () => {
  // Lock against a +y strafe, then the player dashes the other way (−y) and
  // stops. The shot must still head at the point locked at windup start.
  const e = { ...createEnemy({ x: 500, y: 450 }), aiState: STATE_SHOOT, fireCooldown: 0 };
  const lockPlayer = { x: 700, y: 450, hp: PLAYER_MAX_HP, vx: 0, vy: 120 };
  const locked = stepEnemy(e, lockPlayer, DT);
  const lockedAim = locked.enemy.lockedAim;
  assert.ok(lockedAim != null, 'point locked at windup start');

  // Player sits at the SAME spot for the rest of the windup (vy now 0). A fresh
  // lead would aim near-direct; the locked point still leads to +y.
  const stillPlayer = { x: 700, y: 450, hp: PLAYER_MAX_HP, vx: 0, vy: 0 };
  const shot = fireAfterWindup(locked.enemy, stillPlayer);
  assert.ok(shot !== null, 'a projectile should fire after the windup');

  const shotAngle = Math.atan2(shot.vy, shot.vx);
  const expectAngle = Math.atan2(lockedAim.y - shot.y, lockedAim.x - shot.x);
  assert.ok(Math.abs(angleDelta(shotAngle, expectAngle)) < 1e-6,
    `shot ${shotAngle} should follow the locked point ${expectAngle}, not a fresh aim`);
  // Locked point itself must lead ahead of the player in +y (the velocity at lock).
  // (Don't assert shotAngle > 0 — enemy strafe during windup can rotate the
  // fire-time bearing even while still aiming at the locked +y lead point.)
  assert.ok(lockedAim.y > 450 + 1e-3,
    `lockedAim.y ${lockedAim.y} should lead ahead of player y=450`);
});

test('stationary player: shot from wherever the enemy is still heads at the player', () => {
  const e = { ...createEnemy({ x: 500, y: 450 }), aiState: STATE_SHOOT, fireCooldown: 0 };
  const player = { x: 700, y: 450, hp: PLAYER_MAX_HP, vx: 0, vy: 0 };
  // Stationary → lockedAim ≈ player position.
  const r0 = stepEnemy(e, player, DT);
  assert.ok(Math.abs(r0.enemy.lockedAim.x - 700) < 1e-9 &&
            Math.abs(r0.enemy.lockedAim.y - 450) < 1e-9,
    `stationary lock ${JSON.stringify(r0.enemy.lockedAim)} should ≈ player (700,450)`);

  const shot = fireAfterWindup(e, player);
  assert.ok(shot !== null, 'a projectile should fire after the windup');
  // The shot — fired from the enemy's drifted position — must point AT the
  // stationary player (700,450), so the direction from the spawn point lines up.
  const shotAngle = Math.atan2(shot.vy, shot.vx);
  const toPlayer  = Math.atan2(450 - shot.y, 700 - shot.x);
  assert.ok(Math.abs(angleDelta(shotAngle, toPlayer)) < 1e-6,
    `stationary shot ${shotAngle} should head straight at the player ${toPlayer}`);
});

// ── 4. Cancelling the windup clears the lock ─────────────────────────────────

console.log('\n── 4. Leaving SHOOT clears the lock ──\n');

test('leaving SHOOT clears lockedAim and fires nothing', () => {
  const e = { ...createEnemy({ x: 500, y: 450 }), aiState: STATE_SHOOT, fireCooldown: 0 };
  let r = stepEnemy(e, { x: 700, y: 450, hp: PLAYER_MAX_HP, vx: 0, vy: 120 }, DT);
  assert.ok(r.enemy.lockedAim != null, 'lock set during windup');

  // Player runs far out of range → CHASE → windup + lock cancelled.
  const far = { x: 500 + ENEMY_FIRE_RANGE + 300, y: 450, hp: PLAYER_MAX_HP, vx: 0, vy: 0 };
  r = stepEnemy(r.enemy, far, DT);
  assert.equal(r.enemy.windupRemainingMs, 0, 'windup cleared');
  assert.equal(r.enemy.lockedAim, null, 'lock cleared');
  assert.equal(r.projectile, null, 'no shot when the windup is aborted');
});

// ── 5. Arena threads player velocity into the lead lock ──────────────────────

console.log('\n── 5. Arena threads player velocity into the lead lock ──\n');

test('updateArena leads the lock from the player finite-difference velocity', () => {
  // Place player within fire range of the enemy, moving straight up each tick.
  // The enemy should lock a lead POINT that differs from the player's current
  // position because updateArena measured the player's velocity between ticks.
  const base = createArena({}, {});
  let state = {
    ...base,
    player: { ...base.player, x: 800, y: 450 },
    enemy:  { ...base.enemy, x: 1000, y: 450 },
  };

  // Drive the player upward (dy = -1) for a few ticks so velocity is measured
  // and the enemy enters SHOOT + locks its lead.
  let locked = null;
  let playerAtLock = null;
  for (let i = 0; i < 10; i++) {
    state = updateArena(state, { move: { dx: 0, dy: -1 } }, DT);
    if (state.enemy.lockedAim != null) {
      locked = state.enemy.lockedAim;
      playerAtLock = { x: state.player.x, y: state.player.y };
      break;
    }
  }
  assert.ok(locked != null, 'enemy should lock a lead point while chasing a moving player');

  // The player is moving up (−y), so the lead point must sit ABOVE the player's
  // current y (smaller y) — i.e. the lock leads off the player's live position.
  assert.ok(locked.y < playerAtLock.y,
    `locked point y ${locked.y} should lead above the player's y ${playerAtLock.y} for an upward move`);
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
