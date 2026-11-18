# HAUNT//HOUND — Combat Balance Report

> Headless AI-vs-AI balance tester. Scripted player policy (strafe + aim + fire + occasional dash) vs the built-in enemy AI, run over seeded deterministic duels. **Report only — no combat numbers were retuned.**

- Generated: 2026-11-18T20:12:23.350Z
- Builds: 16
- Seeds per build: 16
- Total fights: 256
- Match cap: 180s (fixed 0.01667s step)
- Win-rate flag threshold: > 60.0%
- Duel-length target: 60–120s (median)

## Summary (per build)

| Build | Load% | Pwr (out/draw) | Fights | Wins | Losses | Timeouts | Win rate | Mean dur | Median dur | Flag |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| Runner Legs / Pulse Core / Hatchet Arm / Spotter Arm | 77 | 10/7 | 16 | 15 | 1 | 0 | 93.8% | 67.2s | 67.2s | ⚠️ |
| Runner Legs / Pulse Core / Hatchet Arm / Buckler Arm | 79 | 10/5 | 16 | 15 | 1 | 0 | 93.8% | 67.2s | 67.2s | ⚠️ |
| Runner Legs / Pulse Core / Lancer Arm / Spotter Arm | 74 | 10/9 | 16 | 15 | 1 | 0 | 93.8% | 67.2s | 67.2s | ⚠️ |
| Runner Legs / Pulse Core / Lancer Arm / Buckler Arm | 77 | 10/7 | 16 | 15 | 1 | 0 | 93.8% | 67.2s | 67.2s | ⚠️ |
| Siege Legs / Pulse Core / Hatchet Arm / Spotter Arm | 72 | 10/8 | 16 | 15 | 1 | 0 | 93.8% | 67.2s | 67.2s | ⚠️ |
| Siege Legs / Pulse Core / Hatchet Arm / Buckler Arm | 74 | 10/6 | 16 | 15 | 1 | 0 | 93.8% | 67.2s | 67.2s | ⚠️ |
| Siege Legs / Pulse Core / Lancer Arm / Spotter Arm | 70 | 10/10 | 16 | 15 | 1 | 0 | 93.8% | 67.2s | 67.2s | ⚠️ |
| Siege Legs / Pulse Core / Lancer Arm / Buckler Arm | 72 | 10/8 | 16 | 15 | 1 | 0 | 93.8% | 67.2s | 67.2s | ⚠️ |
| Siege Legs / Furnace Core / Hatchet Arm / Spotter Arm | 78 | 14/8 | 16 | 15 | 1 | 0 | 93.8% | 67.2s | 67.2s | ⚠️ |
| Siege Legs / Furnace Core / Hatchet Arm / Buckler Arm | 80 | 14/6 | 16 | 15 | 1 | 0 | 93.8% | 67.2s | 67.2s | ⚠️ |
| Siege Legs / Furnace Core / Lancer Arm / Spotter Arm | 76 | 14/10 | 16 | 15 | 1 | 0 | 93.8% | 67.2s | 67.2s | ⚠️ |
| Siege Legs / Furnace Core / Lancer Arm / Buckler Arm | 78 | 14/8 | 16 | 15 | 1 | 0 | 93.8% | 67.2s | 67.2s | ⚠️ |
| Runner Legs / Furnace Core / Hatchet Arm / Spotter Arm | 84 | 14/7 | 16 | 14 | 2 | 0 | 87.5% | 68.0s | 67.4s | ⚠️ |
| Runner Legs / Furnace Core / Lancer Arm / Buckler Arm | 84 | 14/7 | 16 | 14 | 2 | 0 | 87.5% | 68.0s | 67.4s | ⚠️ |
| Runner Legs / Furnace Core / Lancer Arm / Spotter Arm | 82 | 14/9 | 16 | 13 | 3 | 0 | 81.3% | 65.6s | 64.4s | ⚠️ |
| Runner Legs / Furnace Core / Hatchet Arm / Buckler Arm | 87 | 14/5 | 16 | 10 | 6 | 0 | 62.5% | 66.8s | 65.4s | ⚠️ |

## Flagged builds (win rate > 60%)

