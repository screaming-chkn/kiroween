# 14-phone-landscape — Requirements

## Introduction
Formalizes the shipped C5 landscape phone touch layout of HAUNT//HOUND. This spec
records what is already in `src/engine/touch.js` (`TOUCH_LAYOUT_LANDSCAPE`,
`LANDSCAPE_GUTTER_FRAC`) so tests and a save hook can protect it. It proposes no
number changes. The C5 values are locked for this branch pending an owner lock.
Fractions are defaults, not a permanent layout. No balance, Sever Wall or tell
changes. Reference viewport: 844×390 CSS px (phone landscape), min dimension 390.

## Requirements

### R1 Landscape Fire/Dash geometry
- On the landscape phone layout (`touchLayoutFor(w, h)` with w > h,
  `TOUCH_LAYOUT_LANDSCAPE`) the buttons SHALL be:
  - Fire: `cxFrac` 0.935, `cyFrac` 0.80, `rFrac` 0.092.
  - Dash: `cxFrac` 0.905, `cyFrac` 0.58, `rFrac` 0.082.
- Radii are fractions of `min(vpW, vpH)`; centres are fractions of vpW and vpH.
- Dash SHALL sit up-left of Fire: a smaller `cxFrac` and a smaller `cyFrac`. It
  SHALL NOT be in a straight row with Fire and SHALL NOT be up-right of Fire
  (the notch side).
- Portrait layout (`TOUCH_LAYOUT`) is unchanged.

### R2 Gutter and safe area
- `LANDSCAPE_GUTTER_FRAC` SHALL be 0.144. The stick zone `wFrac` in
  `TOUCH_LAYOUT_LANDSCAPE` SHALL equal it, so the stick and the gutter match.
- Both buttons SHALL lie inside the right gutter (x ≥ vpW × (1 − 0.144)) and
  inside the viewport.
- Safe area intent: no hit target SHALL reach into typical insets of 47 pt left
  and right and 21 pt bottom on an 844×390-class phone. The bottom inset is met
  by the shipped layout (Fire bottom edge ≈ 348 of 390 CSS px).
- Open item for the owner: on 844×390 the Fire circle spans x ≈ 753–825, so it
  reaches into a 47 pt right inset (edge at x = 797). Dash ends at x ≈ 796 and
  clears it. Task 7 verifies this and reports it. This spec does not change the
  numbers; any move needs an owner decision (see R5).

### R3 Hit targets
- On an 844×390 CSS canvas, the Fire and Dash diameters, computed as
  `rFrac × min(vpW, vpH) × 2`, SHALL each be ≥ 44 CSS px.
- Shipped values: Fire ≈ 72 px (71.8), Dash ≈ 64 px (64.0). The same minimum
  applies at 667×375 and 915×412.

### R4 Gaps
- The edge-to-edge gap between Fire and Dash SHOULD be ≥ 12 CSS px, and 16 CSS px
  is preferred. Shipped on 844×390: about 22 px.
- Existing landscape HUD field checks stay: the meters gap to the arena field
  ≥ 4 CSS px (`METER_FIELD_GAP`) and the taunt gap above the line ≥ 6 CSS px,
  both asserted in `tests/combat/landscapeHud.test.js`.

### R5 Custom layout, defaults not locked
- The code SHALL keep a path for a custom-layout toggle later. The C5 fractions
  are defaults, not the only layout forever. Tests SHALL assert the properties in
  R1–R4 and R7 through the layout object, not by copying literals into new code.
- No custom-layout feature is built in this spec.

### R6 Phone-landscape runtime performance
- Mid-fight frame rate on an 844×390 @ DPR 3 class phone SHOULD be ≥ 55 fps.
- Lite haunting stays on touch devices (no vignette, `FOG_PUFFS_LITE` puffs).
- This spec SHALL NOT add new heavy effects on landscape phone. If the target is
  missed, prefer lower particle caps or skipped draws over any combat change.

### R7 Property tests
- A property test file SHALL check, over seeded random viewports of landscape
  phone size: Fire and Dash diameters, the Fire–Dash gap, containment of both
  buttons in the gutter, Dash up-left of Fire, and ≥ 44 CSS px hit diameters.
- It SHALL use a hand-rolled seeded PRNG, no new npm dependencies, in the style of
  `loadoutEffects.pbt`. It is wired into `npm test`.

### R8 Save hook
- A PostFileSave hook SHALL run the landscape HUD and touch tests whenever the
  touch layout sources are saved: `src/engine/touch.js`, the landscape HUD paths
  (`src/combat/topBarHud.js`, `src/ui/phoneCombatUi.js`) and
  `src/combat/screenHpMeters.js`.
- The hook is authored in a later task. This spec requires it.
