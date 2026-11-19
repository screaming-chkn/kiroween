/**
 * tests/ui/hauntLevel.test.js
 * Run: node tests/ui/hauntLevel.test.js
 */
import assert from 'node:assert/strict';
import {
  MAX_HAUNT_LEVEL, hauntPressure, readHauntLevel, setHauntLevel, bumpHauntLevel,
  applyHauntPressure, formatHauntLabel, drawHauntLevel, hauntAdvancesOn,
  levelUpText, HAUNT_PRESSURE,
} from '../../src/ui/hauntLevel.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.error(`FAIL: ${name}\n  ${e.message}`); }
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !~ ${b}`);

test('hauntPressure ramp and cap', () => {
  near(hauntPressure(1), 0.8);
  near(hauntPressure(2), 1.0);
  near(hauntPressure(3), 1.1);
  near(hauntPressure(4), 1.17);
  near(hauntPressure(5), 1.2);
  near(hauntPressure(9), 1.2);
  assert.equal(MAX_HAUNT_LEVEL, 5);
});

test('level starts at 1 (in-memory fallback, no sessionStorage in node)', () => {
  assert.equal(typeof sessionStorage, 'undefined');
  assert.equal(readHauntLevel(), 1);
});

test('set / bump are clamped', () => {
  assert.equal(setHauntLevel(3), 3);
  assert.equal(readHauntLevel(), 3);
  assert.equal(bumpHauntLevel(), 4);
  assert.equal(bumpHauntLevel(), 5);
  assert.equal(bumpHauntLevel(), 5);
  assert.equal(setHauntLevel(0), 1);
  assert.equal(setHauntLevel(99), 5);
  assert.equal(setHauntLevel('abc'), 1);
});

test('uses sessionStorage key hh-haunt-lv when available', () => {
  const bag = {};
  globalThis.sessionStorage = {
    getItem: (k) => (k in bag ? bag[k] : null),
    setItem: (k, v) => { bag[k] = String(v); },
  };
  try {
    setHauntLevel(4);
    assert.equal(bag['hh-haunt-lv'], '4');
    bag['hh-haunt-lv'] = '2';
    assert.equal(readHauntLevel(), 2);
    globalThis.sessionStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    setHauntLevel(3);
    assert.equal(readHauntLevel(), 3);
  } finally {
    delete globalThis.sessionStorage;
    setHauntLevel(1);
  }
});

test('applyHauntPressure scales hp, maxHp, shotDamage on a copy', () => {
  const e = { x: 1, y: 2, hp: 1500, maxHp: 1500 };
  const a = applyHauntPressure(e, 1, { baseHp: 1500, baseDamage: 20 });
  assert.equal(a.hp, 1200); assert.equal(a.maxHp, 1200); assert.equal(a.shotDamage, 16);
  assert.equal(a.x, 1);
  assert.equal(e.hp, 1500); assert.equal(e.shotDamage, undefined);
  const b = applyHauntPressure(e, 3, { baseHp: 1500, baseDamage: 20 });
  assert.equal(b.hp, 1650); assert.equal(b.shotDamage, 22);
  const c = applyHauntPressure(e, 5, { baseHp: 1500, baseDamage: 20 });
  assert.equal(c.hp, 1800); assert.equal(c.shotDamage, 24);
  const d = applyHauntPressure(e, 2);   // defaults 1500 / 20
  assert.equal(d.hp, 1500); assert.equal(d.shotDamage, 20);
  assert.equal(applyHauntPressure(e, 4, { baseHp: 1500, baseDamage: 20 }).shotDamage, 23);
  // R6: LV4 must stay a 7-hit level (23 dmg vs 140 HP); 24 is LV5's 6-hit cliff.
  assert.equal(applyHauntPressure(e, 4).shotDamage < 24, true);
});

test('hauntAdvancesOn: level goes up only after a win', () => {
  assert.equal(hauntAdvancesOn('win', 'retry'), true);     // win + REDEPLOY
  assert.equal(hauntAdvancesOn('win', 'garage'), true);    // win + GARAGE
  assert.equal(hauntAdvancesOn('lose', 'retry'), false);   // loss + REDEPLOY
  assert.equal(hauntAdvancesOn('lose', 'garage'), false);  // loss + GARAGE
  assert.equal(hauntAdvancesOn('lose', null), false);
  assert.equal(hauntAdvancesOn('playing', 'retry'), false);
});

test('policy applied to the level: loss keeps LV, win bumps once', () => {
  try {
    setHauntLevel(2);
    if (hauntAdvancesOn('lose', 'retry')) bumpHauntLevel();
    if (hauntAdvancesOn('lose', 'garage')) bumpHauntLevel();
    assert.equal(readHauntLevel(), 2);
    if (hauntAdvancesOn('win', 'retry')) bumpHauntLevel();
    assert.equal(readHauntLevel(), 3);
  } finally {
    setHauntLevel(1);
  }
});

test('levelUpText shows the new level, empty at or below LV 1', () => {
  assert.equal(levelUpText(2), 'THE HAUNT RISES \u00b7 HAUNT LV 2. It remembers you.');
  assert.equal(levelUpText(5), 'THE HAUNT RISES \u00b7 HAUNT LV 5. It remembers you.');
  assert.equal(levelUpText(1), '');
  assert.equal(levelUpText(0), '');
  assert.equal(levelUpText(undefined), '');
  assert.deepEqual(Array.from(HAUNT_PRESSURE), [0.8, 1.0, 1.1, 1.17, 1.2]);
});

test('formatHauntLabel', () => {
  assert.equal(formatHauntLabel(1), 'HAUNT LV 1');
  assert.equal(formatHauntLabel(5), 'HAUNT LV 5');
});

test('drawHauntLevel: 13–14px font, balanced save/restore', () => {
  const log = { saves: 0, restores: 0, font: '', texts: [] };
  const target = { save() { log.saves++; }, restore() { log.restores++; }, fillText(t) { log.texts.push(t); } };
  const ctx = new Proxy(target, {
    get(t, k) { return k in t ? t[k] : () => {}; },
    set(t, k, v) { t[k] = v; if (k === 'font') log.font = v; return true; },
  });
  drawHauntLevel(ctx, 2, { x: 380, y: 8 });
  assert.equal(log.saves, log.restores);
  assert.deepEqual(log.texts, ['HAUNT LV 2']);
  const px = parseInt(log.font, 10);
  assert.ok(px >= 13 && px <= 14);
});

console.log(`hauntLevel: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
