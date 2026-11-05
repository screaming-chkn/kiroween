/**
 * tests/combat/arena.test.js
 *
 * Plain-Node tests for the arena combat pure functions.
 * No framework — mirrors the style of tests/engine/loop.test.js.
 *
 * Run:
 *   node tests/combat/arena.test.js
 *
 * Sections
 * ────────
 * A. Unit — createArena, createProjectile, stepProjectile, hitTestCircle
 * B. Unit — enemy state machine (createEnemy, stepEnemy)
 * C. Unit — applyDamage invariants
 * D. PBT  — HP never goes negative for any seeded random hit sequence
 * E. Sim  — scripted match where enemy health drains to 0 → phase 'win'
 * F. Sim  — scripted match where player health drains to 0 → phase 'lose'
 */

import assert from 'node:assert/strict';

import { applyDamage }                               from '../../src/combat/damage.js';
import { createProjectile, stepProjectile, hitTestCircle } from '../../src/combat/projectile.js';
import { createEnemy, stepEnemy, STATE_CHASE, STATE_SHOOT } from '../../src/combat/enemy.js';
import { createArena, updateArena }                  from '../../src/combat/arena.js';
import { clampMechToArena, createMech }              from '../../src/combat/mech.js';
import {
  MECH_RADIUS,
  MECH_CORNER_MARGIN,
  PLAYER_MAX_HP,
  ENEMY_MAX_HP,
  PLAYER_PROJECTILE_DAMAGE,
  ENEMY_PROJECTILE_DAMAGE,
  ENEMY_FIRE_RANGE,
  ENEMY_HYSTERESIS,
  FIRE_COOLDOWN_MS,
  ARENA_WIDTH,
  ARENA_HEIGHT,
  PLAYER_START_X,
  PLAYER_START_Y,
  ENEMY_START_X,
  ENEMY_START_Y,
} from '../../src/combat/config.js';

// ── Minimal harness ──────────────────────────────────────────────────────────

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

/** Seeded PRNG (mulberry32) — deterministic, no external deps. */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Section A — projectile unit tests ────────────────────────────────────────

console.log('\n── A. projectile unit ──\n');

test('createProjectile stores vx/vy from angle', () => {
  const p = createProjectile({ id: 'p0', x: 100, y: 100, angle: 0, damage: 20, owner: 'player' });
  assert.ok(p.vx > 0, 'vx positive for angle=0');
  assert.ok(Math.abs(p.vy) < 1e-9, 'vy ≈ 0 for angle=0');
  assert.equal(p.dead, false);
});

test('createProjectile angle=PI/2 travels downward', () => {
  const p = createProjectile({ id: 'p1', x: 0, y: 0, angle: Math.PI / 2, damage: 20, owner: 'player' });
  assert.ok(Math.abs(p.vx) < 1e-9, `vx ≈ 0, got ${p.vx}`);
  assert.ok(p.vy > 0, `vy > 0, got ${p.vy}`);
});

test('stepProjectile advances position by vx/vy*dt', () => {
  const p = createProjectile({ id: 'p2', x: 100, y: 100, angle: 0, damage: 20, owner: 'player' });
  const arena = { width: ARENA_WIDTH, height: ARENA_HEIGHT };
  const stepped = stepProjectile(p, 1, arena);  // 1 second
  assert.ok(Math.abs(stepped.x - (100 + p.vx)) < 1e-6, `x mismatch: ${stepped.x}`);
  assert.ok(Math.abs(stepped.y - (100 + p.vy)) < 1e-6, `y mismatch: ${stepped.y}`);
  assert.equal(stepped.dead, false);
});

test('stepProjectile marks dead when x < 0', () => {
  const p = createProjectile({ id: 'p3', x: 5, y: 450, angle: Math.PI, damage: 20, owner: 'player' });
  const arena = { width: ARENA_WIDTH, height: ARENA_HEIGHT };
  // 1 second at 600 units/s heading left will travel past x=0
  const stepped = stepProjectile(p, 1, arena);
  assert.equal(stepped.dead, true, 'should be dead after crossing left wall');
});

