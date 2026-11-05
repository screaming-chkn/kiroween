/**
 * src/mech/silhouette.js
 *
 * Pure helper for the garage mech preview silhouette.
 *
 * Turns a loadout into a plain per-slot description that the garage UI renders
 * as a simple top-down SVG silhouette (legs / core / arms / back / head). No
 * DOM, no side-effects — safe to unit-test under Node.
 *
 * The spec intentionally carries only what the drawing needs: whether a slot is
 * filled, and the part's id + display name for per-slot labels / titles. The
 * UI decides fill/stroke from `present`; an empty slot is drawn dimmer.
 *
 * Exports:
 *   silhouetteSpec(loadout, partsById) → { legs, core, armL, armR, back, head }
 *     where each value is { present: boolean, id: string|null, name: string|null }
 */

import { SLOTS } from './loadout.js';

/**
 * @typedef {Object} SlotSpec
 * @property {boolean}      present  - true when a valid part fills the slot
 * @property {string|null}  id       - equipped part id, or null
 * @property {string|null}  name     - equipped part display name, or null
 */

/**
 * Describe each slot of a loadout for the preview silhouette.
 *
 * Unknown ids (not in `partsById`) and empty slots both yield
 * `{ present: false, id: null, name: null }` so the UI can draw them dimmed.
 *
 * @param {Object} loadout    - { legs, core, armL, armR, back, head } — part ids
 * @param {Object} partsById  - Map of id → Part
 * @returns {Record<'legs'|'core'|'armL'|'armR'|'back'|'head', SlotSpec>}
 */
export function silhouetteSpec(loadout, partsById = {}) {
  /** @type {Record<string, SlotSpec>} */
  const spec = {};
  for (const slot of SLOTS) {
    const id = loadout?.[slot] ?? null;
    const part = id != null ? partsById[id] : null;
    spec[slot] = part
      ? { present: true, id, name: part.name ?? id }
      : { present: false, id: null, name: null };
  }
  return spec;
}
