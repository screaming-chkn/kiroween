/**
 * src/combat/config.js
 *
 * Arena-combat configuration constants.
 * All values are plain numbers — import and use directly; never mutate.
 *
 * Covers: R1 (arena size), R2 (speed), R3 (projectiles / cooldown),
 *         R4 (enemy), R5 (HP / damage).
 */

// ── Arena ────────────────────────────────────────────────────────────────────

/** World-unit width of the arena. */
export const ARENA_WIDTH  = 1200;

/** World-unit height of the arena. */
export const ARENA_HEIGHT = 900;

// ── Mechs ────────────────────────────────────────────────────────────────────

/** Base movement speed (world units / second) before any speed penalty. */
export const BASE_SPEED = 240;

/** Collision / hit-test radius for mechs (world units). */
export const MECH_RADIUS = 20;

/**
 * Extra margin added to the wall clamp so the HP bar (±80 wu) and aim barrel
 * (MECH_RADIUS + 30 = 50 wu) stay fully inside the arena at corners (R11).
 *
 * Set to 80 world units = half the HP bar width, which is the largest
 * protruding element.  The barrel tip is only 50 wu from the mech centre so
 * it is always covered.
 */
export const MECH_CORNER_MARGIN = 80;

// ── Projectiles ───────────────────────────────────────────────────────────────

/** Speed of all projectiles in world units per second (R3). */
export const PROJECTILE_SPEED = 600;

/** Collision / hit-test radius for projectiles (world units). */
export const PROJECTILE_RADIUS = 6;

/**
 * Draw radius for the player's projectiles (world units, R10).
 * Matches the historical draw size so player shots read the same as before.
 */
export const PLAYER_PROJECTILE_RADIUS = 5;

/**
 * Draw radius for enemy projectiles (world units, R10).
 * SHALL be larger than the player's so incoming fire reads as a heavier,
 * blood-red threat without relying on colour alone (accessibility rule 6).
 */
export const ENEMY_PROJECTILE_RADIUS = 9;

/** Damage dealt by a single player projectile. */
export const PLAYER_PROJECTILE_DAMAGE = 20;

/** Damage dealt by a single enemy projectile. */
export const ENEMY_PROJECTILE_DAMAGE  = 15;

/** Minimum time between player shots in milliseconds (R3). */
export const FIRE_COOLDOWN_MS = 300;

/**
 * Minimum time between enemy shots in milliseconds (R4 — BALANCE).
 * Deliberately slower than the player's cooldown so the enemy is a threat
 * without overwhelming the player in a 30-60 s round.
 */
export const ENEMY_FIRE_COOLDOWN_MS = 1500;

// ── HP ────────────────────────────────────────────────────────────────────────

/** Starting hit-points for the player mech (R5). */
export const PLAYER_MAX_HP = 300;

/**
 * Starting hit-points for the enemy bot (R5).
 *
 * feel 11/5 feel pass: lowered 900 → 400 so a clean player build lands the
 * kill inside the 60–120 s "winnable duel" target instead of grinding.
 */
export const ENEMY_MAX_HP  = 400;

// ── Enemy AI ──────────────────────────────────────────────────────────────────

/**
 * Distance at which the enemy transitions from CHASE → SHOOT (R4).
 * World units.
 */
export const ENEMY_FIRE_RANGE = 350;

/**
 * Hysteresis band added to FIRE_RANGE for the SHOOT → CHASE transition (R4).
 * Prevents rapid state toggling at the boundary.
 * World units.
 */
export const ENEMY_HYSTERESIS = 40;

/** Base movement speed for the enemy bot (world units / second). */
export const ENEMY_BASE_SPEED = 160;

/**
 * Perpendicular strafe speed while in SHOOT state (world units / second).
 * The enemy sidesteps horizontally relative to the player→enemy axis so that
 * some player shots miss, stretching the round toward the 30-60 s target.
 */
export const ENEMY_STRAFE_SPEED = 90;

/**
 * Enemy shot windup in milliseconds (feel 11/5 feel pass, R4).
 *
 * When the enemy is in SHOOT state and its fire cooldown is ready it first
 * enters a ~0.45 s WINDUP: `enemy.windupRemainingMs` counts down and the
 * renderer reads `windupRemainingMs > 0` to draw a red telegraph glow. The
 * projectile only spawns the tick the windup completes, giving the player a
 * readable "tell" to dash or break line-of-sight before incoming fire.
 */
export const ENEMY_SHOT_WINDUP_MS = 450;

// ── Dash (feel 11/5 feel pass, R2) ───────────────────────────────────────────

/**
 * Dash burst duration in milliseconds. While `player.dashRemainingMs > 0` the
 * player moves at DASH_SPEED_MULT × their normal (penalty-adjusted) speed.
 */
export const DASH_DURATION_MS = 180;

/** Speed multiplier applied to movement during a dash burst. */
export const DASH_SPEED_MULT = 3;

/**
 * Input-buffer window in milliseconds for the DASH action. A DASH press is
 * honoured if it lands within this window before the cooldown becomes ready,
 * so a slightly-early tap still fires the dash the instant it is available.
 */
export const DASH_BUFFER_MS = 100;

/**
 * Dash cooldown in milliseconds by build weight class (light / mid / heavy).
 *
 * Weight class is derived from the loadout `loadPct` (02-mech-builder weight
 * curve):
 *   • light : loadPct ≤ 80          → penalty-free band          → 2500 ms
 *   • mid   : 80 < loadPct ≤ 100    → first speed-penalty band    → 3500 ms
 *   • heavy : loadPct > 100         → heavy / overweight band      → 4500 ms
 *
 * The thresholds mirror weight.js (SOFT_LOW = 80, SOFT_HIGH = 100) so the dash
 * feel tracks the same "the heavier you build, the sluggisher you move" curve.
 */
export const DASH_COOLDOWN_MS = Object.freeze({
  light: 2500,
  mid:   3500,
  heavy: 4500,
});

/**
 * Map a loadout `loadPct` to its dash weight class.
 * @param {number} loadPct
 * @returns {'light' | 'mid' | 'heavy'}
 */
export function dashWeightClass(loadPct = 0) {
  if (loadPct <= 80)  return 'light';
  if (loadPct <= 100) return 'mid';
  return 'heavy';
}

/**
 * Dash cooldown (ms) for a given loadout `loadPct`.
 * @param {number} loadPct
 * @returns {number}
 */
export function dashCooldownForLoad(loadPct = 0) {
  return DASH_COOLDOWN_MS[dashWeightClass(loadPct)];
}

// ── Spawn positions ───────────────────────────────────────────────────────────

/** Player start position (world units). */
export const PLAYER_START_X = 200;
export const PLAYER_START_Y = 450;

/** Enemy start position (world units). Must not overlap player start. */
export const ENEMY_START_X = 1000;
export const ENEMY_START_Y = 450;
