/**
 * src/combat/mechNames.js — player-facing mech labels for the HUD.
 *
 * No player-facing "HOUND" (too close to Chromehounds). Internal speaker ids
 * may still say 'hound'; these strings are what meters and strips show.
 */

export const PLAYER_MECH_NAME = 'RUSTBIT';
export const ENEMY_MECH_NAME = 'CHOPPER';

/** @returns {string} e.g. "P1 · RUSTBIT" */
export function playerHudLabel() {
  return `P1 · ${PLAYER_MECH_NAME}`;
}

/** @returns {string} e.g. "CHOPPER" */
export function enemyHudLabel() {
  return ENEMY_MECH_NAME;
}
