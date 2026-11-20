/**
 * tests/combat/walls.test.js
 *
 * Mixed-size cover walls on LV2+. Run: node tests/combat/walls.test.js
 */
import assert from 'node:assert/strict';
import { createArena, updateArena } from '../../src/combat/arena.js';
import { createProjectile, stepProjectile } from '../../src/combat/projectile.js';
import { moveMech, createMech } from '../../src/combat/mech.js';
import { stepEnemy, createEnemy } from '../../src/combat/enemy.js';
import {
  wallsForLevel, wallForLevel, circleHitsWalls, WALLS_MIN_LV,
  WALL_SHORT, WALL_MEDIUM, WALL_LONG, WALL_BLOCK,
} from '../../src/combat/obstacle.js';
import {
  PLAYER_START_X, PLAYER_START_Y, ENEMY_START_X, ENEMY_START_Y,
  MECH_RADIUS, SEVER_WALL_X, SEVER_WALL_Y, ARENA_WIDTH, ARENA_HEIGHT,
} from '../../src/combat/config.js';

let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}

const DT = 1 / 60;
const SPAWN_CLEAR = 80;

test('WALLS_MIN_LV is 2; LV1 is empty', () => {
  assert.equal(WALLS_MIN_LV, 2);
  assert.deepEqual(wallsForLevel(1), []);
  assert.equal(wallForLevel(1), null);
  assert.deepEqual(wallsForLevel(undefined), []);
});

test('LV2–5 have 2–4 mixed-size walls', () => {
  const counts = {};
  for (const lv of [2, 3, 4, 5]) {
    const walls = wallsForLevel(lv);
    counts[lv] = walls.length;
    assert.ok(walls.length >= 2 && walls.length <= 4, `lv${lv} count ${walls.length}`);
    for (const w of walls) {
      assert.ok(w.thickness > 0);
      assert.ok(Number.isFinite(w.x1 + w.x2 + w.y1 + w.y2));
    }
  }
  assert.equal(counts[2], 2);
  assert.equal(counts[3], 3);
  assert.equal(counts[4], 4);
  assert.equal(counts[5], 4);
});

test('sizes include short, medium, long, and a block across LV2–5', () => {
  const lens = [];
  const thicks = [];
  for (const lv of [2, 3, 4, 5]) {
    for (const w of wallsForLevel(lv)) {
      lens.push(Math.hypot(w.x2 - w.x1, w.y2 - w.y1));
      thicks.push(w.thickness);
    }
  }
  const near = (target) => lens.some((l) => Math.abs(l - target) < 1);
  assert.ok(near(WALL_SHORT), 'short present');
  assert.ok(near(WALL_MEDIUM), 'medium present');
  assert.ok(near(WALL_LONG), 'long present');
  assert.ok(thicks.some((t) => Math.abs(t - WALL_BLOCK) < 1), 'block present');
});

test('spawns stay clear of every wall', () => {
  for (const lv of [1, 2, 3, 4, 5]) {
    const walls = wallsForLevel(lv);
    assert.equal(
      circleHitsWalls(walls, PLAYER_START_X, PLAYER_START_Y, MECH_RADIUS + SPAWN_CLEAR),
      false,
      `player spawn hits a wall on lv${lv}`,
    );
    assert.equal(
      circleHitsWalls(walls, ENEMY_START_X, ENEMY_START_Y, MECH_RADIUS + SPAWN_CLEAR),
      false,
      `enemy spawn hits a wall on lv${lv}`,
    );
    const a = createArena({}, { hauntLv: lv });
    assert.equal(a.player.x, PLAYER_START_X);
    assert.equal(a.enemy.x, ENEMY_START_X);
    assert.equal(
      circleHitsWalls(a.arena.walls, a.player.x, a.player.y, MECH_RADIUS),
      false,
    );
    assert.equal(
      circleHitsWalls(a.arena.walls, a.enemy.x, a.enemy.y, MECH_RADIUS),
      false,
    );
  }
});

