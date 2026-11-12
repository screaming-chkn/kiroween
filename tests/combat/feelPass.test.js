/**
 * tests/combat/feelPass.test.js
 *
 * Expect-style unit tests for the feel 11/5 combat feel pass:
 *
 *   1) Enemy HP: owner GO (11/12) cut ENEMY_MAX_HP 2800 → 1500 (and PLAYER_MAX_HP
 *      300 → 140) for 30–45 s fights. Earlier: feel Tweak GO (11/5) 2920 → 2800 on top
 *      of the LEVER 2 PLAYER_PROJECTILE_DAMAGE 17 → 14 cut. With the widened
 *      dash (DASH_DURATION_MS 180 → 220, burst ≈ 158 wu clearing the ~100 wu
 *      shot hit radius) and the slimmer enemy projectile (radius 9 → 8), a
 *      dash-on-windup player (M3 strafe + dash) WINS with ~20–30% HP left while
 *      a passive strafe-no-dash player (M2) still LOSES on the mean seed — dash
 *      is the lever that tips the duel. Baseline perfect-lead TTK is now ~59 s
 *      (2800/14dmg/0.3s). ENEMY_PROJECTILE_DAMAGE stays 20 so incoming fire
 *      reads as readable pressure, not a punish.
 *   2) Enemy shot windup (~0.45 s) delays the projectile.
 *   3) Real dash on Shift: ~0.22 s burst at 3× speed, cooldown by weight class.
 *   4) Overdraw slows fire rate: shots-per-second drops under overdraw.
 *
 * Plain Node + assert, same harness style as tests/engine/loop.test.js.
 * No browser, no framework.
 *
 *   node tests/combat/feelPass.test.js
 */

import assert from 'node:assert/strict';

import {
  ENEMY_MAX_HP,
  PLAYER_PROJECTILE_DAMAGE,
  ENEMY_SHOT_WINDUP_MS,
  ENEMY_FIRE_RANGE,
  FIRE_COOLDOWN_MS,
  DASH_DURATION_MS,
  DASH_SPEED_MULT,
  DASH_BUFFER_MS,
  DASH_COOLDOWN_MS,
  PLAYER_MAX_HP,
  PLAYER_START_X,
  PLAYER_START_Y,
  ARENA_WIDTH,
  ARENA_HEIGHT,
  dashWeightClass,
  dashCooldownForLoad,
} from '../../src/combat/config.js';
import { createEnemy, stepEnemy, STATE_SHOOT } from '../../src/combat/enemy.js';
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

const DT = 1 / 60;        // fixed timestep used by the game loop
const DT_MS = DT * 1000;  // ≈ 16.667 ms

// ── 1. Enemy HP ──────────────────────────────────────────────────────────────

console.log('\n── 1. Enemy HP & player damage (owner GO LEVER 2) ──\n');

test('PLAYER_PROJECTILE_DAMAGE is 14 (owner GO LEVER 2, was 17)', () => {
  assert.equal(PLAYER_PROJECTILE_DAMAGE, 14);
});

test('ENEMY_MAX_HP is 1500 (owner GO 11/12, was 2800)', () => {
  assert.equal(ENEMY_MAX_HP, 1500);
});

test('PLAYER_MAX_HP is 140 (owner GO 11/12, was 300)', () => {
  assert.equal(PLAYER_MAX_HP, 140);
});

test('createEnemy starts at ENEMY_MAX_HP', () => {
  assert.equal(createEnemy().hp, ENEMY_MAX_HP);
});

// ── 2. Enemy shot windup ──────────────────────────────────────────────────────

console.log('\n── 2. Enemy shot windup ~0.45 s ──\n');

test('ENEMY_SHOT_WINDUP_MS is 450', () => {
  assert.equal(ENEMY_SHOT_WINDUP_MS, 450);
});

