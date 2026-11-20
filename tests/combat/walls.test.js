/**
 * tests/combat/walls.test.js
 *
 * Mixed-size cover walls on LV2+. Run: node tests/combat/walls.test.js
 */
import assert from 'node:assert/strict';
import { createArena, updateArena } from '../../src/combat/arena.js';
import { createProjectile, stepProjectile, armShotAgainstWalls } from '../../src/combat/projectile.js';
import { muzzleWorld, barrelHitsWalls, constrainBarrel } from '../../src/combat/muzzle.js';
import { moveMech, createMech } from '../../src/combat/mech.js';
import { stepEnemy, createEnemy } from '../../src/combat/enemy.js';
import {
  wallsForLevel, wallForLevel, circleHitsWalls, WALLS_MIN_LV,
  WALL_SHORT, WALL_MEDIUM, WALL_LONG, WALL_BLOCK,
  segmentHitsWalls, firstWallHit, wallV, clipSegmentAtWalls,
  chipWallAt, wallLength, WALL_CHIP_FRAC, wallsOf,
} from '../../src/combat/obstacle.js';
import {
  PLAYER_START_X, PLAYER_START_Y, ENEMY_START_X, ENEMY_START_Y,
  MECH_RADIUS, SEVER_WALL_X, SEVER_WALL_Y, ARENA_WIDTH, ARENA_HEIGHT,
} from '../../src/combat/config.js';
import { policyActions, mulberry32, FIXED_DT } from '../../tests/combat/balanceCore.mjs';
import { defaultUpgradeState, deployTotalsFromUpgrades } from '../../src/mech/tankUpgrades.js';
import { applyHauntPressure } from '../../src/ui/hauntLevel.js';

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


test('swept segment catches a fast step that tunnels past a wall', () => {
  const wall = wallV(600, 450, 120);
  const arena = { width: ARENA_WIDTH, height: ARENA_HEIGHT, walls: [wall] };
  // Start just left of the wall; one huge step would land far to the right.
  let p = createProjectile({
    id: 'fast', x: 560, y: 450, angle: 0, damage: 1, owner: 'player', speed: 20000,
  });
  p = stepProjectile(p, DT, arena);
  assert.equal(p.dead, true);
  assert.equal(p.deadReason, 'wall');
  assert.ok(p.x < 600, `died on the near face, x=${p.x}`);
  assert.equal(segmentHitsWalls([wall], 560, 450, 900, 450, 6), true);
  assert.ok(firstWallHit([wall], 560, 450, 900, 450, 6).x < 600);
});

test('point-blank fire into a wall from both sides: 0 shots cross', () => {
  const wall = wallV(600, 450, 200);
  const arena = { width: ARENA_WIDTH, height: ARENA_HEIGHT, walls: [wall] };
  const half = wall.thickness / 2;
  const cases = [
    { side: 'left', x: 600 - half - MECH_RADIUS, angle: 0, kind: 'player' },
    { side: 'right', x: 600 + half + MECH_RADIUS, angle: Math.PI, kind: 'player' },
    { side: 'left-enemy', x: 600 - half - MECH_RADIUS, angle: 0, kind: 'enemy' },
    { side: 'right-enemy', x: 600 + half + MECH_RADIUS, angle: Math.PI, kind: 'enemy' },
  ];
  for (const c of cases) {
    const origin = { x: c.x, y: 450 };
    const muzzle = muzzleWorld(c.kind, c.x, 450, c.angle, c.angle);
    // Muzzle must actually reach past the wall so this is a real clip case.
    const past = c.angle === 0 ? muzzle.x > 600 + half : muzzle.x < 600 - half;
    assert.ok(past, `${c.side} muzzle does not reach past the wall: ${muzzle.x}`);

    let shot = createProjectile({
      id: c.side, x: origin.x, y: origin.y, angle: c.angle, damage: 1, owner: c.kind,
    });
    shot = armShotAgainstWalls(shot, arena, origin, muzzle);
    assert.equal(shot.dead, true, `${c.side} spawn should die on the wall`);
    assert.equal(shot.deadReason, 'wall', c.side);
    const crossed = c.angle === 0 ? shot.x > 600 + half : shot.x < 600 - half;
    assert.equal(crossed, false, `${c.side} spawn landed past the wall at x=${shot.x}`);

    // Even an un-armed shot that is then stepped at ordinary and huge dt
    // must never be live past the wall.
    for (const speed of [600, 20000]) {
      let p = createProjectile({
        id: `${c.side}-${speed}`, x: origin.x, y: origin.y, angle: c.angle,
        damage: 1, owner: c.kind, speed,
      });
      for (let i = 0; i < 80 && !p.dead; i++) {
        const prev = { x: p.x, y: p.y };
        p = stepProjectile(p, DT, arena);
        if (!p.dead && segmentHitsWalls([wall], prev.x, prev.y, p.x, p.y, 6)) {
          throw new Error(`${c.side} @${speed} live after crossing at t=${i}`);
        }
        const livePast = !p.dead && (c.angle === 0 ? p.x > 600 + half : p.x < 600 - half);
        assert.equal(livePast, false, `${c.side} @${speed} live past wall x=${p.x}`);
      }
      assert.equal(p.deadReason, 'wall', `${c.side} @${speed} reason`);
      const endPast = c.angle === 0 ? p.x > 600 + half : p.x < 600 - half;
      assert.equal(endPast, false, `${c.side} @${speed} ended past wall x=${p.x}`);
    }
  }
});

