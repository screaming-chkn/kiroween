/**
 * scripts/kiro-hook-run.mjs — run a Kiro hook command and log that it fired.
 *
 * Usage (from a .kiro/hooks/*.json command action):
 *   node scripts/kiro-hook-run.mjs <hook-name> -- <command...>
 *
 * Kiro passes the hook event as JSON on stdin. This wrapper reads it, runs the
 * real command in the repo root, prints a short summary of its output (Kiro
 * adds hook stdout to the agent context), then appends one line to .kiro/hook-runs.log:
 *
 *   <UTC ISO time> <hook-name> event=<hook_event_name> file=<path> exit=<code> ms=<duration>
 *
 * Only the hook name, event name, file path, exit code and duration are kept;
 * the rest of the event (session ids, cwd) is not written. The exit code is
 * passed back so a failing command still reports as a hook error.
 *
 * Node built-ins only.
 */

import { appendFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOG_FILE = join(REPO_ROOT, '.kiro', 'hook-runs.log');

/** Find the first string under a path-ish key anywhere in the event. */
export function eventFilePath(event) {
  const keys = new Set(['file_path', 'filePath', 'path', 'file', 'uri']);
  const seen = new Set();
  const stack = [event];
  while (stack.length) {
    const v = stack.pop();
    if (!v || typeof v !== 'object' || seen.has(v)) continue;
    seen.add(v);
    for (const [k, val] of Object.entries(v)) {
      if (keys.has(k) && typeof val === 'string' && val) return val;
      if (val && typeof val === 'object') stack.push(val);
    }
  }
  return '';
}

/**
 * Short hook output for the agent's context. Success: the last 3 non-empty
 * lines. Failure: every line that mentions FAIL/Error/✗ (max 30) plus the last
 * 20 lines.
 * @param {string} text
 * @param {{ok:boolean}} o
 */
export function summarizeOutput(text, { ok }) {
  const lines = String(text ?? '').split('\n').filter((l) => l.trim());
  if (ok) return lines.slice(-3).join('\n') + '\n';
  const bad = lines.filter((l) => /FAIL|Error|✗|not ok/.test(l)).slice(0, 30);
  return [...bad, '…', ...lines.slice(-20)].join('\n') + '\n';
}

/** Pick the event name Kiro reports, if any. */
export function eventName(event) {
  if (!event || typeof event !== 'object') return '';
  return String(event.hook_event_name ?? event.hookEventName ?? event.trigger ?? event.event ?? '');
}

function readStdin() {
  if (process.stdin.isTTY) return '';
  try { return readFileSync(0, 'utf8'); } catch { return ''; }
}

function main() {
  const args = process.argv.slice(2);
  const sep = args.indexOf('--');
  const name = args[0] || 'unknown-hook';
  const cmd = sep >= 0 ? args.slice(sep + 1).join(' ') : '';
  if (!cmd) {
    console.error('usage: node scripts/kiro-hook-run.mjs <hook-name> -- <command...>');
    process.exit(2);
  }
  let event = null;
  const raw = readStdin();
  try { event = raw ? JSON.parse(raw) : null; } catch { event = null; }
  let file = eventFilePath(event);
  if (file && isAbsolute(file)) file = relative(REPO_ROOT, file) || file;

  const t0 = Date.now();
  const r = spawnSync(cmd, {
    cwd: REPO_ROOT, shell: true, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const code = r.status ?? 1;
  // Kiro adds hook stdout to the agent's context, so keep it short: a summary
  // on success, the failing lines plus the tail on failure.
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  if (code === 0) process.stdout.write(summarizeOutput(out, { ok: true }));
  else process.stderr.write(summarizeOutput(out, { ok: false }));
  const line = `${new Date().toISOString()} ${name} event=${eventName(event) || '-'} file=${file || '-'} exit=${code} ms=${Date.now() - t0}\n`;
  appendFileSync(LOG_FILE, line);
  process.exit(code);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
