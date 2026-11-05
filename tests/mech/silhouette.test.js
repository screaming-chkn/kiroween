/**
 * tests/mech/silhouette.test.js
 *
 * Pure-function tests for silhouetteSpec (src/mech/silhouette.js).
 * No DOM — runs under plain Node:
 *
 *   node tests/mech/silhouette.test.js
 *
 * Uses only Node's built-in assert module and ES module imports.
 */

import assert from 'node:assert/strict';
import { silhouetteSpec } from '../../src/mech/silhouette.js';
import { PARTS_BY_ID } from '../../src/data/parts.js';
import { defaultLoadout } from '../../src/data/presets.js';
import { SLOTS } from '../../src/mech/loadout.js';

// ── Minimal test harness ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\nsrc/mech/silhouette.js — silhouetteSpec\n');

test('returns one entry per slot', () => {
  const spec = silhouetteSpec(defaultLoadout(), PARTS_BY_ID);
  assert.deepEqual(Object.keys(spec).sort(), [...SLOTS].sort());
});

test('preset loadout marks every slot present with the part name', () => {
  const loadout = defaultLoadout();
  const spec = silhouetteSpec(loadout, PARTS_BY_ID);
  for (const slot of SLOTS) {
    assert.equal(spec[slot].present, true, `${slot} should be present`);
    assert.equal(spec[slot].id, loadout[slot]);
    assert.equal(spec[slot].name, PARTS_BY_ID[loadout[slot]].name);
  }
});

test('empty slot is marked not present with null id/name', () => {
  const loadout = { ...defaultLoadout(), back: null };
  const spec = silhouetteSpec(loadout, PARTS_BY_ID);
  assert.equal(spec.back.present, false);
  assert.equal(spec.back.id, null);
  assert.equal(spec.back.name, null);
  // Other slots unaffected.
  assert.equal(spec.legs.present, true);
});

test('unknown part id is treated as absent (not present)', () => {
  const loadout = { ...defaultLoadout(), head: 'does-not-exist' };
  const spec = silhouetteSpec(loadout, PARTS_BY_ID);
  assert.equal(spec.head.present, false);
  assert.equal(spec.head.id, null);
  assert.equal(spec.head.name, null);
});

test('missing partsById map is handled (all slots absent, no throw)', () => {
  const spec = silhouetteSpec(defaultLoadout());
  for (const slot of SLOTS) {
    assert.equal(spec[slot].present, false);
  }
});

test('empty loadout yields all-absent spec of the right shape', () => {
  const spec = silhouetteSpec({}, PARTS_BY_ID);
  for (const slot of SLOTS) {
    assert.deepEqual(spec[slot], { present: false, id: null, name: null });
  }
});

test('is pure — does not mutate the loadout argument', () => {
  const loadout = defaultLoadout();
  const snapshot = JSON.stringify(loadout);
  silhouetteSpec(loadout, PARTS_BY_ID);
  assert.equal(JSON.stringify(loadout), snapshot);
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
