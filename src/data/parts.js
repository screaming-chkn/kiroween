/**
 * src/data/parts.js
 *
 * Parts table for HAUNT//HOUND — MVP set (~12 parts across 6 slots).
 *
 * Shape:
 *   Part {
 *     id:        string   — unique, kebab-case
 *     slot:      'legs' | 'core' | 'armL' | 'armR' | 'back' | 'head'
 *     name:      string   — display name
 *     weight:    number   — mass units
 *     capacity?: number   — (legs only) weight budget; defaults to weight if absent
 *     powerOut?: number   — energy output (cores)
 *     powerDraw?:number   — energy consumed (weapons, sensors, specials)
 *     stats: {
 *       armor:   number   0–10
 *       speed:   number   0–10
 *       damage:  number   0–10
 *       sensor:  number   0–10
 *     }
 *     roles:     string[] — subset of ['SCOUT','BRUISER','LONGSHOT']
 *     flavor:    string   — one-line in-world description
 *     hexId?:    string   — id of hex if cursed
 *   }
 *
 * Design rule (R2): every part has at least one stat upside (no dead picks).
 *
 * Role definitions used in roleTag derivation (src/mech/role.js):
 *   SCOUT     — speed/sensor focus
 *   BRUISER   — armor/damage close-range
 *   LONGSHOT  — damage/sensor long-range
 *
 * Parts are exported as an array. Build a lookup map with:
 *   import { PARTS } from './parts.js';
 *   const byId = Object.fromEntries(PARTS.map(p => [p.id, p]));
 */

/** @type {Part[]} */
export const PARTS = [
  // ── LEGS (2) ────────────────────────────────────────────────────────────────

  {
    id:       'legs-runner',
    slot:     'legs',
    name:     'Runner Legs',
    weight:   20,
    capacity: 90,
    powerDraw: 1,
    stats:    { armor: 2, speed: 8, damage: 0, sensor: 2 },
    roles:    ['SCOUT'],
    flavor:   'Stripped-down sprint legs. Haunted by a jockey who never slowed down.',
  },
  {
    id:       'legs-siege',
    slot:     'legs',
    name:     'Siege Legs',
    weight:   30,
    capacity: 110,
    powerDraw: 2,
    stats:    { armor: 7, speed: 2, damage: 0, sensor: 0 },
    roles:    ['BRUISER'],
    flavor:   'Reinforced striders. The ghost inside them just stands and stares.',
  },

  // ── CORE (2) ────────────────────────────────────────────────────────────────

  {
    id:      'core-pulse',
    slot:    'core',
    name:    'Pulse Core',
    weight:  15,
    powerOut: 10,
    stats:   { armor: 3, speed: 0, damage: 0, sensor: 4 },
    roles:   ['SCOUT', 'LONGSHOT'],
    flavor:  'Outputs a rhythmic hum that doubles as a short-range ping. Spooky but useful.',
  },
  {
    id:      'core-furnace',
    slot:    'core',
    name:    'Furnace Core',
    weight:  22,
    powerOut: 14,
    stats:   { armor: 5, speed: 0, damage: 2, sensor: 0 },
    roles:   ['BRUISER'],
    flavor:  'Runs hot enough to melt tarmac. The smell never washes out.',
  },

  // ── ARM L (2) ───────────────────────────────────────────────────────────────

  {
    id:       'armL-buckler',
    slot:     'armL',
    name:     'Buckler Arm',
    weight:   10,
    powerDraw: 0,
    stats:    { armor: 6, speed: 0, damage: 0, sensor: 0 },
    roles:    ['BRUISER'],
    flavor:   'A slab of reactor-plate welded to a salvage arm. Ugly, effective.',
  },
  {
    id:       'armL-spotter',
    slot:     'armL',
    name:     'Spotter Arm',
    weight:   8,
    powerDraw: 2,
    stats:    { armor: 0, speed: 0, damage: 0, sensor: 7 },
    roles:    ['SCOUT', 'LONGSHOT'],
    flavor:   'Folded sensor array. Picks up whispers three sectors away.',
  },

  // ── ARM R (2) ───────────────────────────────────────────────────────────────

  {
    id:       'armR-hatchet',
    slot:     'armR',
    name:     'Hatchet Arm',
    weight:   12,
    powerDraw: 1,
    stats:    { armor: 1, speed: 0, damage: 7, sensor: 0 },
    roles:    ['BRUISER'],
    flavor:   'Mono-edge cleaver. Leaves a scar the shape of a screaming face.',
  },
  {
    id:       'armR-lancer',
    slot:     'armR',
    name:     'Lancer Arm',
    weight:   10,
    powerDraw: 3,
    stats:    { armor: 0, speed: 0, damage: 6, sensor: 3 },
    roles:    ['LONGSHOT'],
    flavor:   'Guided rail-lance. The targeting ghost takes over for the last 50 meters.',
  },

  // ── BACK (2) ────────────────────────────────────────────────────────────────

  {
    id:       'back-smoke',
    slot:     'back',
    name:     'Smoke Pack',
    weight:   8,
    powerDraw: 1,
    stats:    { armor: 0, speed: 3, damage: 0, sensor: 2 },
    roles:    ['SCOUT'],
    flavor:   'Releases static-laced smoke. Ghosts love the cover; so should you.',
  },
  {
    id:       'back-howitzer',
    slot:     'back',
    name:     'Howitzer Pack',
    weight:   18,
    powerDraw: 4,
    stats:    { armor: 0, speed: 0, damage: 8, sensor: 1 },
    roles:    ['LONGSHOT', 'BRUISER'],
    flavor:   'Indirect-fire mortar pod. Screams on the way down. Literally.',
  },

  // ── HEAD (2) ────────────────────────────────────────────────────────────────

  {
    id:       'head-optics',
    slot:     'head',
    name:     'Ghost Optics',
    weight:   6,
    powerDraw: 2,
    stats:    { armor: 0, speed: 0, damage: 0, sensor: 8 },
    roles:    ['SCOUT', 'LONGSHOT'],
    flavor:   'Layered thermal-spectral lenses. Lets you see what shouldn\'t be visible.',
  },
  {
    id:       'head-visor',
    slot:     'head',
    name:     'Siege Visor',
    weight:   9,
    powerDraw: 1,
    stats:    { armor: 4, speed: 0, damage: 1, sensor: 2 },
    roles:    ['BRUISER'],
    flavor:   'Blast-hardened faceplate with integrated threat reticle.',
  },
];

/**
 * Convenience lookup: part id → Part.
 * @type {Record<string, Part>}
 */
export const PARTS_BY_ID = Object.fromEntries(PARTS.map(p => [p.id, p]));
