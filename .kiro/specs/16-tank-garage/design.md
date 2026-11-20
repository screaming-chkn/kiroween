# 16-tank-garage — Design

Retro-spec: describes the code as it stands in the working tree.

## Components
- `src/mech/tankUpgrades.js` — pure model, no DOM.
  - State: `{ tracks, turret, loader, armor, dash, credits, wins, tier }`.
    Saved under `hh_tank_upgrades_v1`. `normalizeUpgradeState` clamps any save.
  - `spendNotch(state, slot)` returns `{ ok, state, unlockedTier, reason }`.
    Reasons: `bad-slot`, `no-credits`, `bar-full`.
  - `creditsForNextWin(wins)` = wins + 1. `awardWin` adds it and bumps wins.
    `awardLoss` returns the state unchanged. `awardCredits(state, n)` adds
    credits only (coin grabs).
  - `combatModsFromUpgrades(state)` is the single source of combat numbers:

    | Bar | Per notch | At 4 |
    |---|---|---|
    | tracks | move speed +4% | +16% |
    | turret | shot damage base + round(1.5 × n); reload +5% | damage 20, `breaksWalls` on |
    | loader | reload cut 5% × (1 − 0.55 × turret/4) | halved when turret is full |
    | armor | +6 max HP | +24 |
    | dash | cooldown −6%, duration +4% | −24%, +16% |

    Tier 2 adds +10 HP and +3% speed. Tier 3 adds another +10 HP and takes 5%
    off incoming damage. Damage figures assume base 14 (the tests expect
    "Dmg 20" at notch 4).
  - `notchLabel(slot, notch, baseState)` builds the label from those mods.
  - `enemyScaleFromUpgrades(state)` returns `hpMult` and `damageMult` from the
    notch sum. `deployTotalsFromUpgrades(state)` packs mods and enemy scale for
    `createArena` (fixed light-class weight 69 of 90).
- `src/ui/tankGarage.js` — DOM screen. One row per bar (label, 4 notch
  segments, value text), a detail panel with a SPEND 1 CREDIT button, a meta
  panel (tier, credits, wins, next payout), RESET PROGRESS, SÉANCE and DEPLOY.
  `src/ui/garage.js` keeps the older part-picker helpers and tests, imports
  `mountTankGarage`, and exports `quickDeployPlan` (title-screen deploy reads
  the saved upgrade state).
- `src/combat/arena.js` — `createArena` applies `combatMods` to the player and
  stamps `upgradeHpMult` / `upgradeDamageMult` on the enemy from the totals'
  `enemyHpMult` / `enemyDamageMult`. `applyHauntPressure` in
  `src/ui/hauntLevel.js` is meant to apply them after the HAUNT table row (the
  part of `hauntLevel.js` that does this was not read in this pass).
- `src/main.js` — on a coin grab it calls `awardCredits` and saves. On a win it
  reads the payout with `creditsForNextWin`, then `awardWin` and saves.

## Decisions
- Labels come from the same function that feeds combat, so they cannot drift.
  The label test then re-measures through `createArena` to catch wiring bugs.
- Turret damage is softened (+1.5 per notch, rounded) and the loader is
  attenuated by turret fill so "heavy and fast" cannot both max out.
- The bot scales with total notches so a full build does not trivialise LV1.
  LV1 base HP stays 220.
- Credits are the only currency. Losses pay 0, by design.

## Testing
- `tests/mech/tankUpgrades.test.js`: model, payouts, spend, tier, mods, cliff,
  antagonism, enemy scale, `awardCredits`.
- `tests/mech/labelTruth.test.js`: label equals measured effect, fresh save.
- `tests/combat/creditPickup.test.js`: a grab persists +1 credit.
- Not covered by a test: the `tankGarage.js` DOM (render, spend, focus, Esc).
