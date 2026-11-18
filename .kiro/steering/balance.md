---
inclusion: fileMatch
fileMatchPattern: "src/combat/**"
---
# Balance

## Ground rules
- Numbers only. Balance tuning never adds logic, new files, or new content.
- Single source of truth: all combat numbers live in `src/combat/config.js`.
  `src/ui/hauntLevel.js` owns the HAUNT LV ramp (the `hauntPressure` multiplier
  and `applyHauntPressure`). No other file shall embed magic numbers that affect
  win rate or duel length.
- Never tune by feel alone. Every change needs a before/after matrix run; paste
  the table into `PLAN.md` before merging.

## HAUNT LV ramp
`hauntPressure(lv)` reads the `HAUNT_PRESSURE` table: 0.8 / 1.0 / 1.1 / 1.17 / 1.2
(LV 1–5, M4). Shot damage rounds, so watch hits-to-kill: LV4 must stay
below 1.175 (23 dmg, 7 hits on 140 HP) or it falls onto LV5's 6-hit cliff.
`applyHauntPressure(enemy, lv)` scales enemy `hp` and `shotDamage` by that
multiplier. The ramp is applied at spawn in `main.js` (and in `runFight` via
`opts.hauntLv`) so the headless sim matches live difficulty exactly.

## R6 target bands
Run `npm run test:balance` after any combat number change and verify all five
rows pass before committing.

Win rate = scripted player beats the bot (phase === 'win').

| HAUNT LV | Player win rate | Median duel |
|----------|----------------|-------------|
| 1        | 85–100 %       | 45–120 s    |
| 2        | 75–95 %        | 45–120 s    |
| 3        | 65–85 %        | 45–120 s    |
| 4        | 50–80 %        | 45–120 s    |
| 5        | 40–60 %        | 45–120 s    |

Additional constraints (all LVs):
- No build's win rate may deviate more than 10 pp from its LV mean (no dominant
  loadout).
- Win rates must be monotonic non-increasing LV 1 → LV 5.
- Corner-camp probe win rate must not beat the baseline by more than 10 pp at
  any LV.
- Dash-spam must not beat the tell-reading reactive probe (dash in the last
  150 ms of windup) at any LV; its edge over the tell-blind baseline is
  reported in BALANCE.md.

## Workflow
1. Change numbers in `config.js` or `hauntLevel.js`.
2. Run `npm run test:balance` — this runs `tests/combat/balance.mjs` (the full
   matrix) and writes `tests/combat/BALANCE.md`. The fast R6 guard lives in
   `tests/combat/balance.test.js` and runs as part of `npm test`.
3. Paste the before/after per-LV table into `PLAN.md` with a one-line rationale.
4. Confirm all R6 bands pass, then commit both the number change and the updated
   `PLAN.md`.

## Hard constraints — do not change without a probe run
- `ENEMY_SHOT_WINDUP_MS` (450 ms): the readable tell must stay legible.
- `DASH_DURATION_MS`, `DASH_BUFFER_MS`, `DASH_COOLDOWN_MS`: phone feel — touch
  timing depends on these. Only adjust if a probe policy fails and no
  pure-number fix (HP, damage, speed) restores the band.
- `FIRE_COOLDOWN_MS` (300 ms player): the core fire rhythm.

## Phone is first-class
Dash and fire timings are sized for touch latency. Any number change that moves
the median duel length outside 45–120 s on any LV must be reverted or
compensated before merge.
