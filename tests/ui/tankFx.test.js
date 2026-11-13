/**
 * tests/ui/tankFx.test.js — render-only tank FX (scale, recoil, flash, bob).
 * Run: node tests/ui/tankFx.test.js
 */

import assert from 'node:assert/strict';
import { TANK_DRAW_SCALE, tankGeometry, drawTank, drawTankGhost } from '../../src/ui/tankWire.js';
import { syncTankFx, resetTankFx, shotFx, hoverBob } from '../../src/ui/tankFx.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    resetTankFx();
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function fakeCtx() {
  const c = { saves: 0, restores: 0, segs: 0 };
  const noop = () => {};
  return Object.assign(c, {
    save() { c.saves++; }, restore() { c.restores++; },
    moveTo() { c.segs++; }, lineTo() { c.segs++; },
    fill: noop, stroke: noop, beginPath: noop, closePath: noop,
    ellipse: noop, arc: noop, translate: noop, scale: noop,
  });
}

const st = (elapsedMs, projectiles = [], phase = 'playing') => ({ elapsedMs, projectiles, phase });

console.log('\nsrc/ui/tankFx.js\n');

test('TANK_DRAW_SCALE is 1.3; geometry sizes unchanged', () => {
  assert.equal(TANK_DRAW_SCALE, 1.3);
  const { footprint } = tankGeometry('player', 50, 60, 0.7, 0);
  for (const p of footprint) assert.ok(Math.hypot(p.x - 50, p.y - 60) <= 1.1 * 20);
});

test('draw calls stay save/restore balanced', () => {
  for (const kind of ['player', 'enemy']) {
    const c = fakeCtx();
    drawTank(c, kind, 10, 10, 0.2, 0.9, 0.3);
    drawTankGhost(c, kind, 10, 10, 0.2, 0.3);
    assert.equal(c.saves, c.restores);
  }
});

test('hoverBob: 0 when unsynced, out of phase, within [-2, 2]', () => {
  assert.equal(hoverBob('player', null), 0);
  assert.equal(hoverBob('enemy', undefined), 0);
  const p = hoverBob('player', 500), e = hoverBob('enemy', 500);
  assert.ok(p !== e && Math.abs(p + e) < 1e-9);
  for (const t of [0, 123, 500, 1500, 1999]) {
    for (const k of ['player', 'enemy']) assert.ok(Math.abs(hoverBob(k, t)) <= 2);
  }
});

test('player shot: recoil 4 at instant, ~0 at +120 ms, flash window', () => {
  syncTankFx(st(1000));
  syncTankFx(st(1010, [{ id: 1, owner: 'player' }]));
  const a = shotFx('player', 1010);
  assert.equal(a.recoil, 4);
  assert.equal(a.barrelIndex, 0);
  assert.ok(shotFx('player', 1050).flash > 0);
  assert.ok(shotFx('player', 1060).flash > 0);
  assert.equal(shotFx('player', 1120).flash, 0);
  assert.ok(Math.abs(shotFx('player', 1130).recoil) < 0.05);
});

test('enemy shots alternate barrel 0 then 1', () => {
  syncTankFx(st(0));
  syncTankFx(st(100, [{ id: 1, owner: 'enemy' }]));
  assert.equal(shotFx('enemy', 100).barrelIndex, 0);
  syncTankFx(st(200, [{ id: 1, owner: 'enemy' }, { id: 2, owner: 'enemy' }]));
  assert.equal(shotFx('enemy', 200).barrelIndex, 1);
});

test('resetTankFx and non-playing phase clear state', () => {
  syncTankFx(st(0));
  syncTankFx(st(10, [{ id: 1, owner: 'player' }]));
  resetTankFx();
  assert.equal(shotFx('player', 10).recoil, 0);
  syncTankFx(st(0));
  syncTankFx(st(10, [{ id: 2, owner: 'player' }]));
  syncTankFx(st(20, [], 'win'));
  assert.equal(shotFx('player', 20).recoil, 0);
});

test('clock going backward clears events', () => {
  syncTankFx(st(500));
  syncTankFx(st(510, [{ id: 1, owner: 'player' }]));
  syncTankFx(st(5));
  assert.equal(shotFx('player', 5).recoil, 0);
});

test('active muzzle flash draws more segments than idle', () => {
  const idle = fakeCtx(), hot = fakeCtx();
  drawTank(idle, 'enemy', 0, 0, 0, 0, 0);
  resetTankFx();
  syncTankFx(st(0));
  syncTankFx(st(10, [{ id: 1, owner: 'enemy' }]));
  drawTank(hot, 'enemy', 0, 0, 0, 0, 0);
  assert.ok(hot.segs > idle.segs, `${hot.segs} vs ${idle.segs}`);
});

console.log(`\ntankFx: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
