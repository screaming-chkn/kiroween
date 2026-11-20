/**
 * tests/combat/loadoutEffects.pbt.test.js
 *
 * Property-based tests for the M4.5 loadout effects and the damage path
 * (spec 10-polish R8, task 37).
 * Runnable with Node (no browser, no framework):
 *
 *   node tests/combat/loadoutEffects.pbt.test.js
 *
 * No npm dependencies: plain Node assert + a seeded mulberry32 PRNG, in the
 * same style as tests/mech/pbt.test.js. Every property uses a fixed seed.
 * On failure the message carries the seed, the case index and the failing
 * case as JSON, so a run can be replayed exactly.
 *
 * Properties:
 *   1. combatModsFor is independent of slot insertion order.
 *   2. Loadouts with no effect parts fold to IDENTITY_MODS; disabled → null.
 *   3. Folding laws: bonuses add, multipliers multiply, shotDamage is a max.
 *   4. Bounds hold for every possible loadout (exhaustive, 729 cases).
 *   5. createArena with in-bounds mods: hp === maxHp, integer dash base, and
 *      hp never exceeds maxHp over random ticks.
 *   6. Damage invariants over random short duels (hp never rises or goes
 *      below 0, phase only leaves 'playing'), plus applyDamage on its own.
 *   7. Fired player projectiles carry the folded damage and speed.
 *   8. Flag-off equivalence: no combatMods field === combatMods: null.
 */

import assert from 'node:assert/strict';
import {
  LOADOUT_EFFECTS,
  IDENTITY_MODS,
  combatModsFor,
} from '../../src/combat/loadoutEffects.js';
import { createArena, updateArena } from '../../src/combat/arena.js';
import { applyDamage } from '../../src/combat/damage.js';
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  PLAYER_MAX_HP,
  PLAYER_PROJECTILE_DAMAGE,
  PROJECTILE_SPEED,
  ENEMY_START_X,
  ENEMY_START_Y,
} from '../../src/combat/config.js';
import { SLOTS } from '../../src/mech/loadout.js';
import { PARTS } from '../../src/data/parts.js';
import { enumerateLoadouts, runFight } from './balanceCore.mjs';

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

