---
inclusion: fileMatch
fileMatchPattern: "src/combat/**"
---
# Balance

## Ground rules
- Numbers only. Balance tuning never adds logic, new files, or new content.
- Single source of truth: all combat numbers live in `src/combat/config.js`.
  `src/ui/hauntLevel.js` owns the HAUNT LV ramp (the `HAUNT_LEVELS` table
  and `applyHauntPressure`). No other file shall embed magic numbers that affect
  win rate or duel length.
- Never tune by feel alone. Every change needs a before/after matrix run; paste
  the table into `PLAN.md` before merging.

## HAUNT LV ramp
`HAUNT_LEVELS` in `src/ui/hauntLevel.js` sets enemy HP and shot damage per level:
220/47, 626/40, 890/34, 1100/26, 1800/24 (LV 1–5). LV1 is 220 HP (not 440).
LV4 is 1100/26, retuned so a ~13-credit garage spread has a real cold shot at
LV4. LV1 is tuned to an owner
target (2026-11-19): about 30 s, a first-timer wins about 1/3, a player who
reads the tell about 2/3, measured with the `firstTimer` and `medium` human
profiles in `tests/combat/balanceCore.mjs`. Hits to kill a 140 HP mech:
3 / 4 / 5 / 6 / 6; never jump more than one hit per level. `applyHauntPressure(enemy, lv)` copies the row onto the
enemy. The ramp is applied at spawn in `main.js` (and in `runFight` via
`opts.hauntLv`) so the headless sim matches live difficulty exactly. The old
multiplier ramp (0.8 / 1.0 / 1.1 / 1.17 / 1.2 of 1500 HP / 20 dmg) survives only
as `applyPressure`, for golden replays.

## R6 target bands
Run `npm run test:balance` after any combat number change and verify all five
rows pass before committing.

Win rate = scripted player beats the bot (phase === 'win').

| HAUNT LV | Baseline win rate | Baseline median | Human target |
|----------|-------------------|-----------------|--------------|
| 1        | 90–100 %          | 15–35 s         | firstTimer 25–40 %, medium 60–72 %, medians 25–35 s |
| 2        | 90–100 %          | 30–120 s        | report only |
| 3        | 80–100 %          | 30–120 s        | report only |
| 4        | 60–85 %           | 30–120 s        | report only |
| 5        | 40–60 %           | 30–120 s        | report only |

The baseline is near-perfect lead aim and never reads the tell; it is a
regression guard, not a player. LV1 is tuned to the human profiles.

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
the median duel length outside its band (baseline LV1 15–35 s, LV2–LV5 30–120 s) must be reverted or
compensated before merge.

## Cold-pass caption hygiene
The one-shot DASH teach uses `localStorage` key `hh-tell-caption-seen-v2`
(`src/ui/tellCaption.js`). Before a cold first-minute pass, clear that key or
serve from a fresh origin so the caption can fire. Bumping the `-vN` suffix
re-teaches once after a retune without wiping other progress.
