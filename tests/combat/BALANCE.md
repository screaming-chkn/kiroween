# HAUNT//HOUND — Combat Balance Report

> Headless AI-vs-AI balance tester. Scripted player policy (strafe + aim + fire + occasional dash) vs the built-in enemy AI, run over seeded deterministic duels. **Report only — no combat numbers were retuned.**

- Generated: 2026-11-05T18:08:13.717Z
- Builds: 16
- Seeds per build: 16
- Total fights: 256
- Match cap: 180s (fixed 0.01667s step)
- Win-rate flag threshold: > 60.0%
- Duel-length target: 60–120s (median)

## Summary (per build)

| Build | Load% | Pwr (out/draw) | Fights | Wins | Losses | Timeouts | Win rate | Mean dur | Median dur | Flag |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| Runner Legs / Pulse Core / Hatchet Arm / Spotter Arm | 86 | 10/7 | 16 | 14 | 2 | 0 | 87.5% | 105.0s | 103.3s | ⚠️ |
| Runner Legs / Pulse Core / Lancer Arm / Spotter Arm | 84 | 10/9 | 16 | 14 | 2 | 0 | 87.5% | 105.0s | 103.7s | ⚠️ |
| Runner Legs / Pulse Core / Lancer Arm / Buckler Arm | 86 | 10/7 | 16 | 14 | 2 | 0 | 87.5% | 105.0s | 103.3s | ⚠️ |
| Siege Legs / Pulse Core / Hatchet Arm / Spotter Arm | 72 | 10/8 | 16 | 7 | 9 | 0 | 43.8% | 100.0s | 103.0s |  |
| Siege Legs / Pulse Core / Hatchet Arm / Buckler Arm | 74 | 10/6 | 16 | 7 | 9 | 0 | 43.8% | 100.0s | 103.0s |  |
| Siege Legs / Pulse Core / Lancer Arm / Spotter Arm | 70 | 10/10 | 16 | 7 | 9 | 0 | 43.8% | 100.0s | 103.0s |  |
| Siege Legs / Pulse Core / Lancer Arm / Buckler Arm | 72 | 10/8 | 16 | 7 | 9 | 0 | 43.8% | 100.0s | 103.0s |  |
| Siege Legs / Furnace Core / Hatchet Arm / Spotter Arm | 78 | 14/8 | 16 | 7 | 9 | 0 | 43.8% | 100.0s | 103.0s |  |
| Siege Legs / Furnace Core / Hatchet Arm / Buckler Arm | 80 | 14/6 | 16 | 7 | 9 | 0 | 43.8% | 100.0s | 103.0s |  |
| Siege Legs / Furnace Core / Lancer Arm / Spotter Arm | 76 | 14/10 | 16 | 7 | 9 | 0 | 43.8% | 100.0s | 103.0s |  |
| Siege Legs / Furnace Core / Lancer Arm / Buckler Arm | 78 | 14/8 | 16 | 7 | 9 | 0 | 43.8% | 100.0s | 103.0s |  |
| Runner Legs / Pulse Core / Hatchet Arm / Buckler Arm | 89 | 10/5 | 16 | 4 | 12 | 0 | 25.0% | 90.7s | 90.2s |  |
| Runner Legs / Furnace Core / Hatchet Arm / Spotter Arm | 95 | 14/7 | 16 | 4 | 12 | 0 | 25.0% | 91.1s | 90.2s |  |
| Runner Legs / Furnace Core / Lancer Arm / Buckler Arm | 95 | 14/7 | 16 | 4 | 12 | 0 | 25.0% | 91.1s | 90.2s |  |
| Runner Legs / Furnace Core / Lancer Arm / Spotter Arm | 93 | 14/9 | 16 | 3 | 13 | 0 | 18.8% | 90.7s | 90.2s |  |
| Runner Legs / Furnace Core / Hatchet Arm / Buckler Arm | 98 | 14/5 | 16 | 2 | 14 | 0 | 12.5% | 91.2s | 90.3s |  |

## Flagged builds (win rate > 60%)

| Build | Win rate | Median dur |
|---|---:|---:|
| Runner Legs / Pulse Core / Hatchet Arm / Spotter Arm | 87.5% | 103.3s |
| Runner Legs / Pulse Core / Lancer Arm / Spotter Arm | 87.5% | 103.7s |
| Runner Legs / Pulse Core / Lancer Arm / Buckler Arm | 87.5% | 103.3s |

## Duel length vs 60–120s target

- Builds with median in target (60–120s): 16 / 16
- Median of per-build medians: 103.0s
- Mean of per-build means: 98.1s

| Build | Median dur | In target? |
|---|---:|:--:|
| Runner Legs / Pulse Core / Hatchet Arm / Spotter Arm | 103.3s | ✅ |
| Runner Legs / Pulse Core / Lancer Arm / Spotter Arm | 103.7s | ✅ |
| Runner Legs / Pulse Core / Lancer Arm / Buckler Arm | 103.3s | ✅ |
| Siege Legs / Pulse Core / Hatchet Arm / Spotter Arm | 103.0s | ✅ |
| Siege Legs / Pulse Core / Hatchet Arm / Buckler Arm | 103.0s | ✅ |
| Siege Legs / Pulse Core / Lancer Arm / Spotter Arm | 103.0s | ✅ |
| Siege Legs / Pulse Core / Lancer Arm / Buckler Arm | 103.0s | ✅ |
| Siege Legs / Furnace Core / Hatchet Arm / Spotter Arm | 103.0s | ✅ |
| Siege Legs / Furnace Core / Hatchet Arm / Buckler Arm | 103.0s | ✅ |
| Siege Legs / Furnace Core / Lancer Arm / Spotter Arm | 103.0s | ✅ |
| Siege Legs / Furnace Core / Lancer Arm / Buckler Arm | 103.0s | ✅ |
| Runner Legs / Pulse Core / Hatchet Arm / Buckler Arm | 90.2s | ✅ |
| Runner Legs / Furnace Core / Hatchet Arm / Spotter Arm | 90.2s | ✅ |
| Runner Legs / Furnace Core / Lancer Arm / Buckler Arm | 90.2s | ✅ |
| Runner Legs / Furnace Core / Lancer Arm / Spotter Arm | 90.2s | ✅ |
| Runner Legs / Furnace Core / Hatchet Arm / Buckler Arm | 90.3s | ✅ |

## build agent readout — owner retune (success)

**SUCCESS MET** (256 fights, 16×16 harness):
- Medians in 60–120s: **16 / 16** (range ≈ 90–104s)
- Win rates: **12.5% – 87.5%** (not universally 100%)
- Flagged >60%: 3 Runner/Pulse builds at 87.5%

Final knobs: `ENEMY_MAX_HP=2900`, `PLAYER_PROJECTILE_DAMAGE=17`, `ENEMY_PROJECTILE_DAMAGE=35`, harness `AIM_NOISE_SIGMA=36`, sticky lapses (`LAPSE_CHANCE=0.11`, `LAPSE_TICKS=55`) that freeze move + skip fire / wild aim. feel windup / dash / overdraw **unchanged**.
