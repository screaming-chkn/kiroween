/**
 * tests/combat/balance.test.js
 *
 * SMALL smoke test for the headless balance harness (runs under `npm test`).
 * Runnable with Node (no browser, no framework):
 *
 *   node tests/combat/balance.test.js
 *
 * It runs only a tiny subset (8 fights) so the default test suite stays fast;
 * the full ~200-fight report lives in tests/combat/balance.mjs and is invoked
 * separately via `npm run test:balance`.
 *
 * Asserts, expect-style:
 *   • runFight records a valid phase, elapsedMs, and duration.
 *   • winRate math is correct (wins / fights) and in [0, 1].
 *   • aggregate produces per-build duel-length stats (mean/median) that match
 *     the recorded durations.
 *   • buildReport produces a markdown string and the flagged list is an array
 *     consistent with the > 60% threshold.
 *   • enumerateLoadouts yields only legal builds (load% ≤ 115).
 */

import assert from 'node:assert/strict';
import {
  mulberry32,
  leadAim,
  enumerateLoadouts,
  runFight,
  runMatrix,
  aggregate,
  buildReport,
  mean,
  median,
  WIN_RATE_FLAG,
  DEFAULT_MAX_SECONDS,
} from './balanceCore.mjs';
import { PROJECTILE_SPEED } from '../../src/combat/config.js';
import { PARTS_BY_ID } from '../../src/data/parts.js';
import { totals as loadoutTotals } from '../../src/mech/loadout.js';

// ── Minimal test harness (matches tests/engine/loop.test.js) ──────────────────

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

console.log('\ntests/combat/balance.test.js — balance harness smoke\n');

// ── RNG determinism ───────────────────────────────────────────────────────────

test('mulberry32 is deterministic and in [0,1)', () => {
  const a = mulberry32(12345);
  const b = mulberry32(12345);
  for (let i = 0; i < 5; i++) {
    const va = a();
    const vb = b();
    assert.equal(va, vb, 'same seed must produce same stream');
    assert.ok(va >= 0 && va < 1, `value out of range: ${va}`);
  }
});

// ── Loadout enumeration legality ──────────────────────────────────────────────

test('enumerateLoadouts yields legal builds only (load% ≤ 115)', () => {
  const builds = enumerateLoadouts();
  assert.ok(builds.length >= 8, `expected ≥ 8 builds, got ${builds.length}`);
  assert.ok(builds.length <= 16, `expected ≤ 16 builds, got ${builds.length}`);
  for (const b of builds) {
    const t = loadoutTotals(b.loadout, PARTS_BY_ID);
    assert.ok(t.loadPct <= 115, `illegal build leaked: ${b.key} @ ${t.loadPct}%`);
    // totals passed to the arena carry the derived combat fields.
    assert.ok(typeof b.totals.speedPenalty === 'number');
    assert.ok(typeof b.totals.powerOut === 'number');
  }
});

// ── runFight records phase / duration ──────────────────────────────────────────

test('runFight records phase, elapsedMs, and duration (8-fight subset)', () => {
  const builds = enumerateLoadouts().slice(0, 4);
  const seeds = [1, 2]; // 4 builds × 2 seeds = 8 fights
  const results = [];
  for (const build of builds) {
    for (const seed of seeds) {
      const r = runFight(build, seed, { maxSeconds: 180 });
      results.push({ build, ...r });

      // phase is one of the three expected outcomes.
      assert.ok(
        ['win', 'lose', 'timeout'].includes(r.phase),
        `unexpected phase: ${r.phase}`,
      );
      // duration recorded, positive, and under the cap (+ one tick slack).
      assert.ok(r.elapsedMs > 0, 'elapsedMs must be positive');
      assert.ok(
        r.durationSec <= 180 + 1 / 60,
        `duration ${r.durationSec} exceeded cap`,
      );
      assert.ok(
        Math.abs(r.durationSec - r.elapsedMs / 1000) < 1e-9,
        'durationSec must equal elapsedMs/1000',
      );
      // HPs are non-negative and clamped.
      assert.ok(r.playerHp >= 0 && r.enemyHp >= 0, 'HPs must be ≥ 0');
    }
  }
  assert.equal(results.length, 8, 'smoke subset must be exactly 8 fights');
});

