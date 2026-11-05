# HAUNT//HOUND — Combat Balance Report

> Headless AI-vs-AI balance tester. Scripted player policy (strafe + aim + fire + occasional dash) vs the built-in enemy AI, run over seeded deterministic duels. **Report only — no combat numbers were retuned.**

- Generated: 2026-11-05T19:10:42.676Z
- Builds: 16
- Seeds per build: 16
- Total fights: 256
- Match cap: 180s (fixed 0.01667s step)
- Win-rate flag threshold: > 60.0%
- Duel-length target: 60–120s (median)

## Summary (per build)

| Build | Load% | Pwr (out/draw) | Fights | Wins | Losses | Timeouts | Win rate | Mean dur | Median dur | Flag |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| Runner Legs / Pulse Core / Hatchet Arm / Spotter Arm | 77 | 10/7 | 16 | 16 | 0 | 0 | 100.0% | 52.8s | 52.6s | ⚠️ |
| Runner Legs / Pulse Core / Hatchet Arm / Buckler Arm | 79 | 10/5 | 16 | 16 | 0 | 0 | 100.0% | 52.8s | 52.6s | ⚠️ |
| Runner Legs / Pulse Core / Lancer Arm / Spotter Arm | 74 | 10/9 | 16 | 16 | 0 | 0 | 100.0% | 52.8s | 52.6s | ⚠️ |
| Runner Legs / Pulse Core / Lancer Arm / Buckler Arm | 77 | 10/7 | 16 | 16 | 0 | 0 | 100.0% | 52.8s | 52.6s | ⚠️ |
| Runner Legs / Furnace Core / Hatchet Arm / Spotter Arm | 84 | 14/7 | 16 | 16 | 0 | 0 | 100.0% | 52.7s | 51.8s | ⚠️ |
| Runner Legs / Furnace Core / Hatchet Arm / Buckler Arm | 87 | 14/5 | 16 | 16 | 0 | 0 | 100.0% | 52.6s | 52.1s | ⚠️ |
| Runner Legs / Furnace Core / Lancer Arm / Spotter Arm | 82 | 14/9 | 16 | 16 | 0 | 0 | 100.0% | 52.6s | 51.8s | ⚠️ |
| Runner Legs / Furnace Core / Lancer Arm / Buckler Arm | 84 | 14/7 | 16 | 16 | 0 | 0 | 100.0% | 52.7s | 51.8s | ⚠️ |
| Siege Legs / Pulse Core / Hatchet Arm / Spotter Arm | 72 | 10/8 | 16 | 16 | 0 | 0 | 100.0% | 52.8s | 52.6s | ⚠️ |
| Siege Legs / Pulse Core / Hatchet Arm / Buckler Arm | 74 | 10/6 | 16 | 16 | 0 | 0 | 100.0% | 52.8s | 52.6s | ⚠️ |
| Siege Legs / Pulse Core / Lancer Arm / Spotter Arm | 70 | 10/10 | 16 | 16 | 0 | 0 | 100.0% | 52.8s | 52.6s | ⚠️ |
| Siege Legs / Pulse Core / Lancer Arm / Buckler Arm | 72 | 10/8 | 16 | 16 | 0 | 0 | 100.0% | 52.8s | 52.6s | ⚠️ |
| Siege Legs / Furnace Core / Hatchet Arm / Spotter Arm | 78 | 14/8 | 16 | 16 | 0 | 0 | 100.0% | 52.8s | 52.6s | ⚠️ |
| Siege Legs / Furnace Core / Hatchet Arm / Buckler Arm | 80 | 14/6 | 16 | 16 | 0 | 0 | 100.0% | 52.8s | 52.6s | ⚠️ |
| Siege Legs / Furnace Core / Lancer Arm / Spotter Arm | 76 | 14/10 | 16 | 16 | 0 | 0 | 100.0% | 52.8s | 52.6s | ⚠️ |
| Siege Legs / Furnace Core / Lancer Arm / Buckler Arm | 78 | 14/8 | 16 | 16 | 0 | 0 | 100.0% | 52.8s | 52.6s | ⚠️ |

## Flagged builds (win rate > 60%)

