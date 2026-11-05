/**
 * scripts/build-seance-tasks.mjs — HAUNT//HOUND séance task crawler.
 *
 * Reads every `.kiro/specs/<spec>/tasks.md`, parses its task checklist lines
 * (`- [x] N. title` / `- [ ] N. title`), and writes a flat
 * `public/seance-tasks.json` the séance terminal UI reads at runtime.
 *
 * Output shape (array):
 *   [{ spec, id, title, done, unlockedPart? }, ...]
 *
 * The parser (`parseTasksMd`) is a PURE function with no I/O so it can be unit
 * tested with plain Node. The file-crawling / writing lives in `main()` which
 * only runs when this module is executed directly (not when imported by tests).
 *
 * Run directly:  node scripts/build-seance-tasks.mjs
 * Wired as npm `prebuild` and `build:seance`.
 *
 * ES modules only; Node built-ins only; no external dependencies.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Config ─────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SPECS_DIR = join(REPO_ROOT, '.kiro', 'specs');
const OUT_DIR   = join(REPO_ROOT, 'public');
const OUT_FILE  = join(OUT_DIR, 'seance-tasks.json');

/**
 * UNLOCKED_PART_MAP — a small, hand-curated mapping from `"<spec>#<id>"` to a
 * part name. When a matching task is DONE, the séance UI shows an
 * `UNLOCKED: <part>` ghost line beneath it. Hardcoded on purpose (MVP); the
 * names come from src/data/parts.js so they read in-world.
 *
 * Keyed by `"<spec>#<id>"` to avoid collisions across specs (every spec
 * restarts its own 1..N numbering).
 */
export const UNLOCKED_PART_MAP = {
  '02-mech-builder#1': 'Scout Frame',
  '02-mech-builder#6': 'Runner Legs',
  '03-arena-combat#3': 'Rivet Cannon',
  '03-arena-combat#7': 'Ghost Plating',
  '01-core-engine#6':  'Static Bell',
};

// ── Pure parser ──────────────────────────────────────────────────────────────

/**
 * Parse the body of a `tasks.md` file into structured task records.
 *
 * Recognises lines of the form (leading whitespace tolerated):
 *   - [x] 12. Some done task title
 *   - [ ] 3. Some open task title
 *
 * The checkbox mark may be `x` or `X` (done) or a space (open). Lines that are
 * not task checklist items (headers, prose, blank lines) are ignored.
 *
 * PURE: no I/O, deterministic, returns a fresh array.
 *
 * @param {string} md    Raw markdown text.
 * @param {string} spec  Spec name to stamp on each record (e.g. "02-mech-builder").
 * @returns {{spec:string,id:number,title:string,done:boolean,unlockedPart?:string}[]}
 */
export function parseTasksMd(md, spec = '') {
  const out = [];
  if (typeof md !== 'string') return out;

  // - [x] 12. title   /   - [ ] 3. title
  //   ^ checkbox        ^ id   ^ title
  const LINE_RE = /^\s*-\s*\[([ xX])\]\s*(\d+)\.\s*(.+?)\s*$/;

  for (const raw of md.split(/\r?\n/)) {
    const m = LINE_RE.exec(raw);
    if (!m) continue;

    const done  = m[1].toLowerCase() === 'x';
    const id    = Number(m[2]);
    const title = m[3].trim();

    const record = { spec, id, title, done };

    const partKey = `${spec}#${id}`;
    if (done && Object.prototype.hasOwnProperty.call(UNLOCKED_PART_MAP, partKey)) {
      record.unlockedPart = UNLOCKED_PART_MAP[partKey];
    }

    out.push(record);
  }

  return out;
}

/**
 * Crawl every spec directory under `specsDir`, parse its `tasks.md`, and return
 * one flat array of task records across all specs (specs sorted by name, tasks
 * in file order). PURE w.r.t. the passed reader so it stays testable.
 *
 * @param {string} specsDir           Path to `.kiro/specs`.
 * @param {(p:string)=>string} readFile  File reader (defaults to readFileSync utf8).
 * @param {(p:string)=>string[]} listDirs Spec-name lister (defaults to fs).
 * @returns {object[]}
 */
export function collectTasks(specsDir, readFile = (p) => readFileSync(p, 'utf8'),
                             listDirs = (p) => readdirSync(p, { withFileTypes: true })
                               .filter((d) => d.isDirectory())
                               .map((d) => d.name)) {
  const specs = listDirs(specsDir).sort();
  const all = [];
  for (const spec of specs) {
    const tasksPath = join(specsDir, spec, 'tasks.md');
    if (!existsSync(tasksPath)) continue;
    const md = readFile(tasksPath);
    all.push(...parseTasksMd(md, spec));
  }
  return all;
}

// ── Entry point (only when run directly) ─────────────────────────────────────

function main() {
  const tasks = collectTasks(SPECS_DIR);

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(tasks, null, 2) + '\n', 'utf8');

  const done = tasks.filter((t) => t.done).length;
  console.log(`seance: wrote ${tasks.length} tasks (${done} done) → ${OUT_FILE}`);
}

// Run only when invoked as a script, not when imported by tests.
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
