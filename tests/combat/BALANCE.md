# HAUNT//HOUND — Combat Balance Report

> Headless AI-vs-AI balance tester. Scripted player policy (strafe + aim + fire + occasional dash) vs the built-in enemy AI, run over seeded deterministic duels. **Report for the HAUNT_LEVELS table (LV1 tuned to the owner target with the human profiles below).**

- Generated: 2026-11-19T16:45:07.081Z
- Builds: 16
- Seeds per build: 16
- Total fights: 256
- Match cap: 180s (fixed 0.01667s step)
- Win-rate flag threshold: > 60.0%
- Duel-length target: 60–120s (median)

## Summary (per build)

| Build | Load% | Pwr (out/draw) | Fights | Wins | Losses | Timeouts | Win rate | Mean dur | Median dur | Flag |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| Runner Legs / Pulse Core / Hatchet Arm / Buckler Arm | 79 | 10/5 | 16 | 16 | 0 | 0 | 100.0% | 71.1s | 72.7s | ⚠️ |
| Siege Legs / Pulse Core / Hatchet Arm / Buckler Arm | 74 | 10/6 | 16 | 16 | 0 | 0 | 100.0% | 71.1s | 72.7s | ⚠️ |
| Siege Legs / Furnace Core / Lancer Arm / Buckler Arm | 78 | 14/8 | 16 | 16 | 0 | 0 | 100.0% | 75.6s | 76.2s | ⚠️ |
| Runner Legs / Pulse Core / Lancer Arm / Buckler Arm | 77 | 10/7 | 16 | 15 | 1 | 0 | 93.8% | 73.2s | 72.4s | ⚠️ |
| Runner Legs / Furnace Core / Hatchet Arm / Spotter Arm | 84 | 14/7 | 16 | 15 | 1 | 0 | 93.8% | 67.0s | 67.2s | ⚠️ |
| Siege Legs / Pulse Core / Lancer Arm / Buckler Arm | 72 | 10/8 | 16 | 15 | 1 | 0 | 93.8% | 73.2s | 72.4s | ⚠️ |
| Siege Legs / Furnace Core / Hatchet Arm / Buckler Arm | 80 | 14/6 | 16 | 15 | 1 | 0 | 93.8% | 75.3s | 75.5s | ⚠️ |
| Runner Legs / Pulse Core / Hatchet Arm / Spotter Arm | 77 | 10/7 | 16 | 13 | 3 | 0 | 81.3% | 66.4s | 67.2s | ⚠️ |
| Runner Legs / Pulse Core / Lancer Arm / Spotter Arm | 74 | 10/9 | 16 | 13 | 3 | 0 | 81.3% | 68.2s | 68.9s | ⚠️ |
| Runner Legs / Furnace Core / Hatchet Arm / Buckler Arm | 87 | 14/5 | 16 | 13 | 3 | 0 | 81.3% | 74.2s | 72.9s | ⚠️ |
| Runner Legs / Furnace Core / Lancer Arm / Spotter Arm | 82 | 14/9 | 16 | 13 | 3 | 0 | 81.3% | 69.1s | 69.3s | ⚠️ |
| Runner Legs / Furnace Core / Lancer Arm / Buckler Arm | 84 | 14/7 | 16 | 13 | 3 | 0 | 81.3% | 74.2s | 74.1s | ⚠️ |
| Siege Legs / Pulse Core / Hatchet Arm / Spotter Arm | 72 | 10/8 | 16 | 13 | 3 | 0 | 81.3% | 66.4s | 67.2s | ⚠️ |
| Siege Legs / Pulse Core / Lancer Arm / Spotter Arm | 70 | 10/10 | 16 | 13 | 3 | 0 | 81.3% | 68.2s | 68.9s | ⚠️ |
| Siege Legs / Furnace Core / Hatchet Arm / Spotter Arm | 78 | 14/8 | 16 | 13 | 3 | 0 | 81.3% | 66.6s | 66.6s | ⚠️ |
| Siege Legs / Furnace Core / Lancer Arm / Spotter Arm | 76 | 14/10 | 16 | 13 | 3 | 0 | 81.3% | 68.4s | 69.3s | ⚠️ |