test('clipSegmentAtWalls shortens a barrel at the near face', () => {
  const wall = wallV(600, 450, 120);
  const clipped = clipSegmentAtWalls([wall], 560, 450, 700, 450, 0);
  assert.equal(clipped.clipped, true);
  assert.ok(clipped.x2 <= 600 - wall.thickness / 2 + 1e-6, `clip x=${clipped.x2}`);
  const clear = clipSegmentAtWalls([wall], 200, 450, 400, 450, 0);
  assert.equal(clear.clipped, false);
  assert.equal(clear.x2, 400);
});

test('open floor mid-lane on LV2 still does not false-hit', () => {
  const walls = wallsForLevel(2);
  assert.equal(segmentHitsWalls(walls, 200, 450, 1000, 450, 6), false);
});


test('chipWallAt removes about 20% of original length, centred on impact', () => {
  const wall = wallV(600, 450, 200);
  const pieces = chipWallAt(wall, 600, 450);
  const remain = pieces.reduce((n, w) => n + wallLength(w), 0);
  const expect = 200 * (1 - WALL_CHIP_FRAC);
  assert.ok(Math.abs(remain - expect) < 1.5, `remain=${remain} expect=${expect}`);
  assert.equal(pieces.length, 2);
  // Gap sits on the impact (y=450).
  const lo = Math.min(...pieces.map((w) => Math.max(w.y1, w.y2)));
  const hi = Math.max(...pieces.map((w) => Math.min(w.y1, w.y2)));
  // After a mid chip, the two remnants should leave a hole around 450.
  const tops = pieces.map((w) => Math.min(w.y1, w.y2));
  const bots = pieces.map((w) => Math.max(w.y1, w.y2));
  const gapStart = Math.min(...bots.filter((y) => y <= 450 + 1));
  const gapEnd = Math.max(...tops.filter((y) => y >= 450 - 1));
  void lo; void hi; void gapStart; void gapEnd;
  const coversImpact = pieces.some((w) => {
    const minY = Math.min(w.y1, w.y2);
    const maxY = Math.max(w.y1, w.y2);
    return minY - 1 <= 450 && 450 <= maxY + 1;
  });
  assert.equal(coversImpact, false, 'gap should include the impact');
});

test('max-turret player chips a wall; second shot passes the gap', () => {
  let s = createArena({}, { hauntLv: 3 });
  const before = s.arena.walls.reduce((n, w) => n + wallLength(w), 0);
  s = {
    ...s,
    player: { ...s.player, breaksWalls: true, fireCooldown: 0, x: 500, y: 450, angle: 0 },
  };
  s = updateArena(s, { fire: true, aim: { x: 900, y: 450 } }, DT);
  let broke = (s.wallBreaksThisTick ?? []).length > 0;
  for (let i = 0; i < 50 && !broke; i++) {
    s = updateArena(s, { fire: false, aim: { x: 900, y: 450 } }, DT);
    if ((s.wallBreaksThisTick ?? []).length) broke = true;
  }
  assert.equal(broke, true, 'expected a wall break');
  const after = s.arena.walls.reduce((n, w) => n + wallLength(w), 0);
  const midOrig = wallLength(wallsForLevel(3)[0]);
  const dropped = before - after;
  assert.ok(dropped > midOrig * 0.15 && dropped < midOrig * 0.35, `dropped ${dropped} of mid ${midOrig}`);

  // A fresh shot along the mid-lane (through the new gap) must not die on a wall.
  let shot = createProjectile({
    id: 'gap', x: 500, y: 450, angle: 0, damage: 1, owner: 'player',
  });
  for (let i = 0; i < 80 && !shot.dead; i++) shot = stepProjectile(shot, DT, s.arena);
  assert.notEqual(shot.deadReason, 'wall', `second shot died on a wall at x=${shot.x}`);
  assert.ok(shot.x > 600, `second shot should cross mid-X, x=${shot.x}`);
});

