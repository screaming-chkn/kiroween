/**
 * tests/combat/severWall.test.js
 *
 * Sever Wall: LV3+ only. Run with: node tests/combat/severWall.test.js
 */

import assert from 'node:assert/strict';
import { createArena, updateArena } from '../../src/combat/arena.js';
import { createProjectile, stepProjectile } from '../../src/combat/projectile.js';
import { moveMech, createMech } from '../../src/combat/mech.js';
import { stepEnemy, createEnemy } from '../../src/combat/enemy.js';
import { wallForLevel } from '../../src/combat/obstacle.js';
import { SEVER_WALL_X, SEVER_WALL_Y } from '../../src/combat/config.js';

let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}

const DT = 1 / 60;

test('LV1 and LV2 have no wall; LV3-5 have one', () => {
  for (const lv of [1, 2]) assert.equal(createArena({}, { hauntLv: lv }).arena.wall, undefined);
  assert.equal(createArena({}).arena.wall, undefined);
  for (const lv of [3, 4, 5]) {
    const w = createArena({}, { hauntLv: lv }).arena.wall;
    assert.ok(w);
    assert.equal(w.x1, w.x2, 'vertical');
    assert.equal(w.x1, SEVER_WALL_X);
  }
});

test('severWall option overrides the level', () => {
  assert.ok(createArena({}, { severWall: true }).arena.wall);
  assert.equal(createArena({}, { hauntLv: 5, severWall: false }).arena.wall, undefined);
});

test('wallForLevel leaves flank corridors', () => {
  const w = wallForLevel(3);
  assert.ok(w.y1 > 100 && w.y2 < 800);
});

test('projectile stops on the wall (LV3) and flies on in LV1', () => {
  const shot = () => createProjectile({ id: 'p', x: SEVER_WALL_X - 40, y: SEVER_WALL_Y, angle: 0, damage: 1, owner: 'player' });
  for (const [lv, expectDead] of [[3, true], [1, false]]) {
    const { arena } = createArena({}, { hauntLv: lv });
    let p = shot();
    for (let i = 0; i < 20 && !p.dead; i++) p = stepProjectile(p, DT, arena);
    assert.equal(p.dead, expectDead, `lv${lv}`);
    if (expectDead) assert.ok(p.x < SEVER_WALL_X, 'stopped before crossing');
  }
});

test('player move is blocked at LV3 and free at LV1', () => {
  const start = createMech({ id: 'p', x: SEVER_WALL_X - 40, y: SEVER_WALL_Y, hp: 1, maxHp: 1, owner: 'player' });
  const walled = createArena({}, { hauntLv: 3 }).arena;
  const open = createArena({}, { hauntLv: 1 }).arena;
  let a = start;
  let b = start;
  for (let i = 0; i < 60; i++) {
    a = moveMech(a, { dx: 1, dy: 0 }, DT, walled);
    b = moveMech(b, { dx: 1, dy: 0 }, DT, open);
  }
  assert.ok(a.x < SEVER_WALL_X, `blocked at ${a.x}`);
  assert.ok(b.x > SEVER_WALL_X + 100, 'open field passes');
});

test('dash into the wall cancels the remaining dash', () => {
  let s = createArena({}, { hauntLv: 3 });
  s = { ...s, player: { ...s.player, x: SEVER_WALL_X - 60, y: SEVER_WALL_Y } };
  let hit = false;
  for (let i = 0; i < 20; i++) {
    s = updateArena(s, { move: { dx: 1, dy: 0 }, dash: i === 0 }, DT);
    assert.ok(s.player.x < SEVER_WALL_X, 'never crosses');
    assert.equal(s.player.wallBump, undefined);
    if (s.player.dashRemainingMs === 0 && s.player.dashCooldownMs > 0 && i < 12) hit = true;
  }
  assert.ok(hit, 'dash cancelled early by the bump');
});

test('bot head-on at the wall slides around instead of sticking', () => {
  const { arena } = createArena({}, { hauntLv: 3 });
  let e = createEnemy({ x: SEVER_WALL_X + 40, y: SEVER_WALL_Y });
  const player = { x: 200, y: SEVER_WALL_Y, hp: 100 };
  for (let i = 0; i < 400; i++) e = stepEnemy(e, player, DT, arena, i).enemy;
  assert.ok(e.x < SEVER_WALL_X - 40, `passed the wall, x=${e.x}`);
});

if (failed) { console.error(`${failed} failed`); process.exit(1); }
console.log('severWall: all passed');
