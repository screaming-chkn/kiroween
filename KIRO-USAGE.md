# Kiroween: Kiro usage log

How Kiro (its .kiro specs, steering and hooks, and the kiro-cli runs) was used per milestone. Kept honest for the Devpost write-up. The master copy is the team's working copy on the crew box; the repo-root KIRO-USAGE.md is a synced copy. The Kiro IDE was never used by the crew; every logged Kiro run is the headless kiro-cli.

## M1: real SFX (2026-11-18, build agent) — PR #1, squash 369fdaf
- Kiro used: **no**. Built and tested with box tools (node, git, gh, headless Chrome). No Kiro credits spent.
- .kiro specs/steering/hooks: **not used or changed**. Earlier spec tasks are the source for some of the design: R4 audio buses (`audio.js`) and the ENEMY_SHOT_WINDUP_MS 450 ms tell. No .kiro file was edited.
- Follow-up: the steering/README rewrite (planned) should add a short SFX note so the spec matches the code.

## M2: game feel, title, pause, settings (2026-11-18, build agent) — PR #2, squash ccf67d9
- Kiro IDE used: **no**. No Kiro credits spent. Built with box tools (node, git, gh, headless Chrome).
- .kiro specs: **added `.kiro/specs/10-polish/` (requirements.md, design.md, tasks.md) covering M1–M5.** These spec files were written by build agent outside the Kiro IDE (by hand, in the format of the existing specs 01–08). Kiro did not generate them. M1 and M2 tasks (1–13) are marked done; M3–M5 (14–18) are open.
- `public/seance-tasks.json` rebuilt with the repo's own `npm run build:seance` script, so the séance screen lists 10-polish (159 tasks, 131 done).
- Steering and hooks: not changed. `.kiro/hooks/test-on-save.json` was not run, because work happened outside the IDE; `npm test` was run by hand instead.
- `.kiro/` stays committed (it is not in .gitignore).

## M3: music, fonts, page weight (2026-11-18, build agent) — PR #3, squash 26a0677
- Kiro IDE used: **no**, and no Kiro credits spent. Built with box tools (node, git, gh, npm pack for the fonts, headless Chrome).
- .kiro specs: I updated `.kiro/specs/10-polish/` by hand, outside the Kiro IDE. tasks.md marks M3 done (14, 15, plus new 19–22). requirements.md R5 and design.md describe music.js and fonts.js. I rebuilt `public/seance-tasks.json` with `npm run build:seance` (163 tasks, 137 done).
- Steering: not edited. The existing `.kiro/steering/design-tokens.md` rule ("Self-hosted, OFL license in repo") is the requirement this milestone satisfied.
- Hooks: not run (work happened outside the IDE). I ran `npm test` by hand.
- `.kiro/` stays committed.

## M4: balance (2026-11-18, build agent): PR #4, squash ca6fec8
- **Kiro used: yes**, through `kiro-cli` 3.4.0 in headless chat mode and not in the IDE. Every run used model **Auto** (never Sonnet), `--no-interactive`, and `--trust-tools=fs_read,fs_write`, so Kiro could not run shell commands. Each run had one focused prompt and no long agent loop.
- **Accounts per step:**
  - Runs 1–2 were on the owner's Mac mini in `~/Projects/kiroween-push`, synced to origin/main 26a0677. Nothing was pushed from the mini. The account was the **Google login**, KIRO FREE, a second Kiro account alongside the original.
  - Runs 3–4 were on the box in a local clone. The account was the **GitHub login**, **Kiro Pro**, which is the original account.
- **Commands** (run from the repo root):
  - Run 1, mini: `kiro-cli chat --no-interactive --model auto --trust-tools=fs_read,fs_write "$(cat prompt1.txt)"`. The prompt asked for the R6 balance spec in `.kiro/specs/10-polish` (requirements, design, tasks), the steering file `.kiro/steering/balance.md`, and two hooks.
  - Run 2, mini: same command with `prompt2.txt`. The prompt asked to implement tasks 16 and 23: `runFight` opts `hauntLv`/`policy`, `dashSpam`/`camp` probes, `runLevelMatrix`, and per-LV and probe tables in `balance.mjs`.
  - Run 3, box: `kiro-cli chat --no-interactive --model auto --trust-tools=fs_read,fs_write "$(cat prompt3.txt)"`. The prompt asked for the task-25 R6 guard tests in `balance.test.js` and signed probe-delta columns.
  - Run 4, box: same command with `prompt4.txt`. The prompt asked for a tell-reading `reactive` probe (dash in the last 150 ms of the windup), a 48-seed per-LV matrix, a "dashSpam is not dominant" test, and the matching R6/design/steering text.
  - Usage checks before and after each run: `kiro-cli chat --no-interactive "/usage"`.
