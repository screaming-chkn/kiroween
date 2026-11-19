/**
 * Landscape phone HUD (C4): slim timer strip, meters OUTSIDE field edges,
 * taunt ABOVE the green top, controls clear, no HOUND/POWER/READY on strip.
 */
import assert from 'node:assert/strict';
import { topBarLayout, topBarHeight, TOP_BAR, TOP_BAR_ORDER } from '../../src/combat/topBarHud.js';
import {
  arenaTopLineSy, arenaTopLineTopSy, arenaBottomLineSy, arenaSideEdges, sideOutGeometry,
  METER_FIELD_GAP, SCREEN_HP_LAYOUT,
} from '../../src/combat/screenHpMeters.js';
import { tauntAboveLineY, TAUNT_ABOVE_GAP } from '../../src/ui/possessedTaunts.js';
import { landscapeStripW } from '../../src/ui/phoneCombatUi.js';
import { cameraYForEqualTauntBottomGap } from '../../src/engine/camera.js';
import { touchLayoutFor, LANDSCAPE_GUTTER_FRAC, stickRadiusPx } from '../../src/engine/touch.js';
import { playerHudLabel, enemyHudLabel } from '../../src/combat/mechNames.js';

const SIZES = [[844, 390], [667, 375], [915, 412]];
const AW = 1280;
const AH = 800;

assert.equal(SCREEN_HP_LAYOUT, 'side-out');
assert.ok(TOP_BAR_ORDER.includes('timer'));
assert.ok(!TOP_BAR_ORDER.includes('hp'));
assert.ok(!TOP_BAR_ORDER.includes('hound'));
assert.ok(!TOP_BAR_ORDER.includes('power'));
assert.ok(!TOP_BAR_ORDER.includes('ready'));
assert.ok(LANDSCAPE_GUTTER_FRAC <= 0.15 && LANDSCAPE_GUTTER_FRAC >= 0.13, 'C5 gutter ~0.144');
{
  const { fire, dash } = touchLayoutFor(844, 390);
  assert.ok(dash.cxFrac < fire.cxFrac && dash.cyFrac < fire.cyFrac, 'C5 thumb arc: dash up-left of fire (Digger)');
}
assert.ok(!playerHudLabel().includes('HOUND'));
assert.ok(!enemyHudLabel().includes('HOUND'));

