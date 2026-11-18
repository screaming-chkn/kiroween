/**
 * src/combat/sfxEvents.js — which SFX a single arena tick should trigger.
 *
 * Pure: compares the ArenaState before and after updateArena() and returns
 * a list of SFX ids (see src/engine/audio.js SFX). No DOM / Web Audio, so
 * arena.js stays pure and this is unit-testable under Node.
 */

/**
 * @param {ArenaState} prev  state before the tick
 * @param {ArenaState} next  state after the tick
 * @returns {string[]} SFX ids, in play order
 */
export function sfxEventsForTick(prev, next) {
  const out = [];
  if (!prev || !next) return out;

  // New projectiles: ids not present last tick.
  const seen = new Set((prev.projectiles ?? []).map(p => p.id));
  let pShot = false;
  let eShot = false;
  for (const p of next.projectiles ?? []) {
    if (seen.has(p.id)) continue;
    if (p.owner === 'player') pShot = true;
    else eShot = true;
  }
  // A shot that spawns and hits in the same tick is culled before we see it;
  // the hit sound covers that case.
  if (pShot) out.push('playerShot');
  if (eShot) out.push('enemyShot');

  // Dash start: the burst timer jumped up.
  if ((next.player?.dashRemainingMs ?? 0) > (prev.player?.dashRemainingMs ?? 0)) {
    out.push('dash');
  }

  // Enemy windup tell on the 0 → >0 edge.
  if ((prev.enemy?.windupRemainingMs ?? 0) <= 0 && (next.enemy?.windupRemainingMs ?? 0) > 0) {
    out.push('windup');
  }

  const ended = prev.phase === 'playing' && next.phase !== 'playing';
  if ((next.enemy?.hp ?? 0) < (prev.enemy?.hp ?? 0) && !(ended && next.phase === 'win')) {
    out.push('hitEnemy');
  }
  if ((next.player?.hp ?? 0) < (prev.player?.hp ?? 0) && !(ended && next.phase === 'lose')) {
    out.push('hitPlayer');
  }
  // Kill (win) or death (lose): one boom replaces the final hit sound.
  if (ended) out.push('explode');

  return out;
}
