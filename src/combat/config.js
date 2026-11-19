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

// ── Sever Wall (HAUNT LV 3+ only) ─────────────────────────────────────────────

/** First HAUNT LV that has the Sever Wall. LV1-2 stay an open field. */
export const SEVER_WALL_MIN_LV = 3;

/** Wall centre (world units): arena midline. */
export const SEVER_WALL_X = ARENA_WIDTH / 2;
export const SEVER_WALL_Y = ARENA_HEIGHT / 2;

/**
 * Plan-view length: ~1.5 tank widths. The drawn tank is about 80 wu wide
 * (2 x MECH_RADIUS x TANK_DRAW_SCALE-ish footprint), so 1.5 x 80 = 120 wu.
 * Vertical, so two flank corridors stay open above and below.
 */
export const SEVER_WALL_LENGTH = 120;

/** Collision / stroke thickness (world units). */
export const SEVER_WALL_THICKNESS = 16;

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
 *
 * Feel tweak GO (11/5): 9 → 8 (~11% trim). Shrinking the enemy shot's hit
 * radius makes a windup dash clear the incoming shot more reliably — a smaller
 * projectile is easier to slip past off the telegraph. Still strictly greater
 * than PLAYER_PROJECTILE_RADIUS (5), so incoming fire still reads as the
 * heavier threat and enemyShot.test.js's 8 > 5 assertion holds.
 */
export const ENEMY_PROJECTILE_RADIUS = 8;

/**
 * Damage dealt by a single player projectile.
 *
 * lead GO LEVER 2 (11/5 continue): 17 → 14. At 17 dmg with ENEMY_MAX_HP
 * 3600, sim2 showed BOTH M2 strafe-no-dash AND M3 strafe+dash LOSE ~68–70 s in
 * with <100 enemy HP left — dash never tipped a win because the fight ended a
 * few shots short of the kill. Cutting per-shot damage ~18% stretches the
 * fight so a dash-on-windup player accumulates survivability (break
 * line-of-sight off the telegraph) long enough to land those last shots, while
 * a passive strafe-no-dash player's extra misses still let the enemy's kill
 * clock win. Paired with the ENEMY_MAX_HP 3600 → 3400 trim below so a dashing
 * player can still finish inside ~60–100 s. feel-pass windup (450 ms), fire CD
 * (1500 enemy / 300 player), the dash table, and ENEMY_PROJECTILE_DAMAGE (20)
 * are all untouched.
 */
export const PLAYER_PROJECTILE_DAMAGE = 14;

/**
 * Damage dealt by a single enemy projectile.
 *
 * Feel pass (11/5, lead GO): lowered 35 → 20. At 35 the enemy's shots
 * hit hard enough that a few landed rounds inside the harness freeze windows
 * could delete the player's 300 HP faster than the duel felt fair — incoming
 * fire read as a one-sided punish rather than a readable threat. Dropping
 * per-shot damage to 20 keeps enemy fire a meaningful pressure (≈15 shots to
 * drain 300 HP over the slow 1.5 s cycle) while leaving the player room to
 * dash/break line-of-sight off the windup telegraph. Paired with the
 * ENEMY_MAX_HP 2900 → 1400 cut below so duels stay a tight, winnable feel.
 * Windup (450 ms), ENEMY_FIRE_COOLDOWN_MS (1500), and the dash table are all
 * untouched (feel pass preserved).
 */
export const ENEMY_PROJECTILE_DAMAGE  = 20;

/** Minimum time between player shots in milliseconds (R3). */
export const FIRE_COOLDOWN_MS = 300;

/**
 * Minimum time between enemy shots in milliseconds (R4 — BALANCE).
 * Deliberately slower than the player's cooldown so the enemy is a threat
 * without overwhelming the player in a 30-60 s round.
 */
export const ENEMY_FIRE_COOLDOWN_MS = 1500;

// ── HP ────────────────────────────────────────────────────────────────────────

