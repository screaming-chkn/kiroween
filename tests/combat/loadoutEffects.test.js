/**
 * tests/combat/loadoutEffects.test.js
 *
 * M4.5 loadout effects (spec 10-polish R8):
 *   - each part's mod appears in combatModsFor and in the created arena player
 *   - disabled flag → null mods and no garage text
 *   - flag-off fights are identical to fights built without combatMods
 *
 * Runnable with Node (no browser, no framework):
 *
 *   node tests/combat/loadoutEffects.test.js
 */

import assert from 'node:assert/strict';
import {
  LOADOUT_EFFECTS,
  IDENTITY_MODS,
  combatModsFor,
  effectTextFor,
} from '../../src/combat/loadoutEffects.js';
import { createArena, updateArena } from '../../src/combat/arena.js';
import {
  FEATURES,
  PLAYER_MAX_HP,
  PLAYER_PROJECTILE_DAMAGE,
  PROJECTILE_SPEED,
  FIRE_COOLDOWN_MS,
  ENEMY_PROJECTILE_DAMAGE,
} from '../../src/combat/config.js';
import { enumerateLoadouts, runFight } from './balanceCore.mjs';
import { readFileSync } from 'node:fs';

// Expected numbers come from the table itself, so retuning keeps these tests
// meaningful (team edit after the M4.5 balance pass).
const E = (id) => LOADOUT_EFFECTS[id].mods;

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

// ── Helpers ──────────────────────────────────────────────────────────────────

const DT = 1 / 60;

/** Light, balanced build: dash cooldown base 2500, no overdraw penalty. */
const BASE_TOTALS = { speedPenalty: 0, loadPct: 50, powerOut: 10, powerDraw: 5, balance: 5 };

/** Arena for a build that equips only `partId` (mods folded through combatModsFor). */
function arenaWith(partId, stats = {}) {
  const combatMods = combatModsFor({ legs: 'legs-runner', [slotOf(partId)]: partId }, true);
  return createArena({ ...BASE_TOTALS, combatMods }, stats);
}

function slotOf(partId) {
  return partId.split('-')[0];   // 'armR-hatchet' → 'armR', 'core-pulse' → 'core'
}

/** Fire one shot straight at the enemy and return { state, shot }. */
function fireOnce(state) {
  const next = updateArena(state, { aim: { x: 1000, y: 450 }, fire: true }, DT);
  const shot = next.projectiles.find((p) => p.owner === 'player');
  return { state: next, shot };
}

/** Park an enemy shot on the player and tick once. */
function takeEnemyHit(state) {
  const { player } = state;
  const shot = {
    id: 'eproj-test', x: player.x, y: player.y, vx: 0, vy: 0,
    damage: ENEMY_PROJECTILE_DAMAGE, owner: 'enemy', dead: false,
  };
  return updateArena({ ...state, projectiles: [shot] }, {}, DT);
}

// ── Table + combatModsFor ────────────────────────────────────────────────────

test('FEATURES.loadoutEffects is on and the flag object is frozen', () => {
  assert.equal(FEATURES.loadoutEffects, true);
  assert.ok(Object.isFrozen(FEATURES));
});

test('LOADOUT_EFFECTS has the six parts, each text states its numbers', () => {
  assert.deepEqual(Object.keys(LOADOUT_EFFECTS).sort(), [
    'armL-buckler', 'armL-spotter', 'armR-hatchet', 'armR-lancer', 'core-furnace', 'core-pulse',
  ]);
  const pct = (m) => String(Math.round(Math.abs(m - 1) * 100));
  for (const [id, { text, mods }] of Object.entries(LOADOUT_EFFECTS)) {
    assert.ok(text.startsWith('COMBAT: '), id);
    assert.ok(text.length <= 60, `${id} text is one short line`);
    if (mods.shotDamage != null) assert.ok(text.includes(String(mods.shotDamage)), `${id} damage in text`);
    if (mods.maxHpBonus != null) assert.ok(text.includes(String(mods.maxHpBonus)), `${id} hp in text`);
    for (const k of ['projectileSpeedMult', 'dashCooldownMult', 'fireCooldownMult']) {
      if (mods[k] != null) assert.ok(text.includes(pct(mods[k]) + '%'), `${id} ${k} ${pct(mods[k])}% in text`);
    }
    assert.ok(Object.isFrozen(mods));
  }
  assert.ok(Object.isFrozen(LOADOUT_EFFECTS));
});

test('combatModsFor with no effect parts returns identity values', () => {
  assert.deepEqual(combatModsFor({ legs: 'legs-runner' }, true), { ...IDENTITY_MODS });
  assert.equal(IDENTITY_MODS.shotDamage, PLAYER_PROJECTILE_DAMAGE);
});

