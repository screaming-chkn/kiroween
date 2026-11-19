/**
 * tests/ui/haunting.test.js — arena haunting logic (trail, ghost, grid, fog).
 * Run: node tests/ui/haunting.test.js
 */

import assert from 'node:assert/strict';
import {
  HAUNT_FX, hauntFlags, createHauntFx, tickHaunt, liveTrailCount, trailAlpha,
  forEachTrail, startGhost, ghostPose, gridAlpha, fogPuffOffset,
  drawBorderFog, drawEctoTrail, drawKillGhost, drawHauntVignette,
} from '../../src/ui/haunting.js';

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

const ARENA = { width: 1200, height: 900 };
const alive = (x = 100, y = 200) => ({ x, y, hp: 50 });

function stubCtx() {
  const fn = () => proxy;
  const proxy = new Proxy(fn, {
    get: () => proxy,
    set: () => true,
    apply: () => proxy,
  });
  return proxy;
}

console.log('\nsrc/ui/haunting.js\n');

test('constants are frozen and match the spec', () => {
  assert.ok(Object.isFrozen(HAUNT_FX));
  assert.equal(HAUNT_FX.TRAIL_MAX, 16);
  assert.equal(HAUNT_FX.TRAIL_SAMPLE_MS, 60);
  assert.equal(HAUNT_FX.TRAIL_LIFE_MS, 700);
  assert.equal(HAUNT_FX.FOG_PUFFS, 14);
  assert.equal(HAUNT_FX.GHOST_MS, 1400);
  assert.equal(HAUNT_FX.GHOST_RISE_WU, 90);
  assert.equal(HAUNT_FX.GRID_BASE, 0.12);
  assert.equal(HAUNT_FX.FLICKER_MAX_PER_S, 2);
  assert.equal(HAUNT_FX.VIGNETTE_MAX, 0.25);
  assert.equal(HAUNT_FX.FOG_MAX, 0.35);
});

test('hauntFlags: normal all on, reduced keeps only the vignette', () => {
  assert.deepEqual(hauntFlags(false), { trail: true, fogDrift: true, ghostRise: true, gridFlicker: true, vignette: true });
  assert.deepEqual(hauntFlags(true), { trail: false, fogDrift: false, ghostRise: false, gridFlicker: false, vignette: true });
});

test('createHauntFx preallocates buffers and puffs', () => {
  const fx = createHauntFx({ arena: ARENA, seed: 7 });
  assert.ok(fx.xs instanceof Float64Array && fx.xs.length === HAUNT_FX.TRAIL_MAX);
  assert.ok(fx.ys instanceof Float64Array && fx.ys.length === HAUNT_FX.TRAIL_MAX);
  assert.ok(fx.ts instanceof Float64Array && fx.ts.length === HAUNT_FX.TRAIL_MAX);
  assert.equal(fx.puffs.length, HAUNT_FX.FOG_PUFFS);
  assert.equal(fx.head, 0);
  assert.equal(fx.count, 0);
  assert.equal(fx.t, 0);
  assert.equal(fx.lastSampleMs, -Infinity);
  assert.deepEqual(fx.ghost, { active: false, x: 0, y: 0, t0: 0 });
  assert.deepEqual(fx.flags, hauntFlags(false));
});

test('createHauntFx works with no arguments', () => {
  const fx = createHauntFx();
  assert.equal(fx.puffs.length, HAUNT_FX.FOG_PUFFS);
});

test('trail samples at most every 60 ms', () => {
  const fx = createHauntFx({ arena: ARENA });
  const e = alive();
  for (let i = 0; i < 10; i++) tickHaunt(fx, 16, e); // 160 ms
  // samples at t=16, 80, 144 -> 3
  assert.equal(fx.count, 3);
  assert.equal(liveTrailCount(fx), 3);
});

test('trail caps at TRAIL_MAX and never reallocates', () => {
  const fx = createHauntFx({ arena: ARENA });
  const xs = fx.xs;
  const e = alive();
  const live = liveTrailCount(fx);
  assert.equal(live, 0);
  for (let t = 0; t < 5000; t += 16) {
    tickHaunt(fx, 16, e);
    assert.ok(liveTrailCount(fx) <= HAUNT_FX.TRAIL_MAX);
    assert.ok(fx.count <= HAUNT_FX.TRAIL_MAX);
  }
  assert.equal(fx.xs, xs);
  assert.equal(fx.xs.length, 16);
  assert.ok(fx.head >= 0 && fx.head < 16);
});

