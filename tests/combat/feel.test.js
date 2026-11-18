/**
 * tests/combat/feel.test.js — M2 game feel: pause freezes ticks, hit-stop
 * timer, shake decay + caps, impact points, spark pool.
 *   node tests/combat/feel.test.js
 */
import assert from 'node:assert/strict';
import {
  gateTick, addHitStop, HITSTOP_HIT_MS, HITSTOP_HURT_MS, HITSTOP_MAX_MS,
  traumaForImpact, TRAUMA, impactsForTick,
  createSparks, spawnSparks, stepSparks, liveSparks, SPARK_POOL_SIZE,
} from '../../src/combat/feel.js';
import { createArena, updateArena } from '../../src/combat/arena.js';
import { createCamera, addTrauma, tickShake, SHAKE_MAX_FULL, SHAKE_MAX_REDUCED } from '../../src/engine/camera.js';
import { HITSTOP_MS as KILL_HITSTOP_MS } from '../../src/ui/killMoment.js';
import { buildPlayerActions } from '../../src/combat/actions.js';
import { createInputState, ACTIONS } from '../../src/engine/input.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); failed++; }
}
console.log('\nsrc/combat/feel.js — pause, hit-stop, shake, sparks\n');

// Drive the sim the way main.js does: gate first, step only when allowed.
function run(state, ticks, g, actions = { fire: true, move: { dx: 1, dy: 0 } }) {
  let hs = g.hitStopMs ?? 0;
  let s = state;
  let steps = 0;
  for (let i = 0; i < ticks; i++) {
    const r = gateTick({ paused: g.paused, hitStopMs: hs }, 1000 / 60);
    hs = r.hitStopMs;
    if (r.step) { s = updateArena(s, actions, 1 / 60); steps++; }
  }
  return { s, hs, steps };
}

test('pause freezes ticks: 120 paused ticks leave the arena untouched', () => {
  const s0 = createArena({});
  const { s, steps, hs } = run(s0, 120, { paused: true, hitStopMs: 30 });
  assert.equal(steps, 0);
  assert.equal(s, s0);                 // same object: nothing stepped
  assert.equal(hs, 30);                // hit-stop timer frozen too
});

test('unpaused, the same ticks do advance the arena', () => {
  const s0 = createArena({});
  const { s, steps } = run(s0, 30, { paused: false });
  assert.equal(steps, 30);
  assert.ok(s.elapsedMs > s0.elapsedMs);
});

test('hit-stop holds the sim for ~its duration, then resumes', () => {
  const s0 = createArena({});
  const { steps } = run(s0, 10, { paused: false, hitStopMs: HITSTOP_HIT_MS });
  // 60 ms at 16.7 ms/tick → 4 frozen ticks, then 6 steps.
  assert.equal(steps, 6);
});

test('hit-stop timer counts down and clamps at 0', () => {
  let r = gateTick({ hitStopMs: 20 }, 16);
  assert.equal(r.step, false);
  assert.ok(Math.abs(r.hitStopMs - 4) < 1e-9);
  r = gateTick({ hitStopMs: r.hitStopMs }, 16);
  assert.equal(r.hitStopMs, 0);
  assert.equal(gateTick({ hitStopMs: 0 }, 16).step, true);
});

test('hit-stop lengths: 40–80 ms on hits, kill is longer, never stacks past cap', () => {
  assert.ok(HITSTOP_HIT_MS >= 40 && HITSTOP_HIT_MS <= 80);
  assert.ok(HITSTOP_HURT_MS >= 40 && HITSTOP_HURT_MS <= 80);
  assert.ok(KILL_HITSTOP_MS > HITSTOP_MAX_MS);
  assert.equal(addHitStop(70, 60), 70);
  assert.equal(addHitStop(0, 500), HITSTOP_MAX_MS);
  assert.equal(addHitStop(undefined, HITSTOP_HIT_MS), HITSTOP_HIT_MS);
});

