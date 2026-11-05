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

// Human-readable slot labels for the role tooltip (R9). Kept here so the tooltip
// text matches the slot vocabulary without importing UI code into the mech layer.
const SLOT_LABELS = {
  legs: 'Legs',
  core: 'Core',
  armL: 'Arm L',
  armR: 'Arm R',
  back: 'Back',
  head: 'Head',
};

/**
 * Names the equipped parts that set the current role tag (R9).
 *
 * Runs the same derivation as {@link roleTag}, then returns the slot labels of
 * every equipped part whose `roles` array includes the winning role. These are
 * exactly the parts that "voted" for the tag, so the tooltip can explain it
 * (e.g. "Role from: Back + Legs").
 *
 * Pure function — no side-effects, safe to test in Node.
 *
 * @param {Object} loadout    - { legs, core, armL, armR, back, head } — part ids
 * @param {Object} partsById  - Map of id → Part
 * @returns {string[]}        - slot labels in fixed slot order, or [] when no role
 */
export function roleSources(loadout, partsById) {
  const role = roleTag(loadout, partsById);
  if (role == null) return [];

  const sources = [];
  // Iterate in a stable slot order so the tooltip reads the same every time.
  for (const slot of Object.keys(SLOT_LABELS)) {
    const id = loadout[slot];
    if (id == null) continue;
    const part = partsById[id];
    if (part == null) continue;
    if ((part.roles ?? []).includes(role)) {
      sources.push(SLOT_LABELS[slot]);
    }
  }
  return sources;
}

/**
 * One-line tooltip text naming the parts that set the role (R9).
 *
 * @param {Object} loadout    - { legs, core, armL, armR, back, head } — part ids
 * @param {Object} partsById  - Map of id → Part
 * @returns {string}          - e.g. "Role from: Back + Legs", or "" when no role
 */
export function roleTooltip(loadout, partsById) {
  const sources = roleSources(loadout, partsById);
  if (sources.length === 0) return '';
  return `Role from: ${sources.join(' + ')}`;
}