test('trail samples expire after TRAIL_LIFE_MS', () => {
  const fx = createHauntFx({ arena: ARENA });
  const dead = { x: 0, y: 0, hp: 0 };
  for (let i = 0; i < 5; i++) tickHaunt(fx, 60, alive());
  assert.ok(liveTrailCount(fx) > 0);
  for (let i = 0; i < 50; i++) tickHaunt(fx, 16, dead);
  assert.equal(liveTrailCount(fx), 0);
});

test('forEachTrail iterates oldest to newest, live only', () => {
  const fx = createHauntFx({ arena: ARENA });
  for (let i = 1; i <= 20; i++) tickHaunt(fx, 60, alive(i, i));
  const seen = [];
  forEachTrail(fx, (x, y, a) => { seen.push([x, a]); });
  assert.ok(seen.length > 0 && seen.length <= 16);
  for (let i = 1; i < seen.length; i++) {
    assert.ok(seen[i][0] > seen[i - 1][0], 'x ascends');
    assert.ok(seen[i][1] >= seen[i - 1][1], 'alpha grows toward newest');
  }
  assert.equal(seen[seen.length - 1][0], 20);
});

test('no sampling under reduced motion or when the enemy is dead or absent', () => {
  const r = createHauntFx({ arena: ARENA, reducedMotion: true });
  for (let i = 0; i < 20; i++) tickHaunt(r, 60, alive());
  assert.equal(r.count, 0);
  assert.equal(r.t, 1200);
  const fx = createHauntFx({ arena: ARENA });
  for (let i = 0; i < 20; i++) tickHaunt(fx, 60, { x: 1, y: 1, hp: 0 });
  for (let i = 0; i < 20; i++) tickHaunt(fx, 60, null);
  assert.equal(fx.count, 0);
});

test('trailAlpha bounds', () => {
  assert.ok(Math.abs(trailAlpha(0) - 0.35) < 1e-9);
  assert.equal(trailAlpha(HAUNT_FX.TRAIL_LIFE_MS), 0);
  assert.equal(trailAlpha(HAUNT_FX.TRAIL_LIFE_MS + 100), 0);
  assert.equal(trailAlpha(-5), 0);
  const mid = trailAlpha(350);
  assert.ok(mid > 0 && mid < 0.35);
});

test('ghost: null before start and after GHOST_MS', () => {
  const fx = createHauntFx({ arena: ARENA });
  assert.equal(ghostPose(fx), null);
  startGhost(fx, 300, 400);
  assert.ok(ghostPose(fx));
  tickHaunt(fx, HAUNT_FX.GHOST_MS - 1, null);
  assert.ok(ghostPose(fx));
  tickHaunt(fx, 1, null);
  assert.equal(ghostPose(fx), null);
  assert.equal(fx.ghost.active, false);
});

test('ghost rises, fades and sways under normal motion', () => {
  const fx = createHauntFx({ arena: ARENA });
  tickHaunt(fx, 500, null);
  startGhost(fx, 300, 400);
  const p0 = { ...ghostPose(fx) };   // ghostPose reuses one object, so copy it
  assert.equal(p0.x, 300);
  assert.equal(p0.y, 400);
  assert.ok(Math.abs(p0.alpha - 0.9) < 1e-9);
  tickHaunt(fx, 700, null);
  const p1 = ghostPose(fx);
  assert.ok(p1.y < 400);
  assert.ok(p1.y >= 400 - HAUNT_FX.GHOST_RISE_WU);
  assert.ok(p1.alpha < p0.alpha && p1.alpha > 0);
  tickHaunt(fx, 600, null);
  const p2 = ghostPose(fx);
  assert.ok(p2.y < 400 - 55);
  assert.ok(Math.abs(p2.sway) <= 6 + 1e-9);
});

test('ghost under reduced motion: fades only, no rise or sway', () => {
  const fx = createHauntFx({ arena: ARENA, reducedMotion: true });
  startGhost(fx, 300, 400);
  for (let i = 0; i < 20; i++) {
    tickHaunt(fx, 60, null);
    const p = ghostPose(fx);
    assert.ok(p);
    assert.equal(p.y, 400);
    assert.equal(p.sway, 0);
    assert.ok(p.alpha < 0.9);
  }
});

test('ghostPose returns the same object each call', () => {
  const fx = createHauntFx({ arena: ARENA });
  startGhost(fx, 1, 2);
  const a = ghostPose(fx);
  tickHaunt(fx, 100, null);
  const b = ghostPose(fx);
  assert.equal(a, b);
});