## Flagged builds (win rate > 60%)

| Build | Win rate | Median dur |
|---|---:|---:|
| Runner Legs / Pulse Core / Hatchet Arm / Buckler Arm | 100.0% | 72.7s |
| Siege Legs / Pulse Core / Hatchet Arm / Buckler Arm | 100.0% | 72.7s |
| Siege Legs / Furnace Core / Lancer Arm / Buckler Arm | 100.0% | 76.2s |
| Runner Legs / Pulse Core / Lancer Arm / Buckler Arm | 93.8% | 72.4s |
| Runner Legs / Furnace Core / Hatchet Arm / Spotter Arm | 93.8% | 67.2s |
| Siege Legs / Pulse Core / Lancer Arm / Buckler Arm | 93.8% | 72.4s |
| Siege Legs / Furnace Core / Hatchet Arm / Buckler Arm | 93.8% | 75.5s |
| Runner Legs / Pulse Core / Hatchet Arm / Spotter Arm | 81.3% | 67.2s |
| Runner Legs / Pulse Core / Lancer Arm / Spotter Arm | 81.3% | 68.9s |
| Runner Legs / Furnace Core / Hatchet Arm / Buckler Arm | 81.3% | 72.9s |
| Runner Legs / Furnace Core / Lancer Arm / Spotter Arm | 81.3% | 69.3s |
| Runner Legs / Furnace Core / Lancer Arm / Buckler Arm | 81.3% | 74.1s |
| Siege Legs / Pulse Core / Hatchet Arm / Spotter Arm | 81.3% | 67.2s |
| Siege Legs / Pulse Core / Lancer Arm / Spotter Arm | 81.3% | 68.9s |
| Siege Legs / Furnace Core / Hatchet Arm / Spotter Arm | 81.3% | 66.6s |
| Siege Legs / Furnace Core / Lancer Arm / Spotter Arm | 81.3% | 69.3s |

## Duel length vs 60–120s target

- Builds with median in target (60–120s): 16 / 16
- Median of per-build medians: 70.9s
- Mean of per-build means: 70.5s

| Build | Median dur | In target? |
|---|---:|:--:|
| Runner Legs / Pulse Core / Hatchet Arm / Buckler Arm | 72.7s | ✅ |
| Siege Legs / Pulse Core / Hatchet Arm / Buckler Arm | 72.7s | ✅ |
| Siege Legs / Furnace Core / Lancer Arm / Buckler Arm | 76.2s | ✅ |
| Runner Legs / Pulse Core / Lancer Arm / Buckler Arm | 72.4s | ✅ |
| Runner Legs / Furnace Core / Hatchet Arm / Spotter Arm | 67.2s | ✅ |
| Siege Legs / Pulse Core / Lancer Arm / Buckler Arm | 72.4s | ✅ |
| Siege Legs / Furnace Core / Hatchet Arm / Buckler Arm | 75.5s | ✅ |
| Runner Legs / Pulse Core / Hatchet Arm / Spotter Arm | 67.2s | ✅ |
| Runner Legs / Pulse Core / Lancer Arm / Spotter Arm | 68.9s | ✅ |
| Runner Legs / Furnace Core / Hatchet Arm / Buckler Arm | 72.9s | ✅ |
| Runner Legs / Furnace Core / Lancer Arm / Spotter Arm | 69.3s | ✅ |
| Runner Legs / Furnace Core / Lancer Arm / Buckler Arm | 74.1s | ✅ |
| Siege Legs / Pulse Core / Hatchet Arm / Spotter Arm | 67.2s | ✅ |
| Siege Legs / Pulse Core / Lancer Arm / Spotter Arm | 68.9s | ✅ |
| Siege Legs / Furnace Core / Hatchet Arm / Spotter Arm | 66.6s | ✅ |
| Siege Legs / Furnace Core / Lancer Arm / Spotter Arm | 69.3s | ✅ |

