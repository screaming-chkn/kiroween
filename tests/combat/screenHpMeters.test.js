import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCREEN_HP_LAYOUT, screenHpTopReserve, drawScreenHpMeters,
  meterFillColor, METER_ORANGE, METER_RED, METER_RED_PCT, METER_FRAME, METER_FONT,
  METER_LINE_GAP, arenaTopLineSy, meterTopInset, cornerVGeometry, meterSideReserve,
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
  assert.ok(texts.some(t => String(t) === 'HP'), texts);
  assert.ok(texts.some(t => String(t) === 'HOUND'), texts);
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
  assert.ok(fonts.some(f => String(f).includes('Orbitron')), fonts);
  assert.ok(!fonts.some(f => String(f).includes('VT323')), fonts);
  const fills = ctx.calls.filter(c => c[0] === 'set' && c[1] === 'fillStyle').map(c => c[2]);
  assert.ok(fills.includes(METER_FRAME), fills);
});

test('METER_FONT leads with Orbitron', () => {
  assert.ok(METER_FONT.startsWith('Orbitron'), METER_FONT);
  assert.ok(METER_FONT.includes('monospace'));
});

test('arenaTopLineSy: bottom edge of the 2 wu border in screen space', () => {
  const cam = { x: 600, y: 450, zoom: 0.8 };
  // sy(0) = (0-450)*0.8 + 400 = 40; border adds 2 * 0.8.
  assert.ok(Math.abs(arenaTopLineSy(cam, 1280, 800, 0, 0, 600) - 41.6) < 1e-9);
  assert.ok(Math.abs(arenaTopLineSy(cam, 1280, 800, 0, 5, 600) - 46.6) < 1e-9);
  assert.equal(arenaTopLineSy({ x: NaN, y: 0, zoom: 1 }, 1280, 800), 0);
});

test('meterTopInset: line bottom + 6 CSS px scaled', () => {
  assert.equal(METER_LINE_GAP, 6);
  assert.ok(Math.abs(meterTopInset(41.6, 1) - 47.6) < 1e-9);
  assert.equal(meterTopInset(100, 3), 118);
});

test('corner-v: every part of both groups sits >= 6px under the line', () => {
  for (const [vpW, vpH, scale, lineBottom] of [[1280, 800, 1, 41.6], [1170, 2532, 3, 150], [1280, 800, 1, 0]]) {
    const inset = meterTopInset(lineBottom, scale);
    const g = cornerVGeometry(vpW, vpH, { topInset: inset, scale, leftInset: 10 * scale, rightInset: 10 * scale });
    for (const grp of [g.player, g.enemy]) {
      assert.ok(grp.y >= lineBottom + 6 * scale - 1e-9, `group top ${grp.y} vs line ${lineBottom}`);
      assert.ok(grp.x >= 0 && grp.x + grp.w <= vpW);
    }
    assert.ok(g.fontPx / scale >= 14);
  }
});

test('corner-v draw: no rect, label or frame starts above topInset', () => {
  const ctx = fakeCtx();
  const topInset = 60;
  drawScreenHpMeters(ctx, { player: { hp: 77, maxHp: 140 }, enemy: { hp: 272, maxHp: 440 } },
    1280, 800, { topInset });
  for (const c of ctx.calls) {
    if (c[0] === 'fillRect' || c[0] === 'strokeRect') assert.ok(c[2] >= topInset, `${c[0]} y=${c[2]}`);
    if (c[0] === 'fillText' || c[0] === 'strokeText') assert.ok(c[3] >= topInset, `${c[0]} y=${c[3]}`);
  }
  const baselines = ctx.calls.filter(c => c[0] === 'set' && c[1] === 'textBaseline').map(c => c[2]);
  assert.ok(baselines.every(b => b === 'top'), baselines);
});

test('meterSideReserve leaves room for the label groups', () => {
  assert.ok(meterSideReserve(1280, 800, {}) > 40);
  assert.ok(meterSideReserve(390, 844, {}) < 390 / 2);
});
