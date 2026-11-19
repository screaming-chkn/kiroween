/**
 * src/ui/levelParam.js — `?lv=N` URL jump to a HAUNT LV (playtest fix #3).
 *
 * Read once at startup and passed to setHauntLevel, so judges can see the
 * ramp on purpose. The jump is for that visit only: a later load of the plain
 * URL in the same tab goes back to LV1, as a fresh visit would. Levels earned
 * by winning (no ?lv involved) still survive a reload as before.
 */

import { MIN_HAUNT_LEVEL, MAX_HAUNT_LEVEL } from './hauntLevel.js';

/**
 * @param {string} search  e.g. location.search
 * @returns {number|null}  an integer 1..MAX_HAUNT_LEVEL, else null (ignored, not clamped)
 */
export function parseLevelParam(search) {
  const s = typeof search === 'string' ? search : '';
  const raw = new URLSearchParams(s.startsWith('?') ? s.slice(1) : s).get('lv');
  if (raw === null || !/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  return n >= MIN_HAUNT_LEVEL && n <= MAX_HAUNT_LEVEL ? n : null;
}

/** sessionStorage marker: the current HAUNT LV came from a ?lv URL. */
export const LV_FROM_URL_KEY = 'hh-haunt-lv-from-url';

/**
 * Boot step. With a valid ?lv: set that level and mark it as URL-made. Without
 * one, after a URL-made level: back to LV1 and clear the mark. Else no change.
 *
 * @param {string} search
 * @param {{ set: (n:number) => unknown, storage?: Storage|null }} deps
 * @returns {number|null} the level set, or null when nothing changed
 */
export function applyLevelParam(search, { set, storage = null }) {
  const lv = parseLevelParam(search);
  if (lv !== null) {
    set(lv);
    try { storage?.setItem(LV_FROM_URL_KEY, '1'); } catch (_) { /* this load only */ }
    return lv;
  }
  let fromUrl = false;
  try { fromUrl = storage?.getItem(LV_FROM_URL_KEY) === '1'; } catch (_) { /* none */ }
  if (!fromUrl) return null;
  try { storage.removeItem(LV_FROM_URL_KEY); } catch (_) { /* ignore */ }
  set(MIN_HAUNT_LEVEL);
  return MIN_HAUNT_LEVEL;
}
