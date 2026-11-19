# C7 field-edge check

Values from `globalThis.__HH_HUD_Y__` (canvas px; gaps in CSS px).
PASS when playerGapCss ≥ 4, enemyGapCss ≥ 4, tauntGapCss ≥ 6, and |bottomGapCss − tauntGapCss| ≤ 2 (equal letterbox under field).

## c7-phone-land-lv1

- scale: 2
- lineTop: 144.40000000000003  lineBottom: 145.76800000000003
- fieldBottom: 760
- arena L/R: 432.916 / 1255.084
- playerMeterRight: 424.916 (gapCss 4.00)
- enemyMeterLeft: 1263.084 (gapCss 4.00)
- tauntBottom: 124.40000000000003 (tauntGapCss 10.00)
- bottomGapCss: 10.00  |Δ| vs taunt: 0.00
- result: **PASS** (required)
## c7-phone-land-lv3

- scale: 2
- lineTop: 144.40000000000003  lineBottom: 145.76800000000003
- fieldBottom: 760
- arena L/R: 432.916 / 1255.084
- playerMeterRight: 424.916 (gapCss 4.00)
- enemyMeterLeft: 1263.084 (gapCss 4.00)
- tauntBottom: 124.40000000000003 (tauntGapCss 10.00)
- bottomGapCss: 10.00  |Δ| vs taunt: 0.00
- result: **PASS** (required)
## c7-desk-lv1

- scale: 1
- lineTop: 56  lineBottom: 57.45333333333333
- fieldBottom: 710
- arena L/R: 203.27333333333334 / 1076.7266666666667
- playerMeterRight: 199.27333333333334 (gapCss 4.00)
- enemyMeterLeft: 1080.7266666666667 (gapCss 4.00)
- tauntBottom: 46 (tauntGapCss 10.00)
- bottomGapCss: 10.00  |Δ| vs taunt: 0.00
- result: **PASS** (required)

---
Required field-check FAILs: **0**