test('first SHOOT tick with cooldown 0 starts a windup, no projectile yet', () => {
  const e = { ...createEnemy({ x: 500, y: 450 }), aiState: STATE_SHOOT, fireCooldown: 0 };
  const player = { x: 510, y: 450, hp: PLAYER_MAX_HP };
  const r = stepEnemy(e, player, DT);
  assert.equal(r.projectile, null, 'no projectile on the windup-start tick');
  assert.ok(r.enemy.windupRemainingMs > 0, 'telegraph flag (windupRemainingMs) is set');
});

test('windup delays the shot by ~450 ms (measured)', () => {
  let e = { ...createEnemy({ x: 500, y: 450 }), aiState: STATE_SHOOT, fireCooldown: 0 };
  const player = { x: 510, y: 450, hp: PLAYER_MAX_HP };

  let elapsedMs = 0;
  let fired = false;
  for (let i = 0; i < 120; i++) {
    const r = stepEnemy(e, player, DT);
    e = r.enemy;
    elapsedMs += DT_MS;
    if (r.projectile) { fired = true; break; }
  }

  assert.ok(fired, 'enemy should fire after the windup');
  // The measured span counts the windup-START tick plus the countdown ticks,
  // so it lands ~1 tick above the raw timer. Allow a 2-tick window: this still
  // proves the shot is delayed by ~0.45 s rather than firing instantly.
  const delta = Math.abs(elapsedMs - ENEMY_SHOT_WINDUP_MS);
  console.log(`      measured windup delay ≈ ${elapsedMs.toFixed(1)} ms (target ${ENEMY_SHOT_WINDUP_MS} ms)`);
  assert.ok(delta <= 2 * DT_MS, `windup delay ${elapsedMs}ms should be ≈ ${ENEMY_SHOT_WINDUP_MS}ms`);
  // And it must be clearly NOT instant (at least ~half the windup elapsed).
  assert.ok(elapsedMs >= ENEMY_SHOT_WINDUP_MS * 0.5, 'shot must not fire instantly');
});

test('leaving SHOOT state cancels the windup', () => {
  // Start a windup in SHOOT, then move the player out of range so the enemy
  // transitions back to CHASE: the telegraph must clear.
  let e = { ...createEnemy({ x: 500, y: 450 }), aiState: STATE_SHOOT, fireCooldown: 0 };
  let r = stepEnemy(e, { x: 510, y: 450, hp: PLAYER_MAX_HP }, DT);
  assert.ok(r.enemy.windupRemainingMs > 0, 'windup active after first tick');

  const farPlayer = { x: 500 + ENEMY_FIRE_RANGE + 200, y: 450, hp: PLAYER_MAX_HP };
  r = stepEnemy(r.enemy, farPlayer, DT);
  assert.equal(r.enemy.windupRemainingMs, 0, 'windup cleared when leaving SHOOT');
  assert.equal(r.projectile, null, 'no shot fired when the windup is aborted');
});

// ── 3. Real dash on Shift ───────────────────────────────────────────────────

console.log('\n── 3. Real dash: 0.22 s burst, cooldown by weight class ──\n');

test('dash config: duration 220 ms, 3× speed, 100 ms buffer', () => {
  assert.equal(DASH_DURATION_MS, 220);
  assert.equal(DASH_SPEED_MULT, 3);
  assert.equal(DASH_BUFFER_MS, 100);
});

test('dash cooldown bands: light 2.5 s / mid 3.5 s / heavy 4.5 s', () => {
  assert.equal(DASH_COOLDOWN_MS.light, 2500);
  assert.equal(DASH_COOLDOWN_MS.mid,   3500);
  assert.equal(DASH_COOLDOWN_MS.heavy, 4500);
});

test('dashWeightClass maps loadPct → light/mid/heavy at 80/100 boundaries', () => {
  assert.equal(dashWeightClass(0),   'light');
  assert.equal(dashWeightClass(80),  'light');   // ≤ 80 inclusive
  assert.equal(dashWeightClass(90),  'mid');
  assert.equal(dashWeightClass(100), 'mid');     // ≤ 100 inclusive
  assert.equal(dashWeightClass(110), 'heavy');
});

