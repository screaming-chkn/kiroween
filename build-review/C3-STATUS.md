# C3 STATUS — HOLD LIFTED (2026-11-19 11:14 AM PT)

Hold lifted by the owner via BotKing at 11:14 AM PT. Branch `feat/hud-c` **not merged**. Main stays `925696d`.

## WIP tip
Tip: `47c7948` (C3b HUD). Worktree: feature branch only.

## Done on branch (C3b — this resume)
- **Below the line:** meters + labels + frames + bars use `METER_LINE_GAP` (6 CSS px) under the arena green line (`arenaTopLineSy` + `meterTopInset`). Taunt gap ≥6 from main.
- **Top bar ABOVE the line:** `src/combat/topBarHud.js` — player HP green left, HOUND HP red right, centered MM:SS (`formatFightClock`), EN / POWER / READY / LV; pause DOM button reserved. Narrow phone uses two rows.
- **Orbitron OFL** wired: index.html @font-face + preload, fonts.js CANVAS_FONTS, meters, top bar, taunts, haunt LV draw.
- **Ghost perk** still opt-in; orange→red at ≤25% kept.
- **Spec** `.kiro/specs/13-hud-meters/` updated for C3; séance rebuilt.
- **Tests:** npm test green (970 pass).
- **KIRO-USAGE:** C3b section logged (263.02 → 277.11 Pro credits).
- **Proof:** `deploy/kiro-proof/hud-c/runC3b-*` on the build box.

## Still open (not in C3b)
1. Bigger angular tanks (~10–20%) + LV1 harness sanity check.
2. Landscape phone option.
3. Sever Wall on LV3+ only.
4. Screenshots (`build-review/shots-hud-c3/`), two-bot playtest (harness + Eggbot v2), one revision, shots to BotKing.
5. No merge until owner picks.

## Kiro standing rule
Prefer `kiro-cli` v3 Auto + `--trust-workspace` + file tools. Build agent: screenshots, merges, identity grep, site rebuild, BotKing handoffs. Log every run in `KIRO-USAGE.md`.

## Do not
- Merge to main
- Public deploy / spend