test('LV2 mid-lane stays open; projectiles die on the top short wall', () => {
  const { arena } = createArena({}, { hauntLv: 2 });
  // Mid-lane shot (spawn Y) flies the full width.
  let mid = createProjectile({
    id: 'mid', x: 200, y: SEVER_WALL_Y, angle: 0, damage: 1, owner: 'player',
  });
  for (let i = 0; i < 200 && !mid.dead; i++) mid = stepProjectile(mid, DT, arena);
  assert.equal(mid.deadReason, 'bounds', `mid-lane should miss walls, got ${mid.deadReason}`);
  assert.ok(mid.x > SEVER_WALL_X, 'crossed mid-X');

  // Shot straight up into the short top wall dies as a wall hit.
  let up = createProjectile({
    id: 'up', x: SEVER_WALL_X, y: 400, angle: -Math.PI / 2, damage: 1, owner: 'player',
  });
  for (let i = 0; i < 80 && !up.dead; i++) up = stepProjectile(up, DT, arena);
  assert.equal(up.dead, true);
  assert.equal(up.deadReason, 'wall');
  assert.ok(up.y > 200, `stopped at y=${up.y}`);
});

test('LV3 projectiles stop on the mid Sever Wall and on a side cover', () => {
  const { arena } = createArena({}, { hauntLv: 3 });
  let mid = createProjectile({
    id: 'm', x: SEVER_WALL_X - 40, y: SEVER_WALL_Y, angle: 0, damage: 1, owner: 'player',
  });
  for (let i = 0; i < 20 && !mid.dead; i++) mid = stepProjectile(mid, DT, arena);
  assert.equal(mid.deadReason, 'wall');
  assert.ok(mid.x < SEVER_WALL_X);

  let side = createProjectile({
    id: 's', x: 340, y: 400, angle: -Math.PI / 2, damage: 1, owner: 'player',
  });
  for (let i = 0; i < 80 && !side.dead; i++) side = stepProjectile(side, DT, arena);
  assert.equal(side.deadReason, 'wall');
});

test('player cannot walk through an LV2 wall', () => {
  const { arena } = createArena({}, { hauntLv: 2 });
  const start = createMech({
    id: 'p', x: SEVER_WALL_X, y: 400, hp: 1, maxHp: 1, owner: 'player',
  });
  let m = start;
  for (let i = 0; i < 90; i++) m = moveMech(m, { dx: 0, dy: -1 }, DT, arena);
  assert.ok(m.y > 230, `should stop at the short top wall, y=${m.y}`);
});

test('bot paths around a head-on wall on LV2–5 and does not stick', () => {
  // Each level: start the bot on the far side of a wall, player on the near
  // side, so slide-around must fire. Goal is to cross the wall, not to
  // finish a full chase (SHOOT/strafe can keep distance after that).
  const cases = [
    { lv: 2, ex: 600, ey: 100, px: 600, py: 400, crossed: (e) => e.y > 230 },
    { lv: 3, ex: 640, ey: 450, px: 200, py: 450, crossed: (e) => e.x < 540 },
    { lv: 4, ex: 600, ey: 80,  px: 600, py: 400, crossed: (e) => e.y > 220 },
    { lv: 5, ex: 740, ey: 450, px: 200, py: 450, crossed: (e) => e.x < 540 },
  ];
  for (const c of cases) {
    const { arena } = createArena({}, { hauntLv: c.lv });
    let e = createEnemy({ x: c.ex, y: c.ey });
    const player = { x: c.px, y: c.py, hp: 100 };
    let passed = false;
    for (let i = 0; i < 900; i++) {
      e = stepEnemy(e, player, DT, arena, i).enemy;
      if (circleHitsWalls(arena.walls, e.x, e.y, MECH_RADIUS - 0.5)) {
        throw new Error(`lv${c.lv} bot overlapped a wall at t=${i} (${e.x},${e.y})`);
      }
      if (c.crossed(e)) { passed = true; break; }
    }
    assert.ok(passed, `lv${c.lv} bot did not get around the wall, at (${e.x.toFixed(1)},${e.y.toFixed(1)})`);
  }
});

test('walls stay inside the arena rectangle', () => {
  for (const lv of [2, 3, 4, 5]) {
    for (const w of wallsForLevel(lv)) {
      const half = w.thickness / 2;
      const minX = Math.min(w.x1, w.x2) - half;
      const maxX = Math.max(w.x1, w.x2) + half;
      const minY = Math.min(w.y1, w.y2) - half;
      const maxY = Math.max(w.y1, w.y2) + half;
      assert.ok(minX >= 0 && maxX <= ARENA_WIDTH, `lv${lv} x ${minX}..${maxX}`);
      assert.ok(minY >= 0 && maxY <= ARENA_HEIGHT, `lv${lv} y ${minY}..${maxY}`);
    }
  }
});

if (failed) { console.error(`${failed} failed`); process.exit(1); }
console.log('walls: all passed');
