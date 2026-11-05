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

/**
 * Damage dealt by a single player projectile.
 *
 * Balance retune LEVER 3 (light, 11/5c): 20 → 17. A small DPS cut (~15%) paired
 * with the lapse-movement-freeze (harness) and the ENEMY_MAX_HP 3600 → 3300
 * offset below. The freeze alone pushed win rates off 100%; this light damage
 * trim widens the loss share without blowing medians past 120 s, and the HP cut
 * keeps baseline perfect-lead TTK near ~58 s (3300 / 17 × 0.3 s) so medians stay
 * ~100–115 s. feel windup/dash/overdraw untouched.
 */
export const PLAYER_PROJECTILE_DAMAGE = 17;

/**
 * Damage dealt by a single enemy projectile.
 *
 * Balance retune LEVER 4 (11/5d, LAST pass): 15 → 35. Even with the sticky
 * lapse-movement-freeze (harness) opening sitting-duck windows, at 15 dmg the
 * enemy's slow ~1.95 s shot cycle could not drain the player's 300 HP before
 * the player closed the kill — the player averaged only ~77 dmg/fight (needs
 * 300 to lose) and win rates pinned at 100%. Raising per-shot damage to 35
 * means ~3 landed shots inside the freeze windows (now ~0.9 s each, LAPSE_TICKS
 * 30 → 55) can finish a 300 HP player, so the enemy actually wins some seeds
 * and win rates come off 100%. feel windup/dash/overdraw untouched.
 */
export const ENEMY_PROJECTILE_DAMAGE  = 35;

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
 *
 * Balance retune (LEVER 1, owner approved): raised 400 → 2800 so perfect-lead
 * TTK is no longer ~7 s. At 20 dmg / 0.3 s cooldown the base perfect-lead TTK
 * is ~42 s (2800 / 20 × 0.3 s) before misses and projectile travel.
 *
 * Balance retune LEVER 1b (11/5): raised 2800 → 4200. At 2800 the harness's
 * perfect-lead player landed every shot, giving ~46 s medians and still a 100%
 * win rate — perfect lead was effectively god-mode. Pairing this HP bump with
 * seeded aim noise in the harness player policy (LEVER 2, harness-only) pushes
 * medians back into the 60–120 s window without touching windup, dash, or
 * overdraw fire-rate. 4200 / 20 × 0.3 s ≈ 63 s base perfect-lead TTK before any
 * misses or projectile travel.
 *
 * Balance retune LEVER mix (11/5): lowered 4200 → 3600. At 4200 the harness
 * settled into one of two failure modes depending on sigma: medians in-window
 * but a 100% win rate (sigma 32/42), or a healthy loss share but almost all
 * duels timing out at the 180 s cap (sigma 60). Shortening the baseline TTK
 * ~14% (3600 / 20 × 0.3 s ≈ 54 s base perfect-lead TTK) buys headroom so a
 * moderate aim-noise sigma (36) plus occasional harness-only player-policy
 * lapses can produce a real loss share while medians stay inside 60–120 s.
 * Windup, dash, and overdraw fire-rate are untouched (feel feel preserved).
 *
 * Balance retune LEVER 3 offset (11/5c): lowered 3600 → 3300 to offset the
 * PLAYER_PROJECTILE_DAMAGE 20 → 17 DPS cut so medians do not drift over 120 s.
 * With the lapse-movement-freeze (harness) now letting the enemy land shots,
 * the DPS cut widens the loss share; the paired HP trim keeps baseline
 * perfect-lead TTK near ~58 s (3300 / 17 × 0.3 s) so medians stay ~100–115 s.
 * Windup, dash, and overdraw fire-rate still untouched (feel feel preserved).
 *
 * Balance retune LEVER 1 offset (11/5d, LAST pass): lowered 3300 → 2900. The
 * LEVER 4 enemy-damage bump (15 → 35) and longer freeze (LAPSE_TICKS 30 → 55)
 * lengthen fights slightly — the enemy survives a little longer because the
 * player's own lapses cost more DPS time. Shaving enemy HP ~12% keeps baseline
 * perfect-lead TTK near ~51 s (2900 / 17 × 0.3 s) so player-side medians stay
 * near/under 120 s with PLAYER_PROJECTILE_DAMAGE = 17 even as some fights now
 * end in a loss. Windup, dash, and overdraw fire-rate still untouched.
 */
export const ENEMY_MAX_HP  = 2900;

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
