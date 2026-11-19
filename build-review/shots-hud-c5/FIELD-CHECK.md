# C5 field-edge check

Values from `globalThis.__HH_HUD_Y__` (canvas px; gaps in CSS px).
PASS when playerGapCss ≥ 4, enemyGapCss ≥ 4, and tauntGapCss ≥ 6 (meters outside L/R borders; taunt above field top).

## c5-phone-land-lv1-taunt

- scale: 2
- lineTop: 82.20006078577235  lineBottom: 83.56806078577235
- arena L/R: 432.9158321388581 / 1255.083832138858
- playerMeterRight: 424.9158321388581 (gapCss 4.00)
- enemyMeterLeft: 1263.083832138858 (gapCss 4.00)
- tauntBottom: 70.20006078577235 (gapCss 6.00)
- result: **PASS** (required)
## c5-phone-land-lv3-sever

- scale: 2
- lineTop: 82.20008327515369  lineBottom: 83.56808327515368
- arena L/R: 432.915894897373 / 1255.083894897373
- playerMeterRight: 424.915894897373 (gapCss 4.00)
- enemyMeterLeft: 1263.083894897373 (gapCss 4.00)
- tauntBottom: 70.20008327515369 (gapCss 6.00)
- result: **PASS** (required)
## c5-desk-lv1-mid

- scale: 1
- lineTop: 32.999900022692145  lineBottom: 34.45323335602548
- arena L/R: 203.2732740838421 / 1076.7266074171755
- playerMeterRight: 199.2732740838421 (gapCss 4.00)
- enemyMeterLeft: 1080.7266074171755 (gapCss 4.00)
- tauntBottom: 26.999900022692145 (gapCss 6.00)
- result: **PASS**

---
Required field-check FAILs: **0**