test('trauma scales with damage and is capped per kind', () => {
  assert.ok(traumaForImpact('hit', 30) > traumaForImpact('hit', 5));
  assert.equal(traumaForImpact('hit', 1e6), TRAUMA.hit.cap);
  assert.equal(traumaForImpact('hurt', 1e6), TRAUMA.hurt.cap);
  assert.ok(traumaForImpact('hurt', 10) > traumaForImpact('hit', 10));
  assert.ok(traumaForImpact('kill') >= traumaForImpact('hurt', 1e6));
  assert.equal(traumaForImpact('nope', 10), 0);
});

test('reduced motion cuts shake to almost nothing (< 0.25 px)', () => {
  let cam = createCamera({ reducedMotion: true });
  cam = addTrauma(cam, traumaForImpact('kill', 0, true));
  const { shakeX, shakeY } = tickShake(cam, 0);
  assert.ok(Math.hypot(shakeX, shakeY) < 0.25 * Math.SQRT2, `${shakeX},${shakeY}`);
  assert.ok(SHAKE_MAX_REDUCED < SHAKE_MAX_FULL);
});

test('shake decays to zero and never exceeds the cap', () => {
  let cam = addTrauma(createCamera({}), 5);   // over-add → clamped to 1
  assert.equal(cam.trauma, 1);
  let peak = 0;
  for (let i = 0; i < 60; i++) {
    const r = tickShake(cam, 1 / 60);
    cam = r.camera;
    peak = Math.max(peak, Math.abs(r.shakeX), Math.abs(r.shakeY));
  }
  assert.ok(peak <= SHAKE_MAX_FULL);
  assert.ok(cam.trauma < 1e-9, `trauma ${cam.trauma}`);
  const after = tickShake(cam, 1 / 60);
  assert.equal(after.shakeX, 0);
});

test('impactsForTick: point at the vanished projectile, damage from HP', () => {
  const s0 = createArena({});
  const p = { id: 'pp-1', owner: 'player', x: s0.enemy.x - 18, y: s0.enemy.y, vx: 600, vy: 0 };
  const prev = { ...s0, projectiles: [p] };
  const next = { ...s0, projectiles: [], enemy: { ...s0.enemy, hp: s0.enemy.hp - 25 } };
  const [hit, ...rest] = impactsForTick(prev, next);
  assert.equal(rest.length, 0);
  assert.equal(hit.target, 'enemy');
  assert.equal(hit.damage, 25);
  assert.equal(hit.x, p.x);
  assert.ok(Math.abs(Math.abs(hit.angle) - Math.PI) < 1e-9);  // sparks fly back toward the shooter
  assert.deepEqual(impactsForTick(s0, s0), []);
});

test('impactsForTick: player hurt with no projectile falls back to hull centre', () => {
  const s0 = createArena({});
  const next = { ...s0, player: { ...s0.player, hp: s0.player.hp - 10 } };
  const [hit] = impactsForTick(s0, next);
  assert.equal(hit.target, 'player');
  assert.equal(hit.x, s0.player.x);
});

test('spark pool is fixed size, reuses slots, and burns out', () => {
  const pool = createSparks();
  spawnSparks(pool, { x: 0, y: 0, count: SPARK_POOL_SIZE + 20 }, () => 0.5);
  assert.equal(pool.length, SPARK_POOL_SIZE);
  assert.equal(liveSparks(pool), SPARK_POOL_SIZE);
  for (let i = 0; i < 40; i++) stepSparks(pool, 1 / 60);
  assert.equal(liveSparks(pool), 0);
});

test('a quick dash tap between two ticks is not lost', () => {
  const input = createInputState();
  input.onKeyDown({ key: 'Shift', timeStamp: 0 });
  input.onKeyUp({ key: 'Shift', timeStamp: 5 });
  const cam = createCamera({});
  const a1 = buildPlayerActions(input, cam, 800, 600, 0, 0);
  assert.equal(a1.dash, true);
  const a2 = buildPlayerActions(input, cam, 800, 600, 0, 0);
  assert.equal(a2.dash, false);         // consumed once
  assert.ok(ACTIONS.DASH);
});

test('input.reset drops held keys (no stuck movement after pause)', () => {
  const input = createInputState();
  input.onKeyDown({ key: 'd', timeStamp: 0 });
  assert.equal(input.isPressed(ACTIONS.MOVE_RIGHT), true);
  input.reset();
  assert.equal(input.isPressed(ACTIONS.MOVE_RIGHT), false);
});

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