- **Credits:**
  - Google/free: 0.00 → 2.29 (run 1) → 4.81 (run 2) of 50, resets 2026-12-01. **4.81 used.**
  - GitHub/Pro: 224.46 → 225.11 (run 3) → 226.02 (run 4) of 877, resets 2026-12-01. **1.56 used.**
  - Total for M4: **6.37 credits.**
- **What Kiro authored** (each run's output is committed unedited in its own commit marked "Kiro-authored"):
  - Hooks: `.kiro/hooks/seance-on-spec-save.json`, which rebuilds the séance when a tasks.md is saved, and `.kiro/hooks/balance-on-combat-save.json`, which runs balance.test.js when config.js or hauntLevel.js is saved.
  - Steering: `.kiro/steering/balance.md`, scoped by fileMatch to `src/combat/**`.
  - Spec: 10-polish R6 in requirements.md, design.md "## M4 balance", and tasks 16 and 23–26.
  - Harness: per-LV matrix and probes in `tests/combat/balanceCore.mjs` and `balance.mjs`.
  - Tests: R6 guards in `tests/combat/balance.test.js`.
- **What I edited** (build agent, in separate commits):
  - Kiro inverted the R6 win-rate bands. It wrote LV1 as "10–25 % player wins". I rewrote them as player win rate LV1 85–100 down to LV5 40–60. I later widened LV4 to 50–80 after measuring, and logged that in PLAN.md.
  - In the steering, I fixed the wrong claim that `npm run test:balance` runs balance.test.js, and updated the ramp text.
  - I removed Kiro's dashSpam-vs-tell-blind-baseline test cap, because the deep run shows that edge is real and intended. Dominance is now checked against the reactive probe.
  - I raised the R6 smoke sample to 40 seeds and added `BALANCE_SEEDS`, so the committed BALANCE.md uses 200 seeds.
  - I did all the tuning: `HAUNT_PRESSURE` 0.8/1.0/1.1/1.17/1.2 and `DASH_COOLDOWN_MS.mid` 3000. I updated their unit tests, marked tasks done, rebuilt seance-tasks.json, and wrote the PLAN.md table.
- **Hooks:** the new hooks were not exercised by an IDE, because the work was headless. I ran `npm test` (802 passed) and `npm run build:seance` by hand. `.kiro/` stays committed.

## M5: ship prep (2026-11-18, build agent): PR #5, squash afbd763
- **Kiro used: yes.** Every M5 run was on the box (`kiro-cli` 3.4.0 in a local clone) with the **GitHub login**, **Kiro Pro**. The mini's Google login was not used and is left alone as a backup.
- **Command for each run:** `kiro-cli chat --no-interactive --model auto --trust-tools=fs_read,fs_write "$(cat promptN.txt)"`, run from the repo root. Model was Auto every time (never Sonnet), and Kiro could not run shell commands. `/usage` was checked before and after each run.
- **Runs:**
  - **Run 5** (226.41 → 228.98, **2.57 credits**). Prompt: rewrite steering product/tech/structure for the shipped 1v1 duel; fix accessibility/ui-style lines that cite cut features; reconcile stale spec tasks (CUT (1v1 pivot), or shipped); add 10-polish tasks 27–31 plus R7 EARS bullets and a design "M5 ship" section.
  - **Run 6** (228.98 → 231.40, **2.42 credits**). Prompt: `scripts/build-site.mjs` + `npm run build:site` (static preview, `_headers` noindex, `robots.txt` Disallow, noindex meta on the copied index.html only); `tests/engine/site.test.js` (crawls imports from src/main.js, no dev files); `.kiro/hooks/readme-check-on-save.json` + `scripts/check-readme.mjs` + `tests/engine/readme.test.js`; `.gitignore` with `deploy/` (never `.kiro`).
  - **Run 7** (231.40 → 232.73, **1.33 credits**). Prompt: first draft of README.md (pitch, how to play, Costume Contest, How we used Kiro, balance table, credits, MIT) that passes check-readme.
- **Credits:**
  - M5 total: **6.32 credits.**
  - Pro balance after M5: 232.73 of 877 used, about **644** left; the CLI says it resets 2026-12-01.
  - Gaps between runs: Pro usage read 226.02 at the end of M4 and 226.41 at the start of M5, and 232.73 after run 7 but 232.96 at the final check, with no run in between. That is 0.62 not tied to any run, probably late metering. Counting it, the Pro account is at 232.96 of 877 used, about 644 left.
- **What Kiro authored** (each run committed unedited as "Kiro-authored"):
  - Steering rewrite: product.md, tech.md, structure.md, plus the accessibility.md and ui-style.md line fixes.
  - Spec task reconcile across 02, 04, 05, 06 and 07, and 10-polish tasks 27–31 with R7/design text.
  - build-site.mjs, site.test.js, check-readme.mjs, readme.test.js, the readme-check hook and .gitignore.
  - The README draft.
- **What I edited** (build agent, separate commits):
  - 07 task 4 is now an honest partial (only volume and mute shipped, not the static/shake/colorblind sliders); updated the 05 header; replaced the design-tokens radar lines.
  - README: removed two false claims (settings sliders for static, shake and reduced motion), labelled the balance column "scripted player win %", and replaced Kiro's credits placeholder with the real per-account numbers.
  - Updated the index.html meta description and package.json description to the 1v1 duel.
  - Touch `preventDefault` only on cancelable events (the headless phone pass logged a Chrome intervention).
  - Marked tasks 18 and 27–31 done and rebuilt the séance (172 tasks, 153 done). Task 17 stays open for the deploy and the real-phone test.
- **Hooks:** no IDE save happened, so the hooks did not fire. I ran their commands by hand: `npm test` (821 passed), `npm run build:seance`, `node scripts/check-readme.mjs` (ok, 4 hooks listed). `.kiro/` stays committed.
- **All Kiro use to date:**
  - Google/free account: 4.81 credits (M4 runs 1–2).
  - Pro account: 7.88 credits (M4 runs 3–4 and M5 runs 5–7).
  - Total: 12.69 credits. No credits were bought and no plan or settings were changed.

## M4.5: loadout effects (2026-11-18, build agent): PR #6
- **Kiro used: yes.** All runs were on the box with kiro-cli 3.4.0 and the **GitHub login**, **Kiro Pro**. Same command form as before: `kiro-cli chat --no-interactive --model auto --trust-tools=fs_read,fs_write "$(cat promptN.txt)"`, model Auto (never Sonnet), file tools only.
- **Runs:**
  - **Run 8.** Prompt: add R8 "Loadout effects (M4.5)" EARS requirements, design "## M4.5 loadout effects" and tasks 32–36 to 10-polish, and a new steering file `.kiro/steering/loadout-effects.md` with the effect rules and table.
  - **Run 9.** Prompt: implement R8 / tasks 32–35:
    - the `FEATURES.loadoutEffects` flag
    - `src/combat/loadoutEffects.js` (table, IDENTITY_MODS, combatModsFor, effectTextFor)
    - arena.js applies `combatMods` only when present
    - wiring in main.js and the balance harness
    - the garage `COMBAT:` line
    - `tests/combat/loadoutEffects.test.js`
  - **Run 10.** Prompt: a property-based test file with no dependencies (hand-rolled mulberry32 generator), plus task 37. Kiro wrote `tests/combat/loadoutEffects.pbt.test.js` with 9 properties:
    - order-independent folding
    - identity / disabled → null
    - folding laws
    - exhaustive bounds over all 729 loadouts
    - arena hp/maxHp/dash invariants over random ticks
    - hp never rises or goes below 0, and phase is monotonic
    - applyDamage never heals
    - projectile damage and speed
    - flag-off equivalence
  - All properties passed the first time they ran (0.28 s). No bugs were found.
- **Credits:**
  - Pro usage went 232.96 → 236.57 across runs 8–9. Metering lagged after run 8, so the two can't be split: 3.61 together.
  - Run 10 went 237.11 → 241.14 (4.03), and the final check read 241.47.
  - M4.5 total: **8.51 credits**. The Pro account is at 241.47 of 877, about 635 left, and resets 2026-12-01.
- **What Kiro authored** (each run committed unedited as "Kiro-authored"):
  - the R8 spec, design and tasks 32–37
  - `loadout-effects.md` steering
  - the whole first implementation, its unit tests and the PBT file
- **What I edited** (build agent, separate commits):
  - **Balance retune.** Kiro's first all-upside table (17 dmg, x1.35 shot speed, +25 HP, x0.8 dash, x0.87 reload, x0.88 incoming damage) pushed the 16×200 harness to LV5 ≈ 86 % and LV3 ≈ 98 %, with a 23 pp build gap. I retuned it into sidegrades:
    - Hatchet 18 dmg / reload x1.32
    - Lancer shots x1.4 / reload x1.04
    - Buckler +22 HP / dash x1.5 / reload x1.18
    - Spotter dash x0.85 / reload x1.08
    - Pulse reload x0.95
    - Furnace shots x1.2 / reload x0.97
  - **Harness fix.** The scripted player now leads its aim with the build's real shot speed. Before, faster shots measured as worse because the bot under-led.
  - **Tests.** I rewrote the unit tests to read expected numbers from the table, and added a golden flag-off test: 36 fights recorded on main afbd763 must replay exactly without `combatMods`.
  - **Spec and steering** updated to the tuned table. Marked tasks 17 and 32–37 done and rebuilt the séance.
  - **Docs.** README, DEVPOST and CAPTURE-NOTES updated. KIRO-USAGE.md copied into the repo.
- **Hooks:** no IDE save happened, so the hooks did not fire. I ran their commands by hand: `npm test` (850 passed), `npm run build:seance`, `node scripts/check-readme.mjs`, and `node tests/combat/balance.test.js`.
- **All Kiro use to date:**
  - Google/free account: 4.81 credits (M4 runs 1–2).
  - Pro account: 16.39 run-attributed credits (M4 runs 3–4: 1.56; M5 runs 5–7: 6.32; M4.5 runs 8–10: 8.51), and 0.62 of unattributed metering between checks (M4→M5).
  - Total: 21.20 run-attributed credits. No credits were bought, and no plan or settings were changed.

## M4.6: garage COMBAT text polish (2026-11-18, build agent): PR #7
- **Kiro used: no.** This was a small CSS/markup fix, so Kiro was skipped by design. It used 0 credits, and the account totals are unchanged at 21.20.
- **Cause of the grey text:** the COMBAT line used `var(--color-phosphor)`, which is a possession-themed slot. The garage normally runs in the sterile (unpossessed) palette from `src/ui/possession.js`, which sets that slot to steel grey (#C3CBD2). It turns green only during the séance. This happened on desktop as well as phone; there was no phone media-query override.
- **Fix:** the line now uses the fixed phosphor design token (#39FF88), the same way the green stat-delta chips (`.hh-delta--up`) already do.
- **Layout:** the line now renders as a `COMBAT` label plus short tokens that don't break internally (`effectTokensFor` in `src/combat/loadoutEffects.js`). The tokens wrap within 44ch, and the line-height went from 1.35 to 1.5. Screen readers get the full line through `aria-label`.
- **Tests:** 5 new tests in `tests/ui/garage.test.js`. The hooks did not fire; their commands were run by hand.

## M4.7: garage preview fit under 1280 px (2026-11-18, build agent): PR #8
- **Kiro used: no.** This was a one-line CSS fix, so Kiro was skipped by design. It used 0 credits, and the account totals are unchanged at 21.20.
- **Cause:** below 1280 px, the preview (`.hh-preview`, a flex column) sits in a short grid row (257 px at 1024×640). The default `flex-shrink: 1` squeezed `.hh-preview__art` down to its 120 px min-height. Meanwhile the SVG inside kept its 220 px height and, being centred, spilled about 50 px past the box at the top and bottom.
- **Fix:** `.hh-preview__art { flex-shrink: 0; }`. The box now holds the SVG, and the preview column scrolls as it was already set up to (`overflow-y: auto`). No new breakpoint was added.
- **Tests:** a new CSS-rule test in `tests/ui/garage.test.js`. The hooks did not fire; their commands were run by hand.
