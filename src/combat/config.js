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

/** Starting hit-points for the enemy bot (R5). */
export const ENEMY_MAX_HP  = 900;

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

// ── Spawn positions ───────────────────────────────────────────────────────────

/** Player start position (world units). */
export const PLAYER_START_X = 200;
export const PLAYER_START_Y = 450;

/** Enemy start position (world units). Must not overlap player start. */
export const ENEMY_START_X = 1000;
export const ENEMY_START_Y = 450;
