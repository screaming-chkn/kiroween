/**
 * tests/engine/sfx.test.js — M1 synthesized SFX.
 *
 *   node tests/engine/sfx.test.js
 *
 * Covers: playSfx/unlockAudio no-op safely without an AudioContext (Node),
 * the per-name throttle gate, and sfxEventsForTick mapping arena ticks to
 * SFX ids.
 */

import assert from 'node:assert/strict';
import {
  SFX, SFX_THROTTLE_MS, sfxThrottleGate, playSfx, unlockAudio,
  setBusVolume, BUSES, SFX_DURATION_S, MAX_SFX_VOICES, voiceCapGate,
  installAudioGestures,
} from '../../src/engine/audio.js';
import { sfxEventsForTick } from '../../src/combat/sfxEvents.js';
import { createArena, updateArena } from '../../src/combat/arena.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); failed++; }
}

console.log('\nsrc/engine/audio.js SFX + src/combat/sfxEvents.js\n');

test('playSfx is a safe no-op without an AudioContext', () => {
  assert.equal(unlockAudio(), false);
  for (const name of Object.values(SFX)) {
    assert.doesNotThrow(() => playSfx(name));
    assert.equal(playSfx(name), false);
  }
  assert.equal(playSfx('nope'), false);
});

test('setBusVolume(sfx) is safe without storage or context', () => {
  assert.doesNotThrow(() => setBusVolume(BUSES.SFX, 0.5));
});

test('every SFX id has a throttle window', () => {
  for (const name of Object.values(SFX)) {
    assert.ok(SFX_THROTTLE_MS[name] > 0, `${name} needs a throttle`);
  }
});

test('throttle gate blocks repeats inside the window, allows after', () => {
  const last = {};
  const gap = SFX_THROTTLE_MS.playerShot;
  assert.equal(sfxThrottleGate(last, 'playerShot', 1000), true);
  assert.equal(sfxThrottleGate(last, 'playerShot', 1000 + gap - 1), false);
  assert.equal(sfxThrottleGate(last, 'playerShot', 1000 + gap), true);
});

test('throttle gate is per-name', () => {
  const last = {};
  assert.equal(sfxThrottleGate(last, 'playerShot', 0), true);
  assert.equal(sfxThrottleGate(last, 'hitEnemy', 0), true);
  assert.equal(sfxThrottleGate(last, 'playerShot', 1), false);
});

test('player fire (300 ms cooldown) is never throttled', () => {
  assert.ok(SFX_THROTTLE_MS.playerShot < 300);
});

const base = () => createArena({});

test('every SFX id has a voice length under 1 s (explode/laugh up to 3 s)', () => {
  for (const name of Object.values(SFX)) {
    const cap = name === 'explode' ? 3 : 1;
    assert.ok(SFX_DURATION_S[name] > 0 && SFX_DURATION_S[name] < cap, name);
  }
});

test('voice cap blocks past MAX_SFX_VOICES, frees as voices end', () => {
  const ends = [];
  for (let i = 0; i < MAX_SFX_VOICES; i++) assert.equal(voiceCapGate(ends, 0, 0.2), true);
  assert.equal(voiceCapGate(ends, 0.1, 0.2), false);
  assert.equal(voiceCapGate(ends, 0.2, 0.2), true);   // the first six ended at 0.2
  assert.equal(ends.length, 1);
});

test('installAudioGestures wires unlock + click listeners, safe on junk', () => {
  assert.doesNotThrow(() => installAudioGestures(null));
  const seen = [];
  const fake = { addEventListener: (ev) => seen.push(ev), removeEventListener() {} };
  installAudioGestures(fake);
  for (const ev of ['pointerdown', 'touchend', 'keydown', 'click']) {
    assert.ok(seen.includes(ev), `missing ${ev}`);
  }
});

test('enemy-owned new projectile emits enemyShot only', () => {
  const s0 = base();
  const s1 = { ...s0, projectiles: [{ id: 'x', owner: 'enemy' }] };
  assert.deepEqual(sfxEventsForTick(s0, s1), ['enemyShot']);
  // Same projectile next tick: no repeat.
  assert.deepEqual(sfxEventsForTick(s1, s1), []);
});

test('death emits explode instead of the final hitPlayer', () => {
  const s0 = base();
  const s1 = { ...s0, phase: 'lose', player: { ...s0.player, hp: 0 } };
  assert.deepEqual(sfxEventsForTick(s0, s1), ['explode']);
});

test('null states are safe', () => {
  assert.deepEqual(sfxEventsForTick(null, base()), []);
});


test('no events on an idle tick', () => {
  const s = base();
  assert.deepEqual(sfxEventsForTick(s, s), []);
});

test('firing emits playerShot', () => {
  const s0 = base();
  const s1 = updateArena(s0, { fire: true }, 1 / 60);
  assert.ok(sfxEventsForTick(s0, s1).includes('playerShot'));
});

test('dash start emits dash', () => {
  const s0 = base();
  const s1 = updateArena(s0, { dash: true, move: { dx: 1, dy: 0 } }, 1 / 60);
  assert.ok(sfxEventsForTick(s0, s1).includes('dash'));
});

test('enemy shot, windup edge, hits', () => {
  const s0 = base();
  const p = { id: 'e1', owner: 'enemy' };
  const s1 = {
    ...s0,
    projectiles: [p],
    enemy:  { ...s0.enemy,  windupRemainingMs: 450, hp: s0.enemy.hp - 10 },
    player: { ...s0.player, hp: s0.player.hp - 10 },
  };
  const ev = sfxEventsForTick(s0, s1);
  for (const n of ['enemyShot', 'windup', 'hitEnemy', 'hitPlayer']) {
    assert.ok(ev.includes(n), `missing ${n}`);
  }
  // Windup only on the rising edge.
  const s2 = { ...s1, enemy: { ...s1.enemy, windupRemainingMs: 400 } };
  assert.ok(!sfxEventsForTick(s1, s2).includes('windup'));
});

test('kill emits explode instead of the final hitEnemy', () => {
  const s0 = base();
  const s1 = { ...s0, phase: 'win', enemy: { ...s0.enemy, hp: 0 } };
  const ev = sfxEventsForTick(s0, s1);
  assert.ok(ev.includes('explode'));
  assert.ok(!ev.includes('hitEnemy'));
});

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
