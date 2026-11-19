# C3 STATUS — landscape + shots done (2026-11-19 ~11:38 AM PT)

Branch `feat/hud-c` **not merged**. Main stays `925696d`.

## WIP tip
Tip after landscape/shots commit (see git log / tip hash in commit).

## Done
- **C3b HUD:** below-line meters (≥6px), top bar HP + MM:SS, Orbitron — `47c7948`.
- **Tanks (draw-only):** scale 1.5 + chamfer — `3875467`.
- **Sever Wall:** LV3+ only — `1d95b44`.
- **Landscape:** compact top bar + arena-corner meters; sticks clear; portrait regression OK. y-probe `__HH_HUD_Y__`.
- **Shots + y-check:** `build-review/shots-hud-c3/` (build box) + `y-measurements.md` — **all required phone gaps PASS (6.00 CSS px)**.
- **LV1 harness** (earlier): firstTimer 34.7%/26.2s; medium 66.7%/27.2s.

## Still open
1. Two-bot playtest (harness + Eggbot v2) + one revision.
2. Shots / playtest report to BotKing; owner lock / merge gate.
3. Optional: full LV3–5 balance re-check with Sever Wall.

## Do not
- Merge to main / public deploy / spend
