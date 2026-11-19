/**
 * tests/ui/gutterHaunt.test.js — C9b gutter haunt (faint letterbox filigree).
 * Run: node tests/ui/gutterHaunt.test.js
 */
import assert from 'node:assert/strict';
import {
  GUTTER_HAUNT_ALPHA, GUTTER_HAUNT_STYLES, GUTTER_PALETTES, GUTTER_TILE,
  readGutterHaunt, getGutterHauntTile, clearGutterHauntCache, drawGutterHaunt,
} from '../../src/ui/gutterHaunt.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}

console.log('\nsrc/ui/gutterHaunt.js\n');

test('alpha is in owner faint band 4–6%', () => {
  assert.ok(GUTTER_HAUNT_ALPHA >= 0.04 && GUTTER_HAUNT_ALPHA <= 0.06);
});

test('readGutterHaunt defaults to silver; parses purple/off', () => {
  assert.equal(readGutterHaunt(''), 'silver');
  assert.equal(readGutterHaunt('?lv=3'), 'silver');
  assert.equal(readGutterHaunt('?gutter=purple'), 'purple');
  assert.equal(readGutterHaunt('gutter=violet&lv=1'), 'purple');
  assert.equal(readGutterHaunt('?gutter=off'), 'off');
  assert.equal(readGutterHaunt('?gutter=none'), 'off');
  assert.equal(readGutterHaunt('?gutter=silver'), 'silver');
});

test('palettes exist for silver and purple', () => {
  assert.ok(GUTTER_PALETTES.silver.line);
  assert.ok(GUTTER_PALETTES.purple.line);
  assert.deepEqual([...GUTTER_HAUNT_STYLES].sort(), ['off', 'purple', 'silver']);
});

test('drawGutterHaunt is a no-op for off / bad rect / missing ctx methods', () => {
  const calls = { save: 0, restore: 0, drawImage: 0 };
  const ctx = {
    save() { calls.save++; },
    restore() { calls.restore++; },
    beginPath() {},
    rect() {},
    clip() {},
    drawImage() { calls.drawImage++; },
    globalAlpha: 1,
  };
  drawGutterHaunt(ctx, { vpW: 100, vpH: 100, left: 20, right: 80, top: 10, bottom: 90, style: 'off' });
  assert.equal(calls.save, 0);
  // Without a canvas host, tile bake returns null → early return (no throw).
  clearGutterHauntCache();
  assert.doesNotThrow(() => drawGutterHaunt(ctx, {
    vpW: 100, vpH: 100, left: 20, right: 80, top: 10, bottom: 90, style: 'silver',
  }));
});

test('tile size constant is positive', () => {
  assert.ok(GUTTER_TILE >= 64);
});

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
