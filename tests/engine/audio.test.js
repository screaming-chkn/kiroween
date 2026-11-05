/**
 * tests/engine/audio.test.js
 *
 * Pure-function tests for the audio bus helpers. Runnable with Node
 * (no browser, no framework):
 *
 *   node tests/engine/audio.test.js
 *
 * Only the Node-safe surface is exercised here: volume clamping and bus
 * identity. The playback functions (playMusicBed / playSfx) degrade to safe
 * no-ops under Node, so we assert that degradation instead of audio output.
 *
 * Uses only Node's built-in assert module and ES module import.
 */

import assert from 'node:assert/strict';
import {
  BUSES,
  BUS_IDS,
  isBus,
  clampVolume,
  setBusVolume,
  getBusVolume,
  MUSIC_BED_SRC,
  playMusicBed,
  stopMusicBed,
  playSfx,
} from '../../src/engine/audio.js';

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

function approxEq(a, b, eps = 1e-9) {
  return Math.abs(a - b) < eps;
}

// ── clampVolume ───────────────────────────────────────────────────────────────

console.log('\nsrc/engine/audio.js — bus volume + identity\n');

test('clampVolume passes through values in [0, 1]', () => {
  assert.ok(approxEq(clampVolume(0),    0));
  assert.ok(approxEq(clampVolume(0.25), 0.25));
  assert.ok(approxEq(clampVolume(0.5),  0.5));
  assert.ok(approxEq(clampVolume(1),    1));
});

test('clampVolume clamps below 0 up to 0', () => {
  assert.equal(clampVolume(-0.1), 0);
  assert.equal(clampVolume(-5),   0);
});

test('clampVolume clamps above 1 down to 1', () => {
  assert.equal(clampVolume(1.0001), 1);
  assert.equal(clampVolume(42),     1);
});

test('clampVolume is mute-safe for non-finite / junk input', () => {
  assert.equal(clampVolume(NaN),       0);
  assert.equal(clampVolume(Infinity),  0);   // non-finite → mute-safe 0
  assert.equal(clampVolume(-Infinity), 0);
  assert.equal(clampVolume(undefined), 0);
  assert.equal(clampVolume(null),      0);   // Number(null) === 0
  assert.equal(clampVolume('abc'),     0);
});

test('clampVolume parses numeric strings', () => {
  assert.ok(approxEq(clampVolume('0.75'), 0.75));
});

// ── bus identity ──────────────────────────────────────────────────────────────

test('BUSES exposes music / sfx / static ids', () => {
  assert.equal(BUSES.MUSIC,  'music');
  assert.equal(BUSES.SFX,    'sfx');
  assert.equal(BUSES.STATIC, 'static');
});

test('BUS_IDS contains exactly the three buses', () => {
  assert.deepEqual([...BUS_IDS].sort(), ['music', 'sfx', 'static']);
});

test('isBus accepts valid ids and rejects anything else', () => {
  for (const id of BUS_IDS) assert.ok(isBus(id), `expected ${id} to be a bus`);
  assert.equal(isBus('voice'),    false);
  assert.equal(isBus(''),         false);
  assert.equal(isBus(undefined),  false);
  assert.equal(isBus('MUSIC'),    false);   // case-sensitive
});

// ── setBusVolume / getBusVolume round-trip ────────────────────────────────────

test('setBusVolume stores the clamped value and getBusVolume reads it back', () => {
  assert.ok(approxEq(setBusVolume(BUSES.STATIC, 0.42), 0.42));
  assert.ok(approxEq(getBusVolume(BUSES.STATIC), 0.42));

  // Out-of-range input is clamped on the way in.
  assert.equal(setBusVolume(BUSES.SFX, 2),  1);
  assert.equal(getBusVolume(BUSES.SFX),     1);
  assert.equal(setBusVolume(BUSES.SFX, -3), 0);
  assert.equal(getBusVolume(BUSES.SFX),     0);
});

test('buses have independent volume', () => {
  setBusVolume(BUSES.MUSIC,  0.1);
  setBusVolume(BUSES.SFX,    0.5);
  setBusVolume(BUSES.STATIC, 0.9);
  assert.ok(approxEq(getBusVolume(BUSES.MUSIC),  0.1));
  assert.ok(approxEq(getBusVolume(BUSES.SFX),    0.5));
  assert.ok(approxEq(getBusVolume(BUSES.STATIC), 0.9));
});

test('unknown bus: setBusVolume is ignored, getBusVolume reports 0', () => {
  const before = getBusVolume(BUSES.MUSIC);
  setBusVolume('voice', 0.7);              // ignored
  assert.ok(approxEq(getBusVolume(BUSES.MUSIC), before));
  assert.equal(getBusVolume('voice'), 0);
});

// ── asset path ────────────────────────────────────────────────────────────────

test('music bed src is a relative path (never absolute)', () => {
  assert.equal(MUSIC_BED_SRC, 'assets/audio/haunt-hound-loop.wav');
  assert.ok(!MUSIC_BED_SRC.startsWith('/'),      'must not start with /');
  assert.ok(!/^[A-Za-z]:[\\/]/.test(MUSIC_BED_SRC), 'must not be a drive path');
  assert.ok(!MUSIC_BED_SRC.includes('://'),      'must not be a URL');
});

// ── graceful degradation under Node ───────────────────────────────────────────

test('playback helpers are safe no-ops with no AudioContext (Node)', () => {
  // No `document` in Node → these must not throw and must report "did nothing".
  assert.equal(playMusicBed(), false);
  assert.doesNotThrow(() => stopMusicBed());
  assert.equal(playSfx('shoot'), false);
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
