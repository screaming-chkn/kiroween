/**
 * tests/ui/levelParam.test.js
 * Run: node tests/ui/levelParam.test.js
 */
import assert from 'node:assert/strict';
import { parseLevelParam, applyLevelParam, LV_FROM_URL_KEY } from '../../src/ui/levelParam.js';

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

const memStore = () => {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
};

test('?lv sets the level and marks it; the next plain load goes back to LV1 once', () => {
  const storage = memStore();
  const sets = [];
  const set = n => sets.push(n);
  assert.equal(applyLevelParam('?lv=5', { set, storage }), 5);
  assert.equal(storage.getItem(LV_FROM_URL_KEY), '1');
  assert.equal(applyLevelParam('', { set, storage }), 1);      // plain URL after ?lv=5
  assert.equal(storage.getItem(LV_FROM_URL_KEY), null);
  assert.equal(applyLevelParam('', { set, storage }), null);   // earned levels survive reloads again
  assert.deepEqual(sets, [5, 1]);
});

test('plain loads with no ?lv history change nothing; invalid ?lv is ignored', () => {
  const storage = memStore();
  const sets = [];
  assert.equal(applyLevelParam('', { set: n => sets.push(n), storage }), null);
  assert.equal(applyLevelParam('?lv=9', { set: n => sets.push(n), storage }), null);
  assert.equal(applyLevelParam('?lv=3', { set: n => sets.push(n), storage: null }), 3);   // no storage: still applies
  assert.deepEqual(sets, [3]);
});

console.log(`levelParam: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
