/**
 * tests/engine/site.test.js
 *
 * Contract test for scripts/build-site.mjs (spec 10-polish, task 27, R7):
 * builds into a fresh temp folder and checks the copied file set, the noindex
 * files and that every relative import and index.html reference resolves.
 *
 *   node tests/engine/site.test.js
 */

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildSite, shouldCopy, listLocalImports, assertSafeOutDir, moduleGraph, addModulePreloads, REPO_ROOT,
} from '../../scripts/build-site.mjs';

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`  ok  ${name}`); }
  catch (err) { console.error(`FAIL  ${name}\n${err.stack}`); process.exitCode = 1; }
}

function listFiles(dir, base = dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, e.name);
    if (e.isDirectory()) listFiles(abs, base, out);
    else out.push(abs.slice(base.length + 1).split(/[\\/]/).join('/'));
  }
  return out;
}

const out = join(mkdtempSync(join(tmpdir(), 'hh-site-')), 'site');
const result = buildSite(out);
const files = listFiles(out);

test('buildSite reports file count and bytes', () => {
  assert.equal(result.files, files.length);
  assert.ok(result.bytes > 0);
});

test('core files exist', () => {
  for (const f of ['index.html', 'src/main.js', 'favicon.svg', 'LICENSE', 'public/seance-tasks.json']) {
    assert.ok(existsSync(join(out, f)), `missing ${f}`);
  }
});

test('every audio and font asset is copied', () => {
  const want = [
    ...readdirSync(join(REPO_ROOT, 'assets/audio')).filter((n) => /\.(ogg|mp3)$/.test(n)).map((n) => `assets/audio/${n}`),
    ...readdirSync(join(REPO_ROOT, 'assets/fonts')).filter((n) => /\.woff2$/.test(n)).map((n) => `assets/fonts/${n}`),
  ];
  assert.ok(want.length > 0);
  for (const f of want) assert.ok(existsSync(join(out, f)), `missing ${f}`);
});

test('BUILD.txt names the source commit', () => {
  const txt = readFileSync(join(out, 'BUILD.txt'), 'utf8');
  assert.match(txt, /^commit: ([0-9a-f]{40}|unknown)( \(\+ uncommitted changes\))?\nbuilt: \d{4}-\d\d-\d\dT/);
});

test('_headers and robots.txt are exact', () => {
  assert.equal(readFileSync(join(out, '_headers'), 'utf8'), '/*\n  X-Robots-Tag: noindex, nofollow\n');
  assert.equal(readFileSync(join(out, 'robots.txt'), 'utf8'), 'User-agent: *\nDisallow: /\n');
});

test('copied index.html has the noindex meta, the repo one does not', () => {
  const copied = readFileSync(join(out, 'index.html'), 'utf8');
  assert.ok(copied.includes('<meta name="robots" content="noindex, nofollow">'));
  assert.ok(copied.indexOf('name="viewport"') < copied.indexOf('name="robots"'));
  const repo = readFileSync(join(REPO_ROOT, 'index.html'), 'utf8');
  assert.ok(!repo.includes('name="robots"'));
});

