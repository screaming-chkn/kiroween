/**
 * src/ui/levelParam.js — `?lv=N` URL jump to a HAUNT LV (playtest fix #3).
 *
 * Read once at startup and passed to setHauntLevel, so judges can see the
 * ramp on purpose. Absent or invalid values change nothing.
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
