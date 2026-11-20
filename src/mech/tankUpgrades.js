/**
 * src/mech/tankUpgrades.js
 *
 * Tank garage progression: 5 notch bars + win credits + tier unlock.
 * Pure model (no DOM). Persist via localStorage key hh_tank_upgrades_v1.
 *
 * Bars: tracks | turret | loader | armor | dash  (0..MAX_NOTCH each)
 * Credits: win N pays N; losses pay 0.
 * When every bar is full → unlock next tier, reset bars, keep leftover credits.
 */

import {
  PLAYER_PROJECTILE_DAMAGE,
  FIRE_COOLDOWN_MS,
  PLAYER_MAX_HP,
} from '../combat/config.js';

export const UPGRADES_LS_KEY = 'hh_tank_upgrades_v1';
export const MAX_NOTCH = 4;          // spend 4 to fill one bar (levels 0..4)
export const MAX_TIER = 3;
export const SLOT_ORDER = /** @type {const} */ (
  ['tracks', 'turret', 'loader', 'armor', 'dash']
);

export const SLOT_META = Object.freeze({
  tracks: Object.freeze({
    label: 'TRACKS',
    flavor: 'Rubber screams on cold concrete.',
  }),
  turret: Object.freeze({
    label: 'TURRET',
    flavor: 'Heavier bore. Longer pause. Louder hush.',
  }),
  loader: Object.freeze({
    label: 'LOADER',
    flavor: 'The magazine learns your heartbeat.',
  }),
  armor: Object.freeze({
    label: 'ARMOR',
    flavor: 'Plates drink the hit so you do not.',
  }),
  dash: Object.freeze({
    label: 'DASH',
    flavor: 'A short scream of thrusters. Then silence.',
  }),
});

/** @typedef {{ tracks:number, turret:number, loader:number, armor:number, dash:number, credits:number, wins:number, tier:number }} TankUpgradeState */

/** Fresh default — all bars empty, tier 1. Matches base combat feel. */
export function defaultUpgradeState() {
  return {
    tracks: 0, turret: 0, loader: 0, armor: 0, dash: 0,
    credits: 0, wins: 0, tier: 1,
  };
}

/**
 * Clamp a raw save into a legal state.
 * @param {Partial<TankUpgradeState>|null|undefined} raw
 * @returns {TankUpgradeState}
 */
export function normalizeUpgradeState(raw) {
  const d = defaultUpgradeState();
  if (!raw || typeof raw !== 'object') return d;
  const clampNotch = (n) => {
    const v = Math.floor(Number(n));
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(MAX_NOTCH, v));
  };
  const tier = Math.max(1, Math.min(MAX_TIER, Math.floor(Number(raw.tier)) || 1));
  const credits = Math.max(0, Math.floor(Number(raw.credits)) || 0);
  const wins = Math.max(0, Math.floor(Number(raw.wins)) || 0);
  return {
    tracks: clampNotch(raw.tracks),
    turret: clampNotch(raw.turret),
    loader: clampNotch(raw.loader),
    armor: clampNotch(raw.armor),
    dash: clampNotch(raw.dash),
    credits, wins, tier,
  };
}

/** @returns {TankUpgradeState} */
export function loadUpgradeState(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(UPGRADES_LS_KEY);
    if (raw) return normalizeUpgradeState(JSON.parse(raw));
  } catch (_) { /* fall through */ }
  return defaultUpgradeState();
}

/** @param {TankUpgradeState} state */
export function saveUpgradeState(state, storage = globalThis.localStorage) {
  try {
    storage?.setItem?.(UPGRADES_LS_KEY, JSON.stringify(normalizeUpgradeState(state)));
  } catch (_) { /* private mode / quota */ }
}

/** Credits awarded for the next win given wins-so-far (before this win). Win 1 → 1. */
export function creditsForNextWin(winsSoFar) {
  const w = Math.max(0, Math.floor(Number(winsSoFar)) || 0);
  return w + 1;
}

/**
 * Apply a win: bump wins, add N credits where N = new win index.
 * @param {TankUpgradeState} state
 * @returns {TankUpgradeState}
 */
