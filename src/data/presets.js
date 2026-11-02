/**
 * src/data/presets.js
 *
 * Starter mech preset for HAUNT//HOUND.
 *
 * Used when no localStorage save exists so the player can deploy immediately
 * on first run (R6, product spec: "A match starts in under 30 seconds").
 *
 * The preset must be legal:
 *   - All six slots filled.
 *   - load% ≤ 115 (canDeploy returns true).
 *   - One part per slot matching that slot's name.
 *
 * Preset: "Drifter" — balanced starter build, SCOUT lean, all stats covered.
 *
 *   Slot   Part id             Weight   Capacity
 *   legs   legs-runner         20       80
 *   core   core-pulse          15       (out: 10)
 *   armL   armL-spotter         8       (draw: 2)
 *   armR   armR-hatchet        12       (draw: 1)
 *   back   back-smoke           8       (draw: 1)
 *   head   head-optics          6       (draw: 2)
 *                            ─────
 *   Total weight              69  (load% = 69/80 × 100 = 86.25 — speed penalty ~9.4%)
 *   Power out                 10
 *   Power draw                 6  (spotter 2 + hatchet 1 + smoke 1 + optics 2)
 *   Balance                   +4  (no Overdraw)
 *
 * Weight and power math verified against src/mech/loadout.js::totals().
 */

/** @type {{ legs: string, core: string, armL: string, armR: string, back: string, head: string }} */
export const PRESET_DRIFTER = {
  legs: 'legs-runner',
  core: 'core-pulse',
  armL: 'armL-spotter',
  armR: 'armR-hatchet',
  back: 'back-smoke',
  head: 'head-optics',
};

/**
 * Returns the preset loadout to use on first run.
 * Currently always returns PRESET_DRIFTER; more presets can be added later.
 *
 * @returns {{ legs: string, core: string, armL: string, armR: string, back: string, head: string }}
 */
export function defaultLoadout() {
  return { ...PRESET_DRIFTER };
}
