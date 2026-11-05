/**
 * tests/mech/role-tooltip.test.js
 *
 * Unit tests for src/mech/role.js — roleSources() and roleTooltip() (R9).
 * These back the garage's "Role from: …" tooltip that names the parts that set
 * the role tag.
 *
 * Runnable with Node (no browser, no framework):
 *
 *   node tests/mech/role-tooltip.test.js
 */

import assert from 'node:assert/strict';
import { roleSources, roleTooltip } from '../../src/mech/role.js';

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
// are isolated and fast. Slots mirror the real six-slot layout.

const PARTS = {
  scoutLegs: { id: 'scoutLegs', slot: 'legs', roles: ['SCOUT'] },
  scoutArm:  { id: 'scoutArm',  slot: 'armL', roles: ['SCOUT'] },
  scoutBack: { id: 'scoutBack', slot: 'back', roles: ['SCOUT'] },
  bruiser1:  { id: 'bruiser1',  slot: 'armR', roles: ['BRUISER'] },
  both1:     { id: 'both1',     slot: 'head', roles: ['SCOUT', 'BRUISER'] },
  long1:     { id: 'long1',     slot: 'head', roles: ['LONGSHOT'] },
  norole:    { id: 'norole',    slot: 'core', roles: [] },
  coreScout: { id: 'coreScout', slot: 'core', roles: ['SCOUT'] },
};

const EMPTY = { legs: null, core: null, armL: null, armR: null, back: null, head: null };

console.log('\nsrc/mech/role.js — roleSources / roleTooltip (R9)\n');

// ── roleSources ───────────────────────────────────────────────────────────────

test('empty loadout → no sources', () => {
  assert.deepEqual(roleSources({ ...EMPTY }, PARTS), []);
});

test('single SCOUT part → that slot only', () => {
  const loadout = { ...EMPTY, legs: 'scoutLegs' };
  assert.deepEqual(roleSources(loadout, PARTS), ['Legs']);
});

test('names every part voting for the winning role', () => {
  // SCOUT=3 (Legs, Arm L, Back), BRUISER=1 (Arm R) → SCOUT wins
  const loadout = { ...EMPTY, legs: 'scoutLegs', armL: 'scoutArm', back: 'scoutBack', armR: 'bruiser1' };
  assert.deepEqual(roleSources(loadout, PARTS), ['Legs', 'Arm L', 'Back']);
});

test('excludes parts that do not vote for the winning role', () => {
  // SCOUT=2 (Legs, Arm L), BRUISER=1 (Arm R) → SCOUT wins; Arm R excluded
  const loadout = { ...EMPTY, legs: 'scoutLegs', armL: 'scoutArm', armR: 'bruiser1' };
  assert.deepEqual(roleSources(loadout, PARTS), ['Legs', 'Arm L']);
});

test('dual-role part is listed when its role wins', () => {
  // both1 (SCOUT+BRUISER) + scoutLegs → SCOUT=2, BRUISER=1 → SCOUT wins
  // both the Legs and the Head (both1) voted SCOUT
  const loadout = { ...EMPTY, legs: 'scoutLegs', head: 'both1' };
  assert.deepEqual(roleSources(loadout, PARTS), ['Legs', 'Head']);
});

test('sources are returned in fixed slot order regardless of equip order', () => {
  // Equip Back first conceptually, but output must follow legs→…→head order.
  const loadout = { ...EMPTY, back: 'scoutBack', legs: 'scoutLegs', armL: 'scoutArm' };
  assert.deepEqual(roleSources(loadout, PARTS), ['Legs', 'Arm L', 'Back']);
});

test('core voting for the winning role is named among sources', () => {
  // scoutLegs (SCOUT) + coreScout (SCOUT) + bruiser1 (BRUISER) → SCOUT=2 wins
  // SCOUT voters, in slot order: Legs then Core
  const loadout = { ...EMPTY, legs: 'scoutLegs', armR: 'bruiser1', core: 'coreScout' };
  assert.deepEqual(roleSources(loadout, PARTS), ['Legs', 'Core']);
});

test('part with empty roles contributes no source', () => {
  const loadout = { ...EMPTY, legs: 'scoutLegs', core: 'norole' };
  assert.deepEqual(roleSources(loadout, PARTS), ['Legs']);
});

// ── roleTooltip ───────────────────────────────────────────────────────────────

test('empty loadout → empty tooltip string', () => {
  assert.equal(roleTooltip({ ...EMPTY }, PARTS), '');
});

test('tooltip formats a single source', () => {
  const loadout = { ...EMPTY, legs: 'scoutLegs' };
  assert.equal(roleTooltip(loadout, PARTS), 'Role from: Legs');
});

test('tooltip joins multiple sources with " + " in slot order', () => {
  // back (SCOUT) + legs (SCOUT) → listed in fixed slot order: Legs then Back
  const loadout = { ...EMPTY, back: 'scoutBack', legs: 'scoutLegs' };
  assert.equal(roleTooltip(loadout, PARTS), 'Role from: Legs + Back');
});

test('tooltip matches the R9 example shape', () => {
  // Three SCOUT parts → "Role from: Legs + Arm L + Back"
  const loadout = { ...EMPTY, legs: 'scoutLegs', armL: 'scoutArm', back: 'scoutBack' };
  assert.equal(roleTooltip(loadout, PARTS), 'Role from: Legs + Arm L + Back');
});

// ── Immutability ──────────────────────────────────────────────────────────────

test('roleSources does not mutate loadout', () => {
  const loadout = { ...EMPTY, legs: 'scoutLegs' };
  const copy = { ...loadout };
  roleSources(loadout, PARTS);
  assert.deepEqual(loadout, copy);
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
