/**
 * tests/ui/killMoment.test.js
 * Run: node tests/ui/killMoment.test.js
 */
import assert from 'node:assert/strict';
import {
  HITSTOP_MS, SHATTER_MS, FLICKER_MS,
  beginKillMoment, tickKillMoment, resetKillMoment, killMomentPhase,
  shouldDrawEndCard, shouldDrawEnemy, isKillMomentActive, killMomentT01,
  getKillSnapshot, drawKillShatter, drawKillFlicker,
} from '../../src/ui/killMoment.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { resetKillMoment(); fn(); passed++; } catch (e) { failed++; console.error(`FAIL: ${name}\n  ${e.message}`); }
  finally { resetKillMoment(); }
}

function fakeCtx() {
  const c = { saves: 0, restores: 0, ops: 0 };
  return new Proxy(c, {
    get(t, p) {
      if (p === 'saves' || p === 'restores' || p === 'ops') return t[p];
      if (p === 'save') return () => { t.saves++; };
      if (p === 'restore') return () => { t.restores++; };
      return () => { t.ops++; };
    },
    set() { return true; },
  });
}

const enemy = { x: 400, y: 300, angle: Math.PI, hullHeading: Math.PI };

test('win: hitstop → shatter → flicker → done', () => {
  assert.equal(killMomentPhase(), 'idle');
  assert.equal(shouldDrawEndCard(), false);
  beginKillMoment({ phase: 'win', enemy, nowMs: 1000 });
  assert.equal(killMomentPhase(), 'hitstop');
  assert.ok(isKillMomentActive());
  assert.equal(tickKillMoment(1000 + HITSTOP_MS - 1), 'hitstop');
  assert.equal(tickKillMoment(1000 + HITSTOP_MS), 'shatter');
  assert.ok(getKillSnapshot().segs.length > 0);
  assert.equal(tickKillMoment(1000 + HITSTOP_MS + SHATTER_MS), 'flicker');
  assert.equal(shouldDrawEndCard(), false);
  assert.equal(tickKillMoment(1000 + HITSTOP_MS + SHATTER_MS + FLICKER_MS), 'done');
  assert.equal(shouldDrawEndCard(), true);
  assert.equal(isKillMomentActive(), false);
});

test('lose skips shatter: hitstop → flicker → done', () => {
  beginKillMoment({ phase: 'lose', enemy, nowMs: 0 });
  assert.equal(tickKillMoment(HITSTOP_MS), 'flicker');
  assert.equal(tickKillMoment(HITSTOP_MS + FLICKER_MS), 'done');
});

test('reducedMotion goes to done immediately', () => {
  beginKillMoment({ phase: 'win', enemy, nowMs: 0, reducedMotion: true });
  assert.equal(killMomentPhase(), 'done');
  assert.ok(shouldDrawEndCard());
});

test('begin ignored unless win/lose', () => {
  beginKillMoment({ phase: 'playing', enemy, nowMs: 0 });
  assert.equal(killMomentPhase(), 'idle');
});

test('shouldDrawEnemy: false after hitstop on win, true on lose', () => {
  beginKillMoment({ phase: 'win', enemy, nowMs: 0 });
  assert.equal(shouldDrawEnemy(), true);
  tickKillMoment(HITSTOP_MS);
  assert.equal(shouldDrawEnemy(), false);
  tickKillMoment(1e6);
  assert.equal(shouldDrawEnemy(), false);
  resetKillMoment();
  assert.equal(shouldDrawEnemy(), true);
  beginKillMoment({ phase: 'lose', enemy, nowMs: 0 });
  tickKillMoment(HITSTOP_MS);
  assert.equal(shouldDrawEnemy(), true);
  tickKillMoment(1e6);
  assert.equal(shouldDrawEnemy(), true);
});

test('killMomentT01 progresses 0..1 in shatter', () => {
  beginKillMoment({ phase: 'win', enemy, nowMs: 0 });
  tickKillMoment(HITSTOP_MS + SHATTER_MS / 2);
  assert.ok(Math.abs(killMomentT01(HITSTOP_MS + SHATTER_MS / 2) - 0.5) < 1e-9);
});

test('reset returns to idle', () => {
  beginKillMoment({ phase: 'win', enemy, nowMs: 0 });
  resetKillMoment();
  assert.equal(killMomentPhase(), 'idle');
  assert.equal(getKillSnapshot(), null);
});

test('draw functions balance save/restore', () => {
  beginKillMoment({ phase: 'win', enemy, nowMs: 0 });
  const a = fakeCtx();
  drawKillShatter(a, getKillSnapshot(), 0.5);
  assert.equal(a.saves, a.restores);
  assert.ok(a.saves >= 1);
  const n = fakeCtx();
  drawKillShatter(n, null, 0.5);
  assert.equal(n.saves, n.restores);
  for (const t of [0, 0.4, 0.9]) {
    const b = fakeCtx();
    drawKillFlicker(b, 390, 844, t);
    assert.equal(b.saves, b.restores);
    assert.ok(b.saves >= 1);
  }
});

console.log(`killMoment: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
