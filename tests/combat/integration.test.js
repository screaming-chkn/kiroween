/**
 * tests/combat/integration.test.js
 *
 * Integration smoke tests for the arena combat system.
 * Verifies that the arena + actions pipeline runs end-to-end without
 * errors for 300 frames, and that win/lose phases fire correctly under
 * realistic scripted conditions.
 *
 * Run:
 *   node tests/combat/integration.test.js
 *
 * No browser, no framework — plain Node + assert, same style as loop.test.js.
 *
 * Covers task 14 (R6):
 *   - Arena ticks 300 frames without throwing.
 *   - win phase fires when enemy HP reaches 0.
 *   - lose phase fires when player HP reaches 0.
 *   - Phase is sticky (no further updates after termination).
 *   - buildPlayerActions returns the correct shape.
 *   - Camera follow + shake does not throw.
 */

import assert from 'node:assert/strict';

import { createArena, updateArena }     from '../../src/combat/arena.js';
import { buildPlayerActions }           from '../../src/combat/actions.js';
import { createCamera, updateCamera, addTrauma } from '../../src/engine/camera.js';
import { createInputState }             from '../../src/engine/input.js';
import { applyDamage }                  from '../../src/combat/damage.js';
import {
  PLAYER_MAX_HP,
  ENEMY_MAX_HP,
  PLAYER_START_X,
  PLAYER_START_Y,
  ENEMY_START_X,
  ENEMY_START_Y,
  ARENA_WIDTH,
  ARENA_HEIGHT,
} from '../../src/combat/config.js';

// ── Harness ───────────────────────────────────────────────────────────────────

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

// Viewport stub: fixed size matching a common desktop window.
const VP_W = 1280;
const VP_H = 720;

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Simulate a minimal InputState pointing toward a world position.
 * Used to test buildPlayerActions without a DOM.
 *
 * Returns an InputState-compatible object (read-only subset used by actions.js).
 */
