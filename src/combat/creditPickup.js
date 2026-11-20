/**
 * src/combat/creditPickup.js
 *
 * LV3+ garage-credit coins. Pure: persist happens in main.js after a grab.
 *
 * At the start of LV3 (and up), CREDIT_COUNT coins are placed around
 * the arena, clear of walls and spawn pads. They pop in on a stagger so the
 * opening of the fight keeps flashing coins. Player-only; each grab is +1.
 */

import {
  PLAYER_START_X,
  PLAYER_START_Y,
  ENEMY_START_X,
  ENEMY_START_Y,
  MECH_RADIUS,
} from './config.js';
import { circleHitsWalls, wallsOf } from './obstacle.js';
import { drawCreditIcon } from '../ui/creditIcon.js';

/** First HAUNT LV that spills coins. */
export const CREDIT_MIN_LV = 3;
/** Coins placed at the start of LV3+. */
export const CREDIT_COUNT = 10;
/** Grab / draw radius (world units). */
export const CREDIT_RADIUS = 16;
/** Delay between successive pops at fight start (ms). */
export const CREDIT_STAGGER_MS = 350;
/** Pop-in animation length (ms). */
export const CREDIT_POP_MS = 220;
/** Lifetime after pop (ms). Then the coin despawns. */
export const CREDIT_LIFE_MS = 30000;
/** Blink / fade window at the end of life (ms). */
export const CREDIT_FADE_MS = 3000;
/** Keep coins this far from a spawn centre. */
export const CREDIT_SPAWN_CLEAR = 140;

/**
 * Candidate pads, listed in pop order. Mirrors come in pairs so the field
 * reads fair. Extras exist so a tight wall layout can still fill CREDIT_COUNT.
 */
const CANDIDATES = Object.freeze([
  { x: 480, y: 300 },
  { x: 720, y: 300 },
  { x: 480, y: 620 },
  { x: 720, y: 620 },
  { x: 280, y: 600 },
  { x: 920, y: 600 },
  { x: 300, y: 300 },
  { x: 900, y: 300 },
  { x: 480, y: 120 },
  { x: 720, y: 120 },
  { x: 360, y: 500 },
  { x: 840, y: 500 },
  { x: 240, y: 720 },
  { x: 960, y: 720 },
  { x: 520, y: 800 },
  { x: 680, y: 800 },
  { x: 400, y: 140 },
  { x: 800, y: 140 },
]);

function nearSpawn(x, y) {
  const d1 = Math.hypot(x - PLAYER_START_X, y - PLAYER_START_Y);
  const d2 = Math.hypot(x - ENEMY_START_X, y - ENEMY_START_Y);
  return d1 < CREDIT_SPAWN_CLEAR || d2 < CREDIT_SPAWN_CLEAR;
}

/**
 * Pads for a level that sit clear of walls and spawn zones.
 * @param {number} lv
 * @param {object[]|object|null} walls
 * @returns {Array<{x:number,y:number}>}
 */
export function creditPadsForLevel(lv, walls) {
  const n = Math.floor(Number(lv));
  if (!Number.isFinite(n) || n < CREDIT_MIN_LV) return [];
  const clearR = CREDIT_RADIUS + MECH_RADIUS;
  const pads = [];
  for (const c of CANDIDATES) {
    if (nearSpawn(c.x, c.y)) continue;
    if (circleHitsWalls(walls, c.x, c.y, clearR)) continue;
    pads.push({ x: c.x, y: c.y });
    if (pads.length >= CREDIT_COUNT) break;
  }
  return pads;
}

/**
 * Build the pickup set for a fresh arena.
 * @param {number} lv
 * @param {object[]|object|null} walls
 * @returns {{ coins: object[] }}
 */
export function createCreditPickups(lv, walls) {
  const pads = creditPadsForLevel(lv, walls);
  const coins = pads.map((p, i) => ({
    id: `credit-${i}`,
    x: p.x,
    y: p.y,
    appearAtMs: i * CREDIT_STAGGER_MS,
    grabbed: false,
  }));
  return { coins };
}

/**
 * Reveal coins on their stagger and let the player grab visible ones.
 * Enemy never grabs. Pure; caller persists the credit.
 *
 * @param {{ coins: object[] }|null} pickups
 * @param {number} elapsedMs
 * @param {{ x:number, y:number }|null} player
 * @returns {{ pickups: object, grabbed: number }}
 */
export function stepCreditPickups(pickups, elapsedMs, player) {
  if (!pickups || !Array.isArray(pickups.coins) || !pickups.coins.length) {
    return { pickups, grabbed: 0 };
  }
  const t = elapsedMs ?? 0;
  let grabbed = 0;
  const coins = pickups.coins.map((c) => {
    if (c.grabbed || c.expired) return c;
    if (t < (c.appearAtMs ?? 0)) return c;
    const life = CREDIT_LIFE_MS;
    if (t >= (c.appearAtMs ?? 0) + life) return { ...c, expired: true };
    if (!player) return c;
    const dx = (player.x ?? 0) - c.x;
    const dy = (player.y ?? 0) - c.y;
    if (dx * dx + dy * dy > CREDIT_RADIUS * CREDIT_RADIUS) return c;
    grabbed += 1;
    return { ...c, grabbed: true };
  });
  if (grabbed === 0 && coins.every((c, i) => c === pickups.coins[i])) {
    return { pickups, grabbed: 0 };
  }
  return { pickups: { ...pickups, coins }, grabbed };
}

/**
 * Draw live (not-yet-grabbed) coins, including a pop-in scale and a bob.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ coins: object[] }|null} pickups
 * @param {number} [nowMs]
 */
export function drawCreditPickups(ctx, pickups, nowMs = 0) {
  if (!pickups?.coins) return;
  const t = nowMs ?? 0;
  for (const c of pickups.coins) {
    if (c.grabbed || c.expired) continue;
    const appear = c.appearAtMs ?? 0;
    if (t < appear) continue;
    const age = t - appear;
    if (age >= CREDIT_LIFE_MS) continue;
    const pop = age >= CREDIT_POP_MS
      ? 1
      : 0.2 + 0.9 * (age / CREDIT_POP_MS) + 0.15 * Math.sin((age / CREDIT_POP_MS) * Math.PI);
    const bob = Math.sin((t / 1000) * 3.4 + (c.x + c.y) * 0.01) * 3;
    const spin = Math.sin((t / 1000) * 1.6 + c.x * 0.02) * 0.15;
    const remaining = CREDIT_LIFE_MS - age;
    let alpha = 1;
    if (remaining < CREDIT_FADE_MS) {
      const fade = remaining / CREDIT_FADE_MS;
      const blink = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t / 70));
      alpha = Math.max(0, fade * blink);
    }
    ctx.save();
    ctx.globalAlpha = (ctx.globalAlpha || 1) * alpha;
    drawCreditIcon(ctx, c.x, c.y + bob, CREDIT_RADIUS * Math.min(1.15, pop) * 0.95, { spin });
    ctx.restore();
  }
}

/** @param {object} arena */
export function creditWallsFromArena(arena) {
  return wallsOf(arena);
}
