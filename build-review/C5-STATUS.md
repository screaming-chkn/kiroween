# C5 STATUS — landscape field nudge + Digger thumb arc

**Branch:** `feat/hud-c` (NOT merged; merge still held)
**Base tip before C5:** `f64728a` (C4)
**Feature tip:** `c0c178b`

## What changed
- `LANDSCAPE_GUTTER_FRAC` 0.176 → **0.144** (`TOUCH_LAYOUT_LANDSCAPE.stick.wFrac` matches) for a wider L-R fight field.
- Landscape fit: grow strip ~10% vs C4 `landscapeStripW` base, capped by gutters. On 844×390 with the 1200×900 arena, isotropic zoom hits the **height bound at ~+5%** field size vs C4 (cannot reach +10% L-R without stretch/clip). Vertical already maxed at that point.
- **Thumb arc (Digger brief used):** Fire low/primary (cx 0.935, cy 0.80, r 0.092 ≈72 CSS px); Dash **up-left** of Fire (cx 0.905, cy 0.58, r 0.082 ≈64 CSS px) for notched-iPhone clearance. Centers clamped into the right gutter. Overrides the interim up-right arc default.
- Spec note in `.kiro/specs/13-hud-meters/design.md` (C5 section).
- Tests: `tests/engine/touch.test.js`, `tests/combat/landscapeHud.test.js` (gutter range, up-left arc, ≥44 CSS px, field-gap).
- Shots: `build-review/shots-hud-c5/` + `FIELD-CHECK.md` (PASS).

## Unchanged
- No `HAUNT_LEVELS` / damage / balance retune.
- Sever Wall geometry **unchanged** (mirror-fair mid-X still green).
- No merge. No game-title rename. C4 HUD feel kept (side-out meters, mech names, taunt above field, slim timer strip, Orbitron, Ghost, TANK_DRAW_SCALE 1.5).

## Proof
- `npm test` EXIT 0
- Field-check: playerGapCss/enemyGapCss ≥ 4, tauntGapCss ≥ 6 on landscape LV1 + LV3 (required) and desktop.

## Deviations
- Field width: geometry caps isotropic zoom at ~+5% on 844×390 (height-bound); gutter still narrowed to 0.144 as specified.
- Digger absolute % (11%/17% Fire, 16%/35% Dash from bottom-right) would place Dash into the playfield under the gutter HUD model — shipped Digger **arc direction + sizes**, centers clamped into the right gutter.

## Kiro
- v3 Auto, `--trust-tools=fs_read,fs_write`. One non-fs `run_command` denied (expected). Build agent finished fit-cap + Digger arc + shots.
- Credits: see KIRO-USAGE.md (C5 entry).