export function awardWin(state) {
  const s = normalizeUpgradeState(state);
  const payout = creditsForNextWin(s.wins);
  return { ...s, wins: s.wins + 1, credits: s.credits + payout };
}

/** Losses pay 0 (documented choice). */
export function awardLoss(state) {
  return normalizeUpgradeState(state);
}

/**
 * Add N garage credits (arena coin grabs). Does not change wins.
 * @param {TankUpgradeState} state
 * @param {number} [n=1]
 * @returns {TankUpgradeState}
 */
export function awardCredits(state, n = 1) {
  const s = normalizeUpgradeState(state);
  const add = Math.max(0, Math.floor(Number(n)) || 0);
  return { ...s, credits: s.credits + add };
}

export function barsFull(state) {
  const s = normalizeUpgradeState(state);
  return SLOT_ORDER.every((k) => s[k] >= MAX_NOTCH);
}

/**
 * Spend 1 credit on a slot notch. If that fill completes every bar, unlock
 * the next tier (if any), reset bars to 0, keep leftover credits.
 * @param {TankUpgradeState} state
 * @param {typeof SLOT_ORDER[number]} slot
 * @returns {{ ok:boolean, state:TankUpgradeState, unlockedTier:number|null, reason?:string }}
 */
export function spendNotch(state, slot) {
  const s = normalizeUpgradeState(state);
  if (!SLOT_ORDER.includes(slot)) {
    return { ok: false, state: s, unlockedTier: null, reason: 'bad-slot' };
  }
  if (s.credits < 1) {
    return { ok: false, state: s, unlockedTier: null, reason: 'no-credits' };
  }
  if (s[slot] >= MAX_NOTCH) {
    return { ok: false, state: s, unlockedTier: null, reason: 'bar-full' };
  }
  const next = { ...s, credits: s.credits - 1, [slot]: s[slot] + 1 };
  if (!barsFull(next)) {
    return { ok: true, state: next, unlockedTier: null };
  }
  // All bars full → tier up (cap at MAX_TIER) and reset bars.
  if (next.tier >= MAX_TIER) {
    // Stay at max tier; bars remain full (trophy state).
    return { ok: true, state: next, unlockedTier: null };
  }
  const unlocked = next.tier + 1;
  return {
    ok: true,
    unlockedTier: unlocked,
    state: {
      ...next,
      tier: unlocked,
      tracks: 0, turret: 0, loader: 0, armor: 0, dash: 0,
    },
  };
}

export function resetUpgradeState() {
  return defaultUpgradeState();
}

/**
 * Plain label with numbers for one notch level (what the player sees).
 * Derived from combatModsFromUpgrades so labels stay truthful when bars
 * interact (loader × turret antagonism).
 *
 * @param {typeof SLOT_ORDER[number]} slot
 * @param {number} notch
 * @param {Partial<TankUpgradeState>} [baseState]  other bars (default empty)
 * @returns {string}
 */
export function notchLabel(slot, notch, baseState = defaultUpgradeState()) {
  const n = Math.max(0, Math.min(MAX_NOTCH, Math.floor(Number(notch)) || 0));
  const s = { ...normalizeUpgradeState(baseState), [slot]: n };
  const m = combatModsFromUpgrades(s);
  switch (slot) {
    case 'tracks': {
      const pct = Math.round((m.moveSpeedMult - 1) * 100);
      return pct === 0 ? 'Speed +0%' : `Speed +${pct}%`;
    }
    case 'turret':
      return `Dmg ${m.shotDamage}`;
    case 'loader': {
      const ms = Math.round(FIRE_COOLDOWN_MS * m.fireCooldownMult);
      return `Reload ${(ms / 1000).toFixed(2)}s`;
    }
    case 'armor':
      return `HP ${PLAYER_MAX_HP + m.maxHpBonus}`;
    case 'dash': {
      const pct = Math.round((1 - m.dashCooldownMult) * 100);
      return pct === 0 ? 'Dash CD −0%' : `Dash CD −${pct}%`;
    }
    default:
      return '';
  }
}

