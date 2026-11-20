/**
 * scripts/kiro-close-loop-on-stop.mjs — Stop command companion for Close-the-Loop Guard.
 *
 * Usage (from .kiro/hooks/*.json via kiro-hook-run.mjs):
 *   node scripts/kiro-hook-run.mjs close-loop-on-stop -- node scripts/kiro-close-loop-on-stop.mjs
 *
 * 1) Writes deploy/kiro-proof/close-loop-guard/STOP-FIRED.txt (UTC stamp) proving Stop fired.
 * 2) Writes .kiro/NEXT-PROMPT.md from recent .kiro/hook-runs.log failures (next CLI run).
 *
 * Same-turn steering is the *agent* Stop hook (inject prompt). This command does not
 * claim same-turn LLM steering; it is the durable next-run fallback + honesty marker.
 * Node built-ins only.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOG_FILE = join(REPO_ROOT, '.kiro', 'hook-runs.log');
const OUT_FILE = join(REPO_ROOT, '.kiro', 'NEXT-PROMPT.md');
const MARK_DIR = join(REPO_ROOT, 'deploy', 'kiro-proof', 'close-loop-guard');
const MARK_FILE = join(MARK_DIR, 'STOP-FIRED.txt');
const TAIL = 12;

function readLogTail() {
  try {
    const text = readFileSync(LOG_FILE, 'utf8');
    return text.split('\n').map((l) => l.trimEnd()).filter(Boolean).slice(-TAIL);
  } catch {
    return [];
  }
}

function failingLines(lines) {
  // Ignore our own stop companion lines when deciding "actionable" failures for NEXT-PROMPT.
  return lines.filter(
    (l) => /\bexit=[1-9]\d*\b/.test(l) && !/\bclose-loop-on-stop\b/.test(l) && !/\bclose-loop-stop-log\b/.test(l),
  );
}

function main() {
  const stamped = new Date().toISOString();
  mkdirSync(MARK_DIR, { recursive: true });
  writeFileSync(MARK_FILE, `${stamped}\n`);

  const lines = readLogTail();
  const fails = failingLines(lines);
  mkdirSync(dirname(OUT_FILE), { recursive: true });

  if (!fails.length) {
    writeFileSync(
      OUT_FILE,
      [
        '# NEXT-PROMPT (Close-the-Loop Guard)',
        '',
        `Generated: ${stamped}`,
        '',
        'No actionable recent `exit!=0` lines in `.kiro/hook-runs.log` (last ' + TAIL + ' lines,',
        'ignoring close-loop Stop companion self-lines).',
        '',
        '## Last hook-runs.log lines',
        '```',
        ...(lines.length ? lines : ['(empty)']),
        '```',
        '',
      ].join('\n'),
    );
    process.stdout.write(`close-loop-on-stop: STOP-FIRED + NEXT-PROMPT (no actionable failures)\n`);
    process.exit(0);
  }

  writeFileSync(
    OUT_FILE,
    [
      '# NEXT-PROMPT (Close-the-Loop Guard)',
      '',
      `Generated: ${stamped}`,
      '',
      'Failing hook runs were present when the agent stopped. If the same-turn agent',
      'Stop hook could not finish the fix, use this file as the next CLI prompt.',
      '',
      '## Failing hook-runs.log lines',
      '```',
      ...fails,
      '```',
      '',
      '## Full recent tail',
      '```',
      ...lines,
      '```',
      '',
      '## Suggested next user prompt',
      '',
      'Fix the failing Kiro hooks listed in `.kiro/NEXT-PROMPT.md` (from `.kiro/hook-runs.log`).',
      'Keep changes minimal; do not touch unrelated HUD/combat balance.',
      '',
    ].join('\n'),
  );
  process.stdout.write(`close-loop-on-stop: STOP-FIRED + NEXT-PROMPT (${fails.length} failing line(s))\n`);
  process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
