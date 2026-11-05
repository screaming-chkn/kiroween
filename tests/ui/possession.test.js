/**
 * tests/ui/possession.test.js
 *
 * Pure / DOM-free tests for the possession theme toggle. We never touch a real
 * browser DOM — `applyPossessed` accepts an injectable `doc`, so we hand it a
 * tiny stub that mimics `documentElement.classList`.
 *
 *   node tests/ui/possession.test.js
 *
 * Node built-in assert + ES module imports only.
 */

import assert from 'node:assert/strict';
import {
  POSSESSED_CLASS,
  STERILE_TOKENS,
  POSSESSED_TOKENS,
  applyPossessed,
  isPossessed,
  possessionCSS,
} from '../../src/ui/possession.js';

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

/** A tiny stand-in for a document with a classList on documentElement. */
function makeDocStub() {
  const classes = new Set();
  return {
    documentElement: {
      classList: {
        toggle(name, on) {
          if (on === undefined) {
            classes.has(name) ? classes.delete(name) : classes.add(name);
          } else if (on) {
            classes.add(name);
          } else {
            classes.delete(name);
          }
          return classes.has(name);
        },
        contains: (name) => classes.has(name),
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
      },
    },
    _classes: classes,
  };
}

// ── token maps ───────────────────────────────────────────────────────────────

console.log('\nsrc/ui/possession.js — token maps\n');

test('sterile and possessed share the same token keys', () => {
  const sterile = Object.keys(STERILE_TOKENS).sort();
  const possessed = Object.keys(POSSESSED_TOKENS).sort();
  assert.deepEqual(sterile, possessed);
});

test('the two palettes actually differ (not an accidental copy)', () => {
  let diffs = 0;
  for (const k of Object.keys(POSSESSED_TOKENS)) {
    if (POSSESSED_TOKENS[k] !== STERILE_TOKENS[k]) diffs++;
  }
  assert.ok(diffs >= 4, `expected several token diffs, got ${diffs}`);
});

test('possessed palette keeps the haunted phosphor green', () => {
  assert.equal(POSSESSED_TOKENS['--color-phosphor'], '#39FF88');
  assert.equal(POSSESSED_TOKENS['--color-bone'], '#E8E2D0');
  assert.equal(POSSESSED_TOKENS['--color-ghost'], '#9FD8FF');
});

test('sterile phosphor is a cold grey, clearly NOT the hot possessed green', () => {
  // Sterile readouts must read as cold steel grey (R≈G≈B, no green dominance),
  // so the possession swap to #39FF88 is unmistakable.
  const sterile = STERILE_TOKENS['--color-phosphor'];
  assert.notEqual(sterile, POSSESSED_TOKENS['--color-phosphor'], 'sterile phosphor must differ');
  const r = parseInt(sterile.slice(1, 3), 16);
  const g = parseInt(sterile.slice(3, 5), 16);
  const b = parseInt(sterile.slice(5, 7), 16);
  // Neutral grey: channels within a narrow band of each other (no phosphor pop).
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  assert.ok(spread <= 24, `sterile phosphor should be near-neutral grey, channel spread ${spread}`);
  // Possessed green, by contrast, is strongly green-dominant.
  const pg = parseInt(POSSESSED_TOKENS['--color-phosphor'].slice(3, 5), 16);
  const pr = parseInt(POSSESSED_TOKENS['--color-phosphor'].slice(1, 3), 16);
  assert.ok(pg - pr > 100, 'possessed phosphor must stay strongly green-dominant');
});

// ── applyPossessed ───────────────────────────────────────────────────────────

console.log('\nsrc/ui/possession.js — applyPossessed\n');

test('applyPossessed(true) adds the possessed class', () => {
  const doc = makeDocStub();
  const state = applyPossessed(true, doc);
  assert.equal(state, true);
  assert.ok(doc._classes.has(POSSESSED_CLASS));
  assert.equal(isPossessed(doc), true);
});

test('applyPossessed(false) removes the possessed class', () => {
  const doc = makeDocStub();
  applyPossessed(true, doc);
  const state = applyPossessed(false, doc);
  assert.equal(state, false);
  assert.ok(!doc._classes.has(POSSESSED_CLASS));
  assert.equal(isPossessed(doc), false);
});

test('toggling is idempotent and coerces truthiness to a real boolean', () => {
  const doc = makeDocStub();
  assert.equal(applyPossessed(1, doc), true);
  assert.equal(applyPossessed(1, doc), true); // stays on
  assert.ok(doc._classes.has(POSSESSED_CLASS));
  assert.equal(applyPossessed(0, doc), false);
  assert.equal(applyPossessed('', doc), false);
  assert.ok(!doc._classes.has(POSSESSED_CLASS));
});

test('applyPossessed is a safe no-op without a document', () => {
  // Passing undefined doc (no global document in Node) must not throw and must
  // still echo the requested state.
  assert.equal(applyPossessed(true, undefined), true);
  assert.equal(applyPossessed(false, undefined), false);
});

// ── possessionCSS ─────────────────────────────────────────────────────────────

console.log('\nsrc/ui/possession.js — possessionCSS\n');

test('CSS declares :root defaults and the .possessed override', () => {
  const css = possessionCSS();
  assert.ok(css.includes(':root {'), 'has :root block');
  assert.ok(css.includes(`:root.${POSSESSED_CLASS} {`), 'has .possessed block');
  // Instant toggle — no transition on the custom properties (MVP: no wipe).
  assert.ok(!/transition/i.test(css), 'possession CSS must not animate the swap');
});

test('CSS carries both palettes signature colours', () => {
  const css = possessionCSS();
  assert.ok(css.includes('#39FF88'), 'possessed phosphor present');
  assert.ok(css.includes(STERILE_TOKENS['--color-phosphor']), 'sterile phosphor present');
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\npossession: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
