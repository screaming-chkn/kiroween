/**
 * tests/mech/tankUpgrades.test.js — pure model tests for tank garage progression.
 */
import assert from 'node:assert/strict';
import {
  defaultUpgradeState, normalizeUpgradeState, spendNotch, awardWin,
  creditsForNextWin, awardCredits, barsFull, notchLabel, combatModsFromUpgrades,
  enemyScaleFromUpgrades, hitsToKill, MAX_NOTCH, SLOT_ORDER, paletteForTier,
} from '../../src/mech/tankUpgrades.js';
import { PLAYER_PROJECTILE_DAMAGE, PLAYER_MAX_HP, FIRE_COOLDOWN_MS } from '../../src/combat/config.js';
import { HAUNT_LEVELS } from '../../src/ui/hauntLevel.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}

console.log('\nsrc/mech/tankUpgrades.js\n');

test('default is empty bars tier 1', () => {
  const s = defaultUpgradeState();
  assert.equal(s.tier, 1);
  assert.equal(s.credits, 0);
  for (const k of SLOT_ORDER) assert.equal(s[k], 0);
});

test('win N pays N credits', () => {
  let s = defaultUpgradeState();
  assert.equal(creditsForNextWin(0), 1);
  s = awardWin(s); assert.equal(s.wins, 1); assert.equal(s.credits, 1);
  s = awardWin(s); assert.equal(s.wins, 2); assert.equal(s.credits, 1 + 2);
  s = awardWin(s); assert.equal(s.credits, 1 + 2 + 3);
});

test('spend notch costs 1 and fills bar', () => {
  let s = { ...defaultUpgradeState(), credits: 2 };
  const r = spendNotch(s, 'tracks');
  assert.equal(r.ok, true);
  assert.equal(r.state.tracks, 1);
  assert.equal(r.state.credits, 1);
});

test('cannot spend without credits', () => {
  const r = spendNotch(defaultUpgradeState(), 'armor');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-credits');
});

test('filling all bars unlocks tier 2 and resets bars', () => {
  let s = { ...defaultUpgradeState(), credits: 100, tier: 1 };
  for (const slot of SLOT_ORDER) {
    for (let i = 0; i < MAX_NOTCH; i++) {
      const r = spendNotch(s, slot);
      assert.equal(r.ok, true, r.reason);
      s = r.state;
      if (r.unlockedTier) {
        assert.equal(r.unlockedTier, 2);
        assert.equal(s.tier, 2);
        for (const k of SLOT_ORDER) assert.equal(s[k], 0);
        return;
      }
    }
  }
  assert.fail('never unlocked tier');
});

test('default combat mods match identity feel', () => {
  const m = combatModsFromUpgrades(defaultUpgradeState());
  assert.equal(m.shotDamage, PLAYER_PROJECTILE_DAMAGE);
  assert.equal(m.maxHpBonus, 0);
  assert.equal(m.moveSpeedMult, 1);
  assert.equal(m.dashCooldownMult, 1);
  assert.ok(Math.abs(m.fireCooldownMult - 1) < 1e-9);
});

test('notch labels include numbers', () => {
  assert.match(notchLabel('tracks', 4), /\+16%/);
  assert.match(notchLabel('turret', 4), /Dmg 20.*Breaks walls/);
  assert.match(notchLabel('loader', 0), /0\.30s|0\.3/);
  assert.match(notchLabel('armor', 2), /HP 152/);
  assert.match(notchLabel('dash', 4), /−24%|−24/);
});

test('palette swaps at tier 2 without redraw', () => {
  assert.equal(paletteForTier(1), 'mono-green');
  assert.equal(paletteForTier(2), 'mono-blue');
});

test('LV1 enemy HP stays 220 (untouched)', () => {
  assert.equal(HAUNT_LEVELS[0].hp, 220);
});

test('cliff: max turret vs LV1 still multi-hit', () => {
  const m = combatModsFromUpgrades({ ...defaultUpgradeState(), turret: MAX_NOTCH });
  const htk = hitsToKill(HAUNT_LEVELS[0].hp, m.shotDamage);
  assert.ok(htk >= 8, `LV1 too trivial: ${htk} hits at dmg ${m.shotDamage}`);
  // neighbour cliff
  const below = hitsToKill(HAUNT_LEVELS[0].hp, m.shotDamage - 1);
  assert.ok(below >= htk, 'damage cliff unexpected');
});

test('normalize clamps garbage', () => {
  const s = normalizeUpgradeState({ tracks: 99, credits: -3, tier: 99, wins: 1.7 });
  assert.equal(s.tracks, MAX_NOTCH);
  assert.equal(s.credits, 0);
  assert.equal(s.tier, 3);
  assert.equal(s.wins, 1);
});

test('barsFull false until every slot maxed', () => {
  const s = { ...defaultUpgradeState(), tracks: MAX_NOTCH, turret: MAX_NOTCH, loader: MAX_NOTCH, armor: MAX_NOTCH, dash: MAX_NOTCH - 1 };
  assert.equal(barsFull(s), false);
  assert.equal(barsFull({ ...s, dash: MAX_NOTCH }), true);
});


test('loader×turret stack cannot both max: fire CD stays near or above 1', () => {
  const both = combatModsFromUpgrades({
    ...defaultUpgradeState(), turret: MAX_NOTCH, loader: MAX_NOTCH,
  });
  const loaderOnly = combatModsFromUpgrades({
    ...defaultUpgradeState(), loader: MAX_NOTCH,
  });
  assert.ok(both.fireCooldownMult >= 0.95, `stacked fireCD too fast: ${both.fireCooldownMult}`);
  assert.ok(loaderOnly.fireCooldownMult < both.fireCooldownMult, 'pure loader should still be the fast pick');
});

test('enemy scale is 1 at default; rises with notch fill; LV1 table still 220', () => {
  assert.equal(HAUNT_LEVELS[0].hp, 220);
  const d = enemyScaleFromUpgrades(defaultUpgradeState());
  assert.equal(d.hpMult, 1);
  assert.equal(d.damageMult, 1);
  const maxed = { ...defaultUpgradeState() };
  for (const k of SLOT_ORDER) maxed[k] = MAX_NOTCH;
  const e = enemyScaleFromUpgrades(maxed);
  assert.ok(e.hpMult > 1.35 && e.hpMult < 1.5, `hpMult=${e.hpMult}`);
  assert.ok(e.damageMult > 1.2 && e.damageMult < 1.4, `dmgMult=${e.damageMult}`);
  const spread = { ...defaultUpgradeState(), turret: 4, armor: 3, tracks: 2, loader: 2, dash: 2 };
  const mid = enemyScaleFromUpgrades(spread);
  assert.equal(mid.notchSum, 13);
  assert.equal(mid.hpMult, 1);
  assert.equal(mid.damageMult, 1);
});


test('awardCredits adds N credits without touching wins', () => {
  let s = defaultUpgradeState();
  s = awardCredits(s, 1);
  assert.equal(s.credits, 1);
  assert.equal(s.wins, 0);
  s = awardCredits(s, 5);
  assert.equal(s.credits, 6);
  s = awardCredits(s, 0);
  assert.equal(s.credits, 6);
  s = awardCredits(s, -3);
  assert.equal(s.credits, 6, 'negative adds nothing');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
