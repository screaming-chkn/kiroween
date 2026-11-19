/**
 * src/ui/hauntLevel.js — session difficulty ramp ("HAUNT LV n").
 *
 * Applied at spawn from main.js, outside createArena math. Each LV sets enemy
 * HP and shot damage from HAUNT_LEVELS[lv − 1] (R6).
 *
 * Persistence: sessionStorage key 'hh-haunt-lv', with an in-memory fallback
 * when sessionStorage is missing or throws (Node tests, private modes).
 */

import { ENEMY_MAX_HP, ENEMY_PROJECTILE_DAMAGE } from '../combat/config.js';

export const HAUNT_KEY = 'hh-haunt-lv';
export const MIN_HAUNT_LEVEL = 1;
export const MAX_HAUNT_LEVEL = 5;

let memoryLevel = MIN_HAUNT_LEVEL;

function store() {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage ? sessionStorage : null;
  } catch (_) {
    return null;
  }
}

function clampLevel(n) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return MIN_HAUNT_LEVEL;
  return Math.max(MIN_HAUNT_LEVEL, Math.min(MAX_HAUNT_LEVEL, v));
}

/**
 * Enemy stats per HAUNT LV (index 0 = LV1). The one table to edit for difficulty.
 *
 * LV1 is tuned to an owner target (2026-11-19): about a 30 s duel that a
 * first-timer wins about 1/3 of the time and a player who has learned the tell
 * wins about 2/3. The enemy is fragile (440 HP, ~25 of your shots) but its
 * shot hurts (47: three hits kill a 140 HP mech), so dodging the red ring is
 * what wins. Profiles and results: tests/combat/BALANCE.md.
 *
 * LV2–LV5 move geometrically to the unchanged LV5 cap (1800 / 24): HP x1.42
 * and damage x0.85 per level. The enemy gets tankier and the duel longer, while
 * single hits sting less: hits to kill a 140 HP mech run 3 / 4 / 5 / 5 / 6.
 */
export const HAUNT_LEVELS = Object.freeze([
  Object.freeze({ hp: 440,  shotDamage: 47 }),  // LV1: tuned to the owner target
  Object.freeze({ hp: 626,  shotDamage: 40 }),
  Object.freeze({ hp: 890,  shotDamage: 34 }),
  Object.freeze({ hp: 1266, shotDamage: 28 }),
  Object.freeze({ hp: 1800, shotDamage: 24 }),  // LV5: cap, unchanged
]);

/** Enemy { hp, shotDamage } for a HAUNT LV (clamped to 1–5). */
export function hauntStats(level) {
  return HAUNT_LEVELS[clampLevel(level) - 1];
}

export function readHauntLevel() {
  const s = store();
  if (s) {
    try {
      const raw = s.getItem(HAUNT_KEY);
      if (raw !== null && raw !== undefined) return clampLevel(raw);
    } catch (_) { /* fall through to memory */ }
  }
  return clampLevel(memoryLevel);
}

export function setHauntLevel(n) {
  const lv = clampLevel(n);
  memoryLevel = lv;
  const s = store();
  if (s) {
    try { s.setItem(HAUNT_KEY, String(lv)); } catch (_) { /* memory only */ }
  }
  return lv;
}

export function bumpHauntLevel() {
  return setHauntLevel(readHauntLevel() + 1);
}

/**
 * Level policy: HAUNT LV advances only after a WIN. The end-card action never
 * advances a loss (loss+REDEPLOY and loss+GARAGE keep the level).
 *
 * @param {'win'|'lose'|string} outcome
 * @param {'retry'|'garage'|null} [action]
 * @returns {boolean}
 */
export function hauntAdvancesOn(outcome, action = null) { // eslint-disable-line no-unused-vars
  return outcome === 'win';
}

/**
 * Shallow copy of `enemy` with hp / maxHp and a shotDamage (honoured by the
 * enemy fire site) from HAUNT_LEVELS. Never mutates the input.
 *
 * @param {object} enemy
 * @param {number} level
 */
export function applyHauntPressure(enemy, level) {
  const { hp, shotDamage } = hauntStats(level);
  return { ...enemy, hp, maxHp: hp, shotDamage };
}

/** Old multiplier tuning (base 1500 HP / 20 dmg × p). Kept so golden replays can rerun pre-table fights. */
export function applyPressure(enemy, p, { baseHp = ENEMY_MAX_HP ?? 1500, baseDamage = ENEMY_PROJECTILE_DAMAGE ?? 20 } = {}) {
  const hp = Math.round(baseHp * p);
  return { ...enemy, hp, maxHp: hp, shotDamage: Math.round(baseDamage * p) };
}

/**
 * End-card level-up line shown after a win below max. `newLevel` is the level
 * the player rises to. Returns '' at or below LV 1 (no rise happened).
 *
 * @param {number} newLevel
 * @returns {string}
 */
export function levelUpText(newLevel) {
  const n = Math.floor(Number(newLevel));
  if (!Number.isFinite(n) || n <= MIN_HAUNT_LEVEL) return '';
  return `THE HAUNT RISES \u00b7 HAUNT LV ${Math.min(n, MAX_HAUNT_LEVEL)}. It remembers you.`;
}

export function formatHauntLabel(level) {
  return `HAUNT LV ${clampLevel(level)}`;
}

/**
 * Small label, screen space. `pos` is the right edge (textAlign right) unless
 * pos.align === 'left'.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} level
 * @param {{x:number,y:number,align?:'left'|'right'|'center',scale?:number}} pos
 */
export function drawHauntLevel(ctx, level, pos) {
  const scale = pos.scale > 0 ? pos.scale : 1;
  const text = formatHauntLabel(level);
  ctx.save();
  ctx.font = `${Math.round(14 * scale)}px "Share Tech Mono", monospace`;
  ctx.textAlign = pos.align ?? 'right';
  ctx.textBaseline = 'top';
  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0A0D0B';
  ctx.strokeText(text, pos.x, pos.y);
  ctx.fillStyle = level >= MAX_HAUNT_LEVEL ? '#39FF88' : '#8F9A92';
  ctx.fillText(text, pos.x, pos.y);
  ctx.restore();
}
