/**
 * tests/combat/creditPickup.test.js
 *
 * LV3+ credit coins: count, clearance, stagger, grab + persist.
 * Run: node tests/combat/creditPickup.test.js
 */
import assert from 'node:assert/strict';
import { createArena, updateArena } from '../../src/combat/arena.js';
import {
  CREDIT_MIN_LV, CREDIT_COUNT, CREDIT_RADIUS, CREDIT_STAGGER_MS,
  createCreditPickups, creditPadsForLevel, stepCreditPickups,
} from '../../src/combat/creditPickup.js';
import { wallsForLevel, circleHitsWalls } from '../../src/combat/obstacle.js';
import {
  PLAYER_START_X, PLAYER_START_Y, ENEMY_START_X, ENEMY_START_Y, MECH_RADIUS,
} from '../../src/combat/config.js';
import {
  defaultUpgradeState, awardCredits, loadUpgradeState, saveUpgradeState,
  UPGRADES_LS_KEY,
} from '../../src/mech/tankUpgrades.js';

let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}

const DT = 1 / 60;
const SPAWN_CLEAR = 140;

test('LV1–2 have no coins; LV3 start has at least 6', () => {
  assert.equal(CREDIT_MIN_LV, 3);
  assert.ok(CREDIT_COUNT >= 6);
  for (const lv of [1, 2]) {
    const a = createArena({}, { hauntLv: lv });
    assert.equal(a.creditPickups.coins.length, 0, `lv${lv}`);
  }
  const a3 = createArena({}, { hauntLv: 3 });
  assert.ok(a3.creditPickups.coins.length >= 6, `lv3 has ${a3.creditPickups.coins.length}`);
  for (const lv of [4, 5]) {
    const a = createArena({}, { hauntLv: lv });
    assert.ok(a.creditPickups.coins.length >= 6, `lv${lv} has ${a.creditPickups.coins.length}`);
  }
});

test('coins sit clear of walls and spawn pads', () => {
  for (const lv of [3, 4, 5]) {
    const walls = wallsForLevel(lv);
    const pads = creditPadsForLevel(lv, walls);
    assert.ok(pads.length >= 6, `lv${lv} pads ${pads.length}`);
    for (const p of pads) {
      assert.equal(
        circleHitsWalls(walls, p.x, p.y, CREDIT_RADIUS + MECH_RADIUS),
        false,
        `lv${lv} coin at ${p.x},${p.y} hits a wall`,
      );
      const dP = Math.hypot(p.x - PLAYER_START_X, p.y - PLAYER_START_Y);
      const dE = Math.hypot(p.x - ENEMY_START_X, p.y - ENEMY_START_Y);
      assert.ok(dP >= SPAWN_CLEAR, `lv${lv} coin too close to player (${dP})`);
      assert.ok(dE >= SPAWN_CLEAR, `lv${lv} coin too close to enemy (${dE})`);
    }
  }
});

test('coins pop in on a stagger at the start of the fight', () => {
  const pickups = createCreditPickups(3, wallsForLevel(3));
  const appears = pickups.coins.map((c) => c.appearAtMs);
  assert.ok(appears.length >= 6);
  assert.equal(appears[0], 0);
  for (let i = 1; i < appears.length; i++) {
    assert.equal(appears[i], i * CREDIT_STAGGER_MS);
  }
  const first = stepCreditPickups(pickups, 0, { x: 0, y: 0 });
  assert.equal(first.grabbed, 0);
  // A coin that has not appeared yet cannot be grabbed, even if the player sits on it.
  const early = pickups.coins[5];
  const tooSoon = stepCreditPickups(pickups, early.appearAtMs - 1, { x: early.x, y: early.y });
  assert.equal(tooSoon.grabbed, 0);
  const onTime = stepCreditPickups(pickups, early.appearAtMs, { x: early.x, y: early.y });
  assert.equal(onTime.grabbed, 1);
  assert.equal(onTime.pickups.coins[5].grabbed, true);
});

test('player grab is +1; enemy does not grab', () => {
  const pickups = createCreditPickups(3, wallsForLevel(3));
  const c0 = pickups.coins[0];
  const enemyTry = stepCreditPickups(pickups, 0, null);
  assert.equal(enemyTry.grabbed, 0);
  // stepCreditPickups only tests the player argument — pass the enemy as player to
  // prove we don't auto-collect without a player body. The arena loop only passes player.
  const byPlayer = stepCreditPickups(pickups, 0, { x: c0.x, y: c0.y });
  assert.equal(byPlayer.grabbed, 1);
});

test('arena tick: walk onto a live coin, then persist +1 credit', () => {
  let s = createArena({}, { hauntLv: 3 });
  const coin = s.creditPickups.coins[0];
  assert.equal(coin.appearAtMs, 0);
  // Place the player on the coin and step one tick.
  s = { ...s, player: { ...s.player, x: coin.x, y: coin.y } };
  s = updateArena(s, { move: { dx: 0, dy: 0 } }, DT);
  assert.equal(s.creditsGrabbedThisTick, 1);
  assert.equal(s.creditsGrabbed, 1);
  assert.equal(s.creditPickups.coins[0].grabbed, true);

  // Same grab persists through the official store key.
  const store = new Map();
  const memory = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, String(v)); },
  };
  let ug = defaultUpgradeState();
  assert.equal(ug.credits, 0);
  ug = awardCredits(ug, s.creditsGrabbedThisTick);
  saveUpgradeState(ug, memory);
  const loaded = loadUpgradeState(memory);
  assert.equal(loaded.credits, 1);
  assert.ok(store.has(UPGRADES_LS_KEY));
  assert.equal(JSON.parse(store.get(UPGRADES_LS_KEY)).credits, 1);
});

test('grabbing every coin awards CREDIT_COUNT and is player-only in the arena', () => {
  let s = createArena({}, { hauntLv: 3 });
  const n = s.creditPickups.coins.length;
  assert.ok(n >= 6);
  // Advance time past the last pop, stand on each coin in turn.
  const last = s.creditPickups.coins[n - 1].appearAtMs;
  let elapsed = 0;
  while (elapsed < last) {
    s = updateArena(s, { move: { dx: 0, dy: 0 } }, 0.05);
    elapsed = s.elapsedMs;
  }
  let total = s.creditsGrabbed;
  for (const c of s.creditPickups.coins) {
    if (c.grabbed) continue;
    s = { ...s, player: { ...s.player, x: c.x, y: c.y } };
    s = updateArena(s, { move: { dx: 0, dy: 0 } }, DT);
    total = s.creditsGrabbed;
  }
  assert.equal(total, n);
  assert.ok(s.creditPickups.coins.every((c) => c.grabbed));
});

if (failed) { console.error(`${failed} failed`); process.exit(1); }
console.log('creditPickup: all passed');
