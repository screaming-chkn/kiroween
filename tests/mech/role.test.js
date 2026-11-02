/**
 * tests/mech/role.test.js
 *
 * Unit tests for src/mech/role.js — roleTag().
 * Runnable with Node (no browser, no framework):
 *
 *   node tests/mech/role.test.js
 */

import assert from 'node:assert/strict';
import { roleTag } from '../../src/mech/role.js';

// ── Minimal harness ───────────────────────────────────────────────────────────

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

// ── Test fixtures ─────────────────────────────────────────────────────────────
// Small in-line parts table — no dependency on src/data/parts.js so tests
// are isolated and fast.

const PARTS = {
  scout1:   { id: 'scout1',   slot: 'legs', roles: ['SCOUT'] },
  scout2:   { id: 'scout2',   slot: 'armL', roles: ['SCOUT'] },
  bruiser1: { id: 'bruiser1', slot: 'armR', roles: ['BRUISER'] },
  both1:    { id: 'both1',    slot: 'back', roles: ['SCOUT', 'BRUISER'] },
  long1:    { id: 'long1',    slot: 'head', roles: ['LONGSHOT'] },
  norole:   { id: 'norole',   slot: 'head', roles: [] },
  // Core parts for tie-break tests
  core_scout:   { id: 'core_scout',   slot: 'core', roles: ['SCOUT'] },
  core_bruiser: { id: 'core_bruiser', slot: 'core', roles: ['BRUISER'] },
  core_norole:  { id: 'core_norole',  slot: 'core', roles: [] },
};

console.log('\nsrc/mech/role.js — roleTag\n');

// ── Basic vote counting ───────────────────────────────────────────────────────

test('returns null for fully empty loadout', () => {
  const loadout = { legs: null, core: null, armL: null, armR: null, back: null, head: null };
  assert.equal(roleTag(loadout, PARTS), null);
});

test('returns null when no parts are in partsById', () => {
  const loadout = { legs: 'ghost', core: null, armL: null, armR: null, back: null, head: null };
  assert.equal(roleTag(loadout, PARTS), null);
});

test('single SCOUT part → SCOUT', () => {
  const loadout = { legs: 'scout1', core: null, armL: null, armR: null, back: null, head: null };
  assert.equal(roleTag(loadout, PARTS), 'SCOUT');
});

test('single BRUISER part → BRUISER', () => {
  const loadout = { legs: null, core: null, armL: null, armR: 'bruiser1', back: null, head: null };
  assert.equal(roleTag(loadout, PARTS), 'BRUISER');
});

test('majority wins outright — 2 SCOUT vs 1 BRUISER → SCOUT', () => {
  const loadout = { legs: 'scout1', core: null, armL: 'scout2', armR: 'bruiser1', back: null, head: null };
  assert.equal(roleTag(loadout, PARTS), 'SCOUT');
});

test('part with two roles counts for both', () => {
  // both1 has SCOUT + BRUISER, bruiser1 has BRUISER → BRUISER=2, SCOUT=1
  const loadout = { legs: null, core: null, armL: null, armR: 'bruiser1', back: 'both1', head: null };
  assert.equal(roleTag(loadout, PARTS), 'BRUISER');
});

test('LONGSHOT can win outright', () => {
  const loadout = { legs: null, core: null, armL: null, armR: null, back: null, head: 'long1' };
  assert.equal(roleTag(loadout, PARTS), 'LONGSHOT');
});

test('part with empty roles array contributes no votes', () => {
  const loadout = { legs: 'scout1', core: null, armL: null, armR: null, back: null, head: 'norole' };
  assert.equal(roleTag(loadout, PARTS), 'SCOUT');
});

// ── Tie-breaking ──────────────────────────────────────────────────────────────

test('tie broken by Core part first listed role', () => {
  // scout1 (SCOUT) + bruiser1 (BRUISER) = 1 each → Core decides
  const loadout = { legs: 'scout1', core: 'core_bruiser', armL: null, armR: 'bruiser1', back: null, head: null };
  assert.equal(roleTag(loadout, PARTS), 'BRUISER');
});

test('tie broken by Core when Core favours SCOUT', () => {
  const loadout = { legs: 'scout1', core: 'core_scout', armL: null, armR: 'bruiser1', back: null, head: null };
  assert.equal(roleTag(loadout, PARTS), 'SCOUT');
});

test('tie with core having no roles → lexicographic fallback', () => {
  // BRUISER vs SCOUT, 1 each — core has no roles → alphabetic → BRUISER < SCOUT
  const loadout = { legs: 'scout1', core: 'core_norole', armL: null, armR: 'bruiser1', back: null, head: null };
  assert.equal(roleTag(loadout, PARTS), 'BRUISER');
});

test('tie with unequipped core → lexicographic fallback', () => {
  const loadout = { legs: 'scout1', core: null, armL: null, armR: 'bruiser1', back: null, head: null };
  assert.equal(roleTag(loadout, PARTS), 'BRUISER');
});

test('tie-break is deterministic on repeated calls', () => {
  const loadout = { legs: 'scout1', core: 'core_bruiser', armL: null, armR: 'bruiser1', back: null, head: null };
  const first  = roleTag(loadout, PARTS);
  const second = roleTag(loadout, PARTS);
  assert.equal(first, second);
});

// ── Immutability ──────────────────────────────────────────────────────────────

test('roleTag does not mutate loadout', () => {
  const loadout = { legs: 'scout1', core: null, armL: null, armR: null, back: null, head: null };
  const copy    = { ...loadout };
  roleTag(loadout, PARTS);
  assert.deepEqual(loadout, copy);
});

test('roleTag does not mutate partsById', () => {
  const loadout = { legs: 'scout1', core: null, armL: null, armR: null, back: null, head: null };
  const keysBefore = Object.keys(PARTS).join(',');
  roleTag(loadout, PARTS);
  assert.equal(Object.keys(PARTS).join(','), keysBefore);
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