| Build | Win rate | Median dur |
|---|---:|---:|
| Runner Legs / Pulse Core / Hatchet Arm / Spotter Arm | 93.8% | 67.2s |
| Runner Legs / Pulse Core / Hatchet Arm / Buckler Arm | 93.8% | 67.2s |
| Runner Legs / Pulse Core / Lancer Arm / Spotter Arm | 93.8% | 67.2s |
| Runner Legs / Pulse Core / Lancer Arm / Buckler Arm | 93.8% | 67.2s |
| Siege Legs / Pulse Core / Hatchet Arm / Spotter Arm | 93.8% | 67.2s |
| Siege Legs / Pulse Core / Hatchet Arm / Buckler Arm | 93.8% | 67.2s |
| Siege Legs / Pulse Core / Lancer Arm / Spotter Arm | 93.8% | 67.2s |
| Siege Legs / Pulse Core / Lancer Arm / Buckler Arm | 93.8% | 67.2s |
| Siege Legs / Furnace Core / Hatchet Arm / Spotter Arm | 93.8% | 67.2s |
| Siege Legs / Furnace Core / Hatchet Arm / Buckler Arm | 93.8% | 67.2s |
| Siege Legs / Furnace Core / Lancer Arm / Spotter Arm | 93.8% | 67.2s |
| Siege Legs / Furnace Core / Lancer Arm / Buckler Arm | 93.8% | 67.2s |
| Runner Legs / Furnace Core / Hatchet Arm / Spotter Arm | 87.5% | 67.4s |
| Runner Legs / Furnace Core / Lancer Arm / Buckler Arm | 87.5% | 67.4s |
| Runner Legs / Furnace Core / Lancer Arm / Spotter Arm | 81.3% | 64.4s |
| Runner Legs / Furnace Core / Hatchet Arm / Buckler Arm | 62.5% | 65.4s |

## Duel length vs 60–120s target

- Builds with median in target (60–120s): 16 / 16
- Median of per-build medians: 67.2s
- Mean of per-build means: 67.2s

| Build | Median dur | In target? |
|---|---:|:--:|
| Runner Legs / Pulse Core / Hatchet Arm / Spotter Arm | 67.2s | ✅ |
| Runner Legs / Pulse Core / Hatchet Arm / Buckler Arm | 67.2s | ✅ |
| Runner Legs / Pulse Core / Lancer Arm / Spotter Arm | 67.2s | ✅ |
| Runner Legs / Pulse Core / Lancer Arm / Buckler Arm | 67.2s | ✅ |
| Siege Legs / Pulse Core / Hatchet Arm / Spotter Arm | 67.2s | ✅ |
| Siege Legs / Pulse Core / Hatchet Arm / Buckler Arm | 67.2s | ✅ |
| Siege Legs / Pulse Core / Lancer Arm / Spotter Arm | 67.2s | ✅ |
| Siege Legs / Pulse Core / Lancer Arm / Buckler Arm | 67.2s | ✅ |
| Siege Legs / Furnace Core / Hatchet Arm / Spotter Arm | 67.2s | ✅ |
| Siege Legs / Furnace Core / Hatchet Arm / Buckler Arm | 67.2s | ✅ |
| Siege Legs / Furnace Core / Lancer Arm / Spotter Arm | 67.2s | ✅ |
| Siege Legs / Furnace Core / Lancer Arm / Buckler Arm | 67.2s | ✅ |
| Runner Legs / Furnace Core / Hatchet Arm / Spotter Arm | 67.4s | ✅ |
| Runner Legs / Furnace Core / Lancer Arm / Buckler Arm | 67.4s | ✅ |
| Runner Legs / Furnace Core / Lancer Arm / Spotter Arm | 64.4s | ✅ |
| Runner Legs / Furnace Core / Hatchet Arm / Buckler Arm | 65.4s | ✅ |

## Per HAUNT LV (baseline, 200 seeds × 16 builds per LV)

| LV | Win rate % | Median s | Max build dev pp | Timeouts |
|---:|---:|---:|---:|---:|
| 1 | 100.0 | 52.4 | 0.0 | 0 |
| 2 | 93.3 | 64.8 | 6.3 | 0 |
| 3 | 84.6 | 70.5 | 9.6 | 0 |
| 4 | 77.0 | 74.5 | 10.0 | 0 |
| 5 | 47.3 | 73.9 | 9.7 | 0 |
## Strategy probes

| LV | baseline % | dashSpam % | camp % | reactive % | dashSpam − baseline pp | camp − baseline pp | dashSpam − reactive pp |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 100.0 | 100.0 | 0.0 | 100.0 | +0.0 | -100.0 | +0.0 |
| 2 | 93.3 | 98.5 | 0.0 | 100.0 | +5.2 | -93.3 | -1.5 |
| 3 | 84.6 | 94.8 | 0.0 | 99.8 | +10.2 | -84.6 | -5.1 |
| 4 | 77.0 | 93.2 | 0.0 | 99.6 | +16.2 | -77.0 | -6.4 |
| 5 | 47.3 | 88.3 | 0.0 | 99.4 | +41.0 | -47.3 | -11.1 |
