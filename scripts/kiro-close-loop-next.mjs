/** @deprecated use scripts/kiro-close-loop-on-stop.mjs — kept as alias for NEXT-PROMPT only. */
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const r = spawnSync(process.execPath, [join(here, 'kiro-close-loop-on-stop.mjs')], {
  cwd: resolve(here, '..'),
  stdio: 'inherit',
});
process.exit(r.status ?? 1);
