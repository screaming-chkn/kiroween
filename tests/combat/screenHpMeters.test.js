import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCREEN_HP_LAYOUT, screenHpTopReserve, drawScreenHpMeters,
  meterFillColor, METER_ORANGE, METER_RED, METER_RED_PCT, METER_FRAME,
} from '../../src/combat/screenHpMeters.js';

function fakeCtx() {
  const calls = [];
  const ctx = new Proxy({}, {
    get(_t, p) {
      if (p === 'calls') return calls;
      return (...args) => { calls.push([p, ...args]); };
    },
    set(_t, p, v) { calls.push(['set', p, v]); return true; },
  });
  return ctx;
}

test('SCREEN_HP_LAYOUT is corner-v (layout C)', () => {
  assert.equal(SCREEN_HP_LAYOUT, 'corner-v');
});

test('meterFillColor: orange above 25%, red at ≤25%', () => {
  assert.equal(meterFillColor(1), METER_ORANGE);
  assert.equal(meterFillColor(0.26), METER_ORANGE);
  assert.equal(meterFillColor(METER_RED_PCT), METER_RED);
  assert.equal(meterFillColor(0.1), METER_RED);
  assert.equal(meterFillColor(0), METER_RED);
});

test('screenHpTopReserve: corner-v reserves a short strip', () => {
  assert.ok(screenHpTopReserve('corner-v') >= 20);
  assert.equal(screenHpTopReserve('vertical'), 0);
  assert.ok(screenHpTopReserve('top') >= 28);
});

test('drawScreenHpMeters corner-v draws both short vertical bars + labels', () => {
  const ctx = fakeCtx();
  drawScreenHpMeters(ctx, {
    player: { hp: 120, maxHp: 300 },
    enemy: { hp: 220, maxHp: 440 },
  }, 1280, 800, { layout: 'corner-v', topInset: 40, leftInset: 10, rightInset: 10 });
  const fills = ctx.calls.filter(c => c[0] === 'fillRect');
  assert.ok(fills.length >= 4, `expected >=4 fillRect, got ${fills.length}`);
  const texts = ctx.calls.filter(c => c[0] === 'fillText').map(c => c[1]);
  assert.ok(texts.some(t => String(t).startsWith('HP ')), texts);
  assert.ok(texts.some(t => String(t).startsWith('HOUND ')), texts);
  // Orange fill used when both >25%
  const setFills = ctx.calls.filter(c => c[0] === 'set' && c[1] === 'fillStyle').map(c => c[2]);
  assert.ok(setFills.includes(METER_ORANGE), setFills);
});

test('drawScreenHpMeters corner-v uses red fill at ≤25%', () => {
  const ctx = fakeCtx();
  drawScreenHpMeters(ctx, {
    player: { hp: 30, maxHp: 300 }, // 10%
    enemy: { hp: 400, maxHp: 440 },
  }, 1280, 800, { layout: 'corner-v', topInset: 40 });
  const setFills = ctx.calls.filter(c => c[0] === 'set' && c[1] === 'fillStyle').map(c => c[2]);
  assert.ok(setFills.includes(METER_RED), setFills);
});

test('corner-v labels use phosphor digital color', () => {
  const ctx = fakeCtx();
  drawScreenHpMeters(ctx, {
    player: { hp: 120, maxHp: 300 },
    enemy: { hp: 220, maxHp: 440 },
  }, 1280, 800, { layout: 'corner-v', topInset: 40 });
  const fonts = ctx.calls.filter(c => c[0] === 'set' && c[1] === 'font').map(c => c[2]);
  assert.ok(fonts.some(f => String(f).includes('VT323')), fonts);
  const fills = ctx.calls.filter(c => c[0] === 'set' && c[1] === 'fillStyle').map(c => c[2]);
  assert.ok(fills.includes(METER_FRAME), fills);
});
