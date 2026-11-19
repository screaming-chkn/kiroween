/**
 * tests/engine/hookRun.test.js
 *
 * Tests for scripts/kiro-hook-run.mjs: the hook-event parsing and that every
 * .kiro/hooks/*.json command goes through the logging wrapper.
 *
 *   node tests/engine/hookRun.test.js
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { eventFilePath, eventName } from '../../scripts/kiro-hook-run.mjs';

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`  ok  ${name}`); }
  catch (err) { console.error(`FAIL  ${name}\n${err.stack}`); process.exitCode = 1; }
}

test('eventFilePath finds a nested path', () => {
  assert.equal(eventFilePath({ tool_input: { path: '/r/.kiro/specs/x/tasks.md' } }), '/r/.kiro/specs/x/tasks.md');
  assert.equal(eventFilePath({ file_path: 'src/a.js' }), 'src/a.js');
});

test('eventFilePath is empty for no event or no path', () => {
  assert.equal(eventFilePath(null), '');
  assert.equal(eventFilePath({ session_id: 'abc' }), '');
});

test('eventName reads the hook event name', () => {
  assert.equal(eventName({ hook_event_name: 'PostFileSave' }), 'PostFileSave');
  assert.equal(eventName(null), '');
});

test('every hook command runs through the logging wrapper', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const dir = join(root, '.kiro', 'hooks');
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    const cfg = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    for (const h of cfg.hooks) {
      if (h.action.type !== 'command') continue;
      assert.match(h.action.command, new RegExp(`^node scripts/kiro-hook-run\\.mjs ${f.replace('.json', '')} -- `), f);
    }
  }
});

console.log(`hookRun: ${passed} passed`);
