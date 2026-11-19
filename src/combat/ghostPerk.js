/**
 * src/combat/ghostPerk.js — occasional mid-fight ghost pickup.
 *
 * Spawn: once per fight at GHOST_SPAWN_MS (~mid LV1), between the mechs.
 * Grab: player-only, when within GHOST_RADIUS of the orb.
 * Heal: +10% of current maxHp, clamped to maxHp (heal, not max bump).
 *
 * Pure helpers — arena.js owns state; renderer draws via drawGhostPerk.
 */

export const GHOST_SPAWN_MS = 12000;
export const GHOST_HEAL_FRAC = 0.10;
export const GHOST_RADIUS = 28;
export const GHOST_COLOR = '#9FD8FF';
export const GHOST_CORE = '#E8F7FF';

/** Empty perk slot for a fresh arena. */
export function createGhostPerk() {
  return {
    active: false,
    grabbed: false,
    spawned: false,
    x: 0,
    y: 0,
  };
}

/**
 * Midpoint between mechs, nudged toward arena center if they overlap oddly.
 * @param {{ x: number, y: number }} player
 * @param {{ x: number, y: number }} enemy
 * @param {{ width: number, height: number }} arena
 */
export function ghostSpawnPoint(player, enemy, arena) {
  let x = ((player?.x ?? 0) + (enemy?.x ?? 0)) / 2;
  let y = ((player?.y ?? 0) + (enemy?.y ?? 0)) / 2;
  // Keep off walls a bit.
  const pad = 60;
  const W = arena?.width ?? 1200;
  const H = arena?.height ?? 900;
  x = Math.max(pad, Math.min(W - pad, x));
  y = Math.max(pad, Math.min(H - pad, y));
  return { x, y };
}

/** Heal amount for a grab: 10% of maxHp, floored, at least 1 when maxHp > 0. */
export function ghostHealAmount(maxHp) {
  const m = maxHp ?? 0;
  if (m <= 0) return 0;
  return Math.max(1, Math.floor(m * GHOST_HEAL_FRAC));
}

/**
 * Maybe spawn the ghost once elapsedMs crosses the spawn gate.
 * @returns {object} next perk state
 */
export function maybeSpawnGhost(perk, elapsedMs, player, enemy, arena) {
  if (!perk || perk.spawned || perk.grabbed) return perk;
  if ((elapsedMs ?? 0) < GHOST_SPAWN_MS) return perk;
  const pt = ghostSpawnPoint(player, enemy, arena);
  return { ...perk, active: true, spawned: true, x: pt.x, y: pt.y };
}

/**
 * Player-only grab. Returns { perk, player }.
 * Heal clamps to maxHp.
 */
export function tryGrabGhost(perk, player) {
  if (!perk?.active || perk.grabbed || !player) {
    return { perk, player };
  }
  const dx = (player.x ?? 0) - perk.x;
  const dy = (player.y ?? 0) - perk.y;
  if (dx * dx + dy * dy > GHOST_RADIUS * GHOST_RADIUS) {
    return { perk, player };
  }
  const heal = ghostHealAmount(player.maxHp);
  const nextHp = Math.min(player.maxHp, (player.hp ?? 0) + heal);
  return {
    perk: { ...perk, active: false, grabbed: true },
    player: { ...player, hp: nextHp },
  };
}

/**
 * Draw a simple original wispy orb (ectoplasm) — no external assets.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} perk
 * @param {number} [nowMs]
 */
export function drawGhostPerk(ctx, perk, nowMs = 0) {
  if (!perk?.active || perk.grabbed) return;
  const t = (nowMs ?? 0) / 1000;
  const pulse = 1 + 0.12 * Math.sin(t * 4.2);
  const r = GHOST_RADIUS * 0.55 * pulse;

  ctx.save();
  ctx.translate(perk.x, perk.y);

  // Soft outer glow
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = GHOST_COLOR;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.7, 0, Math.PI * 2);
  ctx.fill();

  // Wispy body
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.9, r * 1.15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Trailing wisps
  ctx.globalAlpha = 0.45;
  for (let i = 0; i < 3; i++) {
    const a = t * 1.6 + i * 2.1;
    const wx = Math.cos(a) * r * 0.55;
    const wy = Math.sin(a * 1.3) * r * 0.7 + r * 0.35;
    ctx.beginPath();
    ctx.ellipse(wx, wy, r * 0.28, r * 0.4, a, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bright core
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = GHOST_CORE;
  ctx.beginPath();
  ctx.arc(0, -r * 0.1, r * 0.35, 0, Math.PI * 2);
  ctx.fill();

  // Tiny eye dots (readable as a ghost, original simple marks)
  ctx.fillStyle = '#0A0D0B';
  ctx.beginPath();
  ctx.arc(-r * 0.12, -r * 0.15, r * 0.08, 0, Math.PI * 2);
  ctx.arc(r * 0.12, -r * 0.15, r * 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
