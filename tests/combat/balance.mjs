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
 *   • tests/combat/BALANCE.md            (in-repo, committed artifact)
 *   • (team copy) BALANCE.md (boss hand-off path)
 *
 * Report only — it never retunes combat numbers.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  enumerateLoadouts,
  runMatrix,
  aggregate,
  buildReport,
  DEFAULT_MAX_SECONDS,
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
const repoPath = resolve(__dirname, 'BALANCE.md');
const bossPath = '(team copy) BALANCE.md';

const targets = [repoPath, bossPath];
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
