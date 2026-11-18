/**
 * scripts/build-site.mjs — HAUNT//HOUND static preview build (spec 10-polish, task 27).
 *
 * Copies exactly what the browser needs into an output folder and adds the
 * noindex files for the private preview:
 *   index.html (with a noindex meta), favicon.svg, LICENSE, src/**, assets/**,
 *   public/seance-tasks.json, _headers, robots.txt
 *
 * Run:  node scripts/build-site.mjs [outDir]
 * outDir defaults to env HH_SITE_OUT, else <repo>/deploy/site.
 * Wired as npm `build:site`.
 *
 * Pure helpers (`shouldCopy`, `listLocalImports`) are exported for tests.
 * `buildSite(outDir)` does the I/O. `main()` only runs when executed directly.
 *
 * ES modules only; Node built-ins only; no external dependencies.
 */

import {
  readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync,
  copyFileSync, rmSync, statSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

// ── Config ─────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(__dirname, '..');
export const DEFAULT_OUT = join(REPO_ROOT, 'deploy', 'site');

export const HEADERS_TXT = '/*\n  X-Robots-Tag: noindex, nofollow\n';
export const ROBOTS_TXT = 'User-agent: *\nDisallow: /\n';
export const NOINDEX_META = '<meta name="robots" content="noindex, nofollow">';

const ROOT_FILES = ['index.html', 'favicon.svg', 'LICENSE', 'public/seance-tasks.json'];
const ROOT_DIRS = ['src', 'assets'];
const MD_ALLOWED = new Set(['assets/audio/README.md']);

// ── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Should this repo-relative path be copied into the site?
 * Only the allow-listed root files and files under src/ and assets/ pass.
 * Markdown is dropped except assets/audio/README.md. Pure.
 *
 * @param {string} relPath  Repo-relative path ('/' or '\' separators).
 * @returns {boolean}
 */
export function shouldCopy(relPath) {
  if (typeof relPath !== 'string' || relPath === '') return false;
  const p = relPath.replace(/\\/g, '/').replace(/^\.\//, '');
  if (p.startsWith('/') || p.split('/').includes('..')) return false;
  if (p.split('/').some((seg) => seg === '.DS_Store' || seg === 'Thumbs.db')) return false;

  if (ROOT_FILES.includes(p)) return true;

  const top = p.split('/')[0];
  if (!ROOT_DIRS.includes(top) || !p.includes('/')) return false;
  if (/\.md$/i.test(p)) return MD_ALLOWED.has(p);
  return true;
}

/**
 * Relative module specifiers in a JS source: `import x from './a.js'`,
 * `import './a.js'`, `import('./a.js')` and `export ... from './a.js'`.
 * Bare specifiers and absolute URLs are ignored. Returns unique specifiers
 * in order of first appearance. Pure.
 *
 * @param {string} jsSource
 * @returns {string[]}
 */
export function listLocalImports(jsSource) {
  if (typeof jsSource !== 'string') return [];
  const src = jsSource
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

  const found = [];
  const add = (spec) => { if (!found.includes(spec)) found.push(spec); };
  const res = [
    /\b(?:import|export)\b[^'";]*?\bfrom\s*['"](\.{1,2}\/[^'"]+)['"]/g,
    /\bimport\s*['"](\.{1,2}\/[^'"]+)['"]/g,
    /\bimport\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g,
  ];
  const hits = [];
  for (const re of res) {
    let m;
    while ((m = re.exec(src)) !== null) hits.push({ at: m.index, spec: m[1] });
  }
  hits.sort((a, b) => a.at - b.at).forEach((h) => add(h.spec));
  return found;
}

/**
 * Throw if `outDir` is somewhere we must never wipe: the repo root, a parent
 * of it, the filesystem root, or the home dir. Pure (no I/O).
 */
export function assertSafeOutDir(outDir, repoRoot = REPO_ROOT, home = homedir()) {
  const out = resolve(outDir);
  const root = resolve(repoRoot);
  const fsRoot = resolve(sep);
  const containsRepo = root === out || root.startsWith(out.endsWith(sep) ? out : out + sep);
  if (out === fsRoot || out === resolve(home) || containsRepo) {
    throw new Error(`build-site: refusing to wipe unsafe output dir: ${out}`);
  }
}

/**
 * BUILD.txt body: which commit the site was built from, so a video or a bug
 * report can be matched to source. Pure.
 * @param {{ sha: string, dirty: boolean, builtAt: string }} info
 */
export function buildInfoText({ sha, dirty, builtAt }) {
  return `commit: ${sha}${dirty ? ' (+ uncommitted changes)' : ''}\nbuilt: ${builtAt}\n`;
}

/** Read the repo HEAD sha and whether the tree has uncommitted changes. */
export function gitBuildInfo(repoRoot = REPO_ROOT) {
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
    const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }).trim() !== '';
    return { sha, dirty };
  } catch {
    return { sha: 'unknown', dirty: false };
  }
}