test('gridAlpha: stays in range, changes at most 20 times in 10 s', () => {
  let changes = 0;
  let prev = gridAlpha(0);
  for (let t = 0; t <= 10000; t += 5) {
    const v = gridAlpha(t);
    assert.ok(v >= 0.08 - 1e-12 && v <= 0.18 + 1e-12, `v=${v}`);
    if (v !== prev) changes++;
    prev = v;
  }
  assert.ok(changes <= 20, `changes=${changes}`);
  assert.ok(changes > 0);
});

test('gridAlpha: windup brightens to 0.2, reduced is steady 0.12', () => {
  for (const t of [0, 400, 1234, 9000]) {
    assert.ok(Math.abs(gridAlpha(t, 1) - 0.2) < 1e-12);
    assert.ok(Math.abs(gridAlpha(t, 5) - 0.2) < 1e-12);
    const mid = gridAlpha(t, 0.5);
    assert.ok(mid >= gridAlpha(t, 0) - 1e-12 && mid <= 0.2 + 1e-12);
    assert.equal(gridAlpha(t, 0.7, true), 0.12);
    assert.equal(gridAlpha(t, -1), gridAlpha(t, 0));
  }
});

test('fog puffs sit outside the arena with at most 24 wu bleed', () => {
  for (const seed of [1, 2, 3, 99, 12345]) {
    const fx = createHauntFx({ arena: ARENA, seed });
    assert.equal(fx.puffs.length, 14);
    for (const p of fx.puffs) {
      const out = Math.max(-p.x, p.x - ARENA.width, -p.y, p.y - ARENA.height);
      assert.ok(out > 0, `centre outside (seed ${seed})`);
      assert.ok(p.r - out <= 24, `bleed ${p.r - out} (seed ${seed})`);
      assert.ok(Number.isFinite(p.phase));
    }
  }
});

test('fog puffs are deterministic per seed', () => {
  const a = createHauntFx({ arena: ARENA, seed: 5 });
  const b = createHauntFx({ arena: ARENA, seed: 5 });
  assert.deepEqual(a.puffs, b.puffs);
});

test('fogPuffOffset: zero when reduced, at most 18 wu otherwise', () => {
  const fx = createHauntFx({ arena: ARENA });
  for (const p of fx.puffs) {
    for (let t = 0; t < 60000; t += 997) {
      const r = fogPuffOffset(p, t, true);
      assert.equal(r.dx, 0);
      assert.equal(r.dy, 0);
      const o = fogPuffOffset(p, t, false);
      assert.ok(Math.abs(o.dx) <= 18 && Math.abs(o.dy) <= 18);
    }
  }
  const a = fogPuffOffset(fx.puffs[0], 0, false);
  const b = fogPuffOffset(fx.puffs[1], 100, false);
  assert.equal(a, b, 'reused object');
});

test('fog drift period is at least 6 s', () => {
  const p = { x: 0, y: 0, r: 80, phase: 0 };
  const a = fogPuffOffset(p, 0, false).dx;
  const b = fogPuffOffset(p, 100, false).dx;
  assert.ok(Math.abs(b - a) < 18 * 0.2);
});

test('draw functions run against a stub ctx without throwing', () => {
  const ctx = stubCtx();
  const fx = createHauntFx({ arena: ARENA });
  for (let i = 0; i < 10; i++) tickHaunt(fx, 60, alive());
  startGhost(fx, 10, 10);
  drawBorderFog(ctx, fx);
  drawEctoTrail(ctx, fx);
  drawKillGhost(ctx, fx);
  drawHauntVignette(ctx, fx, 1280, 800);
  const r = createHauntFx({ arena: ARENA, reducedMotion: true });
  drawBorderFog(ctx, r);
  drawEctoTrail(ctx, r);
  drawKillGhost(ctx, r);
  drawHauntVignette(ctx, r, 390, 844);
  drawHauntVignette(ctx, r, 0, 0);
});

test('lite (phones): no vignette, FOG_PUFFS_LITE puffs, other effects unchanged', () => {
  const fx = createHauntFx({ arena: ARENA, lite: true });
  assert.equal(fx.flags.vignette, false);
  assert.equal(fx.flags.trail, true);
  assert.equal(fx.puffs.length, HAUNT_FX.FOG_PUFFS_LITE);
  assert.ok(HAUNT_FX.FOG_PUFFS_LITE < HAUNT_FX.FOG_PUFFS);
  for (const p of fx.puffs) {
    const inside = p.x > 0 && p.x < ARENA.width && p.y > 0 && p.y < ARENA.height;
    assert.ok(!inside, 'lite puff centre outside the arena');
  }
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