test('combatModsFor returns a fresh object each call', () => {
  const a = combatModsFor({}, true);
  const b = combatModsFor({}, true);
  assert.notEqual(a, b);
  a.maxHpBonus = 999;
  assert.equal(IDENTITY_MODS.maxHpBonus, 0);
});

test('combatModsFor folds every equipped part (multipliers multiply, bonuses add)', () => {
  const m = combatModsFor({ core: 'core-furnace', armR: 'armR-lancer', armL: 'armL-buckler' }, true);
  const f = E('core-furnace'), l = E('armR-lancer'), bk = E('armL-buckler');
  assert.ok(Math.abs(m.projectileSpeedMult - f.projectileSpeedMult * l.projectileSpeedMult) < 1e-12);
  assert.ok(Math.abs(m.fireCooldownMult - f.fireCooldownMult * l.fireCooldownMult * bk.fireCooldownMult) < 1e-12);
  assert.equal(m.maxHpBonus, bk.maxHpBonus);
  assert.equal(m.dashCooldownMult, bk.dashCooldownMult);
  assert.equal(m.shotDamage, PLAYER_PROJECTILE_DAMAGE);
  assert.equal(m.incomingDamageMult, 1);
});

test('combatModsFor(…, false) === null and effectTextFor(…, false) === null', () => {
  assert.equal(combatModsFor({ armR: 'armR-hatchet' }, false), null);
  assert.equal(effectTextFor('armR-hatchet', false), null);
});

test('effectTextFor returns the COMBAT line, null for parts without an effect', () => {
  assert.equal(effectTextFor('armR-hatchet', true), LOADOUT_EFFECTS['armR-hatchet'].text);
  assert.equal(effectTextFor('armR-lancer', true), LOADOUT_EFFECTS['armR-lancer'].text);
  assert.equal(effectTextFor('legs-runner', true), null);
});

// ── Per-effect arena tests ───────────────────────────────────────────────────

const cd = (state) => state.player.fireCooldown;
const baseShot = fireOnce(createArena(BASE_TOTALS));

test('hatchet: fired projectile deals its shotDamage and reload scales', () => {
  const { state, shot } = fireOnce(arenaWith('armR-hatchet'));
  assert.equal(shot.damage, E('armR-hatchet').shotDamage);
  assert.ok(shot.damage > PLAYER_PROJECTILE_DAMAGE);
  assert.ok(Math.abs(cd(state) - FIRE_COOLDOWN_MS * E('armR-hatchet').fireCooldownMult) < 1e-6);
});

test('lancer: fired projectile is faster by projectileSpeedMult, base damage', () => {
  const { state, shot } = fireOnce(arenaWith('armR-lancer'));
  assert.ok(Math.abs(Math.hypot(shot.vx, shot.vy) - PROJECTILE_SPEED * E('armR-lancer').projectileSpeedMult) < 1e-6);
  assert.equal(shot.damage, PLAYER_PROJECTILE_DAMAGE);
  assert.ok(Math.abs(cd(state) - FIRE_COOLDOWN_MS * E('armR-lancer').fireCooldownMult) < 1e-6);
});

test('buckler: +maxHpBonus max and start HP, slower dash and reload', () => {
  const s0 = arenaWith('armL-buckler');
  assert.equal(s0.player.maxHp, PLAYER_MAX_HP + E('armL-buckler').maxHpBonus);
  assert.equal(s0.player.hp, PLAYER_MAX_HP + E('armL-buckler').maxHpBonus);
  assert.equal(s0.player.dashCooldownBaseMs, Math.round(2500 * E('armL-buckler').dashCooldownMult));
  assert.ok(Math.abs(cd(fireOnce(s0).state) - FIRE_COOLDOWN_MS * E('armL-buckler').fireCooldownMult) < 1e-6);
});

test('buckler: bonus is added to a given stats.playerHp', () => {
  const { player } = arenaWith('armL-buckler', { playerHp: 100 });
  assert.equal(player.hp, 100 + E('armL-buckler').maxHpBonus);
  assert.equal(player.maxHp, PLAYER_MAX_HP + E('armL-buckler').maxHpBonus);
});

test('spotter: dash cooldown base scales by dashCooldownMult (light 2500)', () => {
  const base = createArena(BASE_TOTALS).player.dashCooldownBaseMs;
  const s0 = arenaWith('armL-spotter');
  assert.equal(base, 2500);
  assert.equal(s0.player.dashCooldownBaseMs, Math.round(2500 * E('armL-spotter').dashCooldownMult));
  assert.ok(s0.player.dashCooldownBaseMs < base);
});