/** Insert the noindex meta after the viewport meta. Pure. */
export function addNoindexMeta(html) {
  if (html.includes(NOINDEX_META)) return html;
  const re = /(<meta\s+name="viewport"[^>]*>)/i;
  if (!re.test(html)) throw new Error('build-site: viewport meta not found in index.html');
  return html.replace(re, `$1\n  ${NOINDEX_META}`);
}

// ── I/O ──────────────────────────────────────────────────────────────────────

function walk(dirAbs, out = []) {
  for (const ent of readdirSync(dirAbs, { withFileTypes: true })) {
    const abs = join(dirAbs, ent.name);
    if (ent.isDirectory()) walk(abs, out);
    else if (ent.isFile()) out.push(abs);
  }
  return out;
}

/**
 * Build the static site into `outDir` (wiped first). Returns the number of
 * files written and their total size in bytes.
 *
 * @param {string} outDir
 * @returns {{files:number, bytes:number}}
 */
export function buildSite(outDir = DEFAULT_OUT) {
  const out = resolve(outDir);
  assertSafeOutDir(out);

  const rels = [...ROOT_FILES];
  for (const dir of ROOT_DIRS) {
    const abs = join(REPO_ROOT, dir);
    if (!existsSync(abs)) continue;
    for (const f of walk(abs)) rels.push(relative(REPO_ROOT, f).split(sep).join('/'));
  }
  const toCopy = rels.filter(shouldCopy).sort();
  for (const rel of ROOT_FILES) {
    if (!existsSync(join(REPO_ROOT, rel))) throw new Error(`build-site: missing ${rel}`);
  }

  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  let files = 0;
  let bytes = 0;
  for (const rel of toCopy) {
    const dest = join(out, ...rel.split('/'));
    mkdirSync(dirname(dest), { recursive: true });
    if (rel === 'index.html') {
      writeFileSync(dest, addNoindexMeta(readFileSync(join(REPO_ROOT, rel), 'utf8')), 'utf8');
    } else {
      copyFileSync(join(REPO_ROOT, rel), dest);
    }
    files += 1;
    bytes += statSync(dest).size;
  }

  const build = buildInfoText({ ...gitBuildInfo(), builtAt: new Date().toISOString() });
  for (const [name, text] of [['_headers', HEADERS_TXT], ['robots.txt', ROBOTS_TXT], ['BUILD.txt', build]]) {
    const dest = join(out, name);
    writeFileSync(dest, text, 'utf8');
    files += 1;
    bytes += statSync(dest).size;
  }
  return { files, bytes };
}

// ── Entry point (only when run directly) ─────────────────────────────────────

async function main() {
  // scripts/build-seance-tasks.mjs exports only pure helpers (its build lives
  // in a private main()), so nothing is rebuilt here: the committed
  // public/seance-tasks.json is copied. If a callable is exported later, use it.
  try {
    const mod = await import('./build-seance-tasks.mjs');
    const fn = mod.build ?? mod.buildSeanceTasks;
    if (typeof fn === 'function') fn();
  } catch (err) {
    console.warn(`build-site: seance rebuild skipped (${err.message})`);
  }

  const outDir = process.argv[2] || process.env.HH_SITE_OUT || DEFAULT_OUT;
  const { files, bytes } = buildSite(outDir);
  console.log(`site: ${files} files, ${bytes} bytes → ${resolve(outDir)}`);
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
