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
 * @param {typeof SLOT_ORDER[number]} slot
 * @param {number} notch
 * @returns {string}
 */
export function notchLabel(slot, notch) {
  const n = Math.max(0, Math.min(MAX_NOTCH, Math.floor(Number(notch)) || 0));
  switch (slot) {
    case 'tracks': {
      const pct = n * 5; // +0..+20%
      return pct === 0 ? 'Speed +0%' : `Speed +${pct}%`;
    }
    case 'turret': {
      // Standard → Heavy: more damage, slower aim-settle via reload tax
      const dmg = PLAYER_PROJECTILE_DAMAGE + n * 2; // 14..22
      return `Dmg ${dmg}`;
    }
    case 'loader': {
      const mult = 1 - n * 0.06; // 1.00 .. 0.76
      const ms = Math.round(FIRE_COOLDOWN_MS * mult);
      return `Reload ${(ms / 1000).toFixed(2)}s`;
    }
    case 'armor': {
      const hp = PLAYER_MAX_HP + n * 10; // 140..180
      return `HP ${hp}`;
    }
    case 'dash': {
      const pct = n * 8; // cooldown −0..−32%
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

  const moveSpeedMult = 1 + t * 0.05;                 // +0..+20%
  const shotDamage = PLAYER_PROJECTILE_DAMAGE + u * 2; // 14..22
  // Turret heaviness tax: +4% reload per turret notch; loader cuts 6% per notch.
  const fireCooldownMult = (1 + u * 0.04) * (1 - l * 0.06);
  const maxHpBonus = a * 10;                          // +0..+40
  const dashCooldownMult = 1 - d * 0.08;              // −0..−32%
  const dashDurationMult = 1 + d * 0.05;              // +0..+20% dash length

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
  return {
    weight: 69,
    capacity: 90,
    loadPct: (69 / 90) * 100,
    powerOut: 10,
    powerDraw: 6,
    balance: 4,
    combatMods: mods,
    tankUpgrades: normalizeUpgradeState(state),
  };
}