/** Tiny seeded PRNG (mulberry32). Floats in [0, 1). */
function makePrng(seed) {
  let s = seed >>> 0;
  return function next() {
    s  = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t  = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

const hex = (seed) => `0x${(seed >>> 0).toString(16)}`;
const near = (a, b, eps = 1e-12) => Math.abs(a - b) <= eps;

// ── Generators ───────────────────────────────────────────────────────────────

const pick  = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const int   = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const float = (rng, lo, hi) => lo + rng() * (hi - lo);

const MIN_CASES = 200;
const DT = 1 / 60;

/** slot → part ids available for that slot. */
const IDS_BY_SLOT = Object.fromEntries(SLOTS.map((s) => [s, []]));
for (const part of PARTS) IDS_BY_SLOT[part.slot]?.push(part.id);

/** Ids with no entry in LOADOUT_EFFECTS (legs, back, head, plain parts). */
const NO_EFFECT_IDS_BY_SLOT = Object.fromEntries(
  SLOTS.map((s) => [s, IDS_BY_SLOT[s].filter((id) => !LOADOUT_EFFECTS[id])]),
);

/** Each slot is null or a random part of that slot. */
function randomLoadout(rng, idsBySlot = IDS_BY_SLOT, pNull = 0.25) {
  const loadout = {};
  for (const slot of SLOTS) {
    loadout[slot] = rng() < pNull ? null : pick(rng, idsBySlot[slot]);
  }
  return loadout;
}

/** Fisher-Yates over entries; returns a new object with shuffled key order. */
function shuffledCopy(rng, obj) {
  const entries = Object.entries(obj);
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }
  return Object.fromEntries(entries);
}

/** Mods inside the documented bounds (property 4). */
function randomBoundedMods(rng) {
  return {
    shotDamage:          int(rng, PLAYER_PROJECTILE_DAMAGE, 2 * PLAYER_PROJECTILE_DAMAGE),
    projectileSpeedMult: float(rng, 0.5, 2),
    maxHpBonus:          int(rng, 0, 50),
    dashCooldownMult:    float(rng, 0.5, 2),
    fireCooldownMult:    float(rng, 0.5, 2),
    incomingDamageMult:  float(rng, 0.5, 2),
  };
}

function randomTotals(rng, combatMods) {
  const totals = {
    speedPenalty: float(rng, 0, 0.45),
    // Hit the 80 / 100 weight-class edges now and then.
    loadPct:      rng() < 0.2 ? pick(rng, [0, 80, 100]) : float(rng, 0, 130),
    powerOut:     int(rng, 0, 20),
    powerDraw:    int(rng, 0, 20),
  };
  totals.balance = totals.powerOut - totals.powerDraw;
  if (combatMods) totals.combatMods = combatMods;
  return totals;
}

function randomActions(rng) {
  const a = {};
  if (rng() < 0.7) a.move = { dx: float(rng, -1, 1), dy: float(rng, -1, 1) };
  a.aim  = { x: float(rng, 0, ARENA_WIDTH), y: float(rng, 0, ARENA_HEIGHT) };
  a.fire = rng() < 0.6;
  a.dash = rng() < 0.1;
  return a;
}

/**
 * Run `prop` over `count` cases from `gen`, all drawn from one fixed seed.
 * A failure is rethrown with the seed, case index and case as JSON.
 */
function forAll(seed, count, gen, prop, { min = MIN_CASES } = {}) {
  assert.ok(count >= min, `property needs at least ${min} cases, got ${count}`);
  const rng = makePrng(seed);
  for (let i = 0; i < count; i++) {
    const c = gen(rng, i);
    try {
      prop(c, i);
    } catch (err) {
      err.message = `seed ${hex(seed)}, case #${i}: ${JSON.stringify(c)}\n    ${err.message}`;
      throw err;
    }
  }
}

/** Independent reference fold, written from the effect table. */
function expectedFold(loadout) {
  const e = {
    shotDamage: PLAYER_PROJECTILE_DAMAGE, projectileSpeedMult: 1, maxHpBonus: 0,
    dashCooldownMult: 1, fireCooldownMult: 1, incomingDamageMult: 1,
    moveSpeedMult: 1, dashDurationMult: 1,
  };
  for (const id of Object.values(loadout)) {
    const m = LOADOUT_EFFECTS[id]?.mods;
    if (!m) continue;
    e.shotDamage          = Math.max(e.shotDamage, m.shotDamage ?? 0);
    e.projectileSpeedMult *= m.projectileSpeedMult ?? 1;
    e.maxHpBonus          += m.maxHpBonus ?? 0;
    e.dashCooldownMult    *= m.dashCooldownMult ?? 1;
    e.fireCooldownMult    *= m.fireCooldownMult ?? 1;
    e.incomingDamageMult  *= m.incomingDamageMult ?? 1;
  }
  return e;
}

const MULT_KEYS = ['projectileSpeedMult', 'dashCooldownMult', 'fireCooldownMult', 'incomingDamageMult'];

// ── 1. Order independence ────────────────────────────────────────────────────

console.log('\nsrc/combat — PBT: loadout effects (R8)\n');

const SEED_1 = 0x4d450001;
test(`1. combatModsFor ignores slot insertion order (seed ${hex(SEED_1)})`, () => {
  forAll(SEED_1, 300, (rng) => {
    const loadout = randomLoadout(rng);
    // Sometimes add keys no part uses, so unknown ids and extra keys are covered.
    if (rng() < 0.3) loadout.junk = 'part-that-does-not-exist';
    return { loadout, shuffled: shuffledCopy(rng, loadout) };
  }, ({ loadout, shuffled }) => {
    const a = combatModsFor(loadout, true);
    const b = combatModsFor(shuffled, true);
    // Counts and max are exact; float products may differ in the last bits.
    assert.equal(a.shotDamage, b.shotDamage);
    assert.equal(a.maxHpBonus, b.maxHpBonus);
    for (const k of MULT_KEYS) assert.ok(near(a[k], b[k]), `${k}: ${a[k]} vs ${b[k]}`);
  });
});

// ── 2. Identity and disabled flag ────────────────────────────────────────────

const SEED_2 = 0x4d450002;
test(`2. no effect parts → IDENTITY_MODS; disabled → null (seed ${hex(SEED_2)})`, () => {
  forAll(SEED_2, 300, (rng) => ({
    plain:  randomLoadout(rng, NO_EFFECT_IDS_BY_SLOT),
    any:    randomLoadout(rng),
  }), ({ plain, any }) => {
    const m = combatModsFor(plain, true);
    assert.deepEqual(m, { ...IDENTITY_MODS });
    assert.notEqual(m, IDENTITY_MODS, 'must be a fresh object');
    assert.equal(combatModsFor(any, false), null);
    assert.equal(combatModsFor(plain, false), null);
  });
  // Degenerate loadouts also fold to identity.
  for (const empty of [{}, null, undefined]) {
    assert.deepEqual(combatModsFor(empty, true), { ...IDENTITY_MODS });
    assert.equal(combatModsFor(empty, false), null);
  }
});

// ── 3. Folding laws ──────────────────────────────────────────────────────────

const SEED_3 = 0x4d450003;
test(`3. fold: bonuses add, multipliers multiply, shotDamage is max (seed ${hex(SEED_3)})`, () => {
  forAll(SEED_3, 300, (rng) => randomLoadout(rng), (loadout) => {
    const m = combatModsFor(loadout, true);
    const equipped = Object.values(loadout)
      .map((id) => LOADOUT_EFFECTS[id]?.mods)
      .filter(Boolean);

    const hpSum = equipped.reduce((s, x) => s + (x.maxHpBonus ?? 0), 0);
    assert.equal(m.maxHpBonus, hpSum);

    const dmgMax = Math.max(PLAYER_PROJECTILE_DAMAGE, ...equipped.map((x) => x.shotDamage ?? 0));
    assert.equal(m.shotDamage, dmgMax);

    for (const k of MULT_KEYS) {
      const prod = equipped.reduce((p, x) => p * (x[k] ?? 1), 1);
      assert.ok(near(m[k], prod), `${k}: ${m[k]} vs product ${prod}`);
    }

    const ref = expectedFold(loadout);
    for (const k of Object.keys(IDENTITY_MODS)) assert.ok(near(m[k], ref[k]), `${k} vs reference fold`);
  });
});

// ── 4. Bounds, exhaustive ────────────────────────────────────────────────────

test('4. every possible loadout folds inside the bounds (exhaustive)', () => {
  // Each slot is empty or one of its parts: 3^6 = 729 loadouts.
  const options = SLOTS.map((s) => [null, ...IDS_BY_SLOT[s]]);
  const total = options.reduce((n, o) => n * o.length, 1);
  assert.ok(total >= MIN_CASES);
  forAll(0, total, (_rng, i) => {
    const loadout = {};
    let rest = i;
    SLOTS.forEach((slot, s) => {
      loadout[slot] = options[s][rest % options[s].length];
      rest = Math.floor(rest / options[s].length);
    });
    return loadout;
  }, (loadout) => {
    const m = combatModsFor(loadout, true);
    for (const k of ['projectileSpeedMult', 'dashCooldownMult', 'fireCooldownMult']) {
      assert.ok(m[k] >= 0.5 && m[k] <= 2, `${k} out of [0.5, 2]: ${m[k]}`);
    }
    assert.ok(m.incomingDamageMult >= 0.5 && m.incomingDamageMult <= 2);
    assert.ok(Number.isInteger(m.maxHpBonus) && m.maxHpBonus >= 0 && m.maxHpBonus <= 50,
      `maxHpBonus out of [0, 50]: ${m.maxHpBonus}`);
    assert.ok(
      m.shotDamage >= PLAYER_PROJECTILE_DAMAGE && m.shotDamage <= 2 * PLAYER_PROJECTILE_DAMAGE,
      `shotDamage out of range: ${m.shotDamage}`,
    );
  });
});

// ── 5. createArena with in-bounds mods ───────────────────────────────────────

const SEED_5 = 0x4d450005;
test(`5. createArena: hp === maxHp, integer dash base, hp ≤ maxHp over ticks (seed ${hex(SEED_5)})`, () => {
  forAll(SEED_5, 250, (rng) => ({
    mods:     randomBoundedMods(rng),
    totals:   randomTotals(rng, null),
    playerHp: rng() < 0.3 ? int(rng, 1, PLAYER_MAX_HP) : undefined,
    ticks:    int(rng, 1, 60),
    runSeed:  int(rng, 1, 0x7fffffff),
  }), ({ mods, totals, playerHp, ticks, runSeed }) => {
    const stats = playerHp === undefined ? {} : { playerHp };
    const start = createArena({ ...totals, combatMods: mods }, stats);
    const maxHp = PLAYER_MAX_HP + mods.maxHpBonus;

    assert.equal(start.player.maxHp, maxHp);
    if (playerHp === undefined) {
      assert.equal(start.player.hp, maxHp);
      assert.equal(start.player.hp, start.player.maxHp);
    } else {
      assert.equal(start.player.hp, playerHp + mods.maxHpBonus);
    }
    const base = start.player.dashCooldownBaseMs;
    assert.ok(Number.isInteger(base) && base > 0, `dashCooldownBaseMs: ${base}`);

    const rng = makePrng(runSeed);
    let state = start;
    for (let t = 0; t < ticks; t++) {
      state = updateArena(state, randomActions(rng), DT);
      assert.ok(state.player.hp <= state.player.maxHp, `tick ${t}: hp ${state.player.hp} > maxHp ${state.player.maxHp}`);
      assert.equal(state.player.maxHp, maxHp, `tick ${t}: maxHp changed`);
      assert.equal(state.player.dashCooldownBaseMs, base, `tick ${t}: dash base changed`);
    }
  });
});

// ── 6. Damage invariants ─────────────────────────────────────────────────────

const SEED_6 = 0x4d450006;
test(`6. random short duels: hp never rises or goes below 0, phase only leaves 'playing' (seed ${hex(SEED_6)})`, () => {
  let damageEvents = 0;

  forAll(SEED_6, 200, (rng) => ({
    loadout:  randomLoadout(rng),
    useMods:  rng() < 0.7,
    totals:   randomTotals(rng, null),
    // Low hp on both sides and a close start so hits and kills happen quickly.
    playerHp: int(rng, 1, 60),
    enemyHp:  int(rng, 1, 80),
    px:       float(rng, 450, 800),
    py:       float(rng, 350, 550),
    ticks:    int(rng, 60, 150),
    runSeed:  int(rng, 1, 0x7fffffff),
  }), (c) => {
    const mods = c.useMods ? combatModsFor(c.loadout, true) : null;
    let state = createArena(mods ? { ...c.totals, combatMods: mods } : c.totals, { playerHp: c.playerHp });
    state = {
      ...state,
      enemy:  { ...state.enemy, hp: c.enemyHp },
      player: { ...state.player, x: c.px, y: c.py },
    };

    const rng = makePrng(c.runSeed);
    for (let t = 0; t < c.ticks; t++) {
      const prev = state;
      const enemyPos = { x: prev.enemy.x, y: prev.enemy.y };
      const actions = {
        move: rng() < 0.5 ? { dx: float(rng, -1, 1), dy: float(rng, -1, 1) } : undefined,
        // Aim near the enemy so player shots land sometimes.
        aim:  { x: enemyPos.x + float(rng, -40, 40), y: enemyPos.y + float(rng, -40, 40) },
        fire: rng() < 0.9,
        dash: rng() < 0.05,
      };
      state = updateArena(prev, actions, DT);

      assert.ok(state.player.hp <= prev.player.hp, `tick ${t}: player hp rose ${prev.player.hp} → ${state.player.hp}`);
      assert.ok(state.enemy.hp  <= prev.enemy.hp,  `tick ${t}: enemy hp rose ${prev.enemy.hp} → ${state.enemy.hp}`);
      assert.ok(state.player.hp >= 0, `tick ${t}: player hp below 0: ${state.player.hp}`);
      assert.ok(state.enemy.hp  >= 0, `tick ${t}: enemy hp below 0: ${state.enemy.hp}`);
      assert.ok(state.elapsedMs >= prev.elapsedMs, `tick ${t}: elapsedMs went backwards`);
      if (state.player.hp < prev.player.hp || state.enemy.hp < prev.enemy.hp) damageEvents++;

      if (prev.phase !== 'playing') {
        // Over is over: phase and hp stay put.
        assert.equal(state.phase, prev.phase, `tick ${t}: phase left '${prev.phase}'`);
        assert.equal(state.player.hp, prev.player.hp);
        assert.equal(state.enemy.hp, prev.enemy.hp);
      } else {
        assert.ok(['playing', 'win', 'lose'].includes(state.phase), `tick ${t}: bad phase ${state.phase}`);
      }
      // Phase agrees with hp.
      if (state.phase === 'win')  assert.equal(state.enemy.hp, 0);
      if (state.phase === 'lose') assert.ok(state.player.hp === 0 && state.enemy.hp > 0);
      if (state.phase === 'playing') assert.ok(state.player.hp > 0 && state.enemy.hp > 0);
    }
  });

  // Guard against a vacuous run: some cases must have exchanged damage.
  assert.ok(damageEvents > 0, 'no case dealt any damage; the generator never exercises the hit path');
});

const SEED_6B = 0x4d450066;
test(`6b. applyDamage never heals, floors at 0 and does not mutate (seed ${hex(SEED_6B)})`, () => {
  forAll(SEED_6B, 300, (rng) => ({
    hp:     int(rng, 0, 400),
    amount: rng() < 0.15 ? -int(rng, 1, 50) : float(rng, 0, 100),
  }), ({ hp, amount }) => {
    const before = { hp, tag: 'x' };
    const after = applyDamage(before, amount);
    assert.equal(before.hp, hp, 'input mutated');
    assert.equal(after.tag, 'x');
    assert.ok(after.hp >= 0 && after.hp <= hp, `hp ${hp} - ${amount} → ${after.hp}`);
    assert.equal(after.hp, Math.max(0, hp - Math.max(0, amount)));
  });
});

// ── 7. Fired projectiles carry the folded numbers ────────────────────────────

const SEED_7 = 0x4d450007;
test(`7. player projectiles: damage === shotDamage, speed === PROJECTILE_SPEED × mult (seed ${hex(SEED_7)})`, () => {
  let checked = 0;

  forAll(SEED_7, 250, (rng) => ({
    loadout: randomLoadout(rng),
    useMods: rng() < 0.8,
    totals:  randomTotals(rng, null),
    runSeed: int(rng, 1, 0x7fffffff),
  }), (c) => {
    const mods = c.useMods ? combatModsFor(c.loadout, true) : null;
    const expectDamage = mods ? mods.shotDamage : PLAYER_PROJECTILE_DAMAGE;
    const expectSpeed  = PROJECTILE_SPEED * (mods ? mods.projectileSpeedMult : 1);

    let state = createArena(mods ? { ...c.totals, combatMods: mods } : c.totals);
    const rng = makePrng(c.runSeed);
    // Hold fire toward the enemy for 70 ticks (≥ 3 shots at the slowest reload).
    // The enemy starts 800 wu away, so no enemy shot interferes.
    for (let t = 0; t < 70; t++) {
      state = updateArena(state, {
        aim:  { x: ENEMY_START_X, y: ENEMY_START_Y + float(rng, -30, 30) },
        fire: true,
      }, DT);
      for (const p of state.projectiles) {
        if (p.owner !== 'player') continue;
        checked++;
        assert.equal(p.damage, expectDamage, `tick ${t}: damage ${p.damage} !== ${expectDamage}`);
        const speed = Math.hypot(p.vx, p.vy);
        assert.ok(Math.abs(speed - expectSpeed) < 1e-6, `tick ${t}: speed ${speed} !== ${expectSpeed}`);
      }
    }
  });

  assert.ok(checked > 0, 'no player projectile was ever inspected');
});

// ── 8. Flag-off equivalence ──────────────────────────────────────────────────

const SEED_8 = 0x4d450008;
test(`8. totals without combatMods ≡ combatMods: null in seeded fights (seed ${hex(SEED_8)})`, () => {
  const builds = enumerateLoadouts();
  assert.ok(builds.length > 0);
  const policies = ['baseline', 'dashSpam', 'camp', 'reactive'];

  // Fights are the slow part: 12 short fights, each run twice.
  forAll(SEED_8, 12, (rng) => ({
    build:   int(rng, 0, builds.length - 1),
    seed:    int(rng, 1, 0x7fffffff),
    hauntLv: rng() < 0.5 ? int(rng, 1, 5) : undefined,
    policy:  pick(rng, policies),
  }), (c) => {
    const build = builds[c.build];
    const { combatMods, ...without } = build.totals;   // what the caller passes when the flag is off
    const opts = { maxSeconds: 15, hauntLv: c.hauntLv, policy: c.policy };

    const a = runFight({ ...build, totals: without }, c.seed, opts);
    const b = runFight({ ...build, totals: { ...without, combatMods: null } }, c.seed, opts);

    assert.equal(a.phase, b.phase);
    assert.equal(a.elapsedMs, b.elapsedMs);
    assert.equal(a.playerHp, b.playerHp);
    assert.equal(a.enemyHp, b.enemyHp);
  }, { min: 1 });
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
