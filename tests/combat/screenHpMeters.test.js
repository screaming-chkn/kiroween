import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCREEN_HP_LAYOUT, screenHpTopReserve, drawScreenHpMeters,
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

test('SCREEN_HP_LAYOUT is vertical or top', () => {
  assert.ok(SCREEN_HP_LAYOUT === 'vertical' || SCREEN_HP_LAYOUT === 'top');
});

test('screenHpTopReserve: top reserves strip, vertical does not', () => {
  assert.equal(screenHpTopReserve('vertical'), 0);
  assert.ok(screenHpTopReserve('top') >= 28);
});

test('drawScreenHpMeters vertical draws both edge bars + labels', () => {
  const ctx = fakeCtx();
  drawScreenHpMeters(ctx, {
    player: { hp: 120, maxHp: 300 },
    enemy: { hp: 220, maxHp: 440 },
  }, 1280, 800, { layout: 'vertical', topInset: 72, bottomInset: 150 });
  const fills = ctx.calls.filter(c => c[0] === 'fillRect');
  assert.ok(fills.length >= 4, `expected >=4 fillRect, got ${fills.length}`);
  const texts = ctx.calls.filter(c => c[0] === 'fillText').map(c => c[1]);
  assert.ok(texts.some(t => String(t).startsWith('HP ')), texts);
  assert.ok(texts.some(t => String(t).startsWith('HOUND ')), texts);
});

test('drawScreenHpMeters top draws two horizontal bars', () => {
  const ctx = fakeCtx();
  drawScreenHpMeters(ctx, {
    player: { hp: 120, maxHp: 300 },
    enemy: { hp: 220, maxHp: 440 },
  }, 1280, 800, { layout: 'top', topInset: 12, sidePad: 20 });
  const texts = ctx.calls.filter(c => c[0] === 'fillText').map(c => c[1]);
  assert.ok(texts.some(t => String(t).includes('120/300')), texts);
  assert.ok(texts.some(t => String(t).includes('220/440')), texts);
});
