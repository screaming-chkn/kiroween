# WON'T → CAN claim list (HOT RUN, feat/hud-c)

Honest updates for Hook after this hot run. Numbers checked against `KIRO-USAGE.md`, `.kiro/hook-runs.log`, and `public/seance-tasks.json` on tip.

## WASN'T claimable / NOW is (new this hot run)

| Item | Now |
|---|---|
| Spec **14-phone-landscape** | `.kiro/specs/14-phone-landscape/` (requirements / design / tasks) — Kiro HOT-1 |
| Steering **phone-landscape.md** | `.kiro/steering/phone-landscape.md` — Kiro HOT-1 |
| Hook **landscape-hud-on-save** | `.kiro/hooks/landscape-hud-on-save.json` — Kiro HOT-2; firings logged (`landscape-hud-on-save` lines in `.kiro/hook-runs.log`, incl. Kiro PostFileSave on `touch.js`) |
| PBT **touchLayout.pbt.test.js** | `tests/engine/touchLayout.pbt.test.js` — **7 properties**, hand-rolled seeded PRNG, wired in `npm test` — Kiro HOT-2 |
| Hooks total | **5** hook JSON files (was 4) |
| Hook-runs.log | **182** lines (was 174 at hot-run baseline) |
| SÉANCE | **228** tasks / **207** done (was 221 / 200) |
| npm test | **986** passed (was 979; +7 PBT) |
| Kiro Pro credits (this hot window) | **291.67 → 294.32** of 877 (~**2.65** used on HOT-1/2/2b) |
| C5b S polish (Eggbot) | Taunt dark plate + `TAUNT_ABOVE_GAP=10`; larger landscape cur/max — **hand** (not a Kiro claim for authorship); shots `build-review/shots-hud-c5b/` FIELD-CHECK PASS |
| Landscape FPS note | `build-review/HOT-PERF.md` — unthrottled 844×390 @2/@3 **60.1** FPS (≥55; no soft fix) |

## STILL won't claim

| Item | Why |
|---|---|
| Kiro IDE / Web / Crew / MCP / powers | Not used; every logged run is headless `kiro-cli` |
| Hooks fed results back to Kiro | Headless v3 still does not feed hook stdout into the model loop; we re-ran tests by hand |
| PBT caught a bug | `touchLayout.pbt` and `loadoutEffects.pbt` both passed first run; **no bug caught** |
| Which app wrote Oct–Nov early specs (01–08) | Unknown; do not name IDE vs CLI for that phase |
| Soft LV1 combat retune | Harness already in band; Eggbot M fight-length skipped |
| C5 Fire/Dash/gutter as “locked forever” | Spec/steering say defaults + custom-layout toggle later |

## Approved honesty line (unchanged shape)
Runs on CLI v2 did not load hooks; from v3 onward hooks fire on Kiro's own edits and every firing is in `.kiro/hook-runs.log`. Don't say hooks fed results back.
