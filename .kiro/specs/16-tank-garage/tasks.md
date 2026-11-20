# 16-tank-garage — Tasks

Retro-spec. A task is `[x]` only if the code and a test were read in the
current working tree. Tests were read, not run, in this pass (see Verification).

- [x] 1. Five bars (tracks, turret, loader, armor, dash), 0..MAX_NOTCH (4), 1 credit per notch (R1)
- [x] 2. Spend fails with `no-credits` / `bar-full`; fresh and corrupt saves normalise to empty (R1)
- [x] 3. Win N pays N credits; `awardLoss` pays 0 (R2)
- [x] 4. `main.js` pays the win and saves it (R2). Read in code; no test covers the `main.js` wiring.
- [x] 5. Coin grab persists +1 credit under `hh_tank_upgrades_v1`; wins unchanged (R3)
- [x] 6. `notchLabel` derives from `combatModsFromUpgrades` (R4)
- [x] 7. LABEL-TRUTH test: each slot × notch, all-max, loader at max turret (R4)
- [x] 8. TURRET max label includes "Breaks walls" when `breaksWalls` is on (R4)
- [x] 9. LV1 enemy HP stays 220 (`HAUNT_LEVELS[0].hp`, asserted twice) (R5)
- [x] 10. Empty bars equal identity mods; max turret needs at least 8 hits on LV1 (R5)
- [x] 11. Softened turret damage, loader × turret antagonism, fire cooldown ≥ 0.95 at max both (R5)
- [x] 12. Enemy scale: 1.0 / 1.0 empty, HP ×1.40 and damage ×1.30 at all-max (R5)
- [x] 13. Tier unlock resets bars and keeps leftover credits; palette by tier (R6)
- [ ] 14. Tier 3 cap behaviour (bars stay full) has no test. The code does it; nothing asserts it. (R6)
- [ ] 15. `tankGarage.js` DOM test: render, SPEND, DEPLOY, RESET (R7). No test found.
- [ ] 16. Garage text ≥ 14px: CSS in `tankGarage.js` uses 12px and 13px for row labels, flavor, help, meta and reset. Not fixed in this pass. (R7)
- [ ] 17. Esc backs out of the garage: no Esc handler found in `tankGarage.js`. (R7)
- [ ] 18. Reach the garage from pause (accessibility rule 3 covers settings, not the garage). Not checked.
- [ ] 19. `npm test` green on this tree. Not run in this pass.

## Verification
Read in this pass: `src/mech/tankUpgrades.js`, `src/ui/tankGarage.js`,
`src/ui/garage.js` (first ~970 lines; the file was truncated at the tool limit,
so the body of `mountGarage` was not read), `src/combat/arena.js`,
`src/ui/hauntLevel.js`, `src/main.js` (coin and win credit wiring),
`tests/mech/tankUpgrades.test.js`, `tests/mech/labelTruth.test.js`,
`tests/combat/creditPickup.test.js`.

Not done: no test was executed. The shell was unavailable, so every `[x]` rests
on reading the code and the test assertions together.

Mismatches and risks found:
- The brief named `garage.js`. The five-bar screen is in `tankGarage.js`.
  `garage.js` is the older six-slot part picker plus shared helpers.
- `tests/mech/labelTruth.test.js` writes `LABEL-TRUTH.md` and `.json` to
  `the local tank-upgrades report folder ` and calls `git rev-parse` after the assertions
  pass. `writeFileSync` does not create directories, so on a checkout without
  that folder the file may exit non-zero after printing passes. Not confirmed.
- `.kiro/steering/balance.md` says LV1 enemy HP is 440. The code and tests say
  220 (`hauntLevel.js` comment: owner retune 2026-11-19). The steering file is
  stale. Not edited.
- Turret damage per notch, from the formula with base 14: 14, 16, 17, 19, 20.
  The 1.5 step rounds up at .5, so the notch 3 step is +2.

Honest history: the garage was implemented first on `feat/tank-upgrades`, then
spec'd and verified in Kiro afterwards.