/**
 * Combat mods from upgrade state. Shape matches loadoutEffects IDENTITY_MODS
 * plus moveSpeedMult / dashDurationMult. Tier ≥2 adds a small base cushion.
 *
 * Default (all 0, tier 1) ≡ identity — current base feel, LV1 enemy 220 untouched.
 *
 * @param {TankUpgradeState} state
 * @returns {object}
 */
export function combatModsFromUpgrades(state) {
  const s = normalizeUpgradeState(state);
  const t = s.tracks;
  const u = s.turret;
  const l = s.loader;
  const a = s.armor;
  const d = s.dash;

  const moveSpeedMult = 1 + t * 0.04;                 // +0..+16%
  // Softened turret curve (was +2 → 22). Cap stack with loader below.
  const shotDamage = PLAYER_PROJECTILE_DAMAGE + Math.round(u * 1.5); // 14..20
  // Turret heaviness tax: +5% reload per turret notch.
  // Loader cut is attenuated by turret fill so heavy+fast cannot both max out
  // (BotKing soften 2026-11-19): at full turret, loader cut is halved.
  const loaderCut = l * 0.05 * (1 - 0.55 * (u / MAX_NOTCH));
  const fireCooldownMult = (1 + u * 0.05) * (1 - loaderCut);
  const maxHpBonus = a * 6;                           // +0..+24
  const dashCooldownMult = 1 - d * 0.06;              // −0..−24%
  const dashDurationMult = 1 + d * 0.04;              // +0..+16% dash length

  // Tier cushion (reused C9e silhouette, new palette in UI): small, not trivializing.
  let tierHp = 0;
  let tierSpeed = 1;
  let tierIncoming = 1;
  if (s.tier >= 2) { tierHp += 10; tierSpeed *= 1.03; }
  if (s.tier >= 3) { tierHp += 10; tierIncoming *= 0.95; }

  return {
    shotDamage,
    projectileSpeedMult: 1,
    maxHpBonus: maxHpBonus + tierHp,
    dashCooldownMult,
    fireCooldownMult,
    incomingDamageMult: tierIncoming,
    moveSpeedMult: moveSpeedMult * tierSpeed,
    dashDurationMult,
  };
}

/**
 * Runtime enemy scale from upgrade fill. HAUNT_LEVELS base (LV1 220) stays;
 * this multiplies after haunt pressure so a maxed tank does not trivialize.
 * Default (0 notches) → 1 / 1.
 * @param {TankUpgradeState} state
 * @returns {{ hpMult:number, damageMult:number, notchSum:number }}
 */
export function enemyScaleFromUpgrades(state) {
  const s = normalizeUpgradeState(state);
  let notchSum = 0;
  for (const k of SLOT_ORDER) notchSum += s[k];
  // all-max (20) → hp ×1.40, dmg ×1.30 — cold can lose; HTK stays ≥8
  const hpMult = 1 + notchSum * 0.02;
  const damageMult = 1 + notchSum * 0.015;
  return { hpMult, damageMult, notchSum };
}

/**
 * Hits-to-kill cliff helpers for balance notes.
 * @param {number} hp
 * @param {number} dmg
 */
export function hitsToKill(hp, dmg) {
  if (dmg <= 0) return Infinity;
  return Math.ceil(hp / dmg);
}

/**
 * Palette id for tankWire (draw-only recolor). Tier 1 green, 2 blue, 3 blue+note.
 * Does not change tankWire paths.
 */
export function paletteForTier(tier) {
  const t = Math.max(1, Math.floor(Number(tier)) || 1);
  if (t >= 2) return 'mono-blue';
  return 'mono-green';
}

/**
 * Synthetic garage totals so arena weight/dash class stays in the light band
 * (same as the old Drifter ~77% load). Combat mods come from upgrades, not parts.
 */
export function deployTotalsFromUpgrades(state) {
  const mods = combatModsFromUpgrades(state);
  const enemyScale = enemyScaleFromUpgrades(state);
  return {
    weight: 69,
    capacity: 90,
    loadPct: (69 / 90) * 100,
    powerOut: 10,
    powerDraw: 6,
    balance: 4,
    combatMods: mods,
    tankUpgrades: normalizeUpgradeState(state),
    enemyHpMult: enemyScale.hpMult,
    enemyDamageMult: enemyScale.damageMult,
  };
}
