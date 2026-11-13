/**
 * src/ui/specStamp.js — end-card spec stamp text (pure).
 *
 * Counts REAL rows of the build-time seance JSON for one spec. Never invents
 * numbers: missing / empty data returns null and nothing is drawn.
 */

export const ARENA_SPEC = '03-arena-combat';

/**
 * @param {Array<{spec?:string, done?:boolean}>|null|undefined} tasks
 * @param {string} [spec]
 * @returns {{done:number,total:number}|null}
 */
export function countSpecTasks(tasks, spec = ARENA_SPEC) {
  if (!Array.isArray(tasks)) return null;
  let total = 0;
  let done = 0;
  for (const t of tasks) {
    if (!t || t.spec !== spec) continue;
    total++;
    if (t.done === true) done++;
  }
  return total > 0 ? { done, total } : null;
}

/**
 * @param {Array<object>|null|undefined} tasks  Parsed seance-tasks.json.
 * @returns {string|null}
 */
export function formatArenaSpecStamp(tasks) {
  const c = countSpecTasks(tasks, ARENA_SPEC);
  if (!c) return null;
  return `built from .kiro/specs/${ARENA_SPEC} \u00b7 ${c.done}/${c.total} tasks [x]`;
}
