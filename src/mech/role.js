/**
 * src/mech/role.js
 *
 * Derives a live role tag for the current loadout (R5).
 *
 * Algorithm:
 *   1. Count how many times each role string appears across all equipped parts'
 *      `roles` arrays.  A single part can contribute to multiple roles.
 *   2. The role with the highest count wins.
 *   3. Ties are broken by the Core part's first listed role.  If the Core has
 *      no roles, or the Core is unequipped, prefer the lexicographically first
 *      tied role so the result is always deterministic.
 *   4. If no parts are equipped (empty loadout) returns null.
 *
 * Known roles: 'SCOUT', 'BRUISER', 'LONGSHOT'.
 * The function is tolerant of unknown role strings in parts data.
 *
 * Pure function — no side-effects, safe to test in Node.
 *
 * @param {Object} loadout    - { legs, core, armL, armR, back, head } — part ids
 * @param {Object} partsById  - Map of id → Part
 * @returns {string | null}   - Role tag or null when loadout is completely empty
 */
export function roleTag(loadout, partsById) {
  /** @type {Map<string, number>} */
  const counts = new Map();

  // Tally role votes from all equipped parts.
  for (const id of Object.values(loadout)) {
    if (id == null) continue;
    const part = partsById[id];
    if (part == null) continue;
    for (const role of (part.roles ?? [])) {
      counts.set(role, (counts.get(role) ?? 0) + 1);
    }
  }

  if (counts.size === 0) return null;

  // Find the maximum vote count.
  const max = Math.max(...counts.values());

  // Collect roles tied at the maximum.
  const tied = [];
  for (const [role, count] of counts.entries()) {
    if (count === max) tied.push(role);
  }

  // Only one winner — return it directly.
  if (tied.length === 1) return tied[0];

  // Break ties: prefer the Core part's first listed role if it's in the tie.
  const coreId   = loadout.core;
  const corePart = coreId != null ? partsById[coreId] : null;
  if (corePart) {
    for (const role of (corePart.roles ?? [])) {
      if (tied.includes(role)) return role;
    }
  }

  // Fallback: lexicographic sort (deterministic, no external dependencies).
  tied.sort();
  return tied[0];
}
