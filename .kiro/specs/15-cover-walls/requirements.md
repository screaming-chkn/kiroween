# 15-cover-walls — Requirements

## Introduction
Cover walls, solid barrels, breakable walls and credit coins for the 1v1 duel.
LV1 stays open and untouched (enemy HP 220). Walls start at LV2. Breaking is
gated: the player needs the TURRET bar at max notch; the bot breaks from LV3.
Coins at LV3+ feed garage credits so wins 1+2+3 plus a few grabs give a fair
chance at LV4. No new art or audio assets; SFX stay synthesized.

## Requirements

### R1 Cover walls
- WHEN HAUNT LV is 2 or higher, the arena SHALL place mixed-size cover walls.
  At LV1 it SHALL place none.
- Spawn points SHALL stay clear of walls by a fixed margin.
- The bot SHALL path around walls using the existing slide movement.
- Walls SHALL reset to full size at the start of every fight.

### R2 Swept projectiles
- WHEN a projectile spawns, the sim SHALL test the segment tank centre → muzzle
  against every wall.
- WHILE a projectile flies, each step SHALL test the segment prev → next
  against every wall.
- WHEN a segment crosses a wall, the projectile SHALL die with
  `deadReason: 'wall'`.
- A fast step or a point-blank shot SHALL NOT tunnel through a wall.

### R3 Solid barrels
- The turret and barrel of the player AND the bot SHALL NOT overlap a wall.
- WHEN a move or aim change would put the barrel inside a wall, the sim SHALL
  clamp the rotation and/or stop the move, whichever stays smooth.
- Draw-time barrel clipping at the wall slab MAY exist as a visual backup only.
  Physics SHALL NOT depend on it.

### R4 Breakable walls
- WHEN a breaking hit lands, the wall SHALL lose about 20% of its ORIGINAL
  length, centred on the impact point, and the remainder SHALL split into
  segments with a gap the next shot can pass.
- The player's shots SHALL break walls only WHILE the TURRET bar is at max
  notch (any LV that has walls).
- The bot's shots SHALL break walls only at LV3 or higher, always, with no
  upgrades.
- At LV2 the bot's shots SHALL still stop on walls (`deadReason: 'wall'`) and
  SHALL NOT break them.
- A non-breaking wall hit SHALL keep the `hitWall` SFX.

### R5 Break feedback
- WHEN a wall breaks, the system SHALL spawn a debris puff and play a distinct
  `wallBreak` SFX.
- The break SHALL have a visual equivalent that does not rely on sound.
- Debris SHALL respect reduced motion and the static / shake settings.

### R6 Credit coins
- WHEN the fight is LV3 or higher, the arena SHALL spawn 10 coins with a
  staggered pop.
- Coins SHALL be reachable and clear of walls and spawns.
- A coin SHALL despawn 30 s after its pop and SHALL blink or fade for the last
  3 s (no more than 2 flashes per second).
- ONLY the player SHALL be able to grab a coin.
- WHEN a coin is grabbed, the system SHALL add to garage credits, persist them,
  and play a ding-ding chime SFX with a visual equivalent.

### R7 Garage label truth
- The TURRET max notch label SHALL include "Breaks walls".
- Every notch label SHALL equal the measured combat-sim effect (see
  `upgrade-label-truth.md`).
- LV1 enemy HP SHALL stay 220. LV1 SHALL NOT be retuned.

### R8 Progression
- After beating LV1–3 (payouts 1+2+3) and grabbing a realistic share of the
  coins (not all 10), the player SHALL have a decent chance at an LV4 upgrade
  path.
- A cold player with that loadout SHALL win LV4 roughly 30–50% of the time,
  noticeably above the default loadout.
- The balance guard SHALL keep the R6 bands from spec 10 and monotonic win
  rates.
