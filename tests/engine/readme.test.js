/**
 * tests/engine/readme.test.js
 *
 * Unit tests for checkReadme() in scripts/check-readme.mjs (task 31).
 *
 *   node tests/engine/readme.test.js
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkReadme } from '../../scripts/check-readme.mjs';

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`  ok  ${name}`); }
  catch (err) { console.error(`FAIL  ${name}\n${err.stack}`); process.exitCode = 1; }
}

const HOOKS = ['test-on-save.json', 'seance-on-spec-save.json'];
const GOOD = [
  '# HAUNT//HOUND', '## How to play', '## Built for the Costume Contest', '## How we used Kiro',
  `Hooks: ${HOOKS.join(', ')}`, '## Credits', '## License', 'MIT',
].join('\n');
const LICENSE = 'MIT License\n\nCopyright (c) 2026\n';

test('a complete README and LICENSE pass', () => {
  assert.deepEqual(checkReadme(GOOD, LICENSE, HOOKS), []);
});

test('each missing heading is reported', () => {
  for (const h of ['How to play', 'Costume Contest', 'How we used Kiro', 'Credits', 'License']) {
    const text = GOOD.split('\n').filter((l) => !(l.startsWith('#') && l.includes(h))).join('\n');
    const problems = checkReadme(text, LICENSE, HOOKS);
    assert.ok(problems.some((p) => p.includes(`"${h}"`)), `no problem for ${h}`);
  }
});

test('a heading word in plain prose does not count', () => {
  const text = GOOD.replace('## Credits', 'Credits');
  assert.ok(checkReadme(text, LICENSE, HOOKS).some((p) => p.includes('"Credits"')));
});

test('an unmentioned hook file is reported', () => {
  const problems = checkReadme(GOOD, LICENSE, [...HOOKS, 'new-hook.json']);
  assert.equal(problems.length, 1);
  assert.ok(problems[0].includes('new-hook.json'));
});

test('missing MIT is reported', () => {
  const problems = checkReadme(GOOD.replace('MIT', 'free'), LICENSE, HOOKS);
  assert.ok(problems.some((p) => p.includes('MIT')));
});

test('wrong or empty LICENSE first line is reported', () => {
  assert.ok(checkReadme(GOOD, 'Apache License\n', HOOKS).some((p) => p.includes('LICENSE')));
  assert.ok(checkReadme(GOOD, '', HOOKS).some((p) => p.includes('LICENSE')));
});

test('non-string input does not throw', () => {
  assert.ok(checkReadme(undefined, undefined, []).length > 0);
});

// EXPECTED TO PASS ONLY AFTER THE README REWRITE (task 31). The kickoff README
// lacks the required sections, so this assertion fails until it is rewritten.
test('[after README rewrite] the real repo README and LICENSE pass', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const hooks = readdirSync(join(root, '.kiro', 'hooks')).filter((n) => n.endsWith('.json'));
  const problems = checkReadme(
    readFileSync(join(root, 'README.md'), 'utf8'),
    readFileSync(join(root, 'LICENSE'), 'utf8'),
    hooks,
  );
  assert.deepEqual(problems, []);
});

console.log(`readme.test.js: ${passed} passed`);
