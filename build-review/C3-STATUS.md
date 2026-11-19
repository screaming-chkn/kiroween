# C3 STATUS — HOLD (2026-11-19 ~10:12 AM PT)

owner hold until ~2:15 PM PT (BotKing resume). Branch `feat/hud-c` **not merged**. Main stays `925696d`.

## WIP tip
See latest commit on `feat/hud-c` after this hold commit. Worktree: repo feature branch only.

## Done (on branch)
- **C / C2 gameplay HUD** (already on branch before C3): corner vertical meters under arena line; orange→red @ ≤25%; ghost perk (player-only, ~12s, +10% maxHp heal); top stats panel without HP; taunts centered under line in speaker color (HOUND red); damage pops kept.
- **Kiro Run A:** `.kiro/specs/13-hud-meters/` (requirements / design / tasks) authored via kiro-cli v3 Auto — commit `337f1ae`.
- **Orbitron (SIL OFL)** self-hosted under `assets/fonts/` (`orbitron-400/500/700.woff2` + `OFL-Orbitron.txt`) — commit `8fb9cac`. Not wired into HUD draw yet.
- **Séance rebuild** dirty at hold time (spec added) — committed with this hold if present.
- **Proof prompts:** `deploy/kiro-proof/hud-c/runA-*`, `runC3-*` (on build box).

## Left (open C3 spec — do in Kiro first when resumed)
1. **Below the line (hard):** EVERYTHING in each meter group (label, numbers, frame, bar) strictly below the green divider; label top ≥ **6 px** (phone) below line bottom. Same gap for taunt. No touch/cross. Player top-left of arena, HOUND top-right. **y-check** on every phone PNG before reply.
2. **Top bar redesign:** spaced cool strip above the line — player HP (green left), HOUND HP (red right), centered **MM:SS** fight timer from 00:00, plus EN / POWER / radar / LV / pause. Drop/merge if crowded. VT323 out for these readouts.
3. **Font:** wire **Orbitron** (OFL, already on disk) to top bar numbers/timer, meter labels, taunt. Readable on phone. Do **not** use/trace/copy Tesla lettering.
4. **Mech art:** both tanks ~10–20% bigger, more angular wireframe (bevel/chamfer hull, faceted turret, sharper barrel/antenna); keep hitbox/feel; quick LV1 harness sanity (cold ~1/3, learned ~2/3, ~30s); don't crowd meters/taunt.
5. **Deliverable when resumed:** `build-review/shots-hud-c3/` (phone orange/red/ghost/hound-taunt + desktop twins), y-measurements, KIRO-USAGE.md entry for C3 runs, still **no merge** until owner picks.

## Kiro standing rule (owner 10:07 AM PT)
Prefer `kiro-cli` v3 Auto + `--trust-workspace` + file tools for specs / steering / hooks / implementation. Build agent: screenshots, merges, identity grep, site rebuild, BotKing handoffs. Log every run in `KIRO-USAGE.md`.

## Credits snapshot at hold
Kiro Pro (GitHub login): ~263 / 877 used (~30%). C3 implementation run was interrupted mid-edit (hold). Run A (spec) completed earlier this morning — meter exact credits in KIRO-USAGE when C3 section is written on resume.

## Do not
- Merge to main
- Public deploy / spend
- Resume C3 until BotKing says so (~2:15 PM PT)
