/**
 * src/mech/loadout.js
 *
 * Pure model functions for mech loadouts.
 *
 * A Loadout is a plain object mapping slot names to part ids:
 *   { legs, core, armL, armR, back, head }
 *
 * A Part (from src/data/parts.js) has at minimum:
 *   { id, slot, name, weight, powerOut?, powerDraw?, stats, roles }
 *
 * Both functions are pure (no side-effects) so they can be tested in Node
 * and used safely in property-based tests.
 *
 * Exports:
 *   equip(loadout, part)           → new Loadout with part slotted in
 *   totals(loadout, partsById)     → { weight, capacity, loadPct,
 *                                      powerOut, powerDraw, balance }
 */

// ── Slot names ────────────────────────────────────────────────────────────────

export const SLOTS = /** @type {const} */ (
  ['legs', 'core', 'armL', 'armR', 'back', 'head']
);

// ── equip ─────────────────────────────────────────────────────────────────────

/**
 * Return a new loadout with `part` placed in its slot.
 *
 * Does not mutate the original loadout.
 *
 * @param {Object} loadout  - Current loadout { legs, core, armL, armR, back, head }
 * @param {Object} part     - Part object with at least { id, slot }
 * @returns {Object}        - New loadout
 */
export function equip(loadout, part) {
  return { ...loadout, [part.slot]: part.id };
}

// ── totals ────────────────────────────────────────────────────────────────────

/**
 * Compute aggregate stats for a loadout from a parts lookup table.
 *
 * Rules (R3, R4):
 *   - weight    = sum of equipped parts' weight
 *   - capacity  = legs part's weight value (legs part doubles as the weight budget;
 *                 use legs.capacity if present, else legs.weight as the budget,
 *                 matching the parts data shape to be decided in the feel pass)
 *   - loadPct   = weight / capacity × 100  (0 when no legs equipped)
 *   - powerOut  = sum of powerOut fields (cores provide output)
 *   - powerDraw = sum of powerDraw fields (weapons/sensors draw power)
 *   - balance   = powerOut − powerDraw  (negative → Overdraw)
 *
 * Missing slots (null/undefined ids) are skipped gracefully.
 *
 * @param {Object} loadout    - { legs, core, armL, armR, back, head } — part ids
 * @param {Object} partsById  - Map of id → Part
 * @returns {{ weight: number, capacity: number, loadPct: number,
 *             powerOut: number, powerDraw: number, balance: number }}
 */
export function totals(loadout, partsById) {
  let weight    = 0;
  let capacity  = 0;
  let powerOut  = 0;
  let powerDraw = 0;

  for (const slot of SLOTS) {
    const id   = loadout[slot];
    if (id == null) continue;

    const part = partsById[id];
    if (part == null) continue;

    weight    += part.weight    ?? 0;
    powerOut  += part.powerOut  ?? 0;
    powerDraw += part.powerDraw ?? 0;

    // The legs part defines the weight capacity.
    // Support both `capacity` (explicit) and `weight` (implicit budget) fields.
    if (slot === 'legs') {
      capacity = part.capacity ?? part.weight ?? 0;
    }
  }

  const loadPct = capacity > 0 ? (weight / capacity) * 100 : 0;
  const balance = powerOut - powerDraw;

  return { weight, capacity, loadPct, powerOut, powerDraw, balance };
}