test('pulse: fire cooldown after a shot scales by fireCooldownMult', () => {
  assert.ok(Math.abs(cd(baseShot.state) - FIRE_COOLDOWN_MS) < 1e-6);
  const { state } = fireOnce(arenaWith('core-pulse'));
  assert.ok(Math.abs(cd(state) - FIRE_COOLDOWN_MS * E('core-pulse').fireCooldownMult) < 1e-6);
  assert.ok(cd(state) < FIRE_COOLDOWN_MS);
});

test('furnace: faster shots and faster reload', () => {
  const { state, shot } = fireOnce(arenaWith('core-furnace'));
  assert.ok(Math.abs(Math.hypot(shot.vx, shot.vy) - PROJECTILE_SPEED * E('core-furnace').projectileSpeedMult) < 1e-6);
  assert.ok(Math.abs(cd(state) - FIRE_COOLDOWN_MS * E('core-furnace').fireCooldownMult) < 1e-6);
});

test('incomingDamageMult (engine support, unused by the current table) rounds the hit', () => {
  const start = createArena({ ...BASE_TOTALS, combatMods: { ...IDENTITY_MODS, incomingDamageMult: 0.88 } });
  const hit = takeEnemyHit(start);
  assert.equal(start.player.hp - hit.player.hp, Math.round(ENEMY_PROJECTILE_DAMAGE * 0.88));
});

test('no combatMods: player has no effect fields and takes full damage', () => {
  const start = createArena(BASE_TOTALS);
  assert.equal(start.player.shotDamage, undefined);
  assert.equal(start.player.projectileSpeedMult, undefined);
  assert.equal(start.player.incomingDamageMult, undefined);
  const hit = takeEnemyHit(start);
  assert.equal(start.player.hp - hit.player.hp, ENEMY_PROJECTILE_DAMAGE);
  const { shot } = fireOnce(start);
  assert.equal(shot.damage, PLAYER_PROJECTILE_DAMAGE);
  assert.equal(Math.hypot(shot.vx, shot.vy), PROJECTILE_SPEED);
});

// ── Flag-off identity ────────────────────────────────────────────────────────

test('createArena(totals without combatMods) deep-equals createArena(combatMods: null)', () => {
  assert.deepEqual(
    createArena(BASE_TOTALS),
    createArena({ ...BASE_TOTALS, combatMods: null }),
  );
});

test('flag-off fights are identical to pre-M4.5 totals (3 builds x 3 seeds)', () => {
  const builds = enumerateLoadouts().slice(0, 3);
  assert.equal(builds.length, 3);
  for (const build of builds) {
    // Strip combatMods, then compare with a build that never had the field.
    const { combatMods, ...stripped } = build.totals;
    const pre = {
      speedPenalty: build.totals.speedPenalty,
      loadPct:      build.totals.loadPct,
      powerOut:     build.totals.powerOut,
      powerDraw:    build.totals.powerDraw,
      balance:      build.totals.balance,
    };
    assert.deepEqual(stripped, pre);
    assert.ok(build.loadout, 'build.loadout stays available');
    for (const seed of [1, 2, 3]) {
      const a = runFight({ ...build, totals: stripped }, seed, { maxSeconds: 60 });
      const b = runFight({ ...build, totals: pre }, seed, { maxSeconds: 60 });
      assert.equal(a.phase, b.phase);
      assert.equal(a.elapsedMs, b.elapsedMs);
      assert.equal(a.playerHp, b.playerHp);
      assert.equal(a.enemyHp, b.enemyHp);
    }
  }
});

test('flag-off golden: builds without combatMods replay main afbd763 exactly (36 fights)', () => {
  const golden = JSON.parse(readFileSync(new URL('./fixtures/flagoff-golden.json', import.meta.url), 'utf8')).rows;
  const byLabel = new Map(enumerateLoadouts().map((b) => [b.label, b]));
  assert.equal(golden.length, 36);
  for (const [label, seed, lv, policy, phase, elapsedMs, playerHp, enemyHp] of golden) {
    const b = byLabel.get(label);
    const { combatMods, ...off } = b.totals;   // what main.js passes when the flag is off
    // afbd763 ran LV1 at 0.8x; M7 #7 moved live LV1 to 0.6x, so replay the old multiplier.
    const r = runFight({ ...b, totals: off }, seed, lv === 1 ? { pressure: 0.8, policy } : { hauntLv: lv, policy });
    assert.deepEqual([r.phase, r.elapsedMs, r.playerHp, r.enemyHp], [phase, elapsedMs, playerHp, enemyHp], `${label} seed ${seed} LV${lv} ${policy}`);
  }
});

test('flag off: combatModsFor returns null for every enumerated build', () => {
  for (const b of enumerateLoadouts()) assert.equal(combatModsFor(b.loadout, false), null);
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
