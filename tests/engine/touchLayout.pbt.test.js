/**
 * tests/engine/touchLayout.pbt.test.js
 *
 * Seeded property tests for the landscape touch layout (spec 14-phone-landscape).
 * Runnable with plain Node:
 *
 *   node tests/engine/touchLayout.pbt.test.js
 *
 * No npm dependencies: node:assert + a mulberry32 PRNG, same style as
 * tests/combat/loadoutEffects.pbt.test.js. Every property uses a fixed seed.
 * A failure message carries the seed, case index and the case as JSON.
 *
 * Layout values are always read through touchLayoutFor (steering
 * phone-landscape.md: do not copy the literals into tests). P6 and P7 therefore
 * pin the C5 contract by relationship (gutter equals the stick zone width, the
 * layout is frozen, Dash is smaller than Fire), not by repeated literals.
 * The literal values live in src/engine/touch.js and tests/engine/touch.test.js.
 *
 * Sizes: 844x390 is the reference. The generator also tries nearby landscape
 * viewports (640..932 x 360..430, landscape only).
 *
 * Gaps: floor 12 CSS px (asserted); prefer 16 CSS px (documented only).
 */

import assert from 'node:assert/strict';
import { touchLayoutFor, LANDSCAPE_GUTTER_FRAC } from '../../src/engine/touch.js';

const MIN_HIT_DIAMETER = 44; // CSS px
const MIN_GAP = 12;          // CSS px (preferred 16, shipped is larger)
const REF = Object.freeze({ w: 844, h: 390 });
const EXTRA_SIZES = [[667, 375], [915, 412]];
const CASES = 300;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err && err.message ? err.message : err}`);
    failed++;
  }
}

/** Run `check(w, h)` on the reference size, extras and seeded random sizes. */
function forSizes(seed, check) {
  const sizes = [[REF.w, REF.h], ...EXTRA_SIZES];
  const rnd = mulberry32(seed);
  for (let i = 0; i < CASES; i++) {
    const w = Math.round(640 + rnd() * (932 - 640));
    const h = Math.round(360 + rnd() * (430 - 360));
    if (w > h) sizes.push([w, h]);
  }
  sizes.forEach(([w, h], i) => {
    try {
      check(w, h);
    } catch (err) {
      throw new Error(
        `${err.message}\n    seed=${seed} case=${i} input=${JSON.stringify({ w, h })}`,
      );
    }
  });
}

function geom(w, h) {
  const L = touchLayoutFor(w, h);
  const m = Math.min(w, h);
  const f = { x: L.fire.cxFrac * w, y: L.fire.cyFrac * h, r: L.fire.rFrac * m };
  const d = { x: L.dash.cxFrac * w, y: L.dash.cyFrac * h, r: L.dash.rFrac * m };
  return { L, f, d };
}

console.log('touchLayout.pbt');

test('P1 Fire and Dash diameter >= 44 CSS px (844x390 and nearby)', () => {
  forSizes(0xa11ce, (w, h) => {
    const { f, d } = geom(w, h);
    assert.ok(2 * f.r >= MIN_HIT_DIAMETER, `fire diameter ${2 * f.r}`);
    assert.ok(2 * d.r >= MIN_HIT_DIAMETER, `dash diameter ${2 * d.r}`);
  });
});

test('P2 Fire-Dash edge gap >= 12 CSS px (prefer 16)', () => {
  forSizes(0xb0b5, (w, h) => {
    const { f, d } = geom(w, h);
    const gap = Math.hypot(f.x - d.x, f.y - d.y) - f.r - d.r;
    assert.ok(gap >= MIN_GAP, `edge gap ${gap}`);
  });
});

test('P3 Fire and Dash sit in the right gutter, fully on-screen', () => {
  forSizes(0xc0ffee, (w, h) => {
    const { f, d } = geom(w, h);
    for (const [name, b] of [['fire', f], ['dash', d]]) {
      assert.ok(b.x / w >= 1 - LANDSCAPE_GUTTER_FRAC && b.x / w <= 1, `${name} cx ${b.x / w}`);
      assert.ok(b.x + b.r <= w && b.x - b.r >= 0, `${name} off-screen horizontally`);
      assert.ok(b.y + b.r <= h && b.y - b.r >= 0, `${name} off-screen vertically`);
    }
  });
  // Reference size: the whole circle stays inside the gutter too.
  const { f, d } = geom(REF.w, REF.h);
  const gutterLeft = (1 - LANDSCAPE_GUTTER_FRAC) * REF.w;
  assert.ok(f.x - f.r >= gutterLeft, 'fire circle leaves gutter on 844x390');
  assert.ok(d.x - d.r >= gutterLeft, 'dash circle leaves gutter on 844x390');
});

test('P4 Dash is up-left of Fire (smaller cx and smaller cy)', () => {
  forSizes(0xd00d, (w, h) => {
    const { L } = geom(w, h);
    assert.ok(L.dash.cxFrac < L.fire.cxFrac, 'dash not left of fire');
    assert.ok(L.dash.cyFrac < L.fire.cyFrac, 'dash not above fire');
  });
});

test('P5 rFrac gives >= 44 CSS px hit diameter on 844x390', () => {
  const L = touchLayoutFor(REF.w, REF.h);
  const m = Math.min(REF.w, REF.h);
  assert.ok(L.fire.rFrac * m * 2 >= MIN_HIT_DIAMETER, 'fire');
  assert.ok(L.dash.rFrac * m * 2 >= MIN_HIT_DIAMETER, 'dash');
});

test('P6 gutter fraction matches the stick zone and the layout is frozen', () => {
  const L = touchLayoutFor(REF.w, REF.h);
  assert.equal(LANDSCAPE_GUTTER_FRAC, L.stick.wFrac);
  assert.ok(Object.isFrozen(L) && Object.isFrozen(L.fire) && Object.isFrozen(L.dash));
  forSizes(0xe110, (w, h) => {
    assert.equal(touchLayoutFor(w, h), L, 'landscape sizes must share one layout');
  });
});

test('P7 Fire is the larger, lower, right-most button; fractions are stable', () => {
  const a = touchLayoutFor(REF.w, REF.h);
  const b = touchLayoutFor(REF.w, REF.h);
  assert.deepEqual(a.fire, b.fire);
  assert.deepEqual(a.dash, b.dash);
  assert.ok(a.fire.rFrac > a.dash.rFrac, 'fire not larger than dash');
  assert.ok(a.fire.cyFrac > a.dash.cyFrac, 'fire not lower than dash');
  assert.ok(a.fire.cxFrac > a.dash.cxFrac, 'fire not right of dash');
});

console.log(`touchLayout.pbt: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
