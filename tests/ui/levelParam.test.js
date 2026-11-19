/**
 * tests/ui/levelParam.test.js
 * Run: node tests/ui/levelParam.test.js
 */
import assert from 'node:assert/strict';
import { parseLevelParam } from '../../src/ui/levelParam.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.error(`FAIL: ${name}\n  ${e.message}`); }
}

test('?lv=1..5 is read', () => {
  assert.equal(parseLevelParam('?lv=5'), 5);
  assert.equal(parseLevelParam('?lv=1'), 1);
  assert.equal(parseLevelParam('lv=3&demo=1'), 3);
  assert.equal(parseLevelParam('?demo=1&lv=2'), 2);
});

test('absent or invalid ?lv is ignored (null)', () => {
  for (const bad of ['', '?', '?lv=', '?lv=0', '?lv=6', '?lv=-1', '?lv=2.5', '?lv=abc', '?lv=1e1', '?x=3', undefined, null]) {
    assert.equal(parseLevelParam(bad), null, String(bad));
  }
});

console.log(`levelParam: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
