# 15-cover-walls — Design

## Overview
Pure sim logic in small Node-testable modules under `src/combat/`. Drawing,
SFX mapping and garage text stay at the edges. All numbers go in
`src/combat/config.js`; the LV ramp stays in `src/ui/hauntLevel.js`.

## Components
- `src/combat/obstacle.js` — wall list per fight. Each wall keeps its
  `origLen` and a list of live segments. `wallsForLevel(lv, seed)` returns `[]`
  at LV1. `segmentHitsWall(a, b)` is the shared swept test.
  `chipWall(wall, impact)` removes 0.2 × `origLen` centred on the impact and
  splits the segments. `resetWalls()` rebuilds from the seed each fight.
- `src/combat/muzzle.js` — muzzle and barrel-tip geometry. Used by projectile
  spawn, barrel collision and draw clipping so all agree.
- `src/combat/projectile.js` — on spawn, test centre → muzzle. Each step, test
  prev → next. On a hit set `deadReason: 'wall'` and report
  `{wallId, point, owner}`. No per-step distance cap that skips the test.
- `src/combat/mech.js` — after move and aim, test the barrel segment against
  walls. Clamp the turret angle first. If the hull still pushes the barrel
  into a wall, stop that axis (slide). Same code path for player and bot.
- `src/combat/arena.js` — owns the walls and coins, calls `chipWall` when
  `canBreak(owner)` is true:
  - player: TURRET notch at max (the `breaksWalls` flag from
    `src/mech/tankUpgrades.js`);
  - bot: `hauntLv >= 3`.
  Otherwise the shot stops without a chip.
- `src/combat/enemy.js` — existing slide steering treats walls as obstacles.
  No new pathfinding.
- Coins (in `arena.js`): 10 at LV3+, placed by rejection sampling away from
  walls and spawns, checked reachable from the player spawn. Each has a
  staggered `popAt`, a 30 s life after pop, and a fade over the last 3 s.
  Player-only grab radius. Grab adds credits through the garage save.
- `src/combat/sfxEvents.js` — adds `wallBreak` (break diff) and a coin chime
  (two quick notes) on grab. `hitWall` stays for non-breaking hits.
- `src/combat/combatRenderer.js` — wall segments, debris puff, coin blink, and
  a draw-time barrel clip at the slab (visual backup only).
- `src/ui/garage.js` / `src/mech/tankUpgrades.js` — TURRET max `notchLabel`
  includes "Breaks walls" while the flag is on.

## Decisions
- Swept segment test over a bigger step cap: it is exact and cheap for a
  handful of walls.
- Clamp rotation before stopping movement: aiming along a wall stays smooth.
- Chip by original length, not current: repeated hits cannot shrink the cost
  of a gap.
- Coins use the sim clock, so pause and hit-stop freeze the despawn timer.

## Testing
Plain Node tests in `tests/combat/walls.test.js` (the physics hook runs it),
`tests/combat/coins.test.js`, and the label check beside the garage tests.
Balance runs through `tests/combat/balance.test.js`.