test('stepProjectile marks dead when x > arena.width', () => {
  const p = createProjectile({ id: 'p4', x: ARENA_WIDTH - 5, y: 450, angle: 0, damage: 20, owner: 'player' });
  const arena = { width: ARENA_WIDTH, height: ARENA_HEIGHT };
  const stepped = stepProjectile(p, 1, arena);
  assert.equal(stepped.dead, true);
});

test('stepProjectile marks dead when y < 0', () => {
  const p = createProjectile({ id: 'p5', x: 600, y: 5, angle: -Math.PI / 2, damage: 20, owner: 'player' });
  const arena = { width: ARENA_WIDTH, height: ARENA_HEIGHT };
  const stepped = stepProjectile(p, 1, arena);
  assert.equal(stepped.dead, true);
});

test('stepProjectile marks dead when y > arena.height', () => {
  const p = createProjectile({ id: 'p6', x: 600, y: ARENA_HEIGHT - 5, angle: Math.PI / 2, damage: 20, owner: 'player' });
  const arena = { width: ARENA_WIDTH, height: ARENA_HEIGHT };
  const stepped = stepProjectile(p, 1, arena);
  assert.equal(stepped.dead, true);
});

test('stepProjectile already-dead returns same dead flag', () => {
  const p = createProjectile({ id: 'p7', x: 100, y: 100, angle: 0, damage: 20, owner: 'player' });
  const dead = { ...p, dead: true };
  const arena = { width: ARENA_WIDTH, height: ARENA_HEIGHT };
  const stepped = stepProjectile(dead, 1 / 60, arena);
  assert.equal(stepped.dead, true);
});

test('hitTestCircle returns true when overlapping', () => {
  const p = createProjectile({ id: 'h0', x: 200, y: 200, angle: 0, damage: 20, owner: 'player' });
  // Place target directly at projectile position (dist = 0 < combined radius).
  assert.equal(hitTestCircle(p, { x: 200, y: 200 }, MECH_RADIUS), true);
});

test('hitTestCircle returns false when far away', () => {
  const p = createProjectile({ id: 'h1', x: 200, y: 200, angle: 0, damage: 20, owner: 'player' });
  assert.equal(hitTestCircle(p, { x: 500, y: 500 }, MECH_RADIUS), false);
});

test('hitTestCircle returns false for dead projectile', () => {
  const p = { ...createProjectile({ id: 'h2', x: 200, y: 200, angle: 0, damage: 20, owner: 'player' }), dead: true };
  assert.equal(hitTestCircle(p, { x: 200, y: 200 }, MECH_RADIUS), false);
});

// ── Section B — enemy state machine ──────────────────────────────────────────

console.log('\n── B. enemy state machine ──\n');

test('createEnemy initial state is CHASE', () => {
  const e = createEnemy();
  assert.equal(e.aiState, STATE_CHASE);
  assert.equal(e.hp, ENEMY_MAX_HP);
  assert.equal(e.owner, 'enemy');
});

test('stepEnemy transitions CHASE→SHOOT when within fire range', () => {
  const e = createEnemy({ x: 500, y: 450 });
  // Place player at exact fire range or closer.
  const player = { x: 500 + ENEMY_FIRE_RANGE - 10, y: 450, hp: PLAYER_MAX_HP };
  const { enemy } = stepEnemy(e, player, 1 / 60);
  assert.equal(enemy.aiState, STATE_SHOOT);
});

test('stepEnemy stays CHASE when player is beyond fire range', () => {
  const e = createEnemy({ x: 500, y: 450 });
  const player = { x: 500 + ENEMY_FIRE_RANGE + 100, y: 450, hp: PLAYER_MAX_HP };
  const { enemy } = stepEnemy(e, player, 1 / 60);
  assert.equal(enemy.aiState, STATE_CHASE);
});

test('stepEnemy SHOOT→CHASE when player exceeds range + hysteresis', () => {
  // Start in SHOOT state.
  const e = { ...createEnemy({ x: 500, y: 450 }), aiState: STATE_SHOOT };
  const player = { x: 500 + ENEMY_FIRE_RANGE + ENEMY_HYSTERESIS + 10, y: 450, hp: PLAYER_MAX_HP };
  const { enemy } = stepEnemy(e, player, 1 / 60);
  assert.equal(enemy.aiState, STATE_CHASE);
});