// ── Determinism: same (build, seed) ⇒ same result ──────────────────────────────

test('runFight is deterministic for a fixed (build, seed)', () => {
  const build = enumerateLoadouts()[0];
  const r1 = runFight(build, 777, { maxSeconds: 180 });
  const r2 = runFight(build, 777, { maxSeconds: 180 });
  assert.deepEqual(r1, r2, 'same seed must reproduce the same fight');
});

// ── winRate math + duel-length stats ───────────────────────────────────────────

test('aggregate winRate = wins/fights and is in [0,1]', () => {
  const builds = enumerateLoadouts().slice(0, 4);
  const seeds = [1, 2];
  const results = [];
  for (const build of builds) {
    for (const seed of seeds) {
      results.push({ build, ...runFight(build, seed, { maxSeconds: 180 }) });
    }
  }
  const agg = aggregate(results);
  for (const b of agg) {
    assert.equal(b.fights, b.wins + b.losses, 'fights must equal wins+losses');
    const expected = b.fights > 0 ? b.wins / b.fights : 0;
    assert.ok(
      Math.abs(b.winRate - expected) < 1e-12,
      `winRate math wrong for ${b.key}: ${b.winRate} vs ${expected}`,
    );
    assert.ok(b.winRate >= 0 && b.winRate <= 1, 'winRate must be in [0,1]');
    assert.equal(b.flagged, b.winRate > WIN_RATE_FLAG, 'flag must match threshold');
  }
});

test('aggregate duel-length stats match recorded durations', () => {
  // Hand-built results with known durations to verify mean/median exactly.
  const fakeBuild = {
    key: 'fake',
    label: 'Fake Build',
    totals: { loadPct: 50, powerOut: 10, powerDraw: 5, speedPenalty: 0, balance: 5 },
  };
  const durs = [30, 60, 90, 120]; // median = 75, mean = 75
  const results = durs.map((d, i) => ({
    build: fakeBuild,
    phase: i % 2 === 0 ? 'win' : 'lose',
    elapsedMs: d * 1000,
    durationSec: d,
    playerHp: 100,
    enemyHp: 0,
    seed: i,
  }));
  const agg = aggregate(results);
  assert.equal(agg.length, 1, 'one build expected');
  const b = agg[0];
  assert.equal(b.fights, 4);
  assert.equal(b.wins, 2);
  assert.equal(b.losses, 2);
  assert.ok(Math.abs(b.winRate - 0.5) < 1e-12, 'winRate should be 0.5');
  assert.ok(Math.abs(b.meanDurationSec - 75) < 1e-12, `mean ${b.meanDurationSec}`);
  assert.ok(Math.abs(b.medianDurationSec - 75) < 1e-12, `median ${b.medianDurationSec}`);
});

test('mean/median helpers are correct (including odd length)', () => {
  assert.equal(mean([2, 4, 6]), 4);
  assert.equal(median([3, 1, 2]), 2); // odd: middle after sort
  assert.equal(median([1, 2, 3, 4]), 2.5); // even: average of middle two
  assert.equal(mean([]), 0);
  assert.equal(median([]), 0);
});

// ── report writer: markdown string + flagged array ─────────────────────────────

test('buildReport returns markdown and a flagged list consistent with threshold', () => {
  const builds = enumerateLoadouts().slice(0, 4);
  const seeds = [1, 2];
  const results = [];
  for (const build of builds) {
    for (const seed of seeds) {
      results.push({ build, ...runFight(build, seed, { maxSeconds: 180 }) });
    }
  }
  const agg = aggregate(results);
  const meta = {
    totalFights: results.length,
    buildCount: builds.length,
    seedCount: seeds.length,
    maxSeconds: 180,
    generatedAt: '2026-11-05T00:00:00.000Z',
  };
  const report = buildReport(agg, meta);

  assert.equal(typeof report, 'string', 'report must be a string');
  assert.ok(report.includes('# HAUNT//HOUND — Combat Balance Report'), 'has title');
  assert.ok(report.includes('## Summary (per build)'), 'has summary section');
  assert.ok(report.includes('## Flagged builds'), 'has flagged section');
  assert.ok(report.includes('60–120s target'), 'has duel-length section');

  // The flagged list derived from the same agg is an array and consistent.
  const flagged = agg.filter((b) => b.flagged);
  assert.ok(Array.isArray(flagged), 'flagged must be an array');
  for (const b of flagged) {
    assert.ok(b.winRate > WIN_RATE_FLAG, 'flagged entries exceed threshold');
    assert.ok(report.includes(b.label), 'flagged build appears in report');
  }
  // When nothing is flagged the report says so explicitly.
  if (flagged.length === 0) {
    assert.ok(
      report.includes('None — no build exceeded'),
      'empty flagged section states none',
    );
  }
});

