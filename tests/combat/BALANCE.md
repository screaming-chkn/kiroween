# HAUNT//HOUND — Combat Balance Report

> Headless AI-vs-AI balance tester. Scripted player policy (strafe + aim + fire + occasional dash) vs the built-in enemy AI, run over seeded deterministic duels. **Report only — no combat numbers were retuned.**

- Generated: 2026-11-19T02:34:02.074Z
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
| 1 | 100.0 | 42.3 | 0.0 | 0 |
| 2 | 94.6 | 70.0 | 5.1 | 0 |
| 3 | 83.1 | 75.6 | 7.4 | 0 |
| 4 | 74.9 | 80.2 | 7.9 | 0 |
| 5 | 50.2 | 78.4 | 9.2 | 0 |
## Strategy probes

| LV | baseline % | dashSpam % | camp % | reactive % | dashSpam − baseline pp | camp − baseline pp | dashSpam − reactive pp |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 100.0 | 100.0 | 0.0 | 100.0 | +0.0 | -100.0 | +0.0 |
| 2 | 94.6 | 98.5 | 0.0 | 100.0 | +3.9 | -94.6 | -1.5 |
| 3 | 83.1 | 95.5 | 0.0 | 99.4 | +12.4 | -83.1 | -3.9 |
| 4 | 74.9 | 90.9 | 0.0 | 99.4 | +16.0 | -74.9 | -8.5 |
| 5 | 50.2 | 63.3 | 0.0 | 85.0 | +13.1 | -50.2 | -21.7 |