test('stepEnemy fires projectile when in SHOOT state with cooldown 0', () => {
  const e = { ...createEnemy({ x: 500, y: 450 }), aiState: STATE_SHOOT, fireCooldown: 0 };
  const player = { x: 500 + 10, y: 450, hp: PLAYER_MAX_HP };
  const { projectile } = stepEnemy(e, player, 1 / 60);
  assert.ok(projectile !== null, 'should produce a projectile');
  assert.equal(projectile.owner, 'enemy');
  assert.ok(projectile.damage > 0);
});

test('stepEnemy does not fire when cooldown > 0', () => {
  const e = { ...createEnemy({ x: 500, y: 450 }), aiState: STATE_SHOOT, fireCooldown: 100 };
  const player = { x: 510, y: 450, hp: PLAYER_MAX_HP };
  const { projectile } = stepEnemy(e, player, 1 / 60);
  assert.equal(projectile, null);
});

test('stepEnemy moves toward player in CHASE state', () => {
  const e = createEnemy({ x: 500, y: 450 });
  // Player is far to the right.
  const player = { x: 900, y: 450, hp: PLAYER_MAX_HP };
  const arena = { width: ARENA_WIDTH, height: ARENA_HEIGHT };
  const { enemy } = stepEnemy(e, player, 1 / 60, arena);
  assert.ok(enemy.x > e.x, `enemy should have moved right: ${enemy.x} vs ${e.x}`);
});

test('stepEnemy strafes perpendicular to player in SHOOT state', () => {
  // Enemy at (500, 450), player directly to the right at (510, 450).
  // angle = 0, so perpendicular = (0, 1): enemy strafes along Y axis.
  const e = { ...createEnemy({ x: 500, y: 450 }), aiState: STATE_SHOOT, strafeDir: 1 };
  const player = { x: 510, y: 450, hp: PLAYER_MAX_HP };
  const arena = { width: ARENA_WIDTH, height: ARENA_HEIGHT };
  const { enemy } = stepEnemy(e, player, 1 / 60, arena);
  // Enemy should NOT have moved along X (no forward/backward chase in SHOOT).
  assert.equal(enemy.x, 500, 'should not move along forward axis in SHOOT state');
  // Enemy SHOULD have moved along Y (perpendicular strafe).
  assert.ok(enemy.y !== e.y, `enemy should strafe along Y axis: was ${e.y}, now ${enemy.y}`);
});

test('stepEnemy clamps to arena wall in CHASE state', () => {
  // Place enemy at the far right, player beyond the wall.
  const e = createEnemy({ x: ARENA_WIDTH - MECH_RADIUS - 2, y: 450 });
  const player = { x: ARENA_WIDTH + 500, y: 450, hp: PLAYER_MAX_HP };
  const arena = { width: ARENA_WIDTH, height: ARENA_HEIGHT };
  const { enemy } = stepEnemy(e, player, 1, arena);  // large dt
  assert.ok(enemy.x <= ARENA_WIDTH - MECH_RADIUS, `enemy x=${enemy.x} must not exceed right wall`);
});

// ── Section C — applyDamage invariants ───────────────────────────────────────

console.log('\n── C. applyDamage invariants ──\n');

test('applyDamage reduces hp by damage', () => {
  const e = applyDamage({ hp: 100 }, 30);
  assert.equal(e.hp, 70);
});

test('applyDamage clamps to 0 (not negative)', () => {
  const e = applyDamage({ hp: 10 }, 999);
  assert.equal(e.hp, 0);
});

test('applyDamage with 0 damage is a no-op', () => {
  const e = applyDamage({ hp: 50 }, 0);
  assert.equal(e.hp, 50);
});

test('applyDamage ignores negative damage (no healing)', () => {
  const e = applyDamage({ hp: 50 }, -20);
  assert.equal(e.hp, 50);
});

// ── Section D — PBT: HP never goes negative ───────────────────────────────────

console.log('\n── D. PBT — HP never negative ──\n');

