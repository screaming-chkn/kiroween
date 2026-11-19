# 14-phone-landscape — Design

## Overview
This spec formalizes the C5 landscape touch layout. It adds tests and a hook
around existing code. It changes no game source. The C5 numbers are LOCKED for
this branch pending an owner lock: formalize only. No balance, Sever Wall or
tell changes.

## Requirement map
| Req | Module / file | Notes |
|---|---|---|
| R1 geometry | `src/engine/touch.js` `TOUCH_LAYOUT_LANDSCAPE` (`fire`, `dash`), picked by `touchLayoutFor` | Fire 0.935 / 0.80 / 0.092. Dash 0.905 / 0.58 / 0.082. Dash up-left of Fire. |
| R2 gutter, safe area | `LANDSCAPE_GUTTER_FRAC` = 0.144, `TOUCH_LAYOUT_LANDSCAPE.stick.wFrac`, `touchSafeShift` (bottom inset render offset) | Right-inset check for Fire is an open item, see below. |
| R3 hit targets | `rFrac × min(vpW, vpH) × 2`; `hitTestTouchControl` uses the same radii | ≥ 44 CSS px at 844×390, 667×375, 915×412. |
| R4 gaps | Fire–Dash edge gap from the layout; meter and taunt gaps in `tests/combat/landscapeHud.test.js` (`METER_FIELD_GAP`, taunt gap 6) | Gap floor 12, prefer 16. |
| R5 custom layout | Layout is read through `touchLayoutFor`, so a later toggle swaps the object | Not built here. |
| R6 perf | `src/ui/haunting.js` lite set (no vignette, `FOG_PUFFS_LITE`) | Measure, do not add effects. |
| R7 property tests | planned `tests/engine/touchLayout.pbt.test.js` | Seeded PRNG, no deps. |
| R8 hook | planned `.kiro/hooks/landscape-hud-on-save.json` via `scripts/kiro-hook-run.mjs` | Same pattern as `balance-on-combat-save.json`. |

Existing coverage: `tests/engine/touch.test.js` (layout, hit test, controller)
and `tests/combat/landscapeHud.test.js` (gutter range 0.13–0.15, Dash up-left of
Fire, controls ≥ 44 CSS px and clear of meters and strip at DPR 1, 2, 3).

## Geometry on 844×390 (min = 390)
- Fire: centre (789.2, 312), diameter 71.8 px, x 753–825, bottom edge 348.
- Dash: centre (763.8, 226.2), diameter 64.0 px, x 732–796.
- Centre distance ≈ 89.5 px, radii sum ≈ 67.9 px, edge gap ≈ 21.6 px.
- Gutter starts at x = 844 × (1 − 0.144) ≈ 722.5. Both circles are inside it.
- Right 47 pt inset edge is x = 797. Dash clears it. Fire does not (open item).

## Planned property test (R7)
`tests/engine/touchLayout.pbt.test.js`, plain Node, no framework:
- `mulberry32(seed)` PRNG defined in the file. A fixed seed list, so failures
  reproduce. Sample landscape phone viewports (w 640–950, h 360–430, w > h).
- Properties: diameters equal `2 × rFrac × min`; Fire and Dash ≥ 44 px; the
  edge gap ≥ 12; both circles inside the gutter and the viewport; Dash cx < Fire
  cx and Dash cy < Fire cy; stick `wFrac` equals `LANDSCAPE_GUTTER_FRAC`.
- Properties read the layout object, so a later custom layout can reuse them.
- Wired into `package.json` `npm test` in task 3.

## Planned hook (R8)
`.kiro/hooks/landscape-hud-on-save.json`, schema v1, PostFileSave, matcher on
`touch.js`, `topBarHud.js`, `phoneCombatUi.js`, `screenHpMeters.js`. Command:
`node scripts/kiro-hook-run.mjs landscape-hud-on-save -- node tests/combat/landscapeHud.test.js`,
with the touch and property tests added when they exist. Authored in task 4.

## Performance notes (R6)
- Measure mid-fight FPS on an 844×390 @ DPR 3 class profile, and write the
  result in the tasks log.
- Only if below 55 fps: soft fixes, such as lower particle caps or skipping
  draws. No combat, balance or tell changes.
- No new heavy effects on landscape phone.
