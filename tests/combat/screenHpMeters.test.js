import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCREEN_HP_LAYOUT, screenHpTopReserve, drawScreenHpMeters,
  meterFillColor, METER_ORANGE, METER_RED, METER_RED_PCT, METER_FRAME, METER_FONT,
  METER_LINE_GAP, METER_FIELD_GAP, arenaTopLineSy, meterTopInset, cornerVGeometry,
  sideOutGeometry, meterSideReserve, arenaSideEdges,
} from '../../src/combat/screenHpMeters.js';
import { playerHudLabel, enemyHudLabel } from '../../src/combat/mechNames.js';

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

test('SCREEN_HP_LAYOUT is side-out (C4)', () => {
  assert.equal(SCREEN_HP_LAYOUT, 'side-out');
});

test('meterFillColor: orange above 25%, red at ≤25%', () => {
  assert.equal(meterFillColor(1), METER_ORANGE);
  assert.equal(meterFillColor(0.26), METER_ORANGE);
  assert.equal(meterFillColor(METER_RED_PCT), METER_RED);
  assert.equal(meterFillColor(0.1), METER_RED);
  assert.equal(meterFillColor(0), METER_RED);
});

test('screenHpTopReserve: side-out and legacy corner-v', () => {
  assert.ok(screenHpTopReserve('side-out') >= 0);
  assert.ok(screenHpTopReserve('corner-v') >= 20);
  assert.equal(screenHpTopReserve('vertical'), 0);
  assert.ok(screenHpTopReserve('top') >= 28);
});

test('drawScreenHpMeters side-out draws mech names + HP cur/max', () => {
  const ctx = fakeCtx();
  drawScreenHpMeters(ctx, {
    player: { hp: 72, maxHp: 100 },
    enemy: { hp: 220, maxHp: 440 },
  }, 1280, 800, {
    layout: 'side-out', topInset: 40, arenaLeft: 200, arenaRight: 1080, scale: 1,
  });
  const texts = ctx.calls.filter(c => c[0] === 'fillText').map(c => c[1]);
  assert.ok(texts.some(t => String(t) === playerHudLabel()), texts);
  assert.ok(texts.some(t => String(t) === enemyHudLabel()), texts);
  assert.ok(texts.some(t => String(t) === '72/100'), texts);
  assert.ok(texts.some(t => String(t) === '220/440'), texts);
  assert.ok(!texts.some(t => String(t).includes('HOUND')), texts);
  const setFills = ctx.calls.filter(c => c[0] === 'set' && c[1] === 'fillStyle').map(c => c[2]);
  assert.ok(setFills.includes(METER_ORANGE), setFills);
});

test('drawScreenHpMeters side-out uses red fill at ≤25%', () => {
  const ctx = fakeCtx();
  drawScreenHpMeters(ctx, {
    player: { hp: 10, maxHp: 100 },
    enemy: { hp: 400, maxHp: 440 },
  }, 1280, 800, { layout: 'side-out', topInset: 40, arenaLeft: 200, arenaRight: 1080 });
  const setFills = ctx.calls.filter(c => c[0] === 'set' && c[1] === 'fillStyle').map(c => c[2]);
  assert.ok(setFills.includes(METER_RED), setFills);
});

test('side-out labels use Press Start 2P / Orbitron', () => {
  const ctx = fakeCtx();
  drawScreenHpMeters(ctx, {
    player: { hp: 120, maxHp: 300 },
    enemy: { hp: 220, maxHp: 440 },
  }, 1280, 800, { layout: 'side-out', topInset: 40, arenaLeft: 180, arenaRight: 1100 });
  const fonts = ctx.calls.filter(c => c[0] === 'set' && c[1] === 'font').map(c => c[2]);
  assert.ok(fonts.some(f => String(f).includes('Press Start 2P') || String(f).includes('Orbitron')), fonts);
});

test('METER_FONT leads with Press Start 2P (digital), keeps Orbitron fallback', () => {
  assert.ok(METER_FONT.includes('Press Start 2P'), METER_FONT);
  assert.ok(METER_FONT.includes('Orbitron'), METER_FONT);
  assert.ok(METER_FONT.includes('monospace'));
});

test('arenaTopLineSy: bottom edge of the 2 wu border in screen space', () => {
  const cam = { x: 600, y: 450, zoom: 0.8 };
  assert.ok(Math.abs(arenaTopLineSy(cam, 1280, 800, 0, 0, 600) - 41.6) < 1e-9);
  assert.ok(Math.abs(arenaTopLineSy(cam, 1280, 800, 0, 5, 600) - 46.6) < 1e-9);
  assert.equal(arenaTopLineSy({ x: NaN, y: 0, zoom: 1 }, 1280, 800), 0);
});

test('meterTopInset: line bottom + 8 CSS px scaled (C8 HUD_SPACE)', () => {
  assert.equal(METER_LINE_GAP, 8);
  assert.ok(Math.abs(meterTopInset(41.6, 1) - 49.6) < 1e-9);
  assert.equal(meterTopInset(100, 3), 124);
});

test('sideOutGeometry: groups stay outside arena edges by ≥8 CSS px', () => {
  assert.equal(METER_FIELD_GAP, 8);
  for (const [vpW, vpH, scale, left, right] of [
    [1280, 800, 1, 160, 1120],
    [1688, 780, 2, 300, 1388],
    [844, 390, 1, 148, 696],
  ]) {
    const g = sideOutGeometry(vpW, vpH, {
      scale, topInset: 40, arenaLeft: left, arenaRight: right, compact: true,
    });
    assert.ok(g.player.x + g.player.w <= left - METER_FIELD_GAP * scale + 1e-6,
      `player ${g.player.x + g.player.w} vs ${left}`);
    assert.ok(g.enemy.x >= right + METER_FIELD_GAP * scale - 1e-6,
      `enemy ${g.enemy.x} vs ${right}`);
    assert.ok(g.fontPx / scale >= 12);
  }
});

test('legacy corner-v geometry still places groups under a topInset', () => {
  for (const [vpW, vpH, scale, lineBottom] of [[1280, 800, 1, 41.6], [1170, 2532, 3, 150]]) {
    const inset = meterTopInset(lineBottom, scale);
    const g = cornerVGeometry(vpW, vpH, { topInset: inset, scale, leftInset: 10 * scale, rightInset: 10 * scale });
    for (const grp of [g.player, g.enemy]) {
      assert.ok(grp.y >= lineBottom + 6 * scale - 1e-9);
    }
  }
});

test('meterSideReserve leaves room for the label groups', () => {
  assert.ok(meterSideReserve(1280, 800, { layout: 'side-out', arenaLeft: 200, arenaRight: 1080 }) > 40);
  assert.ok(meterSideReserve(390, 844, { layout: 'side-out', arenaLeft: 40, arenaRight: 350 }) < 390 / 2);
});

test('arenaSideEdges returns finite left/right', () => {
  const cam = { x: 600, y: 450, zoom: 0.5 };
  const e = arenaSideEdges(cam, 1280, 800, 1200, {});
  assert.ok(Number.isFinite(e.left) && Number.isFinite(e.right));
  assert.ok(e.left < e.right);
});