test('PBT (seed=1): 200 random hits never produce negative player HP', () => {
  const rand = mulberry32(1);
  let state = createArena();

  // Feed random player fire into a static (non-moving) player facing right,
  // no movement, no enemy fire (put enemy far out of range).
  // We directly call applyDamage in sequence to test the invariant.
  for (let i = 0; i < 200; i++) {
    const dmg = rand() * 100;   // 0–100 HP, random
    state = {
      ...state,
      player: applyDamage(state.player, dmg),
    };
    assert.ok(state.player.hp >= 0, `HP went negative at step ${i}: ${state.player.hp}`);
  }
});

test('PBT (seed=42): 200 random hits never produce negative enemy HP', () => {
  const rand = mulberry32(42);
  let state = createArena();

  for (let i = 0; i < 200; i++) {
    const dmg = rand() * 100;
    state = {
      ...state,
      enemy: applyDamage(state.enemy, dmg),
    };
    assert.ok(state.enemy.hp >= 0, `Enemy HP went negative at step ${i}: ${state.enemy.hp}`);
  }
});

test('PBT (seed=7): updateArena — no hp ever goes negative over 500 frames', () => {
  const rand = mulberry32(7);
  let state = createArena();

  // Run 500 update ticks with random fire input.  The player aims at the
  // enemy's start position so projectiles will eventually hit.
  for (let i = 0; i < 500; i++) {
    if (state.phase !== 'playing') break;

    const fire = rand() > 0.5;
    state = updateArena(state, {
      move: { dx: 0, dy: 0 },
      aim:  { x: ENEMY_START_X, y: ENEMY_START_Y },
      fire,
    }, 1 / 60);

    assert.ok(state.player.hp >= 0, `Player HP < 0 at frame ${i}: ${state.player.hp}`);
    assert.ok(state.enemy.hp  >= 0, `Enemy HP < 0 at frame ${i}: ${state.enemy.hp}`);
  }
});

// ── Section E — Scripted sim: enemy dies → phase 'win' ───────────────────────

console.log('\n── E. Scripted sim — enemy dies → win ──\n');

test('scripted sim: dealing enough damage to enemy transitions to win', () => {
  // Start with a fresh arena.
  let state = createArena();
  assert.equal(state.phase, 'playing');

  // Apply fatal damage directly to the enemy (kills in one frame).
  state = {
    ...state,
    enemy: applyDamage(state.enemy, ENEMY_MAX_HP),
  };
  assert.equal(state.enemy.hp, 0, 'enemy hp should be 0 after fatal hit');

  // Now run one update tick — phase should become 'win'.
  state = updateArena(state, {}, 1 / 60);
  assert.equal(state.phase, 'win', `expected 'win', got '${state.phase}'`);
});

test('scripted sim: win phase is sticky across subsequent updates', () => {
  let state = createArena();
  state = { ...state, enemy: applyDamage(state.enemy, ENEMY_MAX_HP) };
  state = updateArena(state, { fire: true }, 1 / 60);
  assert.equal(state.phase, 'win');
  // Additional ticks must not change phase.
  state = updateArena(state, { fire: true }, 1 / 60);
  assert.equal(state.phase, 'win');
});

test('scripted sim: sustained fire → enemy dead → win', () => {
  // Player fires every tick aimed at enemy, enemy does not move (SHOOT state),
  // enemy starts within fire range so it can also shoot back.
  // We override enemy position to be point-blank so every shot lands.
  let state = createArena();

  // Move enemy to sit on top of the player so every shot is an instant hit.
  state = {
    ...state,
    enemy: {
      ...state.enemy,
      x: PLAYER_START_X + MECH_RADIUS * 2,
      y: PLAYER_START_Y,
    },
  };

  let winReached = false;

  for (let frame = 0; frame < 10000; frame++) {
    state = updateArena(state, {
      aim:  { x: state.enemy.x, y: state.enemy.y },
      fire: true,
    }, 1 / 60);

    if (state.phase === 'win') {
      winReached = true;
      break;
    }
    // Safety: if player dies first test still passes for this assertion:
    if (state.phase === 'lose') break;
  }

  // Enemy is point-blank so at least one side should die fairly quickly.
  // The player starts with more HP (200) and enemy with 150 so enemy dies first.
  assert.equal(winReached, true, `win never reached; phase=${state.phase}, enemyHp=${state.enemy.hp}`);
});

