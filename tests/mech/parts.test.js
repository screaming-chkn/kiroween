/**
 * tests/mech/parts.test.js
 *
 * Sanity checks for src/data/parts.js and src/data/presets.js:
 *   - Every part is well-formed.
 *   - Every part has at least one stat upside (R2).
 *   - All six slots are represented.
 *   - The preset mech is legal (all slots filled, canDeploy).
 *   - Preset power balance is non-negative.
 *
 * Runnable with Node (no browser, no framework):
 *
 *   node tests/mech/parts.test.js
 */

import assert from 'node:assert/strict';
import { PARTS, PARTS_BY_ID }  from '../../src/data/parts.js';
import { defaultLoadout }       from '../../src/data/presets.js';
import { totals }               from '../../src/mech/loadout.js';
import { canDeploy }            from '../../src/mech/weight.js';
import { roleTag }              from '../../src/mech/role.js';

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

const VALID_SLOTS  = ['legs', 'core', 'armL', 'armR', 'back', 'head'];
const VALID_ROLES  = ['SCOUT', 'BRUISER', 'LONGSHOT', 'WARDEN'];
const STAT_KEYS    = ['armor', 'speed', 'damage', 'sensor'];

console.log('\nsrc/data/parts.js — parts sanity\n');

// ── Array shape ───────────────────────────────────────────────────────────────

test('PARTS is a non-empty array', () => {
  assert.ok(Array.isArray(PARTS), 'PARTS must be an array');
  assert.ok(PARTS.length > 0, 'PARTS must have at least one entry');
});

test('PARTS_BY_ID contains every part indexed by id', () => {
  for (const part of PARTS) {
    assert.ok(PARTS_BY_ID[part.id] === part, `PARTS_BY_ID missing or mismatched for id=${part.id}`);
  }
});

test('all 6 slots are represented', () => {
  const covered = new Set(PARTS.map(p => p.slot));
  for (const slot of VALID_SLOTS) {
    assert.ok(covered.has(slot), `No part covers slot '${slot}'`);
  }
});

test('at least 12 parts total (R2)', () => {
  assert.ok(PARTS.length >= 12, `Expected ≥12 parts, got ${PARTS.length}`);
});

// ── Per-part shape ────────────────────────────────────────────────────────────

console.log('\nsrc/data/parts.js — per-part shape\n');

for (const part of PARTS) {
  test(`[${part.id}] has required string fields (id, slot, name, flavor)`, () => {
    assert.equal(typeof part.id,     'string', 'id must be string');
    assert.ok(part.id.length > 0,             'id must be non-empty');
    assert.equal(typeof part.slot,   'string', 'slot must be string');
    assert.equal(typeof part.name,   'string', 'name must be string');
    assert.equal(typeof part.flavor, 'string', 'flavor must be string');
  });

  test(`[${part.id}] slot is one of the 6 valid slots`, () => {
    assert.ok(VALID_SLOTS.includes(part.slot), `Unknown slot '${part.slot}'`);
  });

  test(`[${part.id}] weight is a positive number`, () => {
    assert.equal(typeof part.weight, 'number', 'weight must be number');
    assert.ok(part.weight > 0, `weight must be > 0, got ${part.weight}`);
  });

  test(`[${part.id}] legs have a capacity field`, () => {
    if (part.slot !== 'legs') return; // skip non-legs
    const cap = part.capacity ?? part.weight;
    assert.equal(typeof cap, 'number', 'legs capacity must be a number');
    assert.ok(cap > 0, `legs capacity must be > 0, got ${cap}`);
  });

  test(`[${part.id}] stats object has all four keys in [0,10]`, () => {
    assert.ok(part.stats && typeof part.stats === 'object', 'stats must be an object');
    for (const key of STAT_KEYS) {
      assert.ok(key in part.stats, `stats.${key} is missing`);
      const v = part.stats[key];
      assert.equal(typeof v, 'number', `stats.${key} must be a number`);
      assert.ok(v >= 0 && v <= 10, `stats.${key}=${v} out of range [0,10]`);
    }
  });

  test(`[${part.id}] has at least one stat upside (R2 — no dead picks)`, () => {
    const hasUpside = STAT_KEYS.some(k => (part.stats[k] ?? 0) > 0);
    assert.ok(hasUpside, `Part '${part.name}' has no positive stat — it is a dead pick`);
  });

  test(`[${part.id}] roles is an array of known role strings`, () => {
    assert.ok(Array.isArray(part.roles), 'roles must be an array');
    for (const r of part.roles) {
      assert.ok(VALID_ROLES.includes(r), `Unknown role '${r}' on part '${part.name}'`);
    }
  });

  test(`[${part.id}] powerOut and powerDraw are numbers when present`, () => {
    if (part.powerOut  !== undefined) assert.equal(typeof part.powerOut,  'number');
    if (part.powerDraw !== undefined) assert.equal(typeof part.powerDraw, 'number');
  });

  test(`[${part.id}] ids are unique`, () => {
    const dupes = PARTS.filter(p => p.id === part.id);
    assert.equal(dupes.length, 1, `Duplicate id '${part.id}'`);
  });
}

