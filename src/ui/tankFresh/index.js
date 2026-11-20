/**
 * Fresh tank selector for mock/tank-fresh4.
 * ?tank=a|b|c|d  (default a on this branch when fresh mode is on)
 */
import { FRESH_IDS, FRESH_TANK, setFreshTank } from './common.js';
import { drawA } from './drawA.js';
import { drawB } from './drawB.js';
import { drawC } from './drawC.js';
import { drawD } from './drawD.js';

const DRAW = { a: drawA, b: drawB, c: drawC, d: drawD };

export { FRESH_IDS, FRESH_TANK, setFreshTank };

export function drawFreshTank(ctx, kind, x, y, hullHeading, turretAngle, flashIntensity = 0) {
  const id = FRESH_TANK;
  const fn = id && DRAW[id];
  if (!fn) return false;
  fn(ctx, kind, x, y, hullHeading, turretAngle, flashIntensity);
  return true;
}

/** Parse location / global override. Returns 'a'|'b'|'c'|'d'|null */
export function readFreshTankFromEnv() {
  try {
    const params = new URLSearchParams(
      (typeof location !== 'undefined' && location.search)
        ? (location.search.startsWith('?') ? location.search.slice(1) : location.search)
        : '',
    );
    const raw = (params.get('tank') || globalThis.__HH_FRESH_TANK__ || '').toLowerCase();
    if (FRESH_IDS.includes(raw)) return raw;
  } catch { /* node tests */ }
  return null;
}

export function initFreshTankFromUrl(defaultId = 'a') {
  const fromUrl = readFreshTankFromEnv();
  setFreshTank(fromUrl ?? defaultId);
  return FRESH_TANK;
}