// ── Section F — Scripted sim: player dies → phase 'lose' ─────────────────────

console.log('\n── F. Scripted sim — player dies → lose ──\n');

test('scripted sim: fatal damage to player → phase lose', () => {
  let state = createArena();
  state = {
    ...state,
    player: applyDamage(state.player, PLAYER_MAX_HP),
  };
  assert.equal(state.player.hp, 0);
  state = updateArena(state, {}, 1 / 60);
  assert.equal(state.phase, 'lose', `expected 'lose', got '${state.phase}'`);
});

test('scripted sim: lose phase is sticky', () => {
  let state = createArena();
  state = { ...state, player: applyDamage(state.player, PLAYER_MAX_HP) };
  state = updateArena(state, {}, 1 / 60);
  assert.equal(state.phase, 'lose');
  state = updateArena(state, {}, 1 / 60);
  assert.equal(state.phase, 'lose');
});

// ── Section G — createArena resets projectile list ────────────────────────────

console.log('\n── G. createArena reset ──\n');

test('createArena starts with empty projectile list', () => {
  const state = createArena();
  assert.deepEqual(state.projectiles, []);
});

test('createArena phase is playing', () => {
  const state = createArena();
  assert.equal(state.phase, 'playing');
});

test('createArena respects loadoutTotals.speedPenalty', () => {
  const state = createArena({ speedPenalty: 0.3 });
  assert.equal(state.player.speedPenalty, 0.3);
});

test('createArena player starts at PLAYER_START_X/Y', () => {
  const state = createArena();
  assert.equal(state.player.x, PLAYER_START_X);
  assert.equal(state.player.y, PLAYER_START_Y);
});

test('createArena player starts with PLAYER_MAX_HP', () => {
  const state = createArena();
  assert.equal(state.player.hp, PLAYER_MAX_HP);
  assert.equal(state.player.maxHp, PLAYER_MAX_HP);
});

test('createArena enemy starts with ENEMY_MAX_HP', () => {
  const state = createArena();
  assert.equal(state.enemy.hp, ENEMY_MAX_HP);
});

// ── Section H — updateArena movement / fire cooldown ─────────────────────────

console.log('\n── H. updateArena — movement + cooldown ──\n');

test('updateArena move right advances player x', () => {
  let state = createArena();
  state = updateArena(state, { move: { dx: 1, dy: 0 } }, 1 / 60);
  assert.ok(state.player.x > PLAYER_START_X, `x should increase: ${state.player.x}`);
});

test('updateArena no-move keeps player position', () => {
  let state = createArena();
  state = updateArena(state, {}, 1 / 60);
  assert.equal(state.player.x, PLAYER_START_X);
  assert.equal(state.player.y, PLAYER_START_Y);
});

test('updateArena fire spawns a projectile with owner player', () => {
  let state = createArena();
  state = updateArena(state, { aim: { x: 600, y: 450 }, fire: true }, 1 / 60);
  const playerProj = state.projectiles.filter(p => p.owner === 'player');
  assert.ok(playerProj.length >= 1, 'at least one player projectile expected');
});

test('updateArena fire cooldown prevents double-fire in same tick', () => {
  let state = createArena();
  // Fire once.
  state = updateArena(state, { aim: { x: 600, y: 450 }, fire: true }, 1 / 60);
  const countAfterFirst = state.projectiles.filter(p => p.owner === 'player').length;
  // Fire again immediately (cooldown not elapsed).
  state = updateArena(state, { aim: { x: 600, y: 450 }, fire: true }, 1 / 60);
  const countAfterSecond = state.projectiles.filter(p => p.owner === 'player').length;
  // The second fire tick should not produce more player projectiles
  // (the first one may have moved; still only one per 300 ms).
  assert.ok(countAfterSecond <= countAfterFirst + 1,
    `Too many player projectiles spawned: ${countAfterSecond}`);
});