for (const dpr of [1, 2, 3]) {
  for (const [cssW, cssH] of SIZES) {
    const vpW = cssW * dpr;
    const vpH = cssH * dpr;
    const opts = { pauseReserve: TOP_BAR.pauseReserve, compact: true };
    const bar = topBarLayout(vpW, dpr, opts);
    const ids = bar.cells.map(c => c.id);
    assert.ok(ids.includes('timer'), `timer kept ${cssW}x${cssH}`);
    for (const bad of ['hp', 'hound', 'en', 'power', 'ready']) {
      assert.ok(!ids.includes(bad), `${bad} dropped`);
    }
    assert.equal(bar.rows.length, 1, 'single row');
    assert.equal(topBarHeight(vpW, dpr, opts), TOP_BAR.rowH * dpr);
    const timer = bar.cells.find(c => c.id === 'timer');
    assert.ok(Math.abs(timer.x + timer.w / 2 - vpW / 2) < 1e-6, 'timer centred');

    const reserve = 2 * (TOP_BAR.rowH + 4) * dpr;
    // C5: ~10% wider than C4 landscapeStripW base, capped by gutters (matches main.js).
    const stripBase = landscapeStripW(vpW, dpr, LANDSCAPE_GUTTER_FRAC);
    const stripW = Math.min(vpW * (1 - 2 * LANDSCAPE_GUTTER_FRAC), stripBase * 1.1);
    const zoom = Math.min(stripW / AW, (vpH - reserve) / AH) * 0.95;
    const gapCanvas = TAUNT_ABOVE_GAP * dpr;
    const camY = cameraYForEqualTauntBottomGap({ arenaH: AH, zoom, vpH, gapCanvas });
    const cam = { x: AW / 2, y: camY, zoom };
    const stripBottom = bar.h;
    const lineBottom = Math.max(arenaTopLineSy(cam, vpW, vpH, 0, 0, AW / 2), stripBottom);
    const lineTop = Math.min(arenaTopLineTopSy(cam, vpW, vpH, 0, 0, AW / 2), lineBottom);
    assert.ok(lineBottom >= stripBottom, 'green line not under strip');

    const edges = arenaSideEdges(cam, vpW, vpH, AW, {});
    const g = sideOutGeometry(vpW, vpH, {
      scale: dpr, compact: true, topInset: lineTop,
      arenaLeft: edges.left, arenaRight: edges.right, gapCss: METER_FIELD_GAP,
    });
    assert.ok(Math.abs(g.top - lineTop) < 1e-6, 'meter top == arena top border');
    assert.ok(g.player.x + g.player.w <= edges.left - METER_FIELD_GAP * dpr + 1e-6,
      `player meter outside left: ${g.player.x + g.player.w} vs ${edges.left}`);
    assert.ok(g.enemy.x >= edges.right + METER_FIELD_GAP * dpr - 1e-6,
      `enemy meter outside right: ${g.enemy.x} vs ${edges.right}`);

    const tauntBase = tauntAboveLineY({ lineTop, scale: dpr, gap: TAUNT_ABOVE_GAP });
    assert.ok(tauntBase <= lineTop - TAUNT_ABOVE_GAP * dpr + 1e-6, 'taunt baseline above line');
    assert.ok(TAUNT_ABOVE_GAP >= 6, 'taunt field gap floor');
    const fieldBottom = arenaBottomLineSy(cam, vpW, vpH, AH, 0, 0, AW / 2);
    const bottomGapCss = (vpH - fieldBottom) / dpr;
    const tauntGapCss = (lineTop - tauntBase) / dpr;
    assert.ok(Math.abs(bottomGapCss - tauntGapCss) <= 2 + 1e-6,
      `bottom/taunt gap mismatch: ${bottomGapCss} vs ${tauntGapCss} @ ${cssW}x${cssH} dpr=${dpr}`);

    // Controls ≥44 CSS px and clear of meters / strip.
    const L = touchLayoutFor(cssW, cssH);
    const min = Math.min(cssW, cssH);
    const stripCss = bar.h / dpr;
    const gutter = vpW * LANDSCAPE_GUTTER_FRAC;
    for (const b of [L.fire, L.dash]) {
      const rCss = b.rFrac * min;
      assert.ok(rCss * 2 >= 44 - 1e-6, `button diameter ${rCss * 2} >= 44`);
      const left = b.cxFrac * cssW - rCss;
      const top = b.cyFrac * cssH - rCss;
      assert.ok(left >= (vpW - gutter) / dpr - 1e-6, 'button inside right gutter');
      assert.ok(left + 2 * rCss <= cssW + 1e-6, 'button on screen');
      assert.ok(top >= stripCss - 1e-6, 'button below top bar');
    }
    const stickR = stickRadiusPx(cssW, cssH);
    assert.ok(stickR * 2 >= 44 - 1e-6, `stick diameter ${stickR * 2}`);
    assert.ok(L.stick.xFrac * cssW + L.stick.wFrac * cssW <= gutter / dpr + 1e-6, 'stick in left gutter');
    assert.ok(L.stick.yFrac * cssH >= stripCss - 1e-6, 'stick below top bar');

    // C9: meter tops align to arena top border; bars hug L/R edge (may share Y
    // with the stick band — stick sits further out in the gutter than the bar).
    assert.ok(g.top + 1e-6 >= Math.min(lineTop, stripBottom) - 1e-6, 'meter at/below strip');
    const fireTop = L.fire.cyFrac * cssH - L.fire.rFrac * min;
    const eMeterBottom = (g.enemy.y + g.enemy.h) / dpr;
    assert.ok(eMeterBottom <= fireTop + 1e-6 || g.enemy.x / dpr >= (vpW - gutter) / dpr,
      'enemy meter clear of fire button');
  }
}

// Portrait / desktop: slim single-row strip (no POWER/READY/HP cells).
const pw = topBarLayout(390 * 3, 3, { pauseReserve: TOP_BAR.pauseReserve });
assert.equal(pw.rows.length, 1);
assert.ok(pw.cells.every(c => c.id === 'timer' || c.id === 'lv'));
const dw = topBarLayout(1280, 1);
assert.equal(dw.rows.length, 1);
assert.ok(dw.cells.find(c => c.id === 'timer'));

console.log('landscapeHud tests passed');