/**
 * Starting hit-points for the player mech (R5).
 *
 * owner GO 11/12 (shorter fights, target 30–45 s): PLAYER_MAX_HP 300 → 140 (×0.47),
 * ENEMY_MAX_HP 2800 → 1500 (×0.54). Not an equal factor on purpose: the player
 * gets free shots during the enemy's approach (it only fires inside
 * ENEMY_FIRE_RANGE), a fixed chunk of damage that is a bigger share of a short
 * fight, so an equal ×0.53 cut made strafe-without-dash win 80%. 140 = 7 enemy
 * hits. Damage per hit (14 / 20), dash, windup, lead-aim, speeds and shot
 * radius unchanged.
 */
export const PLAYER_MAX_HP = 140;

/**
 * Starting hit-points for the enemy bot (R5).
 *
 * owner GO 11/12 (shorter fights, target 30–45 s): PLAYER_MAX_HP 300 → 140 (×0.47),
 * ENEMY_MAX_HP 2800 → 1500 (×0.54). Not an equal factor on purpose: the player
 * gets free shots during the enemy's approach (it only fires inside
 * ENEMY_FIRE_RANGE), a fixed chunk of damage that is a bigger share of a short
 * fight, so an equal ×0.53 cut made strafe-without-dash win 80%. 140 = 7 enemy
 * hits. Damage per hit (14 / 20), dash, windup, lead-aim, speeds and shot
 * radius unchanged.
 * History: Feel tweak GO (11/5) 2920 → 2800.
 */
export const ENEMY_MAX_HP  = 1500;

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
 * Enemy shot windup in milliseconds (Feel pass 11/5 feel pass, R4).
 *
 * When the enemy is in SHOOT state and its fire cooldown is ready it first
 * enters a ~0.45 s WINDUP: `enemy.windupRemainingMs` counts down and the
 * renderer reads `windupRemainingMs > 0` to draw a red telegraph glow. The
 * projectile only spawns the tick the windup completes, giving the player a
 * readable "tell" to dash or break line-of-sight before incoming fire.
 */
export const ENEMY_SHOT_WINDUP_MS = 450;

// ── Dash (Feel pass 11/5 feel pass, R2) ───────────────────────────────────────────

/**
 * Dash burst duration in milliseconds. While `player.dashRemainingMs > 0` the
 * player moves at DASH_SPEED_MULT × their normal (penalty-adjusted) speed.
 *
 * Feel tweak GO (11/5): 180 → 220. A full-speed burst now travels
 * ≈ 240 wu/s × 3 × 0.22 s ≈ 158 wu — comfortably past the ~100 wu (≈2.5 mech
 * lengths) enemy shot hit radius, so a windup dash clearly clears the shot even
 * with imperfect timing. The old 180 ms burst (~130 wu) was marginal for a
 * slightly-late dash. DASH_SPEED_MULT (3), DASH_BUFFER_MS (100), and the
 * per-weight cooldown table are all untouched.
 */
export const DASH_DURATION_MS = 220;

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
 *   • mid   : 80 < loadPct ≤ 100    → first speed-penalty band    → 3000 ms
 *     (M4 balance, R6: was 3500. At HAUNT LV5 the Runner + Furnace builds,
 *     the only deployable mid builds, sat ~15 pp under the light builds; the
 *     lighter penalty brings the 16-build spread back inside 10 pp.)
 *   • heavy : loadPct > 100         → heavy / overweight band      → 4500 ms
 *
 * The thresholds mirror weight.js (SOFT_LOW = 80, SOFT_HIGH = 100) so the dash
 * feel tracks the same "the heavier you build, the sluggisher you move" curve.
 */
export const DASH_COOLDOWN_MS = Object.freeze({
  light: 2500,
  mid:   3000,
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

// ── Feature flags ─────────────────────────────────────────────────────────────

/**
 * Feature flags (M4.5, spec 10-polish R8).
 *
 * loadoutEffects: arm and core parts carry one combat effect each
 * (src/combat/loadoutEffects.js) and the garage shows a COMBAT line for it.
 * Off = exact pre-M4.5 behaviour: no combatMods are built, the arena takes no
 * new code path, and the garage shows no COMBAT line.
 */
export const FEATURES = Object.freeze({
  loadoutEffects: true,
});
