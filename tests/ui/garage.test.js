/**
 * tests/ui/garage.test.js
 *
 * Pure-function tests for the R8 "readable stats" chip formatters exported
 * from src/ui/garage.js. These helpers never touch the DOM, so they import
 * cleanly under Node (no browser, no framework):
 *
 *   node tests/ui/garage.test.js
 *
 * Uses only Node's built-in assert module and ES module imports.
 */

import assert from 'node:assert/strict';
import { formatDelta, statChipLabel, overdrawPenaltyPct, GARAGE_CSS } from '../../src/ui/garage.js';

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

// ── formatDelta ───────────────────────────────────────────────────────────────

console.log('\nsrc/ui/garage.js — formatDelta\n');

test('positive delta gets a leading +', () => {
  const r = formatDelta(3);
  assert.equal(r.text, '+3');
  assert.equal(r.cls, 'hh-delta--up');
});

test('negative delta keeps its minus sign', () => {
  const r = formatDelta(-2);
  assert.equal(r.text, '-2');
  assert.equal(r.cls, 'hh-delta--down');
});

test('zero delta renders as plus-minus zero', () => {
  const r = formatDelta(0);
  assert.equal(r.text, '±0');
  assert.equal(r.cls, 'hh-delta--same');
});

// ── statChipLabel ─────────────────────────────────────────────────────────────

console.log('\nsrc/ui/garage.js — statChipLabel\n');

test('uses unique 3-letter codes ARM/SPD/DMG/SEN', () => {
  assert.equal(statChipLabel('armor',  2), 'ARM +2');
  assert.equal(statChipLabel('speed', -1), 'SPD -1');
  assert.equal(statChipLabel('damage', 0), 'DMG ±0');
  assert.equal(statChipLabel('sensor', 4), 'SEN +4');
});

test('codes are all distinct (no first-letter collision)', () => {
  const keys = ['armor', 'speed', 'damage', 'sensor'];
  const codes = keys.map(k => statChipLabel(k, 0).split(' ')[0]);
  const unique = new Set(codes);
  assert.equal(unique.size, keys.length, `codes collide: ${codes.join(', ')}`);
});

test('label pairs a code with the signed delta text', () => {
  // Chip label must stay in sync with formatDelta's text.
  for (const d of [-5, -1, 0, 1, 7]) {
    assert.equal(statChipLabel('armor', d), `ARM ${formatDelta(d).text}`);
  }
});

// ── overdrawPenaltyPct ────────────────────────────────────────────────────────

console.log('\nsrc/ui/garage.js — overdrawPenaltyPct\n');

test('no penalty when output meets or exceeds draw', () => {
  assert.equal(overdrawPenaltyPct(10, 10), 0);
  assert.equal(overdrawPenaltyPct(12, 10), 0);
});

test('no penalty when there is no draw', () => {
  assert.equal(overdrawPenaltyPct(0, 0), 0);
  assert.equal(overdrawPenaltyPct(5, 0), 0);
});

test('penalty is (1 - output/draw) rounded to whole percent', () => {
  // output 8 / draw 10 → scale 0.8 → 20% reduction
  assert.equal(overdrawPenaltyPct(8, 10), 20);
  // output 5 / draw 10 → 50%
  assert.equal(overdrawPenaltyPct(5, 10), 50);
  // output 7 / draw 9 → 1 - 0.7777.. = 0.2222.. → 22%
  assert.equal(overdrawPenaltyPct(7, 9), 22);
});

test('zero output with positive draw is a full 100% penalty', () => {
  assert.equal(overdrawPenaltyPct(0, 10), 100);
});

test('negative output is clamped (never exceeds 100%)', () => {
  assert.equal(overdrawPenaltyPct(-5, 10), 100);
});

test('result is always within [0, 100]', () => {
  const cases = [[10, 10], [8, 10], [0, 10], [-3, 4], [1, 100], [99, 100]];
  for (const [out, draw] of cases) {
    const pct = overdrawPenaltyPct(out, draw);
    assert.ok(pct >= 0 && pct <= 100, `pct=${pct} for out=${out} draw=${draw}`);
    assert.ok(Number.isInteger(pct), `pct must be whole, got ${pct}`);
  }
});

test('penalty is monotonic non-decreasing as output falls (fixed draw)', () => {
  const draw = 10;
  let prev = -1;
  for (const out of [10, 9, 8, 5, 2, 0]) {
    const pct = overdrawPenaltyPct(out, draw);
    assert.ok(pct >= prev, `pct=${pct} should be ≥ previous ${prev} (out=${out})`);
    prev = pct;
  }
});

// ── R10 garage layout (CSS, DOM-free) ────────────────────────────────────────

console.log('\nsrc/ui/garage.js — R10 garage layout\n');

/** Collapse a CSS block's whitespace so property checks are robust. */
function block(css, selector) {
  const start = css.indexOf(selector);
  assert.ok(start >= 0, `selector not found: ${selector}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close).replace(/\s+/g, ' ').trim();
}

test('≥1280px media query switches body to three columns', () => {
  const mq = GARAGE_CSS.indexOf('@media (min-width: 1280px)');
  assert.ok(mq >= 0, 'missing ≥1280px media query');
  // Within the media query, the body uses a three-area template.
  const slice = GARAGE_CSS.slice(mq, mq + 400);
  assert.ok(
    /grid-template-areas:\s*"slots picker preview"/.test(slice),
    'three-column areas (slots | picker | preview) not set at ≥1280px',
  );
});

test('default (<1280px) body keeps slots | picker with preview wrapping', () => {
  const body = block(GARAGE_CSS, '.hh-garage__body {');
  assert.ok(body.includes('"slots picker"'), 'default should keep slots | picker row');
  assert.ok(body.includes('"preview preview"'), 'preview should wrap full-width by default');
});

test('stat bar track is at least 12px tall (R10)', () => {
  const track = block(GARAGE_CSS, '.hh-bar-track {');
  const m = track.match(/height:\s*(\d+)px/);
  assert.ok(m, 'bar track has no px height');
  assert.ok(Number(m[1]) >= 12, `bar track height ${m[1]}px < 12px`);
});

test('stat bar label is at least 12px (R10)', () => {
  const lbl = block(GARAGE_CSS, '.hh-bar-group__label {');
  const m = lbl.match(/font-size:\s*(\d+)px/);
  assert.ok(m, 'bar label has no px font-size');
  assert.ok(Number(m[1]) >= 12, `bar label font ${m[1]}px < 12px`);
});

test('warning line reserves height so the footer does not jump (R10)', () => {
  const notice = block(GARAGE_CSS, '.hh-notice {');
  assert.ok(/min-height:/.test(notice), 'notice line has no reserved min-height');
});

test('parts show a bone border on hover (R10)', () => {
  const hover = block(GARAGE_CSS, '.hh-option:hover {');
  // bone token is #E8E2D0.
  assert.ok(/border-color:\s*#E8E2D0/i.test(hover), 'part hover border is not bone (#E8E2D0)');
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
