# HAUNT//HOUND — Combat Balance Report

> Headless AI-vs-AI balance tester. Scripted player policy (strafe + aim + fire + occasional dash) vs the built-in enemy AI, run over seeded deterministic duels. **Report only — no combat numbers were retuned.**

- Generated: 2026-11-05T17:42:54.534Z
- Builds: 16
- Seeds per build: 16
- Total fights: 256
- Match cap: 180s (fixed 0.01667s step)
- Win-rate flag threshold: > 60.0%
- Duel-length target: 60–120s (median)

## Summary (per build)

| Build | Load% | Pwr (out/draw) | Fights | Wins | Losses | Timeouts | Win rate | Mean dur | Median dur | Flag |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| Runner Legs / Pulse Core / Hatchet Arm / Spotter Arm | 86 | 10/7 | 16 | 16 | 0 | 0 | 100.0% | 7.3s | 7.2s | ⚠️ |
| Runner Legs / Pulse Core / Hatchet Arm / Buckler Arm | 89 | 10/5 | 16 | 16 | 0 | 0 | 100.0% | 7.3s | 7.2s | ⚠️ |
| Runner Legs / Pulse Core / Lancer Arm / Spotter Arm | 84 | 10/9 | 16 | 16 | 0 | 0 | 100.0% | 7.3s | 7.2s | ⚠️ |
| Runner Legs / Pulse Core / Lancer Arm / Buckler Arm | 86 | 10/7 | 16 | 16 | 0 | 0 | 100.0% | 7.3s | 7.2s | ⚠️ |
| Runner Legs / Furnace Core / Hatchet Arm / Spotter Arm | 95 | 14/7 | 16 | 16 | 0 | 0 | 100.0% | 7.3s | 7.2s | ⚠️ |
| Runner Legs / Furnace Core / Hatchet Arm / Buckler Arm | 98 | 14/5 | 16 | 16 | 0 | 0 | 100.0% | 7.3s | 7.2s | ⚠️ |
| Runner Legs / Furnace Core / Lancer Arm / Spotter Arm | 93 | 14/9 | 16 | 16 | 0 | 0 | 100.0% | 7.3s | 7.2s | ⚠️ |
| Runner Legs / Furnace Core / Lancer Arm / Buckler Arm | 95 | 14/7 | 16 | 16 | 0 | 0 | 100.0% | 7.3s | 7.2s | ⚠️ |
| Siege Legs / Pulse Core / Hatchet Arm / Spotter Arm | 72 | 10/8 | 16 | 16 | 0 | 0 | 100.0% | 7.4s | 7.5s | ⚠️ |
| Siege Legs / Pulse Core / Hatchet Arm / Buckler Arm | 74 | 10/6 | 16 | 16 | 0 | 0 | 100.0% | 7.4s | 7.5s | ⚠️ |
| Siege Legs / Pulse Core / Lancer Arm / Spotter Arm | 70 | 10/10 | 16 | 16 | 0 | 0 | 100.0% | 7.4s | 7.5s | ⚠️ |
| Siege Legs / Pulse Core / Lancer Arm / Buckler Arm | 72 | 10/8 | 16 | 16 | 0 | 0 | 100.0% | 7.4s | 7.5s | ⚠️ |
| Siege Legs / Furnace Core / Hatchet Arm / Spotter Arm | 78 | 14/8 | 16 | 16 | 0 | 0 | 100.0% | 7.4s | 7.5s | ⚠️ |
| Siege Legs / Furnace Core / Hatchet Arm / Buckler Arm | 80 | 14/6 | 16 | 16 | 0 | 0 | 100.0% | 7.4s | 7.5s | ⚠️ |
| Siege Legs / Furnace Core / Lancer Arm / Spotter Arm | 76 | 14/10 | 16 | 16 | 0 | 0 | 100.0% | 7.4s | 7.5s | ⚠️ |
| Siege Legs / Furnace Core / Lancer Arm / Buckler Arm | 78 | 14/8 | 16 | 16 | 0 | 0 | 100.0% | 7.4s | 7.5s | ⚠️ |

## Flagged builds (win rate > 60%)

