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

// ── Projectiles ───────────────────────────────────────────────────────────────

/** Speed of all projectiles in world units per second (R3). */
export const PROJECTILE_SPEED = 600;

/** Collision / hit-test radius for projectiles (world units). */
export const PROJECTILE_RADIUS = 6;

/** Damage dealt by a single player projectile. */
export const PLAYER_PROJECTILE_DAMAGE = 20;

/** Damage dealt by a single enemy projectile. */
export const ENEMY_PROJECTILE_DAMAGE  = 15;

/** Minimum time between shots in milliseconds (R3). */
export const FIRE_COOLDOWN_MS = 300;

// ── HP ────────────────────────────────────────────────────────────────────────

/** Starting hit-points for the player mech (R5). */
export const PLAYER_MAX_HP = 200;

/** Starting hit-points for the enemy bot (R5). */
export const ENEMY_MAX_HP  = 150;

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

// ── Spawn positions ───────────────────────────────────────────────────────────

/** Player start position (world units). */
export const PLAYER_START_X = 200;
export const PLAYER_START_Y = 450;

/** Enemy start position (world units). Must not overlap player start. */
export const ENEMY_START_X = 1000;
export const ENEMY_START_Y = 450;