test('dashCooldownForLoad returns the band cooldown', () => {
  assert.equal(dashCooldownForLoad(50),  2500);  // light
  assert.equal(dashCooldownForLoad(95),  3500);  // mid
  assert.equal(dashCooldownForLoad(112), 4500);  // heavy
});

test('measured dash duration ≈ 0.22 s (burst speed tapers off)', () => {
  // Light build (loadPct 0 → 2.5 s cooldown). Hold DASH + move right from
  // mid-arena so walls never clamp the measurement.
  const start = createArena({ loadPct: 0 }, {});
  let state = {
    ...start,
    player: { ...start.player, x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 },
  };
  const moveRight = { move: { dx: 1, dy: 0 }, dash: true };

  let dashMs = 0;
  let wasDashing = false;
  for (let i = 0; i < 60; i++) {
    state = updateArena(state, moveRight, DT);
    const dashing = state.player.dashRemainingMs > 0;
    if (dashing) dashMs += DT_MS;
    if (wasDashing && !dashing) break;   // burst just ended
    wasDashing = dashing;
  }

  console.log(`      measured dash duration ≈ ${dashMs.toFixed(1)} ms (target ${DASH_DURATION_MS} ms)`);
  // Dash is granted the tick AFTER the press buffers, so allow one extra tick.
  assert.ok(
    Math.abs(dashMs - DASH_DURATION_MS) <= DT_MS + 1e-6,
    `dash lasted ${dashMs}ms, expected ≈ ${DASH_DURATION_MS}ms`,
  );
});

test('dash moves the player 3× further than a normal step', () => {
  const mkState = loadPct => {
    const s = createArena({ loadPct }, {});
    return { ...s, player: { ...s.player, x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 } };
  };

  // Normal: one move tick, no dash.
  const normal0 = mkState(0);
  const normal1 = updateArena(normal0, { move: { dx: 1, dy: 0 } }, DT);
  const normalStep = normal1.player.x - normal0.player.x;

  // Dash: first tick buffers + starts the dash burst (3× speed).
  const dash0 = mkState(0);
  const dash1 = updateArena(dash0, { move: { dx: 1, dy: 0 }, dash: true }, DT);
  const dashStep = dash1.player.x - dash0.player.x;

  console.log(`      normal step ${normalStep.toFixed(2)} wu · dash step ${dashStep.toFixed(2)} wu`);
  assert.ok(
    Math.abs(dashStep - normalStep * DASH_SPEED_MULT) < 1e-6,
    `dash step ${dashStep} should be ${DASH_SPEED_MULT}× normal ${normalStep}`,
  );
});

test('dash goes on cooldown and cannot immediately re-trigger', () => {
  const s = createArena({ loadPct: 0 }, {});
  let state = { ...s, player: { ...s.player, x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 } };

  // Trigger a dash.
  state = updateArena(state, { move: { dx: 1, dy: 0 }, dash: true }, DT);
  assert.ok(state.player.dashCooldownMs > 0, 'cooldown armed after dash');
  const cd = state.player.dashCooldownMs;
  assert.ok(
    Math.abs(cd - DASH_COOLDOWN_MS.light) <= DT_MS + 1e-6,
    `light-build cooldown ${cd}ms ≈ ${DASH_COOLDOWN_MS.light}ms`,
  );

  // Run out the dash burst, then try to dash again while still on cooldown.
  for (let i = 0; i < 20; i++) {
    state = updateArena(state, { move: { dx: 1, dy: 0 }, dash: true }, DT);
  }
  // Still on cooldown (20 ticks ≈ 333 ms « 2500 ms) → must NOT be mid-burst
  // from a second dash. dashRemainingMs should be 0 (first burst long over).
  assert.equal(state.player.dashRemainingMs, 0, 'no second dash while on cooldown');
  assert.ok(state.player.dashCooldownMs > 0, 'cooldown still counting down');
});

