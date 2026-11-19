# Kiroween: Kiro usage log

How Kiro (its .kiro specs, steering and hooks, and the kiro-cli runs) was used per milestone. Kept honest for the Devpost write-up. The master copy lives on the team's build box; this repo-root copy is kept in sync. "Build agent" below is the team's AI coding agent; its edits, and copy from the team's copywriter, are marked separately from Kiro's. The Kiro IDE was never used by the crew; every logged Kiro run is the headless kiro-cli.

Note: this repo was re-created with a cleaned history on 2026-11-18. Commit hashes below point to this repo. PR numbers, and the branch commits ed4b814, 8c74def, 9616e58 and 74743f6 (squashed into main before the re-creation), refer to the original private repo, which is kept as an archive.

## M1: real SFX (2026-11-18, build agent) — PR #1, squash d5b6cf5
- Kiro used: **no**. Built and tested with box tools (node, git, gh, headless Chrome). No Kiro credits spent.
- .kiro specs/steering/hooks: **not used or changed**. Earlier spec tasks are the source for some of the design: R4 audio buses (`audio.js`) and the ENEMY_SHOT_WINDUP_MS 450 ms tell. No .kiro file was edited.
- Follow-up: the steering/README rewrite (planned) should add a short SFX note so the spec matches the code.

## M2: game feel, title, pause, settings (2026-11-18, build agent) — PR #2, squash a396349
- Kiro IDE used: **no**. No Kiro credits spent. Built with box tools (node, git, gh, headless Chrome).
- .kiro specs: **added `.kiro/specs/10-polish/` (requirements.md, design.md, tasks.md) covering M1–M5.** These spec files were written by the build agent outside the Kiro IDE (by hand, in the format of the existing specs 01–08). Kiro did not generate them. M1 and M2 tasks (1–13) are marked done; M3–M5 (14–18) are open.
- `public/seance-tasks.json` rebuilt with the repo's own `npm run build:seance` script, so the séance screen lists 10-polish (159 tasks, 131 done).
- Steering and hooks: not changed. `.kiro/hooks/test-on-save.json` was not run, because work happened outside the IDE; `npm test` was run by hand instead.
- `.kiro/` stays committed (it is not in .gitignore).

## M3: music, fonts, page weight (2026-11-18, build agent) — PR #3, squash db6b7e5
- Kiro IDE used: **no**, and no Kiro credits spent. Built with box tools (node, git, gh, npm pack for the fonts, headless Chrome).
- .kiro specs: I updated `.kiro/specs/10-polish/` by hand, outside the Kiro IDE. tasks.md marks M3 done (14, 15, plus new 19–22). requirements.md R5 and design.md describe music.js and fonts.js. I rebuilt `public/seance-tasks.json` with `npm run build:seance` (163 tasks, 137 done).
- Steering: not edited. The existing `.kiro/steering/design-tokens.md` rule ("Self-hosted, OFL license in repo") is the requirement this milestone satisfied.
- Hooks: not run (work happened outside the IDE). I ran `npm test` by hand.
- `.kiro/` stays committed.

## M4: balance (2026-11-18, build agent): PR #4, squash 369abe1
- **Kiro used: yes**, through `kiro-cli` 3.4.0 in headless chat mode and not in the IDE. Every run used model **Auto** (never Sonnet), `--no-interactive`, and `--trust-tools=fs_read,fs_write`, so Kiro could not run shell commands. Each run had one focused prompt and no long agent loop.
- **Accounts per step:**
  - Runs 1–2 were on the owner's Mac mini in `a local clone`, synced to origin/main db6b7e5. Nothing was pushed from the mini. The account was the **Google login**, KIRO FREE, a second Kiro account alongside the original.
  - Runs 3–4 were on the box in the build box's repo clone. The account was the **GitHub login**, **Kiro Pro**, which is the original account.
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
- **What I edited** (by hand, in separate commits):
  - Kiro inverted the R6 win-rate bands. It wrote LV1 as "10–25 % player wins". I rewrote them as player win rate LV1 85–100 down to LV5 40–60. I later widened LV4 to 50–80 after measuring, and logged that in PLAN.md.
  - In the steering, I fixed the wrong claim that `npm run test:balance` runs balance.test.js, and updated the ramp text.
  - I removed Kiro's dashSpam-vs-tell-blind-baseline test cap, because the deep run shows that edge is real and intended. Dominance is now checked against the reactive probe.
  - I raised the R6 smoke sample to 40 seeds and added `BALANCE_SEEDS`, so the committed BALANCE.md uses 200 seeds.
  - I did all the tuning: `HAUNT_PRESSURE` 0.8/1.0/1.1/1.17/1.2 and `DASH_COOLDOWN_MS.mid` 3000. I updated their unit tests, marked tasks done, rebuilt seance-tasks.json, and wrote the PLAN.md table.
- **Hooks:** the new hooks were not exercised by an IDE, because the work was headless. I ran `npm test` (802 passed) and `npm run build:seance` by hand. `.kiro/` stays committed.

