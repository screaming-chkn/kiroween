# C9d field-edge + spacing check

Values from `globalThis.__HH_HUD_Y__` (canvas px; gaps in CSS px).
PASS when playerGapCss ≥ 4, enemyGapCss ≥ 4, tauntGapCss ≈ 8 (±2), and |bottomGapCss − tauntGapCss| ≤ 2 (equal letterbox). Visual: top neon unbroken mid-span; taunt+plate above; names far L/R.
Spacing unit: HUD_SPACE = 8 CSS px.

| Gap | Target | Measured | Result |
|---|---|---|---|

## c9d-phone-land-lv1

- scale: 2  hudSpace: 8
- lineTop: 148.40000000000006  lineBottom: 149.76800000000006
- fieldBottom: 764
- arena L/R: 432.916 / 1255.084
- playerMeterRight: 416.916 (gapCss 8.00)
- enemyMeterLeft: 1271.084 (gapCss 8.00)
- tauntBottom: 132.40000000000006 (tauntGapCss 8.00)
- bottomGapCss: 8.00  |Δ| vs taunt: 0.00
- result: **PASS** (required)

### Spacing table (CSS px)

| Gap | Target | Measured | Result |
|---|---|---|---|
| HUD_SPACE unit | 8 | 8.00 | PASS |
| taunt ↔ field (top) | 8 | 8.00 | PASS |
| field ↔ bottom letterbox | == taunt | 8.00 | PASS |
| meter ↔ field (P1) | 8 | 8.00 | PASS |
| meter ↔ field (enemy) | 8 | 8.00 | PASS |
| stick ↔ left edge | ~8 (touch) | 7.86 | PASS |
| stick ↔ bottom edge | ≥6 | 46.80 | PASS |
| Fire ↔ right edge | ≥8 (gutter≤22) | 17.29 | PASS |
| Fire ↔ bottom edge | ≥6 | 46.02 | PASS |
| meter label gap | 8 | 8.00 | PASS |
## c9d-phone-land-lv3

- scale: 2  hudSpace: 8
- lineTop: 148.40000000000006  lineBottom: 149.76800000000006
- fieldBottom: 764
- arena L/R: 432.916 / 1255.084
- playerMeterRight: 416.916 (gapCss 8.00)
- enemyMeterLeft: 1271.084 (gapCss 8.00)
- tauntBottom: 132.40000000000006 (tauntGapCss 8.00)
- bottomGapCss: 8.00  |Δ| vs taunt: 0.00
- result: **PASS** (required)

### Spacing table (CSS px)

| Gap | Target | Measured | Result |
|---|---|---|---|
| HUD_SPACE unit | 8 | 8.00 | PASS |
| taunt ↔ field (top) | 8 | 8.00 | PASS |
| field ↔ bottom letterbox | == taunt | 8.00 | PASS |
| meter ↔ field (P1) | 8 | 8.00 | PASS |
| meter ↔ field (enemy) | 8 | 8.00 | PASS |
| stick ↔ left edge | ~8 (touch) | 7.86 | PASS |
| stick ↔ bottom edge | ≥6 | 46.80 | PASS |
| Fire ↔ right edge | ≥8 (gutter≤22) | 17.29 | PASS |
| Fire ↔ bottom edge | ≥6 | 46.02 | PASS |
| meter label gap | 8 | 8.00 | PASS |
## c9d-desk-lv1

- scale: 1  hudSpace: 8
- lineTop: 58  lineBottom: 59.45333333333333
- fieldBottom: 712
- arena L/R: 203.27333333333334 / 1076.7266666666667
- playerMeterRight: 195.27333333333334 (gapCss 8.00)
- enemyMeterLeft: 1084.7266666666667 (gapCss 8.00)
- tauntBottom: 50 (tauntGapCss 8.00)
- bottomGapCss: 8.00  |Δ| vs taunt: 0.00
- result: **PASS** (required)

### Spacing table (CSS px)

| Gap | Target | Measured | Result |
|---|---|---|---|
| HUD_SPACE unit | 8 | 8.00 | PASS |
| taunt ↔ field (top) | 8 | 8.00 | PASS |
| field ↔ bottom letterbox | == taunt | 8.00 | PASS |
| meter ↔ field (P1) | 8 | 8.00 | PASS |
| meter ↔ field (enemy) | 8 | 8.00 | PASS |
| stick ↔ left edge | ~8 (touch) | -6.08 | PASS |
| stick ↔ bottom edge | ≥6 | 86.40 | PASS |
| Fire ↔ right edge | ≥8 (gutter≤22) | 14.40 | PASS |
| Fire ↔ bottom edge | ≥6 | 84.96 | PASS |
| meter label gap | 8 | 8.00 | PASS |

---
Required field-check FAILs: **0**
