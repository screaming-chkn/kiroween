/**
 * scripts/check-readme.mjs — HAUNT//HOUND README gate (spec 10-polish, task 31).
 *
 * Exits 1 with a clear message unless:
 *   - README.md has headings containing "How to play", "Costume Contest",
 *     "How we used Kiro", "Credits" and "License"
 *   - README.md mentions every file name in .kiro/hooks/
 *   - README.md says MIT
 *   - the first line of LICENSE is "MIT License"
 *
 * `checkReadme` is PURE (strings in, problems out). `main()` only runs when the
 * module is executed directly.
 *
 * Run:  node scripts/check-readme.mjs
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

export const REQUIRED_HEADINGS = [
  'How to play', 'Costume Contest', 'How we used Kiro', 'Credits', 'License',
];

/**
 * @param {string} readmeText
 * @param {string} licenseText
 * @param {string[]} hookNames  File names in .kiro/hooks/ (e.g. "test-on-save.json").
 * @returns {string[]} Human-readable problems; empty when everything passes.
 */
export function checkReadme(readmeText, licenseText, hookNames = []) {
  const problems = [];
  const readme = typeof readmeText === 'string' ? readmeText : '';
  const license = typeof licenseText === 'string' ? licenseText : '';

  const headings = readme
    .split(/\r?\n/)
    .filter((l) => /^#{1,6}\s+\S/.test(l))
    .map((l) => l.replace(/^#{1,6}\s+/, '').toLowerCase());
  for (const want of REQUIRED_HEADINGS) {
    if (!headings.some((h) => h.includes(want.toLowerCase()))) {
      problems.push(`README.md has no heading containing "${want}"`);
    }
  }

  for (const name of hookNames) {
    if (!readme.includes(name)) {
      problems.push(`README.md does not mention hook file "${name}"`);
    }
  }

  if (!/\bMIT\b/.test(readme)) problems.push('README.md does not say MIT');

  const first = license.split(/\r?\n/)[0].trim();
  if (first !== 'MIT License') {
    problems.push(`LICENSE first line must be "MIT License" (found "${first}")`);
  }

  return problems;
}

function main() {
  const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
  const hooksDir = join(REPO_ROOT, '.kiro', 'hooks');
  const hookNames = existsSync(hooksDir)
    ? readdirSync(hooksDir).filter((n) => n.endsWith('.json')).sort()
    : [];
  const problems = checkReadme(
    read(join(REPO_ROOT, 'README.md')),
    read(join(REPO_ROOT, 'LICENSE')),
    hookNames,
  );
  if (problems.length) {
    console.error('README check failed:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`README check ok (${hookNames.length} hooks listed)`);
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
