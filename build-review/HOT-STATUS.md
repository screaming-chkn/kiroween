# HOT RUN status (feat/hud-c)

## PRIORITY tip for owner lock (C5 + S1/S2) — TOP
- **Tip SHA (S1+S2 feature):** `a3128e33ae063c44bfccad9a93796c674e8cde8e` (`a3128e3`)
- **Current branch tip:** `ebd57fb6c0bc2407d6df5eaf4087d82adc74b6e5` (`ebd57fb`) (includes HOT-1/2 docs after S1/S2)
- **Branch:** feat/hud-c (pushed; **merge still held**)
- **npm test:** **986** passed / 0 failed
- **Field-check:** PASS (player/enemy gapCss 4.00; tauntGapCss **10.00**)
- **Shots:** `build-review/shots-hud-c5b/`
  - `c5b-phone-land-lv1-taunt.png`
  - `c5b-phone-land-lv3-sever.png`
  - `c5b-desk-lv1-mid.png`
  - `FIELD-CHECK.md`
- **S1:** dark plate + `TAUNT_ABOVE_GAP=10`
- **S2:** compact side-out thicker bar + `hpFontPx` 18; names + orange→red@25% kept
- **Unchanged:** C5 Fire/Dash fractions, `LANDSCAPE_GUTTER_FRAC` 0.144, Sever Wall, balance

## Kiro runs
| id | Credits Δ | Authored |
|---|---|---|
| HOT1 | 291.67→293.05 (~1.38) | `.kiro/specs/14-phone-landscape/*`, `.kiro/steering/phone-landscape.md` |
| HOT2 | (with HOT2b) →294.32 (~1.09 from 293.05) | `.kiro/hooks/landscape-hud-on-save.json`, `tests/engine/touchLayout.pbt.test.js` (7 props), package.json, tasks ticks |
| HOT2b | (included above) | one-line comment in `src/engine/touch.js` so PostFileSave fired `landscape-hud-on-save` |

Proof: `deploy/kiro-proof/hud-c/runHOT{1,2,2b}-*.txt`

## Outcomes
- **Perf:** HOT-PERF.md — 60.1 FPS @2/@3 unthrottled; **no soft fix**
- **LV1:** balance.test human profiles **PASS**; **no retune** (HOT-LV1.md)
- **Bugs:** README fifth-hook mention + seance rebuild; no other actionable (HOT-BUGS.md)
- **Claims:** `WONT-TO-CAN-CLAIM.md`

## Credits
- Before hot run: **291.67 / 877** (33.3%)
- After HOT-1/2/2b: **294.32 / 877** (33.5%)
- Used this window: ~**2.65**

## Hook / SÉANCE
- hook-runs.log: **182** (was 174); `landscape-hud-on-save` firings present
- SÉANCE: **228 / 207** done (was 221 / 200)
