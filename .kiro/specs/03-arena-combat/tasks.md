# 03-arena-combat — Tasks

- [x] 1. Combat config constants and arena data (R1, R5)
- [x] 2. `applyDamage` + unit tests: clamp to 0, PBT any sequence (R3, R5)
- [x] 3. `createProjectile` / `stepProjectile` / wall destroy + tests (R3)
- [x] 4. `createMech` / `moveMech` / `aimMech` with speed-penalty integration (R2)
- [x] 5. Player fire: LMB spawn projectile, 300 ms cooldown (R3)
- [x] 6. Enemy CHASE/SHOOT state machine + enemy fire cooldown (R4)
- [x] 7. Projectile–mech hit test, damage routing, phase transitions win/lose (R5, R6)
- [x] 8. Arena wall collision for mechs and projectiles (R1)
- [x] 9. Renderer: world layer (floor grid + walls), entity layer (mechs + projectiles) (R1, R4, R7)
- [x] 10. HUD: player HP bar ≥ 7:1 contrast, enemy HP bar above sprite (R5, R7)
- [x] 11. Win/lose overlay: keyboard (Enter/Space) + click restart, ember focus ring (R6, R7)
- [x] 12. `createArena` / `updateArena` wired into engine loop hooks (R1–R6)
- [x] 13. Reduced-motion shake cap honored in camera during combat (R7)
- [x] 14. Integration smoke test: arena ticks without errors, win/lose fire correctly (R6)

## Preview feedback 11/2 (one UI concern per task, ~4–6 credit runs)
- [x] 15. MUST End card: VICTORY/DESTROYED panel, cause + time survived, RETRY (default focus, Enter) + GARAGE buttons, keep restart guard, text fits at 1280x800 (R8)
- [x] 16. MUST Fixed bottom-left HUD: HP, EN, cooldown ring, POWER OK/STUTTER, ≥20px tabular, ≥7:1; enemy bar label "HP" (R9)
- [x] 17. MUST Hit feedback: 80 ms flash, floating damage numbers, 2–4 px player kick off under reduced motion (R10, closes task 13)
- [x] 18. MUST Enemy shots bigger, blood-red, short trail (R10)
- [x] 19. MUST Body clamp to wall (radius-aware) + 2 px dim wall + faint grid + start camera framing arena, with a clamp unit test (R11)
- [x] 20. SHOULD Overdraw stutter: pulsing POWER tag + skipping ring (R12)

## Checkpoint fixes 11/5 (hardening of landed tasks; keep tests green)
- [x] 21. Hit-flash re-trigger rate limit (FLASH_RETRIGGER_MS/shouldCreateFlash/maybeCreateFlash) + unit tests, so bursts never strobe (R10, a11y rule 4)
- [x] 22. Overhead HP-bar label readable on any fill: ≥12px bold, drawn above the bar with a 2px void stroke under the fill (task 10 polish, a11y rules 1 & 8)
- [x] 23. STUTTER POWER tag pulse floor raised to 0.7 (0.7 + 0.3·pulse) so the word never dims below readable (task 20 polish, a11y rule 1)
- [x] 24. Favicon: real favicon.svg in repo root + `<link rel="icon">` in index.html (removes 404)

## feel 11/5 — combat feel (target: a winnable 60–120 s duel; keep tests green)
- [x] 25. Enemy HP 900 → 400 (`ENEMY_MAX_HP`) so a clean build lands the kill inside the duel window (R5). Tests read `ENEMY_MAX_HP` symbolically, so they track the new value.
- [x] 26. Enemy shot windup ~0.45 s: `ENEMY_SHOT_WINDUP_MS=450`; enemy enters a windup (telegraph flag `enemy.windupRemainingMs > 0`) before firing, projectile only spawns when the windup completes; red glow telegraph in `combatRenderer` (R4, a11y rules 4 & 6). Unit test: windup delays the shot by ~450 ms.
- [x] 27. Real dash on Shift: 0.18 s burst at 3× move speed with a 100 ms input buffer; cooldown by weight class — light 2.5 s (loadPct ≤ 80) / mid 3.5 s (≤ 100) / heavy 4.5 s (> 100), mirroring the weight.js 80/100 bands; `dashRemainingMs`/`dashCooldownMs` on the player (R2). Expect-style test asserts measured dash duration ≈ 0.18 s and the cooldown bands.
- [x] 28. Overdraw actually slows fire rate: when the build is overdrawn, the player fire cooldown is multiplied by `1 + overdrawPenaltyPct/100` (fire rate scaled by output/draw) through the arena fire path (R4). Test: shots-per-second is strictly slower under overdraw than a balanced build.

## feel 11/5 — balance instrumentation (report-only; no retune this pass)
- [x] 29. Headless AI-vs-AI balance tester (tests/CI only, no UI/renderer). `tests/combat/balanceCore.mjs` (seeded mulberry32 RNG, legal-loadout enumeration, scripted strafe/aim/fire/dash player policy, `runFight`/`runMatrix`, per-build aggregation, markdown `buildReport`). `tests/combat/balance.mjs` runs ~256 seeded deterministic duels (16 legal builds × 16 seeds, 180 s cap) and writes `tests/combat/BALANCE.md` + `(team copy) BALANCE.md` with a summary table, flagged builds (win rate > 60%), and duel-length stats vs the 60–120 s target. `tests/combat/balance.test.js` is an 8-fight smoke under `npm test` (asserts RNG determinism, legal-build enumeration, winRate = wins/fights, recorded duel lengths, flagged-list array). Run the full report with `npm run test:balance`. NOTE: outlier retunes come *after* reading the report — this pass measures only.
- [x] 30. Balance-harness fix (PLAN item A, no combat-number retune): `playerPolicy` now **leads the shot** instead of aiming at the enemy's current position, which made strafing shots miss and timed almost every duel out at the 180 s cap. New pure `leadAim(shooter, target, vel, projSpeed)` solves the constant-speed intercept quadratic; the policy estimates enemy velocity by finite difference from last tick's position (threaded via `runFight` → `ctx.prevEnemy`/`ctx.dt`), falling back to the known perpendicular `ENEMY_STRAFE_SPEED` on tick 0. Deterministic and seeded (unchanged RNG stream). Smoke tests extended: `leadAim` intercept geometry (flight distance == aim distance; aim biases toward target motion), stationary-target passthrough, and a matrix assertion that duels resolve (not all timeouts) with most builds' median duel length < the 180 s cap. No `src/combat/*` numbers changed.
