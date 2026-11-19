---
inclusion: fileMatch
fileMatchPattern: ["src/engine/touch.js", "src/combat/screenHpMeters.js", "src/combat/topBarHud.js", "tests/engine/touch.test.js", "tests/combat/landscapeHud.test.js", "tests/engine/touchLayout.pbt.test.js"]
---
# Phone landscape (spec 14-phone-landscape)
Landscape phone (844×390 reference) is the primary touch layout. Spec 14 records the shipped C5 values. It does not change them.

## Current defaults (C5, `TOUCH_LAYOUT_LANDSCAPE` in `src/engine/touch.js`)
| Control | cxFrac | cyFrac | rFrac | Diameter on 844×390 |
|---|---|---|---|---|
| Fire | 0.935 | 0.80 | 0.092 | ~72 CSS px |
| Dash | 0.905 | 0.58 | 0.082 | ~64 CSS px |

- `LANDSCAPE_GUTTER_FRAC` = 0.144. The stick zone `wFrac` equals it.
- These are defaults, not locked forever. Do not copy the literals into new code or tests; read them through `touchLayoutFor`. Keep the path open for a custom-layout toggle later.
- C5 numbers are locked for this branch pending an owner lock. Do not retune them while editing around them.

## Thumb arc
- Fire sits low and is the primary button. Dash sits up-left of Fire (about 11 o'clock): smaller cxFrac and smaller cyFrac.
- Never a straight row with Fire, and never up-right of Fire (the notch side).

## Safe area and size
- Intent: no hit target in typical 47 pt left/right and 21 pt bottom insets on 844×390-class phones. The bottom inset is met. Fire reaches into a 47 pt right inset on 844×390; this is an open item for the owner, tracked in spec 14 task 7.
- Hit diameters `rFrac × min(vpW, vpH) × 2` stay ≥ 44 CSS px at 844×390, 667×375 and 915×412.
- Fire–Dash edge gap: floor 12 CSS px, prefer 16 (shipped about 22). Meters gap to the field ≥ 4 CSS px. Taunt gap above the line ≥ 6 CSS px.

## Performance
- Target ≥ 55 fps mid-fight on 844×390 @ DPR 3 class phones.
- Lite haunting stays on touch devices: no vignette, `FOG_PUFFS_LITE` puffs.
- Add no new heavy effects on landscape phone. If fps is short, lower particle caps or skip draws. Do not touch combat, balance, Sever Wall or the windup tell.

## Checks
- `tests/engine/touch.test.js`, `tests/combat/landscapeHud.test.js`, and the planned `tests/engine/touchLayout.pbt.test.js` (seeded PRNG, no new dependencies).
- A PostFileSave hook for these sources is planned (spec 14 task 4).
