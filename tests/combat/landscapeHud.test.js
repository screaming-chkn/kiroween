/**
 * Landscape phone HUD (C3): meters and taunt stay below the arena green line,
 * the top bar stays above it with HP + MM:SS + HOUND, controls stay clear.
 */
import assert from 'node:assert/strict';
import { topBarLayout, topBarHeight, TOP_BAR, TOP_BAR_ORDER } from '../../src/combat/topBarHud.js';
import {
  arenaTopLineSy, meterTopInset, arenaSideInsets, cornerVGeometry, METER_LINE_GAP,
} from '../../src/combat/screenHpMeters.js';
import { tauntUnderLineY } from '../../src/ui/possessedTaunts.js';
import { landscapeStripW } from '../../src/ui/phoneCombatUi.js';
import { touchLayoutFor, LANDSCAPE_GUTTER_FRAC } from '../../src/engine/touch.js';

const SIZES = [[844, 390], [667, 375], [915, 412]];
const AW = 1280;
const AH = 800;

for (const k of ['hp', 'timer', 'hound']) assert.ok(TOP_BAR_ORDER.includes(k), `order has ${k}`);

for (const dpr of [1, 2, 3]) {
  for (const [cssW, cssH] of SIZES) {
    const vpW = cssW * dpr;
    const vpH = cssH * dpr;
    const opts = { pauseReserve: TOP_BAR.pauseReserve, compact: true };
    const bar = topBarLayout(vpW, dpr, opts);
    const ids = bar.cells.map(c => c.id);
    for (const k of ['hp', 'timer', 'hound']) assert.ok(ids.includes(k), `${k} kept ${cssW}x${cssH}`);
    assert.ok(!ids.includes('en') && !ids.includes('power'), 'EN/POWER dropped');
    assert.equal(bar.rows.length, 1, 'single row');
    assert.equal(topBarHeight(vpW, dpr, opts), TOP_BAR.rowH * dpr);
    for (const c of bar.cells) {
      assert.ok(c.x >= 0 && c.x + c.w <= vpW, 'cell on screen');
      assert.ok(c.w >= 40 * dpr, `${c.id} wide enough`);
    }
    const hp = bar.cells.find(c => c.id === 'hp');
    const timer = bar.cells.find(c => c.id === 'timer');
    const hound = bar.cells.find(c => c.id === 'hound');
    assert.ok(hp.x + hp.w <= timer.x && timer.x + timer.w <= hound.x, 'cells do not overlap');
    assert.ok(hound.x + hound.w <= vpW - TOP_BAR.pauseReserve * dpr, 'clear of pause button');

    // Landscape fit as in main.js: arena centred, strip reserve top and bottom.
    const reserve = 2 * (TOP_BAR.rowH + 4) * dpr;
    const stripW = landscapeStripW(vpW, dpr, LANDSCAPE_GUTTER_FRAC);
    const zoom = Math.min(stripW / AW, (vpH - reserve) / AH) * 0.95;
    const cam = { x: AW / 2, y: AH / 2, zoom };
    const stripBottom = bar.h;
    const line = Math.max(arenaTopLineSy(cam, vpW, vpH, 0, 0, AW / 2), stripBottom);
    assert.ok(line >= stripBottom, 'green line is not under the strip');

    const inset = meterTopInset(line, dpr);
    assert.ok(inset >= line + METER_LINE_GAP * dpr - 1e-6, 'meter inset >= line + 6px');
    const g = cornerVGeometry(vpW, vpH, { topInset: inset, scale: dpr, compact: true });
    assert.ok(g.player.y >= line + METER_LINE_GAP * dpr - 1e-6, 'meter group below line');
    assert.ok(g.enemy.y >= line + METER_LINE_GAP * dpr - 1e-6);
    const tauntBase = tauntUnderLineY({ lineBottom: line, scale: dpr, gap: 6 });
    assert.ok(tauntBase >= line + 6 * dpr, 'taunt baseline under line + 6px');

    // Meters live in the arena corners, between the control gutters.
    const ins = arenaSideInsets(cam, vpW, vpH, AW, { scale: dpr });
    const gm = cornerVGeometry(vpW, vpH, { topInset: inset, scale: dpr, compact: true, leftInset: ins.left, rightInset: ins.right });
    const gutter = vpW * LANDSCAPE_GUTTER_FRAC;
    assert.ok(gm.player.x >= gutter - 1e-6, 'player meter outside left gutter');
    assert.ok(gm.enemy.x + gm.enemy.w <= vpW - gutter + 1e-6, 'enemy meter outside right gutter');

    // Controls: fire + dash circles and the stick zone clear of meters and the strip.
    const L = touchLayoutFor(cssW, cssH);
    const min = Math.min(cssW, cssH);
    const stripCss = bar.h / dpr;
    for (const b of [L.fire, L.dash]) {
      const left = b.cxFrac * cssW - b.rFrac * min;
      const top = b.cyFrac * cssH - b.rFrac * min;
      assert.ok(left >= (vpW - gutter) / dpr - 1e-6, 'button inside right gutter');
      assert.ok(top >= stripCss, 'button below top bar');
      assert.ok(b.cyFrac * cssH + b.rFrac * min <= cssH, 'button on screen');
    }
    assert.ok(L.stick.xFrac * cssW + L.stick.wFrac * cssW <= gutter / dpr + 1e-6, 'stick zone inside left gutter');
    assert.ok(L.stick.yFrac * cssH >= stripCss, 'stick zone below top bar');
  }
}

// Portrait regression: the non-compact layouts are unchanged.
const pw = topBarLayout(390 * 3, 3, { pauseReserve: TOP_BAR.pauseReserve });
assert.equal(pw.narrow, true);
assert.equal(pw.rows.length, 2);
assert.equal(pw.cells.length, 7);
const dw = topBarLayout(1280, 1);
assert.equal(dw.rows.length, 1);
assert.equal(dw.cells.length, 7);
const gp = cornerVGeometry(390 * 3, 844 * 3, { scale: 3, topInset: 100 });
assert.equal(gp.h, Math.max(72, Math.min(120, Math.round(844 * 0.14))) * 3);

console.log('landscapeHud tests passed');