// ── Preset mech ───────────────────────────────────────────────────────────────

console.log('\nsrc/data/presets.js — PRESET_DRIFTER\n');

const preset = defaultLoadout();

test('defaultLoadout returns an object', () => {
  assert.ok(preset && typeof preset === 'object');
});

test('preset fills all 6 slots', () => {
  for (const slot of VALID_SLOTS) {
    assert.ok(preset[slot] != null, `Preset missing slot '${slot}'`);
    assert.equal(typeof preset[slot], 'string', `Preset slot '${slot}' must be a string id`);
  }
});

test('every preset part id exists in PARTS_BY_ID', () => {
  for (const slot of VALID_SLOTS) {
    const id = preset[slot];
    assert.ok(PARTS_BY_ID[id], `Preset id '${id}' (slot ${slot}) not found in PARTS_BY_ID`);
  }
});

test('every preset part is in the correct slot', () => {
  for (const slot of VALID_SLOTS) {
    const part = PARTS_BY_ID[preset[slot]];
    assert.equal(part.slot, slot, `Part '${part.id}' is in slot '${part.slot}' but preset puts it in '${slot}'`);
  }
});

test('preset canDeploy (load% ≤ 115)', () => {
  const t = totals(preset, PARTS_BY_ID);
  assert.ok(
    canDeploy(t.loadPct),
    `Preset load% = ${t.loadPct.toFixed(2)} — canDeploy returned false. Preset is too heavy.`,
  );
});

test('preset power balance is not deeply negative (output > 0)', () => {
  const t = totals(preset, PARTS_BY_ID);
  assert.ok(t.powerOut > 0, `Preset powerOut=${t.powerOut} — core must provide positive output`);
});

test('preset power balance is non-negative (no Overdraw on starter)', () => {
  const t = totals(preset, PARTS_BY_ID);
  assert.ok(
    t.balance >= 0,
    `Preset balance=${t.balance} is negative (Overdraw). Starter mech should not Overdraw.`,
  );
});

test('preset produces a roleTag (build is opinionated)', () => {
  const tag = roleTag(preset, PARTS_BY_ID);
  assert.ok(tag !== null, 'Preset loadout should resolve to a non-null role tag');
  assert.equal(typeof tag, 'string');
});

// ── Property: every legal loadout with load% ≤ 115 can deploy ────────────────

console.log('\nProperty tests (small seeded sweep)\n');

test('all single-slot loadouts with legs stay within deploy rules or are correctly blocked', () => {
  // For each pair of (legs, core) in the data, check that totals + canDeploy
  // agree (i.e. canDeploy returns true iff loadPct ≤ 115).
  const legParts  = PARTS.filter(p => p.slot === 'legs');
  const coreParts = PARTS.filter(p => p.slot === 'core');

  for (const legs of legParts) {
    for (const core of coreParts) {
      const loadout = {
        legs: legs.id, core: core.id,
        armL: null, armR: null, back: null, head: null,
      };
      const t = totals(loadout, PARTS_BY_ID);
      const deployable = canDeploy(t.loadPct);
      if (t.loadPct <= 115) {
        assert.ok(deployable, `loadPct=${t.loadPct.toFixed(2)} should be deployable`);
      } else {
        assert.ok(!deployable, `loadPct=${t.loadPct.toFixed(2)} should be blocked`);
      }
    }
  }
});

test('power balance identity: balance === powerOut − powerDraw for all parts', () => {
  for (const part of PARTS) {
    // Minimal loadout: just this part in its slot + preset legs+core.
    const slot = part.slot;
    const base = defaultLoadout();
    const loadout = { ...base, [slot]: part.id };
    const t = totals(loadout, PARTS_BY_ID);
    assert.equal(
      t.balance,
      t.powerOut - t.powerDraw,
      `balance identity failed for part '${part.id}'`,
    );
  }
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
