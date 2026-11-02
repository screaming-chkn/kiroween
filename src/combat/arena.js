/**
 * src/combat/arena.js
 *
 * Pure functions for the arena combat scene.
 *
 * createArena(loadoutTotals, stats)  → ArenaState
 * updateArena(state, actions, dt)    → ArenaState
 *
 * ArenaState is a plain object; nothing here touches the DOM, Canvas,
 * or Web Audio.  The renderer and input adapter live elsewhere.
 *
 * Covers:
 *   R1 — arena bounds / wall collision
 *   R2 — player movement (delegates to mech.js)
 *   R3 — player fire, 300 ms cooldown, projectile lifecycle
 *   R4 — enemy bot (delegates to enemy.js)
 *   R5 — HP / damage routing
 *   R6 — win / lose phase transitions
 */

import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  PLAYER_MAX_HP,
  PLAYER_PROJECTILE_DAMAGE,
  MECH_RADIUS,
  FIRE_COOLDOWN_MS,
  PLAYER_START_X,
  PLAYER_START_Y,
} from './config.js';
import { createMech, moveMech, aimMech } from './mech.js';
import { createEnemy, stepEnemy }        from './enemy.js';
import { createProjectile, stepProjectile, hitTestCircle } from './projectile.js';
import { applyDamage }                   from './damage.js';

// ── Internal ID counter ───────────────────────────────────────────────────────

// We keep a module-level counter that is reset by createArena so tests get
// deterministic IDs.  It is the only piece of mutable state in this module.
let _nextId = 0;

function nextId(prefix) {
  return `${prefix}-${_nextId++}`;
}

// ── createArena ───────────────────────────────────────────────────────────────

/**
 * Build the initial ArenaState for a new match.
 *
 * @param {{
 *   speedPenalty?: number,  // 0–0.45 from 02-mech-builder weight curve
 * }} [loadoutTotals]  - derived stats from the player's garage build
 *
 * @param {{
 *   playerHp?: number,      // override starting HP (for tests / presets)
 * }} [stats]
 *
 * @returns {ArenaState}
 */
export function createArena(loadoutTotals = {}, stats = {}) {
  // Reset the projectile ID counter so each arena starts at 0 (helps tests).
  _nextId = 0;

  const arena = { width: ARENA_WIDTH, height: ARENA_HEIGHT };

  const player = createMech({
    id:           'player',
    x:            PLAYER_START_X,
    y:            PLAYER_START_Y,
    hp:           stats.playerHp ?? PLAYER_MAX_HP,
    maxHp:        PLAYER_MAX_HP,
    speedPenalty: loadoutTotals.speedPenalty ?? 0,
    owner:        'player',
  });

  const enemy = createEnemy({
    speedPenalty: loadoutTotals.enemySpeedPenalty ?? 0,
  });

  return {
    arena,
    player,
    enemy,
    projectiles: [],
    phase: 'playing',   // 'playing' | 'win' | 'lose'
  };
}

// ── updateArena ───────────────────────────────────────────────────────────────

/**
 * Advance the arena by one fixed-timestep tick.
 *
 * This function is pure: it takes the current state plus the player's
 * intentions for this frame and returns the next state.  No mutations.
 *
 * @param {ArenaState} state
 *
 * @param {{
 *   move?:  { dx: number, dy: number },  // normalised direction (WASD)
 *   aim?:   { x: number, y: number },    // world-space mouse position
 *   fire?:  boolean,                     // LMB held
 * }} actions  - player intentions for this tick
 *
 * @param {number} dt  - seconds (fixed timestep, e.g. 1/60)
 *
 * @returns {ArenaState}
 */
export function updateArena(state, actions, dt) {
  // Once the match is over nothing updates (phase is sticky).
  if (state.phase !== 'playing') return state;

  const { arena } = state;
  const act = actions ?? {};

  // ── 1. Move player (R2) ───────────────────────────────────────────────────
  let player = act.move
    ? moveMech(state.player, act.move, dt, arena)
    : state.player;

  // ── 2. Aim player (R2) ───────────────────────────────────────────────────
  if (act.aim) {
    player = aimMech(player, act.aim);
  }

  // ── 3. Player fire cooldown tick (R3) ────────────────────────────────────
  player = {
    ...player,
    fireCooldown: Math.max(0, player.fireCooldown - dt * 1000),
  };

  // ── 4. Player fire (R3): LMB + cooldown elapsed ───────────────────────────
  let newProjectiles = [];
  if (act.fire && player.fireCooldown === 0) {
    newProjectiles.push(createProjectile({
      id:     nextId('pproj'),
      x:      player.x,
      y:      player.y,
      angle:  player.angle,
      damage: PLAYER_PROJECTILE_DAMAGE,
      owner:  'player',
    }));
    player = { ...player, fireCooldown: FIRE_COOLDOWN_MS };
  }

  // ── 5. Enemy AI tick (R4) ────────────────────────────────────────────────
  const { enemy: updatedEnemy, projectile: enemyShot } =
    stepEnemy(state.enemy, player, dt, arena, _nextId);
  if (enemyShot) {
    _nextId++;   // consume the ID the enemy just used
    newProjectiles.push(enemyShot);
  }

  // ── 6. Step all projectiles (R1, R3) ────────────────────────────────────
  const steppedProjectiles = [
    ...state.projectiles,
    ...newProjectiles,
  ].map(p => stepProjectile(p, dt, arena));

  // ── 7. Hit detection + damage routing (R5) ───────────────────────────────
  let playerAfterHits = player;
  let enemyAfterHits  = updatedEnemy;

  const survivingProjectiles = steppedProjectiles.map(proj => {
    // Already dead (wall) — skip.
    if (proj.dead) return proj;

    if (proj.owner === 'player') {
      // Player projectile vs enemy mech.
      if (hitTestCircle(proj, enemyAfterHits, MECH_RADIUS)) {
        enemyAfterHits = applyDamage(enemyAfterHits, proj.damage);
        return { ...proj, dead: true };
      }
    } else {
      // Enemy projectile vs player mech.
      if (hitTestCircle(proj, playerAfterHits, MECH_RADIUS)) {
        playerAfterHits = applyDamage(playerAfterHits, proj.damage);
        return { ...proj, dead: true };
      }
    }

    return proj;
  });

  // ── 8. Cull dead projectiles ─────────────────────────────────────────────
  const liveProjectiles = survivingProjectiles.filter(p => !p.dead);

  // ── 9. Phase transitions (R6) ────────────────────────────────────────────
  let phase = 'playing';
  if (enemyAfterHits.hp <= 0) {
    phase = 'win';
  } else if (playerAfterHits.hp <= 0) {
    phase = 'lose';
  }

  return {
    arena,
    player:      playerAfterHits,
    enemy:       enemyAfterHits,
    projectiles: liveProjectiles,
    phase,
  };
}
