# 16-tank-garage — Requirements

## Introduction
Retro-spec. The tank garage shipped on `feat/tank-upgrades` before this spec
existed. These requirements were written afterwards by reading the current
code (`src/mech/tankUpgrades.js`, `src/ui/tankGarage.js`, `src/ui/garage.js`)
and its tests. They describe what the code does, not a plan.

The player upgrades one tank through five bars. Credits come from winning and,
at HAUNT LV3+, from arena coins. The bot gets slightly tougher as the bars
fill. Combat numbers live in `src/mech/tankUpgrades.js` and
`src/combat/config.js`; the LV ramp stays in `src/ui/hauntLevel.js`.

## Requirements

### R1 Bars and notches
- The garage SHALL offer five bars: tracks, turret, loader, armor, dash.
- Each bar SHALL hold 0 to `MAX_NOTCH` notches, and `MAX_NOTCH` SHALL be 4.
- Spending one notch SHALL cost exactly 1 credit.
- WHEN credits are 0 or the bar is full, spending SHALL fail and change nothing.
- A fresh or corrupt save SHALL load as 0 credits, 0 wins, all bars empty, tier 1.

### R2 Win payouts
- Win N SHALL pay N credits (win 1 pays 1, win 2 pays 2, win 3 pays 3).
- A loss SHALL pay 0.
- The payout SHALL be saved to garage credits when the fight ends in a win.

### R3 Coin credits
- WHEN the player grabs an arena coin at LV3+, the garage credits SHALL rise by
  1 and SHALL be saved at once under `hh_tank_upgrades_v1`.
- A coin grab SHALL NOT change the win count or the next payout.
- Coin placement, timing and grab rules are owned by `15-cover-walls` (R6).

### R4 Label truth (LABEL-TRUTH)
- Every notch label shown in the garage SHALL equal the effect measured on the
  live player after `createArena` for the same bar state.
- This SHALL hold for each bar at each notch with the other bars empty, for
  all bars at max, and for the loader at each notch with the turret at max.
- Labels SHALL be computed from `combatModsFromUpgrades`, not typed by hand.
- The TURRET max label SHALL include "Breaks walls" while `breaksWalls` is on.

### R5 Balance guards
- LV1 enemy HP SHALL stay 220. LV1 SHALL NOT be retuned by this feature.
- With empty bars the combat mods SHALL equal the base feel (identity).
- A max turret SHALL still need at least 8 hits on the LV1 enemy.
- Turret damage SHALL use the softened curve: base + round(1.5 × notch).
- Loader SHALL be weaker when the turret is filled: the loader reload cut is
  scaled by (1 − 0.55 × turret/4), and each turret notch adds 5% reload. A max
  turret plus a max loader SHALL NOT fire faster than 0.95 × the base reload.
- The bot SHALL scale with total notches: HP +2% and damage +1.5% per notch,
  and 1.0 / 1.0 with empty bars.

### R6 Tier unlock
- WHEN every bar is full and the tier is below the max, the next spend SHALL
  raise the tier, reset all bars to 0, and keep leftover credits.
- At the max tier the bars SHALL stay full.
- The tier SHALL pick the hull palette (green at tier 1, blue at tier 2+). It
  SHALL NOT change collision size.

### R7 Garage screen
- The garage SHALL show each bar with its notch segments and current label,
  a detail panel with "Now" and "Next" labels, credits, wins, next payout and
  tier.
- Rows SHALL be reachable by Tab and open with Enter or Space, with a visible
  2px ember focus outline.
- The garage SHALL meet the accessibility rule: text 14px or larger, targets
  32px or larger, Esc backs out.