test('player without max turret does not break; enemy breaks on LV3 only', () => {
  // Player, no flag, LV3: walls stay the same length after a wall hit.
  let s = createArena({}, { hauntLv: 3 });
  const len0 = s.arena.walls.reduce((n, w) => n + wallLength(w), 0);
  s = { ...s, projectiles: [createProjectile({ id: 'p', x: 560, y: 450, angle: 0, damage: 1, owner: 'player' })] };
  for (let i = 0; i < 30; i++) s = updateArena(s, { fire: false }, DT);
  const len1 = s.arena.walls.reduce((n, w) => n + wallLength(w), 0);
  assert.equal(len1, len0, 'non-max player must not chip');

  // Enemy on LV2: no break.
  let a2 = createArena({}, { hauntLv: 2 });
  // LV2 mid-lane is open; aim at the top short wall.
  const topY = 230;
  const len2a = a2.arena.walls.reduce((n, w) => n + wallLength(w), 0);
  a2 = { ...a2, projectiles: [createProjectile({ id: 'e2', x: 600, y: 400, angle: -Math.PI / 2, damage: 1, owner: 'enemy' })] };
  let hit2 = false;
  for (let i = 0; i < 80; i++) {
    a2 = updateArena(a2, { fire: false }, DT);
    if ((a2.wallHitsThisTick ?? 0) > 0) hit2 = true;
    if ((a2.wallBreaksThisTick ?? []).length) break;
  }
  assert.equal((a2.wallBreaksThisTick ?? []).length, 0, 'enemy must not break on LV2');
  const len2b = a2.arena.walls.reduce((n, w) => n + wallLength(w), 0);
  assert.equal(len2b, len2a);
  assert.equal(hit2, true, 'enemy shot should still die on the LV2 wall');

  // Enemy on LV3: breaks the mid wall.
  let a3 = createArena({}, { hauntLv: 3 });
  const len3a = a3.arena.walls.reduce((n, w) => n + wallLength(w), 0);
  a3 = { ...a3, projectiles: [createProjectile({ id: 'e3', x: 560, y: 450, angle: 0, damage: 1, owner: 'enemy' })] };
  let broke3 = false;
  for (let i = 0; i < 40; i++) {
    a3 = updateArena(a3, { fire: false }, DT);
    if ((a3.wallBreaksThisTick ?? []).length) { broke3 = true; break; }
  }
  assert.equal(broke3, true, 'enemy should break on LV3');
  const len3b = a3.arena.walls.reduce((n, w) => n + wallLength(w), 0);
  assert.ok(len3b < len3a, `LV3 enemy did not shorten walls (${len3a} → ${len3b})`);
});

test('barrel pose never overlaps a wall (hug + aim through)', () => {
  const walls = wallsForLevel(3);
  // Mid vertical wall at x=600, thickness 16. Hug from the left, aim right.
  const hugX = 600 - 8 - 20; // body just clear
  const from = { x: hugX, y: 450, angle: -Math.PI / 2 };
  const to = { x: hugX, y: 450, angle: 0 };
  const heading = 0;
  const c = constrainBarrel('enemy', from, to, walls, heading);
  assert.equal(
    barrelHitsWalls(walls, 'enemy', c.x, c.y, c.angle, heading),
    false,
    `enemy barrel still in wall at (${c.x.toFixed(1)},${c.y.toFixed(1)}) a=${c.angle}`,
  );
  const pc = constrainBarrel('player', from, to, walls, heading);
  assert.equal(
    barrelHitsWalls(walls, 'player', pc.x, pc.y, pc.angle, heading),
    false,
    `player barrel still in wall at (${pc.x.toFixed(1)},${pc.y.toFixed(1)})`,
  );
  // Walking straight into the wall while already facing it must stop short.
  const walkFrom = { x: 400, y: 450, angle: 0 };
  const walkTo = { x: 580, y: 450, angle: 0 };
  const w = constrainBarrel('player', walkFrom, walkTo, walls, 0);
  assert.equal(barrelHitsWalls(walls, 'player', w.x, w.y, w.angle, 0), false);
  assert.ok(w.x < 580, `should stop short, x=${w.x}`);
  assert.ok(Math.abs(w.angle) < 0.05, `should keep aiming at the wall, a=${w.angle}`);
});

test('committed poses in a LV2 fight have 0 barrel overlaps (movement hull heading)', () => {
  const totals = deployTotalsFromUpgrades(defaultUpgradeState());
  let state = createArena(totals, { hauntLv: 2 });
  state = { ...state, enemy: applyHauntPressure(state.enemy, 2) };
  const rng = mulberry32(0xC0FFEE00);
  const ctx = { tick: 0, prevEnemy: undefined, dt: FIXED_DT };
  let prevEnemy;
  let hits = 0;
  const maxTicks = Math.ceil(40 / FIXED_DT);
  for (let tick = 0; tick < maxTicks && state.phase === 'playing'; tick++) {
    ctx.tick = tick;
    ctx.prevEnemy = prevEnemy;
    const actions = policyActions('baseline', state, rng, ctx);
    prevEnemy = { x: state.enemy.x, y: state.enemy.y };
    state = updateArena(state, actions, FIXED_DT);
    const walls = wallsOf(state.arena);
    const pH = state.player.hullHeading ?? state.player.angle;
    const eH = state.enemy.hullHeading ?? state.enemy.angle;
    if (barrelHitsWalls(walls, 'player', state.player.x, state.player.y, state.player.angle, pH)) hits++;
    if (barrelHitsWalls(walls, 'enemy', state.enemy.x, state.enemy.y, state.enemy.angle, eH)) hits++;
  }
  assert.equal(hits, 0, `barrel overlaps in a 40s LV2 fight: ${hits}`);
});

if (failed) { console.error(`${failed} failed`); process.exit(1); }
console.log('walls: all passed');