test('no dev-only paths are copied', () => {
  for (const f of files) {
    assert.ok(!/^(tests|node_modules|\.kiro|\.git|scripts|deploy)\//.test(f), `leaked ${f}`);
    assert.ok(!/(^|\/)package(-lock)?\.json$/.test(f), `leaked ${f}`);
    if (/\.md$/i.test(f)) assert.equal(f, 'assets/audio/README.md');
  }
  assert.ok(!files.includes('package.json'));
});

test('every relative import reachable from src/main.js was copied', () => {
  const seen = new Set();
  const queue = ['src/main.js'];
  while (queue.length) {
    const rel = queue.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    assert.ok(existsSync(join(out, rel)), `missing ${rel}`);
    const src = readFileSync(join(out, rel), 'utf8');
    for (const spec of listLocalImports(src)) {
      const target = resolve('/', dirname(rel), spec).slice(1).split('\\').join('/');
      assert.ok(existsSync(join(out, target)), `${rel} imports ${spec} which was not copied`);
      if (target.endsWith('.js') || target.endsWith('.mjs')) queue.push(target);
    }
  }
  assert.ok(seen.size > 1);
});

test('relative href/src in index.html exist', () => {
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1])
    .filter((r) => !/^([a-z][a-z0-9+.-]*:|\/\/|#|data:)/i.test(r));
  assert.ok(refs.length > 0);
  for (const r of refs) {
    const p = r.split(/[?#]/)[0].replace(/^\//, '');
    assert.ok(existsSync(join(out, p)), `index.html references missing ${r}`);
  }
});

test('shouldCopy allow and deny list', () => {
  for (const ok of ['index.html', 'favicon.svg', 'LICENSE', 'src/main.js', 'src/ui/garage.js',
    'assets/audio/README.md', 'assets/audio/duel-loop.ogg', 'assets/fonts/OFL-VT323.txt',
    'public/seance-tasks.json']) assert.equal(shouldCopy(ok), true, ok);
  for (const no of ['README.md', 'ROADMAP.md', 'package.json', 'package-lock.json', 'tests/engine/site.test.js',
    'node_modules/x/index.js', '.kiro/steering/tech.md', '.git/config', 'scripts/build-site.mjs',
    'deploy/site/index.html', 'src/notes.md', 'assets/notes.md', 'src', '', '../x', 'public/other.json']) {
    assert.equal(shouldCopy(no), false, no);
  }
});

test('listLocalImports finds static, dynamic and re-export specifiers', () => {
  const src = [
    "import a from './a.js';",
    "import { b,\n  c } from '../b/c.js';",
    "import './side.js';",
    "export * from './re.js';",
    "export { z } from './z.js';",
    "const m = await import('./lazy.js');",
    "import fs from 'node:fs';",
    "// import nope from './comment.js';",
    "/* import nope2 from './block.js'; */",
  ].join('\n');
  assert.deepEqual(listLocalImports(src), ['./a.js', '../b/c.js', './side.js', './re.js', './z.js', './lazy.js']);
  assert.deepEqual(listLocalImports(''), []);
});

test('assertSafeOutDir refuses the repo root, its parents, / and home', () => {
  const root = resolve('/tmp/some/repo');
  assert.throws(() => assertSafeOutDir(root, root, '/home/u'));
  assert.throws(() => assertSafeOutDir('/tmp/some', root, '/home/u'));
  assert.throws(() => assertSafeOutDir('/', root, '/home/u'));
  assert.throws(() => assertSafeOutDir('/home/u', root, '/home/u'));
  assert.doesNotThrow(() => assertSafeOutDir('/tmp/some/repo/deploy/site', root, '/home/u'));
  assert.doesNotThrow(() => assertSafeOutDir('/tmp/other/site', root, '/home/u'));
});

test('moduleGraph walks relative imports breadth-first and survives cycles', () => {
  const files = {
    'src/main.js': "import './a.js';\nimport { b } from './sub/b.js';\nimport x from './missing.js';",
    'src/a.js': 'export const a = 1;',
    'src/sub/b.js': "import { a } from '../a.js';\nimport './c.js';",
    'src/sub/c.js': "import './b.js';",
  };
  const read = (rel) => (rel in files ? files[rel] : null);
  assert.deepEqual(moduleGraph('src/main.js', read), ['src/main.js', 'src/a.js', 'src/sub/b.js', 'src/sub/c.js']);
});

test('addModulePreloads inserts links before the module script, idempotently', () => {
  const html = '<html><head></head><body>\n  <script type="module" src="src/main.js"></script>\n</body></html>';
  const out1 = addModulePreloads(html, ['src/a.js', 'src/b.js']);
  const link = (p) => `  <link rel="modulepreload" href="${p}">`;
  assert.ok(out1.includes(`${link('src/a.js')}\n${link('src/b.js')}\n`));
  assert.ok(out1.lastIndexOf('modulepreload') < out1.indexOf('<script type="module"'));
  assert.equal(addModulePreloads(out1, ['src/c.js']), out1);
  assert.equal(addModulePreloads(html, []), html);
  assert.throws(() => addModulePreloads('<html><body></body></html>', ['src/a.js']), Error);
});

test('built index.html preloads every module reachable from src/main.js once, before the script', () => {
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  const hrefs = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((m) => m[1]);
  const graph = moduleGraph('src/main.js', (rel) => (
    existsSync(join(REPO_ROOT, rel)) ? readFileSync(join(REPO_ROOT, rel), 'utf8') : null
  )).filter((p) => p !== 'src/main.js');
  assert.ok(graph.length > 1);
  assert.deepEqual([...hrefs].sort(), [...graph].sort());
  assert.equal(new Set(hrefs).size, hrefs.length);
  for (const h of hrefs) assert.ok(existsSync(join(out, h)), `preload target missing: ${h}`);
  const scriptAt = html.search(/<script\s+type="module"/);
  assert.ok(scriptAt > 0);
  assert.ok(html.lastIndexOf('rel="modulepreload"') < scriptAt);
});

rmSync(dirname(out), { recursive: true, force: true });
console.log(`site.test.js: ${passed} passed`);
