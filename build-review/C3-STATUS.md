# C3 STATUS — tanks + Sever Wall done (2026-11-19 ~11:35 AM PT)

Hold lifted earlier (11:14 AM PT). Branch `feat/hud-c` **not merged**. Main stays `925696d`.

## WIP tip
See latest `feat/hud-c` tip after Sever Wall commit (git log).

## Done
- **C3b HUD:** below-line meters (≥6px), top bar HP green/red + MM:SS + EN/POWER/READY/LV, Orbitron OFL — `47c7948`.
- **Tanks (draw-only):** TANK_DRAW_SCALE 1.5, chamfered hull/turret, sharper barrel/antenna — `3875467`. Hitboxes unchanged.
- **Sever Wall:** LV3+ only mid vertical wall; blocks shots + dash; LV1–2 open — this commit. Spec `.kiro/specs/11-sever-wall/`.
- **LV1 harness sanity (40 seeds):** firstTimer 34.7% / 26.2s; medium 66.7% / 27.2s. No retune.
- **KIRO-USAGE:** C3b + tanks + Sever sections logged.

## Still open
1. Landscape phone option / reflow.
2. Screenshots (`build-review/shots-hud-c3/`) + y-check.
3. Two-bot playtest (harness + Eggbot v2) + one revision; shots to BotKing.
4. Optional: full LV3–5 balance re-check with wall present (task 6 in 11-sever-wall).

## Do not
- Merge to main / public deploy / spend
