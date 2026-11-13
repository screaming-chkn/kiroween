/**
 * tankFx.js — render-only tank FX state (muzzle flash, recoil, hover bob).
 * Clock is state.elapsedMs only (deterministic). Never touches gameplay.
 */

export const RECOIL_PX = 4;
export const RECOIL_MS = 120;
export const FLASH_MS = 100;
const BOB_AMP = 1.5;
const BOB_PERIOD_MS = 2000;

let clock = null;
const seen = new Set();
const events = { player: null, enemy: null };
let enemyNext = 0;

export function resetTankFx() {
  seen.clear();
  events.player = null;
  events.enemy = null;
  enemyNext = 0;
  clock = null;
}

/** Sync from existing combat state. Call once per frame before drawing. */
export function syncTankFx(state) {
  if (!state || state.phase !== 'playing' || typeof state.elapsedMs !== 'number') {
    resetTankFx();
    return;
  }
  const now = state.elapsedMs;
  if (clock !== null && now < clock) resetTankFx();
  clock = now;
  const live = new Set();
  for (const p of state.projectiles ?? []) {
    live.add(p.id);
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    if (p.owner === 'player') events.player = { t0: now, barrel: 0 };
    else if (p.owner === 'enemy') {
      events.enemy = { t0: now, barrel: enemyNext };
      enemyNext = 1 - enemyNext;
    }
  }
  for (const id of seen) if (!live.has(id)) seen.delete(id);
}

const IDLE = Object.freeze({ recoil: 0, barrelIndex: 0, flash: 0 });

/** @returns {{recoil:number, barrelIndex:number, flash:number}} */
export function shotFx(kind, nowMs = clock) {
  const e = events[kind];
  if (!e || nowMs == null) return { ...IDLE };
  const dt = nowMs - e.t0;
  if (dt < 0 || dt >= RECOIL_MS) return { ...IDLE, barrelIndex: e.barrel };
  const k = 1 - dt / RECOIL_MS;
  const flash = dt < FLASH_MS ? 1 - dt / FLASH_MS : 0;
  return { recoil: RECOIL_PX * k * k, barrelIndex: e.barrel, flash };
}

/** Synced clock (null if unsynced). */
export function fxClock() {
  return clock;
}

/** Slow 1–2 px sine; player/enemy out of phase. 0 when unsynced. */
export function hoverBob(kind, nowMs) {
  if (nowMs == null) return 0;
  const phase = kind === 'enemy' ? Math.PI : 0;
  return BOB_AMP * Math.sin((nowMs / BOB_PERIOD_MS) * Math.PI * 2 + phase);
}
