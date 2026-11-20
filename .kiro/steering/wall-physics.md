---
inclusion: fileMatch
fileMatchPattern: "(src/combat/**|muzzle\\.js)"
---
# Wall physics

## Rules
- A barrel never occupies a wall. Player and bot use the same code path. Clamp
  turret rotation first; if the hull still pushes the barrel in, stop that
  axis and slide. Draw-time barrel clipping is a visual backup only.
- Projectiles use a swept segment test. At spawn test tank centre → muzzle. Each
  step test prev → next. Never test only the end point. A hit sets
  `deadReason: 'wall'`.
- Muzzle and barrel-tip geometry live in `src/combat/muzzle.js`. Spawn,
  collision and drawing all read it.
- Walls exist at LV2+. LV1 is open. Spawns stay clear. Walls reset each fight.

## Chip rules
- A breaking hit removes about 20% of the wall's ORIGINAL length, centred on
  the impact, and splits the rest into segments.
- Player breaks only with the TURRET bar at max notch (any LV with walls).
- Bot breaks at LV3+ only, with no upgrades. At LV2 bot shots stop on walls
  and do not chip.
- A break plays `wallBreak` and a debris puff. Non-breaking wall hits keep
  `hitWall`.

## Checks
Run `node tests/combat/walls.test.js` after any change here. Required cases:
point-blank 0 crossings, 200-seed LV2–3 0 crossings, 20% gap then second shot
through, bot LV3 breaks and LV2 does not, barrel-overlap probe.