## M5: ship prep (2026-11-18, build agent): PR #5, squash 25887b3
- **Kiro used: yes.** Every M5 run was on the box (`kiro-cli` 3.4.0 in the build box's repo clone) with the **GitHub login**, **Kiro Pro**. The mini's Google login was not used and is left alone as a backup.
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
- **What I edited** (by hand, separate commits):
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
- **What I edited** (by hand, separate commits):
  - **Balance retune.** Kiro's first all-upside table (17 dmg, x1.35 shot speed, +25 HP, x0.8 dash, x0.87 reload, x0.88 incoming damage) pushed the 16×200 harness to LV5 ≈ 86 % and LV3 ≈ 98 %, with a 23 pp build gap. I retuned it into sidegrades:
    - Hatchet 18 dmg / reload x1.32
    - Lancer shots x1.4 / reload x1.04
    - Buckler +22 HP / dash x1.5 / reload x1.18
    - Spotter dash x0.85 / reload x1.08
    - Pulse reload x0.95
    - Furnace shots x1.2 / reload x0.97
  - **Harness fix.** The scripted player now leads its aim with the build's real shot speed. Before, faster shots measured as worse because the bot under-led.
  - **Tests.** I rewrote the unit tests to read expected numbers from the table, and added a golden flag-off test: 36 fights recorded on main 25887b3 must replay exactly without `combatMods`.
  - **Spec and steering** updated to the tuned table. Marked tasks 17 and 32–37 done and rebuilt the séance.
  - **Docs.** README, DEVPOST and CAPTURE-NOTES updated. KIRO-USAGE.md copied into the repo.
- **Hooks:** no IDE save happened, so the hooks did not fire. I ran their commands by hand: `npm test` (850 passed), `npm run build:seance`, `node scripts/check-readme.mjs`, and `node tests/combat/balance.test.js`.
- **All Kiro use to date:**
  - Google/free account: 4.81 credits (M4 runs 1–2).
  - Pro account: **17.01 metered** (224.46 → 241.47). That is 16.39 for runs (M4 runs 3–4: 1.56; M5 runs 5–7: 6.32; M4.5 runs 8–10: 8.51, which already includes the lag inside the M4.5 window) plus 0.62 of metering not tied to any run (0.39 between M4 and M5, and 0.23 after M5).
  - **Total: 21.82 credits metered** = 4.81 + 1.56 + 6.32 + 8.51 + 0.62. The 21.20 figure used earlier left out the 0.62. No credits were bought, and no plan or settings were changed.

## M4.6: garage COMBAT text polish (2026-11-18, build agent): PR #7
- **Kiro used: no.** This was a small CSS/markup fix, so Kiro was skipped by design. It used 0 credits, and the account totals are unchanged at 21.82 metered (corrected; see the M4.8 entry).
- **Cause of the grey text:** the COMBAT line used `var(--color-phosphor)`, which is a possession-themed slot. The garage normally runs in the sterile (unpossessed) palette from `src/ui/possession.js`, which sets that slot to steel grey (#C3CBD2). It turns green only during the séance. This happened on desktop as well as phone; there was no phone media-query override.
- **Fix:** the line now uses the fixed phosphor design token (#39FF88), the same way the green stat-delta chips (`.hh-delta--up`) already do.
- **Layout:** the line now renders as a `COMBAT` label plus short tokens that don't break internally (`effectTokensFor` in `src/combat/loadoutEffects.js`). The tokens wrap within 44ch, and the line-height went from 1.35 to 1.5. Screen readers get the full line through `aria-label`.
- **Tests:** 5 new tests in `tests/ui/garage.test.js`. The hooks did not fire; their commands were run by hand.

## M4.7: garage preview fit under 1280 px (2026-11-18, build agent): PR #8
- **Kiro used: no.** This was a one-line CSS fix, so Kiro was skipped by design. It used 0 credits, and the account totals are unchanged at 21.82 metered (corrected; see the M4.8 entry).
- **Cause:** below 1280 px, the preview (`.hh-preview`, a flex column) sits in a short grid row (257 px at 1024×640). The default `flex-shrink: 1` squeezed `.hh-preview__art` down to its 120 px min-height. Meanwhile the SVG inside kept its 220 px height and, being centred, spilled about 50 px past the box at the top and bottom.
- **Fix:** `.hh-preview__art { flex-shrink: 0; }`. The box now holds the SVG, and the preview column scrolls as it was already set up to (`overflow-y: auto`). No new breakpoint was added.
- **Tests:** a new CSS-rule test in `tests/ui/garage.test.js`. The hooks did not fire; their commands were run by hand.

## M4.8: mouse aim at any DPR, phone aim anchor, BUILD.txt (2026-11-18, build agent): PR #9
- **Kiro used: no.** This was a small input fix, so Kiro was skipped by design. It used 0 credits.
- **Credits correction:** the all-time total is **21.82 credits metered** = Google 4.81 + Pro 17.01. The Pro part is M4 1.56 + M5 6.32 + M4.5 8.51 + 0.62 not tied to any run. Earlier entries said 21.20, which left out the 0.62.
- **Mouse aim cause:** `input.js` stored `offsetX/Y` (CSS px), but `buildPlayerActions` → `screenToWorld` works in canvas backing-store px (CSS px × devicePixelRatio). At DPR 1.5 or 2, aim pointed toward the top-left. The touch path already scaled correctly.
- **Mouse aim fix:** a single `clientToCanvas()` in `src/engine/pointer.js` (rect + canvas.width/rect.width) is now used by mouse aim, touch aim and end-card clicks. Tests cover DPR 1, 1.5 and 2.
- **Phone aim cause:** the FIRE drag is a virtual stick (direction only), which is intended. But the direction was applied around the screen centre, and the phone camera leads toward the enemy, so the tank sits off-centre. That bent the aim by up to about 50°.
- **Phone aim fix:** the aim is now anchored at the tank.
- **BUILD.txt:** `build:site` now writes `BUILD.txt` with the source commit.
- **Hooks:** none fired; their commands were run by hand.

## Kiro #1 probe: CLI v3 fires the workspace hooks (2026-11-18, build agent): branch kiro-v3-hooks
- **Why:** every earlier run used `--no-interactive` without choosing an engine, and `kiro-cli chat --help` says that defaults to the **v2** engine. The Kiro docs (kiro.dev/docs/hooks) say standalone `.kiro/hooks/*.json` files load in the IDE and **CLI V3**, and that file hooks fire only on agent edits. So our hooks never fired.
- **Logging first (build agent, not Kiro, commit 9616e58):** each hook command now runs through `scripts/kiro-hook-run.mjs`, which runs the same command and appends one line to `.kiro/hook-runs.log` (UTC time, hook, event, file, exit code, ms). Test: `tests/engine/hookRun.test.js`.
- **Run 11, box, Pro (GitHub login), model Auto, kiro-cli 3.4.0, engine v3:**
  `kiro-cli chat --agent-engine v3 --trust-workspace --no-interactive --model auto --trust-tools=fs_read,fs_write "<prompt>"`
  - Prompt: append task 38 to `.kiro/specs/10-polish/tasks.md`, edit nothing else, run no shell commands.
  - Started 17:44:44 PT, Kiro exited 0 at 17:44:55 PT. Kiro read the file, then made one "Replace in File" edit.
- **Hook fired:** `seance-on-spec-save` (PostFileSave, matcher `.kiro/specs/*/tasks.md`). Log line: `2026-11-19T01:44:53.504Z seance-on-spec-save event=PostFileSave file=.kiro/specs/10-polish/tasks.md exit=0 ms=213` (17:44:53 PT). It rebuilt `public/seance-tasks.json` at 17:44:53 PT (161/179 done). No other hook matched the edit, so none fired.
- **Commits:** ed4b814 "Kiro-authored" (the tasks.md line), 8c74def (hook output: seance-tasks.json and the first hook-runs.log line, produced by the hook rather than by hand).
- **Credits (`/usage`):** Pro 241.47 → 241.60 of 877. **0.13 used** (metering can lag; recheck at the next run). About 635 left; resets 2026-12-01. No credits bought, no plan or settings change, no new login, no IDE.
- **Proof** (build box, not in the repo): `deploy/kiro-proof/` holds `probe-recording.mp4` (screen recording of the box desktop, 75 s, the run in a visible terminal), `probe-transcript.txt` (`script` capture), `probe-prompt.txt`, `run-probe.sh` and `frame-16s.png`.
- **Tests:** `npm test` 877 passed, 0 failed (873 + 4 new).
- **Account totals:** 21.82 + 0.13 = **21.95 credits metered** (Google 4.81, Pro 17.14).

## M6: haunt words and taunts (win-review #2 + #6) (2026-11-18, build agent): branch m6-haunt-words
- **Kiro used: yes**, 3 runs on the box, Pro (GitHub login), model **Auto**, kiro-cli 3.4.0, **engine v3** with workspace trust. Command for each run (prompts saved next to the proof files):
  `kiro-cli chat --agent-engine v3 --trust-workspace --no-interactive --model auto --trust-tools=fs_read,fs_write "$(cat runN-prompt.txt)"`
- Copy source: the team's approved copy (end card, HUD label, 16 taunts, the spec-haunted pattern), used word for word.
- **Before Kiro (build agent, commit 74743f6):** the hook wrapper now passes Kiro a short summary of hook output instead of the full ~1,300-line test log.
- **Run 12 (17:56–17:57 PT):** Kiro wrote spec `.kiro/specs/11-haunt-words/` (requirements R1–R4, design, 11 tasks). It tried one shell command, which was denied (file tools only).
  - Hooks fired: `seance-on-spec-save` ×1 (on Kiro creating `11-haunt-words/tasks.md`, exit 0).
- **Run 13 (17:58–17:59 PT):** tasks 1–4. End-card copy EXORCISED / POSSESSED / LAID TO REST, the sublines, "Spirit banished.", the level-up line `levelUpText` in `hauntLevel.js`, the stamp drawn with a max width, the enemy bar label HOUND, plus tests.
  - Hooks fired: `test-on-save` ×14 (12 failing while edits were half done, the last 2 green), `balance-on-combat-save` ×1 (on `src/ui/hauntLevel.js`, exit 0; no balance numbers changed), `seance-on-spec-save` ×4 (task ticks).
- **Run 14 (18:00–18:03 PT):** tasks 5–10. 16 moment-tagged taunts (spawn, windup, hit, low HP, enemy death, player death), a shared windup/hit cooldown that never cuts off a line, a once-per-match low-HP latch, `specTauntLine` ("Task {id} done. So are you." from a real done task in `seance-tasks.json`), the `main.js` wiring, the steering rewrite, and tests. It tried shell commands 3 times and was denied each time.
  - Hooks fired: `test-on-save` ×9 (2 failing mid-edit, the last 7 green), `seance-on-spec-save` ×1.
- **Hook output and the agent:** every firing is in `.kiro/hook-runs.log`. In both implementation runs Kiro said it had not seen the hooks' summaries, so on v3 headless, PostFileSave command output does not appear to reach the agent's context. The hooks really ran, but Kiro did not use their results to fix things. I ran `npm test` after each run.
- **Credits (`/usage`):** Pro 241.60 → 244.97 (after run 13; run 12's metering lagged into this reading) → 248.59 (after run 14). **6.99 for M6** (runs 12+13: 3.37, run 14: 3.62). About 628 left of 877; resets 2026-12-01. No credits bought, no plan or settings change, no new login, no IDE.
- **What I edited (by hand, separate commits):**
  - **Bug 2:** the in-fight taunt was drawn 56 world units above the enemy, right on its HP label (top at 58). The new `tauntBaselineY` puts it above the label with a gap, or below the enemy when the top edge is too close. Tests added.
  - `specTauntLine` now drops a spec number's leading zero (`3.5`, not `03.5`).
  - Task 11 (text-fit check) was ticked by hand and the séance rebuilt with `npm run build:seance` by hand. No hook fired for that edit.
  - README spooky-elements and Kiro sections were updated.
- **Text fit:** screenshots at 1280×800, 1024×640 and 390×844 DPR 2 (phone portrait) are in `build-review/shots-m6/` on the build box. They cover the spawn taunt, the low-HP taunt, and the end cards for an LV 2 win, an LV 5 win and an LV 1 loss. Every string fits and there were 0 console errors. On the phone, LAID TO REST fills the card width but is not clipped.
- **Proof** (build box, not in the repo): `deploy/kiro-proof/run12-*`, `run13-*`, `run14-*` (screen recording, scrubbed transcript, prompt).
- **Tests:** `npm test` 900 passed, 0 failed.
- **Account totals:** 21.95 + 6.99 = **28.94 credits metered** (Google 4.81, Pro 24.13).

## M7: title deploy, phone layout, stat bars, load hints (win-review #3, #4, #8, #10) (2026-11-18, build agent)
- **Kiro used: yes**, 4 runs (plus 1 aborted) on the box, Pro (GitHub login), model **Auto**, kiro-cli 3.4.0, **engine v3** with workspace trust, file tools only:
  `kiro-cli chat --agent-engine v3 --trust-workspace --no-interactive --model auto --trust-tools=fs_read,fs_write "$(cat runN-prompt.txt)"`
- **Run 15 (18:14–18:15 PT), PR #14, win-review #3:** the title's PRESS TO DEPLOY goes straight into a duel with the saved (or default) loadout; a GARAGE button and the G key open the garage (`titleChoice`, `quickDeployPlan`, tests, task 39).
  - Hooks fired: `test-on-save` ×10 (1 failing mid-edit), `seance-on-spec-save` ×1.
  - Measured: DEPLOY tap to a live duel in about 0.3 s on desktop and phone (before: the tap opened the garage).
- **Run 16 (18:18 PT), aborted:** my tool call was cut off after about 25 s while Kiro was still reading files. It made no edits. The partial recording and transcript are kept as `run16-aborted-*`.
- **Run 16b (18:18–18:20 PT), PR #15, win-review #4:** landscape phone controls moved into 22% side gutters with the arena fitted to the middle strip (`TOUCH_LAYOUT_LANDSCAPE`, `touchLayoutFor`); the portrait camera frames both tanks (`phoneFrame`), plus tests and task 40.
  - Hooks fired: `test-on-save` ×21 (20 failing while edits were half done), `seance-on-spec-save` ×1.
  - My fixes (separate commits): the test import Kiro dropped; button centres in the test follow the layout; the portrait taunt sits above the compact HOUND label and under the HUD row; the label reads "HOUND n"; the 1024×640 garage uses three columns from 960 px, compact rows on short screens and dark thin scrollbars (0 inner scroll panes, 6/6 slots visible).
- **Run 17 (18:34–18:36 PT), PR #16, win-review #8:** garage stat bars scale against the real min/max loadout totals (`statRanges`, `statBarPct`, tests, task 41). The default SCOUT bars went from 10 / 18 / 12 / 38 % to 15 / 100 / 17.5 / 88 %.
  - Hooks fired: `test-on-save` ×6 (1 failing mid-edit), `seance-on-spec-save` ×1.
  - My fix (separate commit): dropped the unused `STAT_MAX`.
- **Run 18 (18:38–18:39 PT), PR #18, win-review #10:** the built site adds `<link rel="modulepreload">` for all 45 modules reachable from `src/main.js` (`moduleGraph`, `addModulePreloads`, tests, task 42). The repo's own `index.html` is unchanged.
  - Hooks fired: `seance-on-spec-save` ×1, `test-on-save` ×2 (green). `scripts/` edits match no hook.
- **Not Kiro:** the public-repo scrub (PR #13) and the LV1 balance tune (PR #17: pressure 0.8 → 0.6, LV1 median 56.0 → 42.3 s, LV2–LV5 unchanged) were done by the build agent.
- **Hook output and the agent:** as in M6, Kiro said it could not see hook output or run shell commands. I ran `npm test` after every run.
- **Credits (`/usage`):** Pro 248.59 → 249.99 (run 15) → 253.94 (run 16b, including the aborted run 16) → 255.26 (run 17) → 256.17 (run 18). **7.58 for M7.** About 621 left of 877; resets 2026-12-01. No credits bought, no plan or settings change, no new login, no IDE.
- **Proof** (build box, not in the repo): `deploy/kiro-proof/run15-*`, `run16-aborted-*`, `run16b-*`, `run17-*`, `run18-*` (screen recording, scrubbed transcript, prompt).
- **Account totals:** 28.94 + 7.58 = **36.52 credits metered** (Google 4.81, Pro 31.71).

## M8: visible haunting in the arena and garage (win-review #5) (2026-11-18, build agent)
- **Kiro used: yes**, 4 runs on the box, Pro (GitHub login), model **Auto**, kiro-cli 3.4.0, **engine v3** with workspace trust, file tools only (same command as M7). All four are in PR #21 (squash `d1e918f`).
- **Run 19 (18:55–18:56 PT):** Kiro wrote spec `.kiro/specs/12-haunting/` (requirements R1–R8, design, 10 tasks) and the Haunting rules in `ui-style.md` and `design-tokens.md` (task 9).
  - Hooks fired: `seance-on-spec-save` ×1.
- **Run 20 (18:57–18:59 PT):** tasks 1–6. `src/ui/haunting.js` (effect caps, reduced-motion flags, a 16-point trail ring buffer with a 700 ms life, kill ghost pose, grid flicker, border fog, cached sprites) and its tests.
  - Hooks fired: `test-on-save` ×2 (green), `seance-on-spec-save` ×1.
  - My fix (separate commit): one ghost test compared the reused pose object with itself; it now copies the pose first.
- **Run 21 (19:00–19:02 PT):** task 7. The haunting is wired into the arena: grid flicker, border fog, the ectoplasm trail behind the enemy, the kill ghost from the wreck, and the vignette on the FOG layer.
  - Hooks fired: `test-on-save` ×10 (green), `seance-on-spec-save` ×1.
- **Run 22 (19:01–19:03 PT):** task 8. Garage ghost wisps behind the mech preview, a 5% ghost tint on the panels, and the reduced-motion off-switch, plus tests.
  - Hooks fired: `test-on-save` ×2 (green), `seance-on-spec-save` ×1.
- **What I edited (by hand, separate commits):**
  - Tuning after screenshots: larger, softer fog puffs; a taller kill ghost (90 wu rise, 0.9 start alpha, a soft glow) so it reads before the end card; the vignette sprite scaled so its effective alpha is 0.25 under the FOG layer's 0.35 clamp.
  - A phone lite set (touch UI): no vignette and 8 fog puffs instead of 14. With the full set, phone portrait at 4× CPU dropped to 45 fps. Spec R7, the design and the steering note this. Tests added.
  - Task 10 (readability and fps check) was ticked by hand and the séance rebuilt.
  - Before the haunting: PR #19 (usage-log wording) and PR #20 (the 844×390 garage scrolls as one body; the landscape arena clears the top-left HUD panel) were done by hand.
- **FPS** (headless Chromium, 6 s of rAF; busy = CDP task time per frame), before → after:
  - 1280×800: 60.2 → 60.0 fps, busy 2.40 → 3.89 ms.
  - 390×844 DPR 2, 4× CPU throttle: 60.0 → 60.1 fps, busy 13.77 → 15.10 ms.
  - 844×390 DPR 2, 4× CPU throttle: 60.1 → 59.8 fps, busy 8.41 → 10.85 ms.
- **Readability:** before/after screenshots at 1280×800, 1024×640, 390×844 and 844×390 DPR 2, plus a reduced-motion pass, are in `build-review/shots-m8/` on the build box. The windup tell, shots and HP labels draw above the haunting layers and look the same as before. There were 0 console errors.
- **Hook output and the agent:** as in M6 and M7, hook output did not reach Kiro. I ran `npm test` after every run.
- **Credits (`/usage`):** Pro 256.17 → 257.15 (run 19) → 259.37 (run 20) → 260.62 (run 21) → 261.37 (run 22). **5.20 for M8.** About 616 left of 877; resets 2026-12-01. No credits bought, no plan or settings change, no new login, no IDE.
- **Proof** (build box, not in the repo): `deploy/kiro-proof/run19-*` to `run22-*` (screen recording, scrubbed transcript, prompt).
- **Tests:** `npm test` 953 passed, 0 failed.
- **Account totals:** 36.52 + 5.20 = **41.72 credits metered** (Google 4.81, Pro 36.91).


## HUD C / C3 hold (2026-11-19 ~10:12 AM PT, build agent) — branch feat/hud-c, NOT merged
- **Owner hold** until ~2:15 PM PT. WIP committed; main stays `925696d`.
- **Kiro used this morning (before hold):**
  - **Run A (spec):** kiro-cli v3 Auto, Pro (GitHub login), file tools only → `.kiro/specs/13-hud-meters/` (requirements, design, tasks). Commit on branch: `337f1ae`.
  - **Orbitron (SIL OFL)** self-hosted under `assets/fonts/` (build-agent download + commit `8fb9cac`); not yet wired into draw calls.
  - **Run C3 (implementation):** started with v3 Auto; interrupted by owner hold mid-run (transcript `deploy/kiro-proof/hud-c/runC3-*`). No C3 visual commits yet.
- **Credits:** Pro read ~263.02 / 877 at hold (~30%). Exact per-run deltas to be finalized when C3 resumes.
- **Open:** below-line ≥6px y-check, top bar dual HP + MM:SS, Orbitron HUD wire-up, bigger angular tanks + LV1 sanity, shots-hud-c3/, full KIRO-USAGE C3 section. Status: `build-review/C3-STATUS.md`.
- **Standing rule (owner 10:07 AM PT):** prefer Kiro for remaining Kiroween build work until submit.

## HUD C3 resume (2026-11-19 ~11:18–11:30 AM PT, build agent) — branch feat/hud-c, NOT merged
- **Hold lifted** 11:14 AM PT by the owner via BotKing. Resume from tip `e6e43de`.
- **Run id:** C3b.
- **Command** (from worktree root):
  `kiro-cli chat --agent-engine v3 --trust-workspace --no-interactive --model auto --trust-tools=fs_read,fs_write "$(cat runC3b-prompt.txt)"`
  Prompt/transcript on the build box: `deploy/kiro-proof/hud-c/runC3b-prompt.txt`, `runC3b-transcript.txt`. Usage checks: `/usage` before and after.
- **Credits (Pro, GitHub login):** 263.02 → 277.11 of 877 (**14.09** for C3b). About 600 left; resets 2026-12-01. No credits bought, no plan change, no IDE.
- **What Kiro authored (file tools only; several shell attempts denied as intended):**
  - New `src/combat/topBarHud.js` (formatFightClock, topBarCells/layout/draw, Orbitron, HP green/red, MM:SS).
  - `src/combat/screenHpMeters.js`: arenaTopLineSy, meterTopInset, METER_LINE_GAP=6, METER_FONT→Orbitron, labels under bars.
  - `src/ui/possessedTaunts.js`: Orbitron TAUNT_FONT, wrap; main passes gap ≥6.
  - `src/ui/hauntLevel.js`: Orbitron for drawHauntLevel (HAUNT_LEVELS numbers untouched).
  - `src/ui/pauseMenu.js`: pause button CSS for the top strip.
  - `src/engine/fonts.js`: Orbitron 400/500/700 in CANVAS_FONTS.
  - `src/main.js`: top strip during playing; meters under line via meterTopInset; phoneFrame clears strip.
  - `index.html`: Orbitron @font-face + preload.
  - Tests: `tests/combat/hud.test.js`, `tests/combat/screenHpMeters.test.js`.
  - Spec: `.kiro/specs/13-hud-meters/` requirements/design/tasks for C3.
- **What the build agent finished by hand:**
  - Fonts test: expect 7 `font-display: swap` faces and Orbitron OFL/preload (was hard-coded to 4).
  - `arenaTopLineSy`: return 0 when camera.x/y/zoom is non-finite (Kiro's NaN-x case still yielded a finite sy).
  - `npm test` green; `npm run build:seance` (215 tasks, 195 done).
- **Not in this commit (still open):** bigger angular tanks + LV1 check, landscape phone option, Sever Wall on LV3+, screenshots / two-bot playtest.
- **Tests:** `npm test` **970** passed, 0 failed.
- **Do not merge** until BotKing / owner pick. Main stays `925696d`.

## HUD C3 tanks (2026-11-19 ~11:26–11:28 AM PT, build agent) — branch feat/hud-c, NOT merged
- **Run id:** C3-tanks.
- **Command:** `kiro-cli chat --agent-engine v3 --trust-workspace --no-interactive --model auto --trust-tools=fs_read,fs_write "$(cat runC3-tanks-prompt.txt)"`
  Proof: `deploy/kiro-proof/hud-c/runC3-tanks-prompt.txt`, `runC3-tanks-transcript.txt`.
- **Credits (Pro):** 277.43 → 279.04 (**1.61**).
- **Kiro authored:** `src/ui/tankWire.js` (TANK_DRAW_SCALE 1.3→1.5, chamfered hull/turret prisms, longer taper barrels, antenna), `tests/ui/tankWire.test.js`, `.kiro/specs/13-hud-meters/design.md` Mech art bullet. Hitboxes / HAUNT_LEVELS untouched.
- **Build-agent follow-up:** phoneCombatUi + tankFx tests updated for new scale/barrelLen; `npm test` green.
- **Commit:** `3875467`.

## HUD C3 Sever Wall (2026-11-19 ~11:28–11:35 AM PT, build agent) — branch feat/hud-c, NOT merged
- **Run id:** C3-sever.
- **Command:** same kiro-cli pattern with `runSeverWall-prompt.txt` → `runSeverWall-transcript.txt`.
- **Credits (Pro):** 279.04 → 283.08 (**4.04**).
- **Kiro authored:** `src/combat/obstacle.js` (new), config SEVER_WALL_*, arena/mech/projectile/enemy/combatRenderer/main wiring, `tests/combat/severWall.test.js`, package.json test:combat entry, `.kiro/specs/11-sever-wall/requirements.md`.
- **Build-agent follow-up:** balanceCore `runFight` now passes `hauntLv` into `createArena` (so LV3+ harness gets the wall; LV1 stays open); added `tasks.md` + séance rebuild; LV1 sanity harness (40 seeds × 16 builds): firstTimer **34.7%** / median **26.2s**, medium **66.7%** / median **27.2s** (in band; draw-only tanks did not skew). No balance retune.
- **Tests:** `npm test` green (includes severWall suite).

## HUD C3 landscape + shots (2026-11-19 ~11:33–11:38 AM PT, build agent) — branch feat/hud-c, NOT merged
- **Run id:** C3-landscape.
- **Command:** `kiro-cli chat --agent-engine v3 --trust-workspace --no-interactive --model auto --trust-tools=fs_read,fs_write "$(cat runLandscape-prompt.txt)"`
  Proof: `deploy/kiro-proof/hud-c/runLandscape-prompt.txt`, `runLandscape-transcript.txt`.
- **Credits (Pro):** 283.58 → 287.25 (**3.67**).
- **Kiro authored:** landscape compact top bar (HP/READY/timer/HOUND/LV; EN/POWER dropped), compact meters via arenaSideInsets, `tests/combat/landscapeHud.test.js`, package.json test:combat entry, design.md landscape note. Portrait path unchanged.
- **Build-agent follow-up:** `globalThis.__HH_HUD_Y__` probe in `main.js` (canvas px + CSS gaps); `build-review/shots-hud-c3.mjs` + serve-hud-c.sh module list; captured shots under build-box `build-review/shots-hud-c3/` with **all required phone y-checks PASS** (gapCss 6.00). Shots are build-agent work (no Kiro credits).
- **Tests:** `npm test` green (includes landscapeHud).

## HUD C3 S-revision (2026-11-19 ~11:42 AM PT, build agent) — branch feat/hud-c, NOT merged
- **Kiro used: no.** Build-agent only (0 credits). Source: Eggbot cold pass `build-host/crew/trials/eggbot-v2/cold-passes/2026-11-19-c3-60b60c5.md`.
- **Shipped S fixes:** title `.hh-title-keys` brighter/larger; `TELL_CAPTION_MS` 3500→5000; Sever Wall spawn label (`severWallLabelText`, 3.5s) drawn in `combatRenderer`. Deferred M/RISKY LV1 damage soften.
- **Tests:** `npm test` green. No HAUNT_LEVELS / balance retune.
- **Re-shots:** slim title + LV3 sever label; prior y-check still valid (`shots-hud-c3/REVISION.md`).

## C4 HUD — landscape-first side meters + mech names (2026-11-19 ~12:30 PM PT) — branch feat/hud-c
- **Kiro used: partial.** One `kiro-cli` v3 Auto run with `--trust-tools=fs_read,fs_write` started on the C4 prompt (incl. mirror-fair + ~20% field/gutter nudge). It read several HUD modules, then failed a non-fs locate tool in non-interactive mode. Build agent finished the implementation by hand to match the prompt. Transcript kept under the team deploy kiro-proof hud-c folder.
- **Credits (GitHub / Kiro Pro):** 287.47 → 287.95 of 877 (~0.48 used this run). Reset 2026-12-01.
- **Files (feature):** `src/combat/mechNames.js` (new), `topBarHud.js`, `screenHpMeters.js`, `src/ui/possessedTaunts.js` (`tauntAboveLineY`), `src/engine/touch.js` (gutter 0.176), `src/main.js` (side-out + above-field probe), tests (`landscapeHud`, `screenHpMeters`, `hud`, `touch`, `possessedTaunts`, new `mechNames` + `mirrorFair`), `.kiro/specs/13-hud-meters/` R10–R11, `build-review/shots-hud-c4.mjs` + shots.
- **Out of scope kept:** no HAUNT_LEVELS / damage / balance retune; Sever Wall geometry unchanged (already mid-X); no merge; no game-title rename.
- Hooks: not run (work outside IDE). `npm test` green by hand.

## C5 HUD — wider field + Digger thumb arc (2026-11-19 ~12:41–12:50 PM PT) — branch feat/hud-c, NOT merged
- **Run id:** C5.
- **Command:** `kiro-cli chat --agent-engine v3 --trust-workspace --no-interactive --model auto --trust-tools=fs_read,fs_write` with `deploy/kiro-proof/hud-c/runC5-prompt.txt` → `runC5-transcript.txt`.
- **Credits (GitHub / Kiro Pro):** 288.05 → 291.67 of 877 (~**3.62** this run, including a short usage probe before the task). Reset 2026-12-01.
- **Kiro authored:** `src/engine/touch.js` (gutter 0.144 + initial arc), `src/main.js` (landscape strip fit), `tests/engine/touch.test.js`, `tests/combat/landscapeHud.test.js`, `.kiro/specs/13-hud-meters/design.md`.
- **Build-agent follow-up:** capped strip growth to ~10% intent (height-bound ~+5% on 844×390 / 1200×900 arena); applied Digger brief up-left Fire/Dash (~72/64 CSS px) clamped into gutter; shots + FIELD-CHECK PASS; no balance / Sever change.
- **Tests:** `npm test` green. Digger brief used (up-left arc).

## HOT RUN — HOT-1 phone-landscape spec + steering (2026-11-19 ~1:57 PM PT) — branch feat/hud-c
- **Run id:** HOT1.
- **Command:** `kiro-cli chat --agent-engine v3 --trust-workspace --no-interactive --model auto --trust-tools=fs_read,fs_write` with `deploy/kiro-proof/hud-c/runHOT1-prompt.txt` → `runHOT1-transcript.txt`.
- **Credits (GitHub / Kiro Pro):** 291.67 → 293.05 of 877 (~**1.38** this run). Reset 2026-12-01.
- **Kiro authored:** `.kiro/specs/14-phone-landscape/{requirements,design,tasks}.md`, `.kiro/steering/phone-landscape.md`. Hook `seance-on-spec-save` fired on tasks.md (hook-runs.log +1 → 175).
- **Build-agent follow-up:** none for HOT-1 files. Commit `c102728`.

## HOT RUN — C5b Eggbot S1+S2 (2026-11-19 ~2:00 PM PT) — branch feat/hud-c, tip for owner lock
- **Kiro used: no** for S1/S2 source (build-agent hand; priority tip). Prefer-Kiro deferred to HOT-2 hook exercise.
- **Credits:** 0 for S1/S2.
- **Shipped:** `TAUNT_ABOVE_GAP=10` + dark plate (`possessedTaunts.js`); compact side-out thicker bar + `hpFontPx` 18 (`screenHpMeters.js`); main.js wiring; tests. Commit `a3128e3` (tip).
- **Shots:** `build-review/shots-hud-c5b/` FIELD-CHECK PASS (gaps 4/4/10). `npm test` 979 green. No Fire/Dash/gutter/balance/Sever change.

## HOT RUN — HOT-2 hook + touchLayout.pbt (2026-11-19 ~2:00 PM PT) — branch feat/hud-c
- **Run ids:** HOT2 + HOT2b (micro save).
- **Proof:** `deploy/kiro-proof/hud-c/runHOT2-prompt.txt`, `runHOT2-transcript.txt`, `runHOT2b-*`.
- **Credits (Pro):** 293.05 → 294.14 of 877 (~**1.09** across HOT2+HOT2b). Reset 2026-12-01.
- **Kiro authored:** `.kiro/hooks/landscape-hud-on-save.json`, `tests/engine/touchLayout.pbt.test.js` (7 properties), `package.json` test:engine entry, tasks.md ticks, one-line comment in `src/engine/touch.js` (HOT2b).
- **Hook firings:** manual invoke + Kiro PostFileSave on touch.js (`landscape-hud-on-save`, exit=0). Log ~180→182+.
- **Build-agent:** ran PBT (7/7), npm test; task 5 ticked after exercise.
- **Tests:** `npm test` green (includes touchLayout.pbt).

## HOT RUN — wrap (2026-11-19 ~2:10 PM PT) — branch feat/hud-c tip ebd57fb
- **Credits (Pro):** 291.67 → 294.14 of 877 (~**2.47** HOT-1/2/2b). Reset 2026-12-01.
- **Kiro:** HOT1 spec 14 + steering; HOT2 hook + touchLayout.pbt (7 props); HOT2b touch.js comment (hook fire).
- **Hand:** C5b S1/S2 (taunt plate, meters); README fifth hook; seance rebuild; fps-landscape.mjs + HOT-PERF (60.1 FPS, no soft fix); LV1/bugs/claims docs.
- **Tests:** npm test **986** green. Hook log **182**. SÉANCE **228/205**.
- **owner lock tip (S1+S2):** a3128e3; shots shots-hud-c5b/. Merge held.
- **Claims file:** build-review/WONT-TO-CAN-CLAIM.md (and team build-review copy).

## C7 HUD polish — wheeled default + neon + font (2026-11-19 ~3:10 PM PT) — branch feat/hud-c, NOT merged
- **Run id:** C7.
- **Command:** `kiro-cli chat --agent-engine v3 --trust-workspace --no-interactive --model auto --trust-tools=fs_read,fs_write` with `deploy/kiro-proof/hud-c7/runC7-prompt.txt` → `runC7-transcript.txt`.
- **Credits (Kiro Pro / Auto):** short confirm-only run (border already applied by build-agent). Reset 2026-12-01.
- **Kiro authored:** confirmed neon double/inset border in `combatRenderer.js`; no code rewrite needed. Steering `.kiro/steering/hud-c7-neon-border.md` + `tank-wire-styles.md` (default wheeled).
- **Build-agent hand:** wheeled 8x8 POP (wheels/mast/lights/glow), neon blue Fire/Dash/stick, double border, HUD crisp frames, Press Start 2P (OFL) self-host, default `TANK_STYLE=wheeled`.
- **Tests / shots:** see team-archive/hud-c7/.
