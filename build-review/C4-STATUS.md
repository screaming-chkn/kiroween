# C4 STATUS — landscape-first side meters (2026-11-19 ~12:30 PM PT)

Branch `feat/hud-c` **not merged**. Main stays untouched. Merge held for owner lock.

## Tip
Tip: `72253a651c9e47a11c4fb7c6c9ba3c75235c0e70` (`72253a6`). Worktree: feature branch only.

## What changed
- Landscape phone primary (844×390); desktop 1280×720; portrait must not break.
- Slim top strip: MM:SS timer + optional LV; dropped POWER / READY / HP / HOUND cells.
- HP meters **outside** the green field L/R borders (`side-out`); labels `P1 · RUSTBIT` / `CHOPPER` with `cur/max`.
- Trash talk **above** the field top, speaker colour.
- ~20% smaller gutters/strip vs C3 (`LANDSCAPE_GUTTER_FRAC` 0.22→0.176, rowH 36→29) for a larger fight field; stick/fire ≥44 CSS px.
- Mech names module; no player-facing "HOUND" on HUD.
- Mirror-fair test: Sever Wall already centred mid-X; spawns already mirror-fair — **geometry unchanged**, no balance harness re-run.
- Kept: Orbitron, dotted frames, TANK_DRAW_SCALE 1.5, Ghost perk, Sever Wall + label, orange→red@25%.

## Shots (`build-review/shots-hud-c4/`)
- `c4-phone-land-title.png`
- `c4-phone-land-lv1-taunt.png` (field-check PASS)
- `c4-phone-land-lv3-sever.png` (field-check PASS)
- `c4-desk-lv1-mid.png` (field-check PASS)
- `FIELD-CHECK.md`

## Do not
- Merge to main / public deploy / spend / force-push
