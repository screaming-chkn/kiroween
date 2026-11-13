/**
 * src/ui/hauntLevel.js — session difficulty ramp ("HAUNT LV n").
 *
 * Applied at spawn from main.js, outside createArena math. LV1 = 0.8× enemy
 * HP and shot damage, +0.1× per level, capped at 1.2× (LV5+).
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

/** HP / damage multiplier: 0.8, 0.9, 1.0, 1.1, 1.2 (cap). */
export function hauntPressure(level) {
  const lv = clampLevel(level);
  // Round to 1 decimal to keep float noise out of Math.round results.
  return Math.min(1.2, Math.round((0.8 + (lv - 1) * 0.1) * 10) / 10);
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
 * Shallow copy of `enemy` with scaled hp / maxHp and a shotDamage the enemy
 * fire site honours. Never mutates the input.
 *
 * @param {object} enemy
 * @param {number} level
 * @param {{baseHp?:number, baseDamage?:number}} [base]
 */
export function applyHauntPressure(enemy, level, { baseHp = ENEMY_MAX_HP ?? 1500, baseDamage = ENEMY_PROJECTILE_DAMAGE ?? 20 } = {}) {
  const p = hauntPressure(level);
  const hp = Math.round(baseHp * p);
  return { ...enemy, hp, maxHp: hp, shotDamage: Math.round(baseDamage * p) };
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
