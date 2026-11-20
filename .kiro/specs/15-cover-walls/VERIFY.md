# 15-cover-walls — Verification note

Honest history: cover walls, LV3 credit coins and the tank garage were built
first (`feat/tank-upgrades`, then `feat/walls`). A second pass added solid
barrels, breakable walls, 10 coins with a 30 s despawn and chime, and
"Breaks walls" in the TURRET label. This spec and this check were written in
Kiro after those implementation passes, from the code as it stands.

Method (first pass): files and tests were read in the working tree. No test,
balance run, hook or browser check was executed because the shell was
unavailable. Nothing in that pass is a measured result.

## Matches the spec (code and a test agree on reading)
- Walls at LV2+, none at LV1, spawns clear (R1).
- Bot slides around walls, tested on LV2 to LV5 (R1).
- Swept projectile test at spawn and per step; point-blank shots from both
  sides never end past the wall (R2).
- Solid barrel for player and bot through `constrainBarrel`; draw-time clip is
  a visual backup (R3).
- Player breaks walls only at TURRET max; bot breaks at LV3+, not LV2; a
  20% gap on a 200 wide wall lets the next shot through (R4).
- 10 coins at LV3 to LV5, none at LV1 to LV2, staggered 350 ms, clear of walls
  and spawns, despawn at 30 s after pop, +1 credit saved on grab (R6).
- TURRET max label reads "Dmg 20 · Breaks walls". LV1 enemy HP is 220 (R7).

## Mismatches (see tasks.md Verification for detail)
- design.md names (`chipWall`, `coins.test.js`, coins in `arena.js`, `mech.js`
  barrel code) differ from the files.
- Short walls and the block lose more than 20% per break (`WALL_CHIP_MIN`).
- Coin blink is about 2.3 per second, above the 2 per second cap, and ignores
  reduced motion.
- No reachability check for coins.
- `labelTruth.test.js` writes outside the repo and may fail on a fresh checkout.
- Resolved: `.kiro/steering/balance.md` now says LV1 220 and LV4 1100/26.

## Still open
- `npm run test:balance` and `npm run test:balance:full`.
- 60 fps with walls and coins, on desktop and phone.
- Both hooks run green on this tree.
- Debris, wall-break and chime event tests; reduced-motion and shake checks on
  the break sparks.
- Deploy and live friend-link. A public deploy needs the owner's yes.

## Second pass
Method: the shell was unavailable again, so this check executed nothing. Code
and tests were read in the working tree. Run results below are the
implementer's report, not re-run here.

- Hull-heading physics: movers store `hullHeading` from the same movement
  rule as the renderer (wheeled gun offset). `constrainBarrel` tests against
  that heading and has a ring-search fallback. `walls.test.js` checks both
  tanks every tick of a 40 s LV2 fight against stored `hullHeading` (0
  overlaps).
- Reported 200-seed instrumented fights, LV2–4, cold and scripted:
  projectile wall-crossings 0, barrel-overlap ticks 0, timeouts 0. This probe
  is not a committed test.
- `npm test` reported passing (walls, creditPickup, LABEL-TRUTH, hauntLevel).
- LV4 is now 1100 HP / 26 dmg (was 1266 / 28); LV1 stays 220. Enemy scale is
  1.0 through the first 13 notches, then ramps to x1.40 HP / x1.30 dmg at
  all-max (20). 13-credit spread (turret 4, armor 3, tracks 2, loader 2,
  dash 2): LV4 cold 42%, default cold 5% (delta +37). Spread scripted 100%,
  default scripted 95.5%.
- Cold LV3 default 6.5% (5.5% at 4f7304f). All-max LV3 cold is 1.5%, still
  below ~3%. A soften was proposed and is NOT shipped. Open.
- Ticked in tasks.md this pass: 14, 16, 19.
- Still open: wall reset-per-fight test, wallBreak/chime event tests, coin
  reachability, coin blink rate, all-max LV3 soften, hook runs, deploy.
