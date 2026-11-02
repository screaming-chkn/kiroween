# 03-arena-combat — Design

## Overview
Pure-logic combat model plus a thin Canvas renderer. All game-state mutations are pure functions so they can be property-tested in Node. The arena scene wires them together and hooks into the engine loop from 01-core-engine.

## Components

- `src/combat/arena.js` — scene entry: `createArena(config)`, `updateArena(state, actions, dt)`, `renderArena(state, renderer)`. Owns the update/render hook registration.
- `src/combat/mech.js` — `createMech(cfg)`, `moveMech(mech, dir, dt, speedPenalty)`, `aimMech(mech, worldTarget)`. Pure functions over a mech object.
- `src/combat/projectile.js` — `createProjectile(origin, dir, speed, damage, owner)`, `stepProjectile(proj, dt)`, `hitTest(proj, target)`. Pure; no side effects.
- `src/combat/damage.js` — `applyDamage(entity, amount)` → new entity with `hp = Math.max(0, entity.hp - amount)`. Pure; satisfies the PBT requirement (R3, R5).
- `src/combat/enemy.js` — `stepEnemy(enemy, player, dt)` implements the CHASE/SHOOT state machine. Returns updated enemy + optional new projectile.
- `src/combat/endscreen.js` — `showEndScreen(canvas, result)` renders win/lose overlay; handles keyboard (Enter/Space) and click restart; proper focus management.
- `src/data/combat-config.js` — constants: arena size, starting HP, base speed, fire cooldown, fire range, projectile speed, damage values.

## Data model

```js
// World-space coords; origin top-left.
Arena   { width, height }          // e.g. 1200 × 900

Mech    { id, x, y, angle,         // angle in radians (facing direction)
          hp, maxHp,
          speedPenalty,            // 0–0.45, from 02 weight curve
          fireCooldown,            // ms remaining
          owner: 'player'|'enemy' }

Projectile { id, x, y, vx, vy,
             damage, owner: 'player'|'enemy',
             dead: bool }

ArenaState { arena, player, enemy, projectiles[], phase }
// phase: 'playing' | 'win' | 'lose'
```

## Movement and aiming
- WASD maps to a normalised direction vector each frame. If diagonal, normalise to length 1 before scaling.
- `effectiveSpeed = baseSpeed × (1 − speedPenalty)`. `speedPenalty` is read from the active loadout via `speedPenalty(loadPct)` from `src/mech/weight.js`.
- Aim angle = `Math.atan2(worldTarget.y − mech.y, worldTarget.x − mech.x)`. Mouse canvas coords are converted to world coords via the camera transform.

## Collision and damage
- Projectile–mech overlap: circle test, radius = projectile radius + mech radius.
- Wall collision: AABB clamp for mechs; destroy projectile when its centre leaves `[0, arena.width] × [0, arena.height]`.
- `applyDamage` is the single write-path for HP; always clamps to 0.

## Enemy state machine
```
CHASE: move toward player at enemySpeed; transition → SHOOT when dist ≤ fireRange
SHOOT: face player, fire on cooldown; transition → CHASE when dist > fireRange + hysteresis
```
Hysteresis (e.g. 40 units) prevents rapid state toggling.

## Rendering layers (via 01-core-engine render.js)
1. **World** — arena floor grid, walls.
2. **Entities** — mechs (triangles), projectiles (player: amber circle; enemy: red diamond).
3. **HUD** — player HP bar (bottom-left, ember amber on dark, ≥ 7:1), enemy HP bar (above enemy sprite).
4. **Overlay** — win/lose screen (rendered last, blocks input to game layers).

## Testing
- Unit: `applyDamage` clamp, `stepProjectile` position math, `moveMech` with and without speed penalty, state-machine transitions.
- PBT (small seeded generator): any sequence of non-negative damage values leaves HP ≥ 0; projectile position is linear in t.
- Camera pure-function tests live in `tests/engine/camera.test.js` (see 01-core-engine task 7).

## Open questions
- Exact mech sprite art vs placeholder triangles (decide with 07-ui-crt).
- Whether to apply 02 weight curve from saved loadout or hardcode for this prototype slice.
