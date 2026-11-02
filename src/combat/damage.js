/**
 * src/combat/damage.js
 *
 * Pure damage application logic.
 *
 * R3, R5 requirement:
 *   HP after any hit SHALL be max(0, HP − damage) — never negative.
 *
 * Single responsibility: the one write-path for HP. No other module
 * should modify entity.hp directly.
 *
 * Exports:
 *   applyDamage(entity, amount) → new entity with hp floored at 0.
 */

/**
 * Return a new entity with hp reduced by `amount`, floored at 0.
 *
 * @param {{ hp: number }} entity  - Any object with an `hp` property.
 * @param {number}         amount  - Damage to apply. Values < 0 are clamped
 *                                   to 0 (no healing through this path).
 * @returns {{ hp: number }}       - Shallow-cloned entity with updated hp.
 */
export function applyDamage(entity, amount) {
  const dmg = Math.max(0, amount);          // negative damage is a no-op
  return { ...entity, hp: Math.max(0, entity.hp - dmg) };
}