## Per HAUNT LV (baseline, 200 seeds × 16 builds per LV)

| LV | Win rate % | Median s | Max build dev pp | Timeouts |
|---:|---:|---:|---:|---:|
| 1 | 97.9 | 21.0 | 2.9 | 0 |
| 2 | 98.5 | 29.4 | 2.5 | 0 |
| 3 | 93.9 | 41.7 | 5.9 | 0 |
| 4 | 73.1 | 57.6 | 12.6 | 0 |
| 5 | 50.2 | 78.4 | 9.2 | 0 |
## Strategy probes

| LV | baseline % | dashSpam % | camp % | reactive % | dashSpam − baseline pp | camp − baseline pp | dashSpam − reactive pp |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 97.9 | 100.0 | 0.0 | 100.0 | +2.1 | -97.9 | +0.0 |
| 2 | 98.5 | 100.0 | 0.0 | 100.0 | +1.5 | -98.5 | +0.0 |
| 3 | 93.9 | 99.8 | 0.0 | 99.6 | +5.9 | -93.9 | +0.2 |
| 4 | 73.1 | 95.9 | 0.0 | 99.3 | +22.8 | -73.1 | -3.4 |
| 5 | 50.2 | 63.3 | 0.0 | 85.0 | +13.1 | -50.2 | -21.7 |

## Human profiles (LV1 target: ~30 s; first-timer wins ~1/3, medium ~2/3)

Harness-only player models (`HUMAN_PROFILES` in `balanceCore.mjs`). Both run the baseline policy (lead aim, sticky lapses, random dashes) plus:

| Profile | Aim sigma (wu) | Reads the tell | Reaction (ms) | Stands still to aim |
|---|---:|---:|---:|---:|
| baseline (reference) | 36 | never (random dashes only) | – | never |
| firstTimer | 60 | 25 % of rings | 330 ± 90 | 40 % of 0.75 s beats |
| medium | 54 | 60 % of rings | 280 ± 70 | 40 % of 0.75 s beats |

- **firstTimer:** a first game. Rough aim (sigma 60 was the old "near-0 % wins" setting), reacts to a quarter of the red rings, a bit slow.
- **medium:** has learned the tell (the LV1 caption teaches it). Slightly better aim, dashes on most rings.
- Cold passes: clear `localStorage` key `hh-tell-caption-seen-v2` (or use a fresh origin) so the one-shot DASH caption is actually tested.
- A reaction dashes along the strafe line once the delay has passed; after the 450 ms windup it is too late. Dash cooldown still applies, so nobody dodges every shot.
- The gap between the two is mostly tell-reading: at LV1, medium's tell habit with first-timer aim (sigma 60) already wins 63.8 %, so about 30 of the 36 pp gap is the dodge. Win rate is very sensitive to "stands still": at LV1, 30 % gives first-timer ~52 % / medium ~73 %, 50 % gives ~20 % / ~61 %. Treat these as models, not measurements; a real phone playtest is the check.

| LV | firstTimer win % | firstTimer median s | medium win % | medium median s | baseline win % | baseline median s |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 33.4 | 25.8 | 69.2 | 27.7 | 97.9 | 21.0 |
| 2 | 23.8 | 34.3 | 64.8 | 39.1 | 98.5 | 29.4 |
| 3 | 7.4 | 39.5 | 39.3 | 51.8 | 93.9 | 41.7 |
| 4 | 0.6 | 43.2 | 13.8 | 59.5 | 73.1 | 57.6 |
| 5 | 0.0 | 49.8 | 4.5 | 69.5 | 50.2 | 78.4 |
