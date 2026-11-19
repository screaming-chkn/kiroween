# C4 field-edge check

Values from `globalThis.__HH_HUD_Y__` (canvas px; gaps in CSS px).
PASS when playerGapCss ≥ 4, enemyGapCss ≥ 4, and tauntGapCss ≥ 6 (meters outside L/R borders; taunt above field top).

## c4-phone-land-lv1-taunt

- scale: 2
- lineTop: 96.44999441342694  lineBottom: 97.7546610800936
- arena L/R: 451.94780064466346 / 1236.0524673113302
- playerMeterRight: 443.94780064466346 (gapCss 4.00)
- enemyMeterLeft: 1244.0524673113302 (gapCss 4.00)
- tauntBottom: 84.44999441342694 (gapCss 6.00)
- result: **PASS** (required)
## c4-phone-land-lv3-sever

- scale: 2
- lineTop: 96.45008908325427  lineBottom: 97.75475574992093
- arena L/R: 451.94756643948864 / 1236.0522331061554
- playerMeterRight: 443.94756643948864 (gapCss 4.00)
- enemyMeterLeft: 1244.0522331061554 (gapCss 4.00)
- tauntBottom: 84.45008908325427 (gapCss 6.00)
- result: **PASS** (required)
## c4-desk-lv1-mid

- scale: 1
- lineTop: 32.99988505907487  lineBottom: 34.4532183924082
- arena L/R: 203.2733161709318 / 1076.7266495042652
- playerMeterRight: 199.2733161709318 (gapCss 4.00)
- enemyMeterLeft: 1080.7266495042652 (gapCss 4.00)
- tauntBottom: 26.99988505907487 (gapCss 6.00)
- result: **PASS**

---
Required field-check FAILs: **0**