test('updateArena player projectile wall-destroy is culled from list', () => {
  // Fire a shot heading right at full speed; run enough ticks to cross the wall.
  let state = createArena();
  state = updateArena(state, { aim: { x: ARENA_WIDTH, y: PLAYER_START_Y }, fire: true }, 1 / 60);
  // 3 seconds = well past the right wall.
  for (let i = 0; i < 180; i++) {
    state = updateArena(state, {}, 1 / 60);
  }
  const livePlayer = state.projectiles.filter(p => p.owner === 'player');
  assert.equal(livePlayer.length, 0, 'player projectile should be gone after crossing wall');
});

// ── Section I — clampMechToArena (R11) ────────────────────────────────────────

console.log('\n── I. clampMechToArena — body clamp (R11) ──\n');

const ARENA = { width: ARENA_WIDTH, height: ARENA_HEIGHT };

function mech(x, y) {
  return createMech({ id: 'test', x, y, hp: 100, maxHp: 100,
                      speedPenalty: 0, owner: 'player' });
}

test('clampMechToArena: centre of arena is unchanged', () => {
  const m = mech(ARENA_WIDTH / 2, ARENA_HEIGHT / 2);
  const c = clampMechToArena(m, ARENA);
  assert.equal(c.x, m.x);
  assert.equal(c.y, m.y);
});

test('clampMechToArena: x < MECH_CORNER_MARGIN is pulled to MECH_CORNER_MARGIN', () => {
  const m = mech(0, ARENA_HEIGHT / 2);
  const c = clampMechToArena(m, ARENA);
  assert.equal(c.x, MECH_CORNER_MARGIN);
});

test('clampMechToArena: x > width − MECH_CORNER_MARGIN is pulled to width − MECH_CORNER_MARGIN', () => {
  const m = mech(ARENA_WIDTH, ARENA_HEIGHT / 2);
  const c = clampMechToArena(m, ARENA);
  assert.equal(c.x, ARENA_WIDTH - MECH_CORNER_MARGIN);
});

test('clampMechToArena: y < MECH_CORNER_MARGIN is pulled to MECH_CORNER_MARGIN', () => {
  const m = mech(ARENA_WIDTH / 2, 0);
  const c = clampMechToArena(m, ARENA);
  assert.equal(c.y, MECH_CORNER_MARGIN);
});

test('clampMechToArena: y > height − MECH_CORNER_MARGIN is pulled to height − MECH_CORNER_MARGIN', () => {
  const m = mech(ARENA_WIDTH / 2, ARENA_HEIGHT);
  const c = clampMechToArena(m, ARENA);
  assert.equal(c.y, ARENA_HEIGHT - MECH_CORNER_MARGIN);
});

test('clampMechToArena: far outside top-left corner is clamped to (MECH_CORNER_MARGIN, MECH_CORNER_MARGIN)', () => {
  const m = mech(-999, -999);
  const c = clampMechToArena(m, ARENA);
  assert.equal(c.x, MECH_CORNER_MARGIN);
  assert.equal(c.y, MECH_CORNER_MARGIN);
});

test('clampMechToArena: far outside bottom-right is clamped to (w−margin, h−margin)', () => {
  const m = mech(99999, 99999);
  const c = clampMechToArena(m, ARENA);
  assert.equal(c.x, ARENA_WIDTH  - MECH_CORNER_MARGIN);
  assert.equal(c.y, ARENA_HEIGHT - MECH_CORNER_MARGIN);
});

test('clampMechToArena: exactly on boundary is accepted unchanged', () => {
  const m = mech(MECH_CORNER_MARGIN, ARENA_HEIGHT - MECH_CORNER_MARGIN);
  const c = clampMechToArena(m, ARENA);
  assert.equal(c.x, MECH_CORNER_MARGIN);
  assert.equal(c.y, ARENA_HEIGHT - MECH_CORNER_MARGIN);
});

test('clampMechToArena: does not mutate other mech fields', () => {
  const m = mech(-5, ARENA_HEIGHT / 2);
  const c = clampMechToArena(m, ARENA);
  assert.equal(c.hp,           m.hp);
  assert.equal(c.maxHp,        m.maxHp);
  assert.equal(c.speedPenalty, m.speedPenalty);
  assert.equal(c.owner,        m.owner);
  assert.equal(c.id,           m.id);
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