| Build | Win rate | Median dur |
|---|---:|---:|
| Runner Legs / Pulse Core / Hatchet Arm / Spotter Arm | 100.0% | 52.6s |
| Runner Legs / Pulse Core / Hatchet Arm / Buckler Arm | 100.0% | 52.6s |
| Runner Legs / Pulse Core / Lancer Arm / Spotter Arm | 100.0% | 52.6s |
| Runner Legs / Pulse Core / Lancer Arm / Buckler Arm | 100.0% | 52.6s |
| Runner Legs / Furnace Core / Hatchet Arm / Spotter Arm | 100.0% | 51.8s |
| Runner Legs / Furnace Core / Hatchet Arm / Buckler Arm | 100.0% | 52.1s |
| Runner Legs / Furnace Core / Lancer Arm / Spotter Arm | 100.0% | 51.8s |
| Runner Legs / Furnace Core / Lancer Arm / Buckler Arm | 100.0% | 51.8s |
| Siege Legs / Pulse Core / Hatchet Arm / Spotter Arm | 100.0% | 52.6s |
| Siege Legs / Pulse Core / Hatchet Arm / Buckler Arm | 100.0% | 52.6s |
| Siege Legs / Pulse Core / Lancer Arm / Spotter Arm | 100.0% | 52.6s |
| Siege Legs / Pulse Core / Lancer Arm / Buckler Arm | 100.0% | 52.6s |
| Siege Legs / Furnace Core / Hatchet Arm / Spotter Arm | 100.0% | 52.6s |
| Siege Legs / Furnace Core / Hatchet Arm / Buckler Arm | 100.0% | 52.6s |
| Siege Legs / Furnace Core / Lancer Arm / Spotter Arm | 100.0% | 52.6s |
| Siege Legs / Furnace Core / Lancer Arm / Buckler Arm | 100.0% | 52.6s |

## Duel length vs 60–120s target

- Builds with median in target (60–120s): 0 / 16
- Median of per-build medians: 52.6s
- Mean of per-build means: 52.8s

| Build | Median dur | In target? |
|---|---:|:--:|
| Runner Legs / Pulse Core / Hatchet Arm / Spotter Arm | 52.6s | — |
| Runner Legs / Pulse Core / Hatchet Arm / Buckler Arm | 52.6s | — |
| Runner Legs / Pulse Core / Lancer Arm / Spotter Arm | 52.6s | — |
| Runner Legs / Pulse Core / Lancer Arm / Buckler Arm | 52.6s | — |
| Runner Legs / Furnace Core / Hatchet Arm / Spotter Arm | 51.8s | — |
| Runner Legs / Furnace Core / Hatchet Arm / Buckler Arm | 52.1s | — |
| Runner Legs / Furnace Core / Lancer Arm / Spotter Arm | 51.8s | — |
| Runner Legs / Furnace Core / Lancer Arm / Buckler Arm | 51.8s | — |
| Siege Legs / Pulse Core / Hatchet Arm / Spotter Arm | 52.6s | — |
| Siege Legs / Pulse Core / Hatchet Arm / Buckler Arm | 52.6s | — |
| Siege Legs / Pulse Core / Lancer Arm / Spotter Arm | 52.6s | — |
| Siege Legs / Pulse Core / Lancer Arm / Buckler Arm | 52.6s | — |
| Siege Legs / Furnace Core / Hatchet Arm / Spotter Arm | 52.6s | — |
| Siege Legs / Furnace Core / Hatchet Arm / Buckler Arm | 52.6s | — |
| Siege Legs / Furnace Core / Lancer Arm / Spotter Arm | 52.6s | — |
| Siege Legs / Furnace Core / Lancer Arm / Buckler Arm | 52.6s | — |

## feel-pass readout (owner GO, 11/5)

Combat knobs applied: `ENEMY_MAX_HP=1400`, `ENEMY_PROJECTILE_DAMAGE=20`, windup/dash/fire CD unchanged. Default Scout loadPct≈76.7% (runner capacity 90) → light 2.5s dash.

**16×16 harness:** all builds still 100% win, medians ≈52s (below 60–120 band — expected after HP cut; harness lead-aim remains strong).

**sim2.mjs vs feel targets:**
| Case | Target | Measured | Verdict |
|---|---|---|---|
| strafe-no-dash | LOSE ~90s | WIN 28.1s @ 160 HP | **FAIL** (too fast) |
| strafe+dash | WIN 60–100s, 30–50% HP | WIN 29.0s @ 220 HP (73%) | **FAIL** (too fast / too healthy) |
| idle | die | LOSE 31.1s | OK shape |
| windup | 450ms | 450ms | PASS |
| dash light/mid/heavy CD | 2.5/3.5/4.5s | 2517/3517/4517ms | PASS |

Gap: with lead-aim + player dmg 17, 1400 HP melts in ~28s. Closing the gap needs another GO (raise HP again and/or cut player DPS) — not done here (package numbers locked).
