import assert from 'node:assert/strict';
import {
  PLAYER_MECH_NAME, ENEMY_MECH_NAME, playerHudLabel, enemyHudLabel,
} from '../../src/combat/mechNames.js';
import { formatHudStat } from '../../src/combat/hud.js';

assert.equal(PLAYER_MECH_NAME, 'RUSTBIT');
assert.equal(ENEMY_MECH_NAME, 'CHOPPER');
assert.equal(playerHudLabel(), 'P1 · RUSTBIT');
assert.equal(enemyHudLabel(), 'CHOPPER');
assert.ok(!playerHudLabel().toUpperCase().includes('HOUND'));
assert.ok(!enemyHudLabel().toUpperCase().includes('HOUND'));
assert.equal(formatHudStat(72, 100), '72/100');
console.log('mechNames tests passed');
