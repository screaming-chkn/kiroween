/**
 * src/combat/loadoutEffects.js
 *
 * Pure data + helpers for the M4.5 loadout effects (spec 10-polish R8).
 * Each arm and core part has one combat effect (an upside plus, for most,
 * a reload or dash cost) that reuses existing systems. No DOM, Canvas or audio.
 *
 * Keep each `text` line in sync with its `mods` number.
 *
 * Exports:
 *   LOADOUT_EFFECTS                       partId → { text, mods }
 *   IDENTITY_MODS                         no-op mods
 *   combatModsFor(loadout, enabled?)      → mods | null
 *   effectTextFor(partId, enabled?)       → string | null
 *   effectTokensFor(partId, enabled?)     → {label, tokens, text} | null
 */

import { FEATURES, PLAYER_PROJECTILE_DAMAGE } from './config.js';

/**
 * Effect table, tuned with the 16-build x 200-seed balance harness (M4.5,
 * PLAN.md). Each part is a sidegrade: one clear upside, paid for in reload
 * (fire cooldown) or dash, so no build dominates and HAUNT LV bands hold.
 * Percentages in `text` are the real multipliers: "+32% reload" = fire
 * cooldown x1.32, "dash recharges 15% faster" = dash cooldown x0.85.
 *
 * @type {Readonly<Record<string, { text: string, mods: object }>>}
 */
export const LOADOUT_EFFECTS = Object.freeze({
  'armR-hatchet': Object.freeze({
    text: `COMBAT: shots deal 18 (base ${PLAYER_PROJECTILE_DAMAGE}), +32% reload`,
    mods: Object.freeze({ shotDamage: 18, fireCooldownMult: 1.32 }),
  }),
  'armR-lancer': Object.freeze({
    text: 'COMBAT: shots fly 40% faster, +4% reload',
    mods: Object.freeze({ projectileSpeedMult: 1.4, fireCooldownMult: 1.04 }),
  }),
  'armL-buckler': Object.freeze({
    text: 'COMBAT: +22 max HP; dash recharge +50%, +18% reload',
    mods: Object.freeze({ maxHpBonus: 22, dashCooldownMult: 1.5, fireCooldownMult: 1.18 }),
  }),
  'armL-spotter': Object.freeze({
    text: 'COMBAT: dash recharges 15% faster, +8% reload',
    mods: Object.freeze({ dashCooldownMult: 0.85, fireCooldownMult: 1.08 }),
  }),
  'core-pulse': Object.freeze({
    text: 'COMBAT: reload 5% faster',
    mods: Object.freeze({ fireCooldownMult: 0.95 }),
  }),
  'core-furnace': Object.freeze({
    text: 'COMBAT: shots fly 20% faster, reload 3% faster',
    mods: Object.freeze({ projectileSpeedMult: 1.2, fireCooldownMult: 0.97 }),
  }),
});

/** Mods that change nothing. */
export const IDENTITY_MODS = Object.freeze({
  shotDamage:          PLAYER_PROJECTILE_DAMAGE,
  projectileSpeedMult: 1,
  maxHpBonus:          0,
  dashCooldownMult:    1,
  fireCooldownMult:    1,
  incomingDamageMult:  1,
  moveSpeedMult:       1,
  dashDurationMult:    1,
});

/**
 * Fold the mods of every equipped part into one object.
 * Multipliers multiply, bonuses add, shotDamage takes the max.
 *
 * @param {Record<string, string|null|undefined>} loadout  slot → part id
 * @param {boolean} [enabled=FEATURES.loadoutEffects]
 * @returns {object|null}  fresh mods object, or null when disabled
 */
export function combatModsFor(loadout, enabled = FEATURES.loadoutEffects) {
  if (!enabled) return null;
  const out = { ...IDENTITY_MODS };
  for (const id of Object.values(loadout ?? {})) {
    const m = LOADOUT_EFFECTS[id]?.mods;
    if (!m) continue;
    if (m.shotDamage != null)          out.shotDamage = Math.max(out.shotDamage, m.shotDamage);
    if (m.projectileSpeedMult != null) out.projectileSpeedMult *= m.projectileSpeedMult;
    if (m.maxHpBonus != null)          out.maxHpBonus += m.maxHpBonus;
    if (m.dashCooldownMult != null)    out.dashCooldownMult *= m.dashCooldownMult;
    if (m.fireCooldownMult != null)    out.fireCooldownMult *= m.fireCooldownMult;
    if (m.incomingDamageMult != null)  out.incomingDamageMult *= m.incomingDamageMult;
  }
  return out;
}

/**
 * One-line garage text for a part, or null when it has no effect or the flag is off.
 *
 * @param {string} partId
 * @param {boolean} [enabled=FEATURES.loadoutEffects]
 * @returns {string|null}
 */
export function effectTextFor(partId, enabled = FEATURES.loadoutEffects) {
  if (!enabled) return null;
  return LOADOUT_EFFECTS[partId]?.text ?? null;
}

/**
 * Split a part's COMBAT line into short display tokens for the garage
 * (M4.6): "COMBAT: shots deal 18 (base 14), +32% reload" →
 * { label: 'COMBAT', tokens: ['shots deal 18 (base 14)', '+32% reload'] }.
 * Splits on top-level ',' and ';' only. Null when there is no line.
 * @param {string} partId
 * @param {boolean} [enabled]
 * @returns {{label: string, tokens: string[], text: string} | null}
 */
export function effectTokensFor(partId, enabled = FEATURES.loadoutEffects) {
  const text = effectTextFor(partId, enabled);
  if (!text) return null;
  const m = /^([A-Z]+):\s*(.*)$/.exec(text);
  const label = m ? m[1] : '';
  const body = m ? m[2] : text;
  const tokens = [];
  let depth = 0, cur = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';') && depth === 0) { if (cur.trim()) tokens.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) tokens.push(cur.trim());
  return { label, tokens, text };
}
