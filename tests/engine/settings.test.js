/**
 * tests/engine/settings.test.js — SFX/music volume + mute persistence.
 *   node tests/engine/settings.test.js
 */
import assert from 'node:assert/strict';
import {
  SETTINGS_KEY, DEFAULT_SETTINGS, normalizeSettings, loadSettings, saveSettings, busLevels,
} from '../../src/engine/settings.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); failed++; }
}
function memStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
}
console.log('\nsrc/engine/settings.js\n');

test('defaults when nothing is stored', () => {
  assert.deepEqual(loadSettings(memStorage()), { ...DEFAULT_SETTINGS });
});

test('save → load round-trips through storage', () => {
  const st = memStorage();
  saveSettings({ sfx: 0.35, music: 0.1, muted: true }, st);
  assert.deepEqual(loadSettings(st), { sfx: 0.35, music: 0.1, muted: true });
  assert.ok(st.m.has(SETTINGS_KEY));
});

test('corrupt JSON or blocked storage falls back to defaults', () => {
  assert.deepEqual(loadSettings(memStorage({ [SETTINGS_KEY]: '{nope' })), { ...DEFAULT_SETTINGS });
  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(loadSettings(blocked), { ...DEFAULT_SETTINGS });
  assert.doesNotThrow(() => saveSettings({ sfx: 1 }, blocked));
  assert.deepEqual(loadSettings(null), { ...DEFAULT_SETTINGS });
});

test('values are clamped and mute is strictly boolean', () => {
  assert.deepEqual(normalizeSettings({ sfx: 4, music: -1, muted: 'yes' }), { sfx: 1, music: 0, muted: false });
});

test('mute zeroes both buses without losing the slider values', () => {
  const s = { sfx: 0.5, music: 0.7, muted: true };
  assert.deepEqual(busLevels(s), { sfx: 0, music: 0 });
  assert.deepEqual(busLevels({ ...s, muted: false }), { sfx: 0.5, music: 0.7 });
});

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