| Build | Win rate | Median dur |
|---|---:|---:|
| Runner Legs / Pulse Core / Hatchet Arm / Spotter Arm | 100.0% | 7.2s |
| Runner Legs / Pulse Core / Hatchet Arm / Buckler Arm | 100.0% | 7.2s |
| Runner Legs / Pulse Core / Lancer Arm / Spotter Arm | 100.0% | 7.2s |
| Runner Legs / Pulse Core / Lancer Arm / Buckler Arm | 100.0% | 7.2s |
| Runner Legs / Furnace Core / Hatchet Arm / Spotter Arm | 100.0% | 7.2s |
| Runner Legs / Furnace Core / Hatchet Arm / Buckler Arm | 100.0% | 7.2s |
| Runner Legs / Furnace Core / Lancer Arm / Spotter Arm | 100.0% | 7.2s |
| Runner Legs / Furnace Core / Lancer Arm / Buckler Arm | 100.0% | 7.2s |
| Siege Legs / Pulse Core / Hatchet Arm / Spotter Arm | 100.0% | 7.5s |
| Siege Legs / Pulse Core / Hatchet Arm / Buckler Arm | 100.0% | 7.5s |
| Siege Legs / Pulse Core / Lancer Arm / Spotter Arm | 100.0% | 7.5s |
| Siege Legs / Pulse Core / Lancer Arm / Buckler Arm | 100.0% | 7.5s |
| Siege Legs / Furnace Core / Hatchet Arm / Spotter Arm | 100.0% | 7.5s |
| Siege Legs / Furnace Core / Hatchet Arm / Buckler Arm | 100.0% | 7.5s |
| Siege Legs / Furnace Core / Lancer Arm / Spotter Arm | 100.0% | 7.5s |
| Siege Legs / Furnace Core / Lancer Arm / Buckler Arm | 100.0% | 7.5s |

## Duel length vs 60–120s target

- Builds with median in target (60–120s): 0 / 16
- Median of per-build medians: 7.3s
- Mean of per-build means: 7.4s

| Build | Median dur | In target? |
|---|---:|:--:|
| Runner Legs / Pulse Core / Hatchet Arm / Spotter Arm | 7.2s | — |
| Runner Legs / Pulse Core / Hatchet Arm / Buckler Arm | 7.2s | — |
| Runner Legs / Pulse Core / Lancer Arm / Spotter Arm | 7.2s | — |
| Runner Legs / Pulse Core / Lancer Arm / Buckler Arm | 7.2s | — |
| Runner Legs / Furnace Core / Hatchet Arm / Spotter Arm | 7.2s | — |
| Runner Legs / Furnace Core / Hatchet Arm / Buckler Arm | 7.2s | — |
| Runner Legs / Furnace Core / Lancer Arm / Spotter Arm | 7.2s | — |
| Runner Legs / Furnace Core / Lancer Arm / Buckler Arm | 7.2s | — |
| Siege Legs / Pulse Core / Hatchet Arm / Spotter Arm | 7.5s | — |
| Siege Legs / Pulse Core / Hatchet Arm / Buckler Arm | 7.5s | — |
| Siege Legs / Pulse Core / Lancer Arm / Spotter Arm | 7.5s | — |
| Siege Legs / Pulse Core / Lancer Arm / Buckler Arm | 7.5s | — |
| Siege Legs / Furnace Core / Hatchet Arm / Spotter Arm | 7.5s | — |
| Siege Legs / Furnace Core / Hatchet Arm / Buckler Arm | 7.5s | — |
| Siege Legs / Furnace Core / Lancer Arm / Spotter Arm | 7.5s | — |
| Siege Legs / Furnace Core / Lancer Arm / Buckler Arm | 7.5s | — |

## build agent readout (after lead-aim harness fix)

- **Win-rate outliers:** ALL 16 builds flagged (100% win rate). No single-build outlier — the scripted lead-aim policy dominates the enemy before its 0.45s windup cycle can matter.
- **Duel length vs 60–120s:** **FAIL.** Median ≈ **7.2–7.5 s** (far below target). Earlier no-lead policy timed out at 180s; lead-aim overcorrects.
- **Outlier fixes:** NOT applied. PLAN item A hard cap was 10 Kiro credits; this item burned ≈9.6. Remaining ≈0.4 is too small for a combat retune. Recommended follow-up (separate budget): raise `ENEMY_MAX_HP` and/or reduce player DPS / add aim noise so scripted medians land in 60–120s without 100% win rates.