test('heavy build has a longer dash cooldown than a light build', () => {
  const light = createArena({ loadPct: 0 },   {});
  const heavy = createArena({ loadPct: 112 }, {});
  const lightDash = updateArena(
    { ...light, player: { ...light.player, x: 600, y: 450 } },
    { move: { dx: 1, dy: 0 }, dash: true }, DT,
  );
  const heavyDash = updateArena(
    { ...heavy, player: { ...heavy.player, x: 600, y: 450 } },
    { move: { dx: 1, dy: 0 }, dash: true }, DT,
  );
  assert.ok(
    heavyDash.player.dashCooldownMs > lightDash.player.dashCooldownMs,
    `heavy cooldown ${heavyDash.player.dashCooldownMs} should exceed light ${lightDash.player.dashCooldownMs}`,
  );
});

// ── 4. Overdraw slows fire rate ───────────────────────────────────────────────

console.log('\n── 4. Overdraw slows fire rate ──\n');

/**
 * Count shots fired over `frames` ticks while holding fire, then convert to
 * shots-per-second. A "shot" is detected when the player fire cooldown goes
 * from ready (0) to armed (> 0) across an update — robust against projectile
 * culling (projectiles leave the arena and disappear from the list).
 */
function measureShotsPerSecond(loadoutTotals, frames = 600) {
  let state = createArena(loadoutTotals, {});
  // Aim straight up so player shots fly to the top wall and never hit the
  // enemy — this isolates the fire rate from the match outcome. Guard against
  // the phase leaving 'playing' (which would freeze the cooldown).
  const aimUp = { fire: true, aim: { x: state.player.x, y: 0 } };
  let shots = 0;
  let ticks = 0;
  for (let i = 0; i < frames; i++) {
    if (state.phase !== 'playing') break;
    const before = state.player.fireCooldown;
    state = updateArena(state, aimUp, DT);
    const after = state.player.fireCooldown;
    ticks++;
    // Fired this tick: the cooldown jumped UP (reset to its full value) rather
    // than ticking down. This is robust regardless of the exact pre-fire value.
    if (after > before) shots++;
  }
  const seconds = ticks * DT;
  return shots / seconds;
}

test('overdrawPenaltyPct feeds the fire-rate multiplier (balanced build = 1×)', () => {
  // Balanced: powerOut ≥ powerDraw → no penalty → fireCooldownMult 1.
  const balanced = createArena({ powerOut: 10, powerDraw: 10 }, {});
  assert.equal(balanced.player.fireCooldownMult, 1);
});

test('overdrawn build sets fireCooldownMult > 1', () => {
  // powerOut 5, powerDraw 10 → penalty 50% → mult 1.5.
  const over = createArena({ powerOut: 5, powerDraw: 10 }, {});
  assert.ok(over.player.fireCooldownMult > 1, `mult ${over.player.fireCooldownMult} should exceed 1`);
  assert.ok(
    Math.abs(over.player.fireCooldownMult - 1.5) < 1e-6,
    `mult should be 1.5, got ${over.player.fireCooldownMult}`,
  );
});

test('overdraw fires strictly slower (shots-per-second) than a balanced build', () => {
  const normalSps = measureShotsPerSecond({ powerOut: 10, powerDraw: 10 });
  const overSps   = measureShotsPerSecond({ powerOut: 5,  powerDraw: 10 });

  console.log(`      normal ≈ ${normalSps.toFixed(2)} shots/s · overdraw ≈ ${overSps.toFixed(2)} shots/s`);
  assert.ok(overSps < normalSps, `overdraw ${overSps} sps should be slower than normal ${normalSps} sps`);
});

test('measured fire rates match the cooldown model (≈ 1000/eff-cooldown)', () => {
  const normalSps = measureShotsPerSecond({ powerOut: 10, powerDraw: 10 });
  // Balanced cooldown is FIRE_COOLDOWN_MS; expected sps ≈ 1000 / FIRE_COOLDOWN_MS.
  const expected = 1000 / FIRE_COOLDOWN_MS;
  // Tolerance: discrete 60 Hz sampling rounds the period up to a whole tick.
  assert.ok(
    Math.abs(normalSps - expected) < expected * 0.15,
    `normal ${normalSps.toFixed(2)} sps should be ≈ ${expected.toFixed(2)} sps`,
  );
});

// ── Summary ────────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
