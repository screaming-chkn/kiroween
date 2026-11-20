# 15-cover-walls — Tasks

`[x]` means the code and a test were read together in the current working tree
and agree. Tests were read, not run (see Verification).

- [ ] 1. obstacle.js: mixed-size walls for LV2+, none at LV1, spawns clear, reset each fight (R1). Walls, LV1 and spawn clearance are tested; reset-per-fight has no test.
- [x] 2. Bot slides around walls with the existing steering (R1)
- [x] 3. Swept projectile test: centre → muzzle at spawn, prev → next per step, `deadReason: 'wall'` (R2)
- [x] 4. muzzle.js shared barrel-tip geometry (R2, R3)
- [x] 5. Solid barrel for player and bot: clamp rotation, then stop the move (R3). Code stops the move first when the aim is clear at the old position; see Verification.
- [x] 6. Draw-time barrel clip at the wall slab, visual backup only (R3)
- [x] 7. chipWall: remove 20% of the original length at the impact, split segments (R4). Real names are `chipWallAt` / `chipWallsAt`. Short walls lose more than 20%; see Verification.
- [x] 8. Break gate: player at TURRET max notch; bot LV3+ only; LV2 bot shots stop without breaking (R4)
- [ ] 9. Debris puff + `wallBreak` SFX with a visual cue; keep `hitWall` for non-breaking hits (R5). Code is in place (sparks, `wallBreak` / `hitWall` events, synth recipe). No test read covers `sfxEventsForTick` for these.
- [ ] 10. Coins: 10 at LV3+, staggered pop, reachable, clear of walls and spawns (R6). Count, stagger and clearance are tested; reachability is not.
- [ ] 11. Coin life: 30 s after pop, blink/fade last 3 s, player-only grab (R6). Despawn is tested. The blink runs near 2.3 cycles per second, above the 2 per second cap; see Verification.
- [ ] 12. Coin grab persists garage credits + chime SFX with a visual cue (R6). Persist is tested. The chime event is wired but no read test covers it, and the visual cue is only the coin vanishing and the HUD balance changing.
- [x] 13. Garage: TURRET max label includes "Breaks walls"; LV1 enemy HP stays 220 (R7)
- [x] 14. Tune LV4 odds with 1+2+3 payouts and partial coin grabs; target 30–50% cold win rate (R8). `HAUNT_LEVELS[3]` is 1100 / 26 in code. Reported run: 13-credit spread (turret 4, armor 3, tracks 2, loader 2, dash 2) LV4 cold 42%, default cold 5%. Partial coin grabs were not measured separately.
- [x] 15. Test: point-blank shot at a wall, 0 crossings (R2)
- [x] 16. Test: 200 seeds on LV2 and LV3, wall-cross count 0 (R2). Met by a reported instrumented run, LV2–4, cold and scripted: projectile wall-crossings 0, timeouts 0. That probe is not a committed test file; the committed guard is the point-blank/swept tests in `walls.test.js`.
- [x] 17. Test: max-turret shot opens a 20% gap, second shot passes through (R4)
- [x] 18. Test: bot at LV3 breaks a wall; bot at LV2 does not (R4)
- [x] 19. Test: barrel-overlap probe for player and bot over many angles and moves (R3). Committed: hug/aim poses plus a 40 s LV2 fight that checks both tanks every tick against stored `hullHeading` (0 overlaps). Reported 200-seed run, LV2–4: barrel-overlap ticks 0.
- [x] 20. Test: 10 coins at LV3+, 0 at LV1–2, despawn at 30 s after pop, bot cannot grab (R6). The bot case holds by construction (see Verification).
- [x] 21. Test: LABEL-TRUTH for every notch, TURRET max includes "Breaks walls" (R7)
- [ ] 22. Balance: `npm run test:balance`; LV1 unchanged, bands and monotonic win rates hold (R8). Not run.
- [ ] 23. `npm test` passes, 60 fps holds with walls and coins, HUD text and tap targets unchanged (R5, R6). `npm test` reported passing (walls, creditPickup, LABEL-TRUTH, hauntLevel); 60 fps and HUD checks not measured.
- [ ] 24. Hooks `physics-on-combat-save` and `balance-lv34-on-save` run green (R2, R8). Both hook files exist and point at `walls.test.js` and `balance.test.js`. Neither was run.

