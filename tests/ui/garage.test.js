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
import { LOADOUT_EFFECTS, effectTokensFor } from '../../src/combat/loadoutEffects.js';
import { STERILE_TOKENS, POSSESSED_TOKENS } from '../../src/ui/possession.js';
import { formatDelta, statChipLabel, overdrawPenaltyPct, GARAGE_CSS, pickerEmptyHint, statRanges, statBarPct } from '../../src/ui/garage.js';
import { PARTS } from '../../src/data/parts.js';
import { defaultLoadout } from '../../src/data/presets.js';

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

test('≥960px media query switches body to three columns', () => {
  const mq = GARAGE_CSS.indexOf('@media (min-width: 960px)');
  assert.ok(mq >= 0, 'missing ≥960px media query');
  // Within the media query, the body uses a three-area template.
  const slice = GARAGE_CSS.slice(mq, mq + 400);
  assert.ok(
    /grid-template-areas:\s*"slots picker preview"/.test(slice),
    'three-column areas (slots | picker | preview) not set at ≥960px',
  );
});

test('default (<960px) body keeps slots | picker with preview wrapping', () => {
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
  // bone token is #E8E2D0; now wired through var(--color-bone, #E8E2D0) so it
  // reskins on possession while keeping the bone fallback.
  assert.ok(
    /border-color:\s*var\(--color-bone,\s*#E8E2D0\)/i.test(hover),
    'part hover border is not the bone token var (var(--color-bone, #E8E2D0))',
  );
});

test('garage CSS wires key chrome to possession tokens (reskins on .possessed)', () => {
  // Title, slots, borders, deploy, silhouette strokes and the séance button
  // must read from var(--color-*) so an instant .possessed swap repaints them.
  assert.ok(
    /color:\s*var\(--color-phosphor,/.test(block(GARAGE_CSS, '.hh-garage__title {')),
    'title colour must be wired to var(--color-phosphor)',
  );
  assert.ok(
    /background:\s*var\(--color-panel,/.test(block(GARAGE_CSS, '.hh-slot {')),
    'slot background must be wired to var(--color-panel)',
  );
  assert.ok(
    /border-top:\s*1px solid var\(--color-phosphor-dim,/.test(block(GARAGE_CSS, '.hh-garage__footer {')),
    'footer border must be wired to var(--color-phosphor-dim)',
  );
  assert.ok(
    /stroke:\s*var\(--color-phosphor,/.test(block(GARAGE_CSS, '.hh-sil__part {')),
    'silhouette stroke must be wired to var(--color-phosphor)',
  );
  assert.ok(
    /color:\s*var\(--color-ghost,/.test(block(GARAGE_CSS, '.hh-seance-btn {')),
    'séance button colour must be wired to var(--color-ghost)',
  );
  assert.ok(
    /background:\s*var\(--color-phosphor,/.test(block(GARAGE_CSS, '.hh-deploy {')),
    'deploy background must be wired to var(--color-phosphor)',
  );
});

// ── Phone layout (spec 08) ───────────────────────────────────────────────────

console.log('\nsrc/ui/garage.js — phone layout (≤700px)\n');

test('≤700px media query stacks body in a single column', () => {
  const mq = GARAGE_CSS.indexOf('@media (max-width: 700px)');
  assert.ok(mq >= 0, 'missing max-width: 700px media query');
  const slice = GARAGE_CSS.slice(mq).replace(/\s+/g, ' ');
  assert.ok(/grid-template-columns:\s*1fr;/.test(slice), 'single-column template missing');
  assert.ok(/"slots" "picker" "preview"/.test(slice), 'stacked areas missing');
  assert.ok(/overflow-y:\s*auto/.test(slice), 'vertical scroll missing');
  assert.ok(/env\(safe-area-inset-bottom\)/.test(slice), 'safe-area padding missing');
});

test('≤700px targets are at least 44px tall', () => {
  const mq = GARAGE_CSS.indexOf('@media (max-width: 700px)');
  assert.ok(/min-height:\s*44px/.test(GARAGE_CSS.slice(mq)), 'min-height: 44px missing');
});

test('desktop default rules still come before the phone override', () => {
  assert.ok(GARAGE_CSS.indexOf('@media (min-width: 1280px)') < GARAGE_CSS.indexOf('@media (max-width: 700px)'));
});

test('pickerEmptyHint: stacked never says "left"', () => {
  assert.equal(pickerEmptyHint(true), 'Select a slot above.');
  assert.ok(!pickerEmptyHint(true).includes('left'));
  assert.equal(pickerEmptyHint(false), 'Select a slot on the left.');
});

test('≤700px: sticky footer and scrolling body', () => {
  const mq = GARAGE_CSS.indexOf('@media (max-width: 700px)');
  const slice = GARAGE_CSS.slice(mq).replace(/\s+/g, ' ');
  const footer = slice.match(/\.hh-garage__footer \{([^}]*)\}/);
  const body = slice.match(/\.hh-garage__body \{([^}]*)\}/);
  assert.ok(footer && /position:\s*sticky/.test(footer[1]), 'footer sticky missing');
  assert.ok(body && /overflow-y:\s*auto/.test(body[1]), 'body overflow-y missing');
});

test('present silhouette label uses the void colour; séance outline is ghost', () => {
  const present = GARAGE_CSS.match(/\.hh-sil__label--present \{([^}]*)\}/);
  assert.ok(present && /fill:\s*var\(--color-void,/.test(present[1]), 'present label must use void');
  assert.ok(/border:\s*1px solid var\(--color-ghost,/.test(block(GARAGE_CSS, '.hh-seance-btn {')));

test('GARAGE_CSS styles the wireframe depth edge', () => {
  assert.ok(GARAGE_CSS.includes('.hh-sil__edge'));
});
});

// ── M4.6: COMBAT line colour + tokens ──────────────────────────────────────

console.log('\nM4.6 — garage COMBAT line\n');

test('COMBAT line is phosphor green in the sterile (unpossessed) garage palette', () => {
  // Root cause of the grey line: var(--color-phosphor) is steel grey while unpossessed.
  assert.notEqual(STERILE_TOKENS['--color-phosphor'].toUpperCase(), POSSESSED_TOKENS['--color-phosphor'].toUpperCase());
  const rule = GARAGE_CSS.match(/\.hh-option__effect \{([^}]*)\}/);
  assert.ok(rule, '.hh-option__effect rule exists');
  const color = /(?:^|;|\n)\s*color:\s*([^;]+);/.exec(rule[1]);
  assert.ok(color, 'effect rule sets a colour');
  assert.ok(!/var\(--color-phosphor/.test(color[1]), 'must not use the possession-themed phosphor slot');
  assert.equal(color[1].trim().slice(0, 7).toUpperCase(), POSSESSED_TOKENS['--color-phosphor'].toUpperCase());
});

test('no phone media query overrides the COMBAT line colour', () => {
  const phone = GARAGE_CSS.slice(GARAGE_CSS.indexOf('@media (max-width: 700px)'));
  assert.ok(!/hh-option__effect/.test(phone));
});

test('COMBAT line wraps as tokens with roomier line-height', () => {
  const rule = GARAGE_CSS.match(/\.hh-option__effect \{([^}]*)\}/)[1];
  assert.match(rule, /flex-wrap:\s*wrap/);
  const lh = Number(/line-height:\s*([\d.]+)/.exec(rule)[1]);
  assert.ok(lh >= 1.45, `line-height ${lh}`);
  const tok = GARAGE_CSS.match(/\.hh-option__effect-token \{([^}]*)\}/);
  assert.ok(tok && /white-space:\s*nowrap/.test(tok[1]));
});

test('effectTokensFor splits every COMBAT line into short tokens that rebuild the text', () => {
  for (const [id, eff] of Object.entries(LOADOUT_EFFECTS)) {
    const t = effectTokensFor(id, true);
    assert.equal(t.label, 'COMBAT', id);
    assert.equal(t.text, eff.text, id);
    assert.ok(t.tokens.length >= 1 && t.tokens.length <= 3, id);
    for (const tok of t.tokens) {
      assert.ok(tok.length <= 28, `${id}: "${tok}" too long`);
      assert.ok(!/^[,;\s]|[,;\s]$/.test(tok), `${id}: "${tok}" untrimmed`);
    }
    const norm = s => s.replace(/[,;]\s*/g, '|');
    assert.equal(norm(eff.text.replace(/^COMBAT:\s*/, '')), t.tokens.join('|'), id);
  }
  assert.deepEqual(effectTokensFor('armR-hatchet', true).tokens, ['shots deal 18 (base 14)', '+32% reload']);
});

test('effectTokensFor is null when the flag is off or the part has no effect', () => {
  assert.equal(effectTokensFor('armR-hatchet', false), null);
  assert.equal(effectTokensFor('legs-runner', true), null);
});

// ── M4.7: preview art fits its box ──────────────────────────────────────────

console.log('\nM4.7 — garage preview fit\n');

test('preview art box never flex-shrinks below its SVG (no spill under 1280px)', () => {
  const art = GARAGE_CSS.match(/\.hh-preview__art \{([^}]*)\}/);
  assert.ok(art, '.hh-preview__art rule exists');
  assert.match(art[1], /flex-shrink:\s*0/);
  const prev = GARAGE_CSS.match(/\.hh-preview \{([^}]*)\}/)[1];
  assert.match(prev, /overflow-y:\s*auto/, 'preview column scrolls instead of clipping');
  const svg = GARAGE_CSS.match(/\.hh-preview__svg \{([^}]*)\}/)[1];
  assert.match(svg, /max-height:\s*220px/);
});

// ── Stat bar scaling ────────────────────────────────────────────────────────

console.log('\nstat bar scaling\n');

const BAR_KEYS = ['armor', 'speed', 'damage', 'sensor'];
const BAR_SLOTS = ['legs', 'core', 'armL', 'armR', 'back', 'head'];

test('statRanges matches a brute-force per-slot min/max sum', () => {
  const r = statRanges();
  for (const key of BAR_KEYS) {
    let min = 0;
    let max = 0;
    for (const slot of BAR_SLOTS) {
      const vals = PARTS.filter(p => p.slot === slot).map(p => p.stats[key]);
      if (!vals.length) continue;
      min += Math.min(...vals);
      max += Math.max(...vals);
    }
    assert.equal(r[key].min, min, `${key} min`);
    assert.equal(r[key].max, max, `${key} max`);
  }
});

test('every stat range has max > min', () => {
  const r = statRanges();
  for (const key of BAR_KEYS) assert.ok(r[key].max > r[key].min, key);
});

test('statBarPct: 100 at max, 10 at min, 55 mid, clamped outside', () => {
  const range = { min: 10, max: 30 };
  assert.equal(statBarPct(30, range), 100);
  assert.equal(statBarPct(10, range), 10);
  assert.equal(statBarPct(20, range), 55);
  assert.equal(statBarPct(99, range), 100);
  assert.equal(statBarPct(-5, range), 10);
  assert.equal(statBarPct(5, { min: 5, max: 5 }), 100);
  assert.equal(typeof statBarPct(20, range), 'number');
});

test('default loadout: speed bar is full, sensor bar is above 80', () => {
  const lo = defaultLoadout();
  const stats = { armor: 0, speed: 0, damage: 0, sensor: 0 };
  for (const slot of BAR_SLOTS) {
    const part = PARTS.find(p => p.id === lo[slot]);
    if (!part) continue;
    for (const key of BAR_KEYS) stats[key] += part.stats[key];
  }
  const r = statRanges();
  assert.equal(statBarPct(stats.speed, r.speed), 100);
  assert.ok(statBarPct(stats.sensor, r.sensor) > 80);
});

test('landscape phones: the garage body is the only scroll pane (no inner panes)', () => {
  const at = GARAGE_CSS.indexOf('@media (max-width: 959px) and (max-height: 500px)');
  assert.ok(at >= 0, 'missing landscape-phone media query');
  const blk = GARAGE_CSS.slice(at, GARAGE_CSS.indexOf('\n}\n', at));
  assert.match(blk, /\.hh-garage__body\s*\{[^}]*overflow-y:\s*auto/);
  assert.match(blk, /\.hh-preview\s*\{\s*overflow:\s*visible/);
});

// ── Haunting (spec 12, R6) ──────────────────────────────────────────────────

console.log('\nsrc/ui/garage.js — haunting (spec 12, R6)\n');

const HAUNT_START = GARAGE_CSS.indexOf('Haunting (spec 12, R6)');
const HAUNT_END = GARAGE_CSS.indexOf('end Haunting (spec 12, R6)');
const HAUNT_CSS = GARAGE_CSS.slice(HAUNT_START, HAUNT_END);

test('haunting block sits before the reduced-motion block', () => {
  assert.ok(HAUNT_START >= 0 && HAUNT_END > HAUNT_START, 'haunting block markers missing');
  assert.ok(HAUNT_END < GARAGE_CSS.indexOf('@media (prefers-reduced-motion: reduce)'));
});

test('wisp keyframes exist and only animate transform and opacity', () => {
  for (const name of ['hh-wisp-a', 'hh-wisp-b']) {
    const at = GARAGE_CSS.indexOf(`@keyframes ${name}`);
    assert.ok(at >= 0, `missing @keyframes ${name}`);
    const open = GARAGE_CSS.indexOf('{', at);
    let depth = 0;
    let end = open;
    for (let i = open; i < GARAGE_CSS.length; i++) {
      if (GARAGE_CSS[i] === '{') depth++;
      if (GARAGE_CSS[i] === '}' && --depth === 0) { end = i; break; }
    }
    const body = GARAGE_CSS.slice(open + 1, end);
    const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map(m => m[1]);
    assert.ok(props.length > 0, `${name} has no declarations`);
    for (const p of props) assert.ok(p === 'transform' || p === 'opacity', `${name} animates ${p}`);
  }
});

test('wisp pseudo-elements ignore pointer events and stay at or under 0.35 opacity', () => {
  const rule = block(HAUNT_CSS, '.hh-preview__art::before,');
  assert.match(rule, /pointer-events:\s*none/);
  assert.match(rule, /z-index:\s*-1/);
  const op = Number(/opacity:\s*([\d.]+)/.exec(rule)[1]);
  assert.ok(op <= 0.35, `opacity ${op}`);
  for (const m of HAUNT_CSS.matchAll(/opacity:\s*([\d.]+)/g)) assert.ok(Number(m[1]) <= 0.35, `opacity ${m[1]}`);
});

test('reduced motion turns both wisp animations off', () => {
  const at = GARAGE_CSS.indexOf('@media (prefers-reduced-motion: reduce)');
  const blk = GARAGE_CSS.slice(at, GARAGE_CSS.indexOf('\n}\n', at)).replace(/\s+/g, ' ');
  assert.match(blk, /\.hh-preview__art::before,\s*\.hh-preview__art::after \{ animation: none; \}/);
});

test('preview SVG sits above the wisps (z-index 1)', () => {
  const rule = block(HAUNT_CSS, '.hh-preview__svg {');
  assert.match(rule, /position:\s*relative/);
  assert.match(rule, /z-index:\s*1\b/);
});

test('haunting block adds no hex colours beyond the token fallbacks', () => {
  const allowed = new Set(['#9FD8FF', '#1F9E57', '#121A15', '#0A0D0B']);
  const hexes = HAUNT_CSS.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
  for (const h of hexes) assert.ok(allowed.has(h.toUpperCase()), `unexpected hex ${h}`);
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
