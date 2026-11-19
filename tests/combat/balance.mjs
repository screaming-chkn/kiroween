/**
 * tests/combat/balance.mjs
 *
 * Full headless balance report runner (invoke separately from `npm test`):
 *
 *   node tests/combat/balance.mjs
 *
 * HARD SCOPE: tests / CI only. No UI, no renderer. This script drives the
 * pure arena sim with a scripted deterministic player policy against the
 * built-in enemy AI across ~200 seeded duels, aggregates per-build win rate
 * and duel length, flags builds with win rate > 60%, and writes a markdown
 * report to BOTH:
 *
 *   • tests/combat/BALANCE.md            (in-repo, committed artifact) — only
 *     on a full run (BALANCE_SEEDS=200, `npm run test:balance:full`, ~7 min).
 *     Quick runs (default 48 per-LV seeds) write to the OS temp dir instead,
 *     so they never overwrite the committed 200-seed report.
 *   • process.env.BALANCE_BOSS_PATH       (optional second copy for hand-off)
 *
 * Report only — it never retunes combat numbers.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  enumerateLoadouts,
  runMatrix,
  runLevelMatrix,
  aggregate,
  buildReport,
  median,
  DEFAULT_MAX_SECONDS,
  HUMAN_PROFILES,
  AIM_NOISE_SIGMA,
} from './balanceCore.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Target ~200 fights total: pick a seed count so builds × seeds ≈ 200.
const builds = enumerateLoadouts();
const TARGET_TOTAL = 200;
const seedCount = Math.max(16, Math.ceil(TARGET_TOTAL / builds.length));
const seeds = Array.from({ length: seedCount }, (_, i) => 0x9e3779b9 + i * 2654435761);

console.log(
  `\nHAUNT//HOUND balance run — ${builds.length} builds × ${seedCount} seeds ` +
    `= ${builds.length * seedCount} fights (cap ${DEFAULT_MAX_SECONDS}s)\n`,
);

const started = Date.now();
const { results } = runMatrix({ seeds, maxSeconds: DEFAULT_MAX_SECONDS });
const agg = aggregate(results);

const meta = {
  totalFights: results.length,
  buildCount: builds.length,
  seedCount,
  maxSeconds: DEFAULT_MAX_SECONDS,
  generatedAt: new Date().toISOString(),
};

const report = buildReport(agg, meta);

// ── Write to both targets ──────────────────────────────────────────────────────
// The committed report is the 200-seed run. Read the seed count here so a
// quick run never overwrites it.
const FULL_SEEDS = 200;
const lvSeedCount = Math.max(1, Number(process.env.BALANCE_SEEDS) || 48);
const repoPath = lvSeedCount === FULL_SEEDS
  ? resolve(__dirname, 'BALANCE.md')
  : join(tmpdir(), `haunt-hound-BALANCE.${lvSeedCount}-seeds.md`);
const bossPath = process.env.BALANCE_BOSS_PATH || '';

const targets = [repoPath, ...(bossPath ? [bossPath] : [])];
for (const target of targets) {
  try {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, report, 'utf8');
    console.log(`  ✓ wrote ${target}`);
  } catch (err) {
    console.error(`  ✗ failed to write ${target}: ${err.message}`);
  }
}

// ── Console summary ─────────────────────────────────────────────────────────────
const flagged = agg.filter((b) => b.flagged);
console.log(`\n  Elapsed: ${((Date.now() - started) / 1000).toFixed(1)}s`);
console.log(`  Flagged builds (win rate > 60%): ${flagged.length}`);
for (const b of flagged) {
  console.log(
    `    ⚠️  ${b.label} — win ${(b.winRate * 100).toFixed(1)}%, ` +
      `median ${b.medianDurationSec.toFixed(1)}s`,
  );
}
console.log('');

// ── Per-level matrix (baseline + probes) ───────────────────────────────────────
console.log('  Running per-LV matrix (baseline, dashSpam, camp, reactive, firstTimer, medium)…');
const policies = ['baseline', 'dashSpam', 'camp', 'reactive', 'firstTimer', 'medium'];
// Per-LV section uses its own seed list (not the ~200-fight list above).
// Default 48 seeds (~1 min). Per-build deviation at 48 seeds is mostly
// sampling noise (±7 pp per build), so the committed BALANCE.md comes from
// `npm run test:balance:full` (BALANCE_SEEDS=200, ~7 min). lvSeedCount is
// read above, next to the output path.
const lvSeeds = Array.from({ length: lvSeedCount }, (_, i) => 0x9e3779b9 + i * 2654435761);
const levelMatrices = {};
for (const pol of policies) {
  levelMatrices[pol] = runLevelMatrix({ seeds: lvSeeds, policy: pol, maxSeconds: DEFAULT_MAX_SECONDS });
}

// Helper: count timeouts across all builds at one level entry.
function countTimeouts(lvEntry) {
  return lvEntry.builds.reduce((s, b) => s + b.timeouts, 0);
}

// ── Per HAUNT LV (baseline) table ─────────────────────────────────────────────
const baselineLevels = levelMatrices['baseline'];

const lvLines = [];
lvLines.push(`## Per HAUNT LV (baseline, ${lvSeedCount} seeds × ${builds.length} builds per LV)`);
lvLines.push('');
lvLines.push('| LV | Win rate % | Median s | Max build dev pp | Timeouts |');
lvLines.push('|---:|---:|---:|---:|---:|');
for (const lv of baselineLevels) {
  lvLines.push(
    `| ${lv.level} | ${(lv.winRate * 100).toFixed(1)} | ${lv.medianDurationSec.toFixed(1)} ` +
    `| ${(lv.maxBuildDeviation * 100).toFixed(1)} | ${countTimeouts(lv)} |`,
  );
}
lvLines.push('');

// ── Strategy probes table ──────────────────────────────────────────────────────
const probeLines = [];
probeLines.push('## Strategy probes');
probeLines.push('');
probeLines.push('| LV | baseline % | dashSpam % | camp % | reactive % | dashSpam − baseline pp | camp − baseline pp | dashSpam − reactive pp |');
probeLines.push('|---:|---:|---:|---:|---:|---:|---:|---:|');

const signed = (x) => (x >= 0 ? '+' : '') + x.toFixed(1);
const levels = baselineLevels.map((e) => e.level);
for (const level of levels) {
  const pcts = {};
  for (const pol of policies) {
    const entry = levelMatrices[pol].find((e) => e.level === level);
    pcts[pol] = entry ? entry.winRate * 100 : 0;
  }
  probeLines.push(
    `| ${level} | ${pcts['baseline'].toFixed(1)} | ${pcts['dashSpam'].toFixed(1)} ` +
    `| ${pcts['camp'].toFixed(1)} | ${pcts['reactive'].toFixed(1)} ` +
    `| ${signed(pcts['dashSpam'] - pcts['baseline'])} ` +
    `| ${signed(pcts['camp'] - pcts['baseline'])} ` +
    `| ${signed(pcts['dashSpam'] - pcts['reactive'])} |`,
  );
}
probeLines.push('');

// ── Human profiles (owner LV1 target) ────────────────────────────────────────
const humanLines = [];
humanLines.push('## Human profiles (LV1 target: ~30 s; first-timer wins ~1/3, medium ~2/3)');
humanLines.push('');
humanLines.push('Harness-only player models (`HUMAN_PROFILES` in `balanceCore.mjs`). Both run the baseline policy (lead aim, sticky lapses, random dashes) plus:');
humanLines.push('');
humanLines.push('| Profile | Aim sigma (wu) | Reads the tell | Reaction (ms) | Stands still to aim |');
humanLines.push('|---|---:|---:|---:|---:|');
humanLines.push(`| baseline (reference) | ${AIM_NOISE_SIGMA} | never (random dashes only) | – | never |`);
for (const [name, p] of Object.entries(HUMAN_PROFILES)) {
  humanLines.push(`| ${name} | ${p.aimSigma} | ${Math.round(p.tellDodgeChance * 100)} % of rings | ${p.reactMeanMs} ± ${p.reactSdMs} | ${Math.round(p.stillShare * 100)} % of 0.75 s beats |`);
}
humanLines.push('');
humanLines.push('- **firstTimer:** a first game. Rough aim (sigma 60 was the old "near-0 % wins" setting), reacts to a quarter of the red rings, a bit slow.');
humanLines.push('- **medium:** has learned the tell (the LV1 caption teaches it). Slightly better aim, dashes on most rings.');
humanLines.push('- A reaction dashes along the strafe line once the delay has passed; after the 450 ms windup it is too late. Dash cooldown still applies, so nobody dodges every shot.');
humanLines.push('- The gap between the two is mostly tell-reading. Win rate is very sensitive to "stands still": at LV1, 30 % gives first-timer ~52 % / medium ~73 %, 50 % gives ~20 % / ~61 %. Treat these as models, not measurements; a real phone playtest is the check.');
humanLines.push('');
humanLines.push('| LV | firstTimer win % | firstTimer median s | medium win % | medium median s | baseline win % | baseline median s |');
humanLines.push('|---:|---:|---:|---:|---:|---:|---:|');
for (const level of levels) {
  const e = (pol) => levelMatrices[pol].find((x) => x.level === level);
  const ft = e('firstTimer'), md = e('medium'), bl = e('baseline');
  humanLines.push(`| ${level} | ${(ft.winRate * 100).toFixed(1)} | ${ft.medianDurationSec.toFixed(1)} | ${(md.winRate * 100).toFixed(1)} | ${md.medianDurationSec.toFixed(1)} | ${(bl.winRate * 100).toFixed(1)} | ${bl.medianDurationSec.toFixed(1)} |`);
}
humanLines.push('');

// ── Append tables to BALANCE.md ───────────────────────────────────────────────
const appendMd = '\n' + lvLines.join('\n') + probeLines.join('\n') + '\n' + humanLines.join('\n');
for (const target of targets) {
  try {
    writeFileSync(target, report + appendMd, 'utf8');
  } catch (err) {
    console.error(`  ✗ failed to append tables to ${target}: ${err.message}`);
  }
}

// ── Print tables to console ───────────────────────────────────────────────────
console.log('\n' + lvLines.join('\n'));
console.log(probeLines.join('\n'));
console.log(humanLines.join('\n'));
