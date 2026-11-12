/**
 * tests/ui/seance.test.js
 *
 * Pure / DOM-free tests for the séance terminal's data + formatting layer.
 * No browser DOM is touched — we only exercise the exported pure helpers:
 *
 *   • parseTasksMd        (scripts/build-seance-tasks.mjs) — markdown ledger parse
 *   • taskLineText        (src/ui/seance.js)               — one task → line text
 *   • unlockedLineText    (src/ui/seance.js)               — UNLOCKED ghost line
 *   • countDone           (src/ui/seance.js)               — done-count summary
 *   • seanceLines         (src/ui/seance.js)               — flatten + filter
 *
 * Run with Node (no framework):
 *
 *   node tests/ui/seance.test.js
 *
 * Node built-in assert + ES module imports only.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTasksMd, collectTasks } from '../../scripts/build-seance-tasks.mjs';
import {
  taskLineText,
  shortTaskTitle,
  fullTaskLineText,
  unlockedLineText,
  countDone,
  seanceLines,
} from '../../src/ui/seance.js';

const __testDir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__testDir, '..', '..');

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

// ── parseTasksMd (scripts/build-seance-tasks.mjs) ─────────────────────────────

console.log('\nscripts/build-seance-tasks.mjs — parseTasksMd\n');

test('parses a done task line ([x])', () => {
  const rows = parseTasksMd('- [x] 1. Page shell', '01-core-engine');
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    spec: '01-core-engine',
    id: 1,
    title: 'Page shell',
    done: true,
  });
});

test('parses an open task line ([ ])', () => {
  const rows = parseTasksMd('- [ ] 3. Relay capture', '04-radar-relays');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].done, false);
  assert.equal(rows[0].id, 3);
  assert.equal(rows[0].title, 'Relay capture');
});

test('ignores headers, prose, and blank lines', () => {
  const md = [
    '# 04-radar-relays — Tasks (draft)',
    '',
    'Some intro prose that is not a task.',
    '- [ ] 1. First task',
    '## A sub-heading',
    '- [x] 2. Second task',
    '',
  ].join('\n');
  const rows = parseTasksMd(md, '04-radar-relays');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, 1);
  assert.equal(rows[1].id, 2);
  assert.equal(rows[1].done, true);
});

test('accepts uppercase [X] as done and tolerates leading whitespace', () => {
  const rows = parseTasksMd('   - [X] 7. Indented done task', '03-arena-combat');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].done, true);
  assert.equal(rows[0].id, 7);
  assert.equal(rows[0].title, 'Indented done task');
});

test('non-string input returns an empty array (defensive)', () => {
  assert.deepEqual(parseTasksMd(null, 'x'), []);
  assert.deepEqual(parseTasksMd(undefined, 'x'), []);
  assert.deepEqual(parseTasksMd(42, 'x'), []);
});

test('stamps the spec name on every record', () => {
  const rows = parseTasksMd('- [ ] 1. A\n- [x] 2. B', '02-mech-builder');
  assert.ok(rows.every((r) => r.spec === '02-mech-builder'));
});

test('attaches unlockedPart for a mapped done task', () => {
  // 01-core-engine#6 → "Static Bell" per UNLOCKED_PART_MAP; only when done.
  const done = parseTasksMd('- [x] 6. Audio buses', '01-core-engine');
  assert.equal(done[0].unlockedPart, 'Static Bell');
  const open = parseTasksMd('- [ ] 6. Audio buses', '01-core-engine');
  assert.equal(open[0].unlockedPart, undefined);
});

// ── taskLineText (src/ui/seance.js) ───────────────────────────────────────────

console.log('\nsrc/ui/seance.js — taskLineText\n');

test('done task renders with [x] box', () => {
  const text = taskLineText({ spec: '01-core-engine', id: 2, title: 'Loop', done: true });
  assert.equal(text, '[x] 01-core-engine 2. Loop');
});

test('open task renders with [ ] box', () => {
  const text = taskLineText({ spec: '04-radar-relays', id: 3, title: 'Static', done: false });
  assert.equal(text, '[ ] 04-radar-relays 3. Static');
});

// ── unlockedLineText (src/ui/seance.js) ───────────────────────────────────────

console.log('\nsrc/ui/seance.js — shortTaskTitle / fullTaskLineText\n');

test('Task 26 of 03-arena-combat (real JSON) renders the short line', () => {
  const committed = JSON.parse(readFileSync(join(REPO_ROOT, 'public', 'seance-tasks.json'), 'utf8'));
  const t = committed.find((x) => x.spec === '03-arena-combat' && x.id === 26);
  assert.ok(t, 'task 26 missing');
  assert.equal(taskLineText(t), '[x] 03-arena-combat 26. Enemy shot windup ~0.45 s');
  assert.ok(fullTaskLineText(t).includes('ENEMY_SHOT_WINDUP_MS'), 'full title kept');
});

test("first of ':' or ';' wins", () => {
  assert.equal(shortTaskTitle('A: b; c'), 'A');
  assert.equal(shortTaskTitle('A; b: c'), 'A');
});

test('no separator -> trimmed full title', () => {
  assert.equal(shortTaskTitle('  Plain title  '), 'Plain title');
});

test('fullTaskLineText keeps the whole title', () => {
  const t = { spec: 's', id: 4, title: 'Head: tail; more', done: false };
  assert.equal(fullTaskLineText(t), '[ ] s 4. Head: tail; more');
  assert.equal(taskLineText(t), '[ ] s 4. Head');
});

// ── unlockedLineText (src/ui/seance.js) ───────────────────────────────────────

console.log('\nsrc/ui/seance.js — unlockedLineText\n');

test('returns an UNLOCKED line when the task unlocked a part', () => {
  assert.equal(unlockedLineText({ unlockedPart: 'Scout Frame' }), 'UNLOCKED: Scout Frame');
});

test('returns null when nothing was unlocked', () => {
  assert.equal(unlockedLineText({}), null);
  assert.equal(unlockedLineText(null), null);
});

// ── countDone (src/ui/seance.js) ──────────────────────────────────────────────

console.log('\nsrc/ui/seance.js — countDone\n');

test('counts only done tasks', () => {
  const tasks = [{ done: true }, { done: false }, { done: true }, { done: false }];
  assert.equal(countDone(tasks), 2);
});

test('returns 0 for an empty or non-array input', () => {
  assert.equal(countDone([]), 0);
  assert.equal(countDone(null), 0);
  assert.equal(countDone(undefined), 0);
});

// ── seanceLines (src/ui/seance.js) ────────────────────────────────────────────

console.log('\nsrc/ui/seance.js — seanceLines\n');

test('flattens tasks to renderable task lines', () => {
  const tasks = [
    { spec: '01-core-engine', id: 1, title: 'A', done: true },
    { spec: '01-core-engine', id: 2, title: 'B', done: false },
  ];
  const lines = seanceLines(tasks, 'all');
  assert.equal(lines.length, 2);
  assert.equal(lines[0].kind, 'task');
  assert.equal(lines[0].done, true);
  assert.equal(lines[0].text, '[x] 01-core-engine 1. A');
  assert.equal(lines[1].done, false);
});

test('emits an unlocked line after a done task that unlocked a part', () => {
  const tasks = [{ spec: '02-mech-builder', id: 1, title: 'Frame', done: true, unlockedPart: 'Scout Frame' }];
  const lines = seanceLines(tasks, 'all');
  assert.equal(lines.length, 2);
  assert.equal(lines[0].kind, 'task');
  assert.equal(lines[1].kind, 'unlocked');
  assert.equal(lines[1].text, 'UNLOCKED: Scout Frame');
});

test("filter 'done' keeps only done tasks", () => {
  const tasks = [
    { spec: 's', id: 1, title: 'A', done: true },
    { spec: 's', id: 2, title: 'B', done: false },
  ];
  const lines = seanceLines(tasks, 'done');
  assert.equal(lines.length, 1);
  assert.equal(lines[0].done, true);
});

test("filter 'open' keeps only open tasks", () => {
  const tasks = [
    { spec: 's', id: 1, title: 'A', done: true },
    { spec: 's', id: 2, title: 'B', done: false },
  ];
  const lines = seanceLines(tasks, 'open');
  assert.equal(lines.length, 1);
  assert.equal(lines[0].done, false);
});

test('non-array input yields no lines', () => {
  assert.deepEqual(seanceLines(null), []);
  assert.deepEqual(seanceLines(undefined), []);
});


// ── committed seance-tasks.json freshness ─────────────────────────────────────

console.log('\npublic/seance-tasks.json — freshness\n');

test('committed JSON matches crawl of .kiro/specs/*/tasks.md', () => {
  const fromSpecs = collectTasks(join(REPO_ROOT, '.kiro', 'specs'));
  const committed = JSON.parse(readFileSync(join(REPO_ROOT, 'public', 'seance-tasks.json'), 'utf8'));
  assert.equal(
    committed.length,
    fromSpecs.length,
    `stale seance-tasks.json: committed ${committed.length} tasks, specs have ${fromSpecs.length}. Run: npm run build:seance`,
  );
  assert.deepEqual(
    committed,
    fromSpecs,
    'stale seance-tasks.json content. Run: npm run build:seance and commit public/seance-tasks.json',
  );
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\nseance: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