function stubInput({ aimX = VP_W / 2, aimY = VP_H / 2, fire = false, moveRight = false } = {}) {
  // Replicate the minimal interface of createInputState().
  const held = new Set();
  if (moveRight) held.add('MOVE_RIGHT');
  if (fire)      held.add('FIRE_PRIMARY');

  return {
    aimX,
    aimY,
    isPressed(action) { return held.has(action); },
    consume()         { return null; },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\n── A. buildPlayerActions shape ──\n');

test('buildPlayerActions returns { move, aim, fire } with no keys held', () => {
  const input  = stubInput();
  const camera = createCamera({ x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2, zoom: 1 });
  const result = buildPlayerActions(input, camera, VP_W, VP_H);

  assert.ok('move' in result,  'result.move must exist');
  assert.ok('aim'  in result,  'result.aim must exist');
  assert.ok('fire' in result,  'result.fire must exist');
  assert.equal(result.move, null, 'move should be null with no keys held');
  assert.equal(result.fire, false, 'fire should be false with LMB not pressed');
});

test('buildPlayerActions move is non-null when MOVE_RIGHT is held', () => {
  const input  = stubInput({ moveRight: true });
  const camera = createCamera({ x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2, zoom: 1 });
  const result = buildPlayerActions(input, camera, VP_W, VP_H);

  assert.notEqual(result.move, null, 'move should be an object');
  assert.equal(result.move.dx, 1, `dx should be 1, got ${result.move?.dx}`);
  assert.equal(result.move.dy, 0, `dy should be 0, got ${result.move?.dy}`);
});

test('buildPlayerActions fire is true when FIRE_PRIMARY is held', () => {
  const input  = stubInput({ fire: true });
  const camera = createCamera({ x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2, zoom: 1 });
  const result = buildPlayerActions(input, camera, VP_W, VP_H);

  assert.equal(result.fire, true);
});

test('buildPlayerActions aim is in world-space (camera-adjusted)', () => {
  // Camera centred on arena centre, zoom 1, no shake.
  // Mouse at canvas centre → should map to arena centre (ARENA_WIDTH/2, ARENA_HEIGHT/2).
  const camera = createCamera({ x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2, zoom: 1 });
  const input  = stubInput({ aimX: VP_W / 2, aimY: VP_H / 2 });
  const result = buildPlayerActions(input, camera, VP_W, VP_H);

  assert.ok(
    Math.abs(result.aim.x - ARENA_WIDTH  / 2) < 0.01,
    `aim.x ≈ ${ARENA_WIDTH / 2}, got ${result.aim.x}`,
  );
  assert.ok(
    Math.abs(result.aim.y - ARENA_HEIGHT / 2) < 0.01,
    `aim.y ≈ ${ARENA_HEIGHT / 2}, got ${result.aim.y}`,
  );
});

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\n── B. Arena ticks 300 frames without error ──\n');

test('300 frames of idle (no actions) completes without throwing', () => {
  let state = createArena();

  for (let i = 0; i < 300; i++) {
    if (state.phase !== 'playing') break;
    state = updateArena(state, {}, 1 / 60);
  }

  // No assertion on phase — enemy may have closed in and fired; just no throw.
  assert.ok(['playing', 'win', 'lose'].includes(state.phase),
    `unexpected phase: ${state.phase}`);
});

test('300 frames with WASD right + fire aimed at enemy does not throw', () => {
  let state  = createArena();
  let camera = createCamera({ x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2, zoom: 1 });
  let shakeX = 0;
  let shakeY = 0;

  for (let i = 0; i < 300; i++) {
    if (state.phase !== 'playing') break;

    const input  = stubInput({ moveRight: true, fire: true, aimX: VP_W, aimY: VP_H / 2 });
    const actions = buildPlayerActions(input, camera, VP_W, VP_H, shakeX, shakeY);

    state = updateArena(state, actions, 1 / 60);

    const result = updateCamera(camera, state.player, 1 / 60);
    camera = result.camera;
    shakeX = result.shakeX;
    shakeY = result.shakeY;
  }

  assert.ok(['playing', 'win', 'lose'].includes(state.phase));
});

test('player and enemy HP are always in [0, maxHp] over 300 frames', () => {
  let state = createArena();

  for (let i = 0; i < 300; i++) {
    if (state.phase !== 'playing') break;
    state = updateArena(state, {
      aim:  { x: ENEMY_START_X, y: ENEMY_START_Y },
      fire: true,
    }, 1 / 60);

    assert.ok(state.player.hp >= 0 && state.player.hp <= PLAYER_MAX_HP,
      `player HP out of range at frame ${i}: ${state.player.hp}`);
    assert.ok(state.enemy.hp >= 0 && state.enemy.hp <= ENEMY_MAX_HP,
      `enemy HP out of range at frame ${i}: ${state.enemy.hp}`);
  }
});

test('projectile list stays finite over 300 frames', () => {
  let state = createArena();

  for (let i = 0; i < 300; i++) {
    if (state.phase !== 'playing') break;
    state = updateArena(state, {
      aim:  { x: ENEMY_START_X, y: ENEMY_START_Y },
      fire: true,
    }, 1 / 60);

    assert.ok(
      state.projectiles.length < 200,
      `projectile list exploded at frame ${i}: ${state.projectiles.length}`,
    );
  }
});

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\n── C. Win / lose transitions ──\n');

test('win fires when enemy is at 1 HP and takes damage', () => {
  let state = createArena();
  // Drain enemy to 1 HP
  state = { ...state, enemy: { ...state.enemy, hp: 1 } };

  // One tick with a shot aimed at the enemy (enemy is close enough to hit
  // after a few more ticks, but applyDamage is deterministic so we directly
  // kill via updateArena after positioning the mech).
  // To guarantee an instant kill: move enemy on top of player so hit lands.
  state = {
    ...state,
    enemy: {
      ...state.enemy,
      x: PLAYER_START_X + 5,
      y: PLAYER_START_Y,
    },
  };

  // Fire for up to 120 frames — at point-blank this hits immediately.
  for (let i = 0; i < 120; i++) {
    state = updateArena(state, {
      aim:  { x: state.enemy.x, y: state.enemy.y },
      fire: true,
    }, 1 / 60);
    if (state.phase === 'win') break;
  }

  assert.equal(state.phase, 'win', `expected win, got ${state.phase}`);
});

test('lose fires when player is at 1 HP and enemy fires', () => {
  let state = createArena();
  // Drain player to 1 HP
  state = { ...state, player: { ...state.player, hp: 1 } };

  // Move enemy point-blank with cooldown cleared so it fires immediately.
  state = {
    ...state,
    enemy: {
      ...state.enemy,
      x:            PLAYER_START_X + 5,
      y:            PLAYER_START_Y,
      fireCooldown: 0,
      aiState:      'SHOOT',
    },
  };

  for (let i = 0; i < 120; i++) {
    state = updateArena(state, {}, 1 / 60);
    if (state.phase === 'lose') break;
  }

  assert.equal(state.phase, 'lose', `expected lose, got ${state.phase}`);
});

test('win phase is sticky — subsequent updates do not change phase', () => {
  let state = createArena();
  state = { ...state, enemy: applyDamage(state.enemy, ENEMY_MAX_HP) };
  state = updateArena(state, {}, 1 / 60); // commit win
  assert.equal(state.phase, 'win');

  for (let i = 0; i < 10; i++) {
    state = updateArena(state, { fire: true }, 1 / 60);
    assert.equal(state.phase, 'win', `phase changed at tick ${i}`);
  }
});

test('lose phase is sticky — subsequent updates do not change phase', () => {
  let state = createArena();
  state = { ...state, player: applyDamage(state.player, PLAYER_MAX_HP) };
  state = updateArena(state, {}, 1 / 60); // commit lose
  assert.equal(state.phase, 'lose');

  for (let i = 0; i < 10; i++) {
    state = updateArena(state, { fire: true }, 1 / 60);
    assert.equal(state.phase, 'lose', `phase changed at tick ${i}`);
  }
});

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\n── D. Camera integration ──\n');

test('updateCamera does not throw over 300 frames', () => {
  let camera = createCamera({
    x: ARENA_WIDTH / 2,
    y: ARENA_HEIGHT / 2,
    zoom: 1,
  });

  let state = createArena();

  for (let i = 0; i < 300; i++) {
    if (state.phase !== 'playing') break;
    state = updateArena(state, { aim: { x: ENEMY_START_X, y: ENEMY_START_Y }, fire: true }, 1 / 60);
    const result = updateCamera(camera, state.player, 1 / 60);
    camera = result.camera;
    assert.ok(Number.isFinite(camera.x),  `camera.x is not finite at frame ${i}`);
    assert.ok(Number.isFinite(camera.y),  `camera.y is not finite at frame ${i}`);
    assert.ok(Number.isFinite(result.shakeX), `shakeX is not finite at frame ${i}`);
    assert.ok(Number.isFinite(result.shakeY), `shakeY is not finite at frame ${i}`);
  }
});

test('addTrauma clamps to 1.0 even with repeated damage bursts', () => {
  let camera = createCamera({ x: 0, y: 0, zoom: 1 });
  for (let i = 0; i < 20; i++) {
    camera = addTrauma(camera, 0.5);
  }
  assert.ok(camera.trauma <= 1.0, `trauma exceeded 1.0: ${camera.trauma}`);
  assert.ok(camera.trauma >= 0.0, `trauma went negative: ${camera.trauma}`);
});

test('reduced-motion camera produces shake ≤ 2px', () => {
  // trauma = 1.0 (maximum), reducedMotion = true.
  // updateCamera with dt=0 → trauma decays by 0 → stays 1.0 → shake uses SHAKE_MAX_REDUCED (2px).
  let camera = createCamera({ x: 0, y: 0, zoom: 1, trauma: 1.0, reducedMotion: true });
  const result = updateCamera(camera, { x: 0, y: 0 }, 0);
  assert.ok(Math.abs(result.shakeX) <= 2, `shakeX too large: ${result.shakeX}`);
  assert.ok(Math.abs(result.shakeY) <= 2, `shakeY too large: ${result.shakeY}`);
});

// ── Summary ────────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
