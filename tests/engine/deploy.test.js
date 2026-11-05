/**
 * tests/engine/deploy.test.js
 *
 * R5 "Start fast" contract test:
 *   WHEN the player hits Deploy THEN a match SHALL start in under 30 seconds.
 *
 * Runnable with Node (no browser, no framework):
 *
 *   node tests/engine/deploy.test.js
 *
 * ── What this proves ─────────────────────────────────────────────────────────
 * The 30 s figure is a *user-experience* ceiling, not a loading screen — there
 * is no loading screen in HAUNT//HOUND. On first run the garage hands a preset
 * loadout straight to the arena and the fixed-timestep loop begins. So the
 * enforceable contract is that the CODE on the Deploy critical path finishes
 * far inside that ceiling.
 *
 * This test times the exact garage→arena handoff that src/main.js runs when
 * `onDeploy` fires, with no DOM / Canvas / audio involved:
 *
 *   defaultLoadout()                 → preset part ids (first-run, no save)
 *   totals(loadout, PARTS_BY_ID)     → weight / power totals
 *   speedPenalty(loadPct)            → arena-ready stat (weight curve)
 *   createArena(arenaStats)          → initial ArenaState
 *   updateArena(...) × warm-up ticks → the loop is actually advancing
 *
 * We assert the wall-clock elapsed is comfortably under the 30 000 ms ceiling
 * with a tight CI budget (< 2 000 ms) so a regression that stalls the deploy
 * path fails loudly — without a flaky real-time 30 s wait.
 *
 * Uses only Node's built-in assert module and ES module imports.
 */

import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import { defaultLoadout }                from '../../src/data/presets.js';
import { PARTS_BY_ID }                   from '../../src/data/parts.js';
import { totals }                        from '../../src/mech/loadout.js';
import { speedPenalty }                  from '../../src/mech/weight.js';
import { createArena, updateArena }      from '../../src/combat/arena.js';
import { FIXED_DT }                      from '../../src/engine/loop.js';

// ── Minimal test harness (matches tests/engine/loop.test.js) ─────────────────

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

// ── Contract constants ───────────────────────────────────────────────────────

/** R5 hard ceiling: a match must start in under 30 s. */
const R5_CEILING_MS = 30_000;

/**
 * CI budget: the pure critical path must finish well inside the ceiling.
 * Generous enough to survive a slow/loaded CI box, tight enough that a real
 * stall (e.g. an accidental sync sleep or O(n²) blow-up) trips it.
 */
const CI_BUDGET_MS = 2_000;

/** Number of warm-up ticks to advance so we prove the loop really runs. */
const WARMUP_TICKS = 180;   // ~3 s of fixed-timestep sim at 1/60

/**
 * Run the full garage→arena deploy critical path exactly as src/main.js does
 * on first run, and return the resulting state. No DOM / Canvas / audio.
 */
function runDeployCriticalPath() {
  // 1. First-run loadout: no localStorage save → preset.
  const loadout = defaultLoadout();

  // 2. Garage totals (weight / power).
  const loadoutTotals = totals(loadout, PARTS_BY_ID);

  // 3. Derive arena stats (weight curve → speed penalty), mirroring main.js.
  const arenaStats = {
    ...loadoutTotals,
    speedPenalty: speedPenalty(loadoutTotals.loadPct ?? 0),
  };

  // 4. Build the arena.
  const state0 = createArena(arenaStats);

  // 5. Advance the loop a few frames so "the match has started" is real, not
  //    just an allocated object. No input this warm-up.
  let state = state0;
  for (let i = 0; i < WARMUP_TICKS; i++) {
    state = updateArena(state, {}, FIXED_DT);
  }

  return { state0, state };
}

// ── Tests ────────────────────────────────────────────────────────────────────

console.log('\nR5 — Deploy-to-match starts in under 30 s (pure critical path)\n');

test('deploy critical path finishes well under the 30 s ceiling', () => {
  const t0 = performance.now();
  runDeployCriticalPath();
  const elapsedMs = performance.now() - t0;

  // The real R5 contract.
  assert.ok(
    elapsedMs < R5_CEILING_MS,
    `deploy took ${elapsedMs.toFixed(2)}ms — must be < ${R5_CEILING_MS}ms (R5)`,
  );

  // Tight, enforceable CI budget so regressions fail loudly.
  assert.ok(
    elapsedMs < CI_BUDGET_MS,
    `deploy took ${elapsedMs.toFixed(2)}ms — CI budget is < ${CI_BUDGET_MS}ms`,
  );

  console.log(
    `    deploy path: ${elapsedMs.toFixed(2)}ms ` +
    `(ceiling ${R5_CEILING_MS}ms, CI budget ${CI_BUDGET_MS}ms)`,
  );
});

test('deploy produces a live, playable arena (match actually started)', () => {
  const { state0, state } = runDeployCriticalPath();

  // Fresh arena is in the playing phase at t=0.
  assert.equal(state0.phase, 'playing', `state0.phase=${state0.phase}`);
  assert.equal(state0.elapsedMs, 0, `state0.elapsedMs=${state0.elapsedMs}`);

  // Player and enemy both exist with positive HP — a real match, not a stub.
  assert.ok(state0.player, 'player must exist');
  assert.ok(state0.enemy, 'enemy must exist');
  assert.ok(state0.player.hp > 0, `player.hp=${state0.player.hp}`);
  assert.ok(state0.enemy.hp > 0, `enemy.hp=${state0.enemy.hp}`);

  // After warm-up ticks the sim clock has advanced — the loop is live.
  assert.ok(
    state.elapsedMs > 0,
    `elapsedMs after warm-up must be > 0, got ${state.elapsedMs}`,
  );
  assert.ok(
    Number.isFinite(state.player.x) && Number.isFinite(state.player.y),
    'player position must stay finite through warm-up',
  );
});

test('each deploy tick is cheap (no per-tick stall on the critical path)', () => {
  // Build once (outside the timed region) then time a block of ticks so we
  // isolate per-frame cost from one-time setup. A single tick must be far
  // under one 16.6 ms frame budget; we assert a generous per-tick ceiling.
  const loadout = defaultLoadout();
  const arenaStats = {
    ...totals(loadout, PARTS_BY_ID),
  };
  arenaStats.speedPenalty = speedPenalty(arenaStats.loadPct ?? 0);

  let state = createArena(arenaStats);

  const TICKS = 600;   // ~10 s of sim
  const t0 = performance.now();
  for (let i = 0; i < TICKS; i++) {
    state = updateArena(state, {}, FIXED_DT);
  }
  const perTickMs = (performance.now() - t0) / TICKS;

  assert.ok(
    perTickMs < 5,
    `per-tick cost ${perTickMs.toFixed(4)}ms must be < 5ms`,
  );
  console.log(`    per-tick cost: ${perTickMs.toFixed(4)}ms over ${TICKS} ticks`);
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