// ── lead-the-shot intercept geometry ───────────────────────────────────────────

test('leadAim aims ahead of a strafing target and the intercept geometry holds', () => {
  // Shooter at origin; target 300 wu to the right, strafing straight "up"
  // (−y) at 90 wu/s. A shot aimed at the current position (300, 0) would
  // trail behind; a correct lead must bias the aim toward negative y.
  const shooter = { x: 0, y: 0 };
  const target = { x: 300, y: 0 };
  const vel = { x: 0, y: -90 };
  const aim = leadAim(shooter, target, vel, PROJECTILE_SPEED);

  // Lead point must be ahead of the target along its motion (y < 0) and still
  // roughly downrange (x near 300).
  assert.ok(aim.y < 0, `lead should bias toward target motion, got y=${aim.y}`);
  assert.ok(Math.abs(aim.x - 300) < 1e-9, `x should be unchanged, got ${aim.x}`);

  // Recover the implied intercept time from the lead distance along y:
  //   aim.y = target.y + vel.y * t  ⇒  t = (aim.y - target.y) / vel.y
  const t = (aim.y - target.y) / vel.y;
  assert.ok(t > 0, `intercept time must be positive, got ${t}`);

  // Core invariant: a projectile travelling PROJECTILE_SPEED for time t covers
  // exactly the distance from the shooter to the lead point.
  const flightDist = PROJECTILE_SPEED * t;
  const aimDist = Math.hypot(aim.x - shooter.x, aim.y - shooter.y);
  assert.ok(
    Math.abs(flightDist - aimDist) < 1e-6,
    `flight ${flightDist} must match aim distance ${aimDist}`,
  );
});

test('leadAim with a stationary target returns the current position', () => {
  const aim = leadAim({ x: 0, y: 0 }, { x: 250, y: 100 }, { x: 0, y: 0 }, PROJECTILE_SPEED);
  assert.ok(Math.abs(aim.x - 250) < 1e-9 && Math.abs(aim.y - 100) < 1e-9,
    `stationary target: aim should equal position, got (${aim.x},${aim.y})`);
});

// ── the whole point: leading produces real outcomes under the cap ──────────────

test('matrix produces real win/lose outcomes and sub-cap medians for most builds', () => {
  // A few seeds across every legal build — enough signal without the full run.
  const seeds = [1, 2, 3, 4];
  const { builds, results } = runMatrix({ seeds, maxSeconds: DEFAULT_MAX_SECONDS });
  const agg = aggregate(results);

  // Not everything may time out: there must be a real mix of resolved duels.
  const resolved = results.filter((r) => r.phase === 'win' || r.phase === 'lose');
  assert.ok(
    resolved.length > 0,
    'leading the shot must resolve at least some duels (not all timeouts)',
  );

  // The old bug timed almost every duel out at the 180 s cap. With leading,
  // most builds' MEDIAN duel length must land meaningfully below the cap.
  const capSec = DEFAULT_MAX_SECONDS;
  const belowCap = agg.filter((b) => b.medianDurationSec < capSec - 1);
  assert.ok(
    belowCap.length > agg.length / 2,
    `most builds must have median < ${capSec}s; only ${belowCap.length}/${agg.length} did`,
  );

  // Sanity: enumerated builds and results line up.
  assert.equal(results.length, builds.length * seeds.length, 'matrix size matches');
});

// ── Summary ────────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