## Verification
Second pass: the shell was unavailable to this verifier again. Nothing was
executed here. Code and tests were read in the working tree
(`hauntLevel.js` 1100 / 26 at LV4, `walls.test.js` with the hull-heading
fight probe). Run results below come from the implementer's report, not from
this check:
- `npm test` passed (walls, creditPickup, LABEL-TRUTH, hauntLevel).
- 200-seed instrumented fights, LV2–4, cold and scripted: projectile
  wall-crossings 0, barrel-overlap ticks 0, timeouts 0.
- Cold LV3 default 6.5% (5.5% at 4f7304f). All-max LV3 cold 1.5%, below ~3%;
  a soften was proposed, not shipped.
- LV4 1100 / 26 (was 1266 / 28); 13-credit spread LV4 cold 42%, default cold
  5%; spread scripted 100%, default scripted 95.5%.
Newly ticked: 14, 16, 19. Still open: 1, 9, 10, 11, 12, 22, 23, 24 (see each
line). Deploy and live friend-link are unproven.

First-pass scope (kept for history): read in the working tree, not executed.

Files read: `obstacle.js`, `projectile.js`, `muzzle.js`, `arena.js`,
`enemy.js`, `creditPickup.js`, `combatRenderer.js`, `sfxEvents.js`,
`src/engine/audio.js`, `src/ui/tankWire.js`, `src/main.js` (about 1,100 of its
lines; the rest of the loop was not read), `src/ui/hauntLevel.js` (top),
`tests/combat/walls.test.js`, `tests/combat/creditPickup.test.js`,
`tests/mech/labelTruth.test.js`, `tests/mech/tankUpgrades.test.js`, both hook
JSON files, `package.json`.

Mismatches between spec text and code (no source changed):
- Names. design.md says `chipWall`, `resetWalls`, `wallsForLevel(lv, seed)`
  and `tests/combat/coins.test.js`. The code has `chipWallAt` / `chipWallsAt`,
  no `resetWalls`, `wallsForLevel(lv)` with fixed layouts, and the coin test is
  `tests/combat/creditPickup.test.js`.
- Coin module. design.md puts coins in `arena.js`. They live in
  `src/combat/creditPickup.js`; `arena.js` calls it.
- Barrel physics. design.md puts it in `mech.js` and says clamp rotation first.
  It is `constrainBarrel` in `muzzle.js`, called from `arena.js` (player) and
  `enemy.js` (bot, with `preferMove`). For the player it stops the move first
  when the aim is clear at the old position, and clamps the aim otherwise.
  R3 only asks for "whichever stays smooth", so R3 holds; the design wording
  does not.
- Chip size. `WALL_CHIP_MIN = 32` overrides 20% on short walls. The 100 wide
  wall loses 32 units (32%) and the 64 block loses 32 (50%). R4 says "about
  20%". The 200 wide wall case is the one tested.
- Reachability. design.md says coins are "checked reachable from the player
  spawn". The code uses a fixed candidate list filtered by wall and spawn
  clearance. No reachability check exists.
- Coin blink. `drawCreditPickups` blinks with `sin(t / 70)`, a 440 ms period,
  about 2.3 cycles per second. R6 and the accessibility rule cap flicker at 2
  per second. It also ignores reduced motion. Left as is; this is a real
  change, not a comment typo.
- Bot grab. `stepCreditPickups` takes only a player argument and `arena.js`
  passes only the player, so the bot cannot grab. The test passes `null` to
  show this, which is weak proof.
- LV1 HP. `.kiro/steering/balance.md` says 440. Code and tests say 220.
- `tests/mech/labelTruth.test.js` writes report files to
  `the local tank-upgrades report folder ` and runs `git rev-parse`. On a checkout
  without that folder it may fail after its assertions pass.
- Wall-hit SFX. `wallHitsThisTick` counts `bounds` deaths as well as `wall`
  deaths, so `hitWall` also plays on arena-edge shots. This is by the C9b
  comment, not a bug.

Still open: 200-seed balance, LV4 tune, 60 fps, hook runs, `npm test`, deploy.
