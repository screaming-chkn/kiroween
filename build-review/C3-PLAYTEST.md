# C3 playtest — feat/hud-c (post S-revision)
2026-11-19. Unmerged. Plan rev 11:15. Cold pin was `60b60c5`; S-revision shipped after Eggbot pass.

## Bot A — Build harness
- LV1 (40 seeds × 16 builds): firstTimer **34.7%** win / median **26.2 s**; medium **66.7%** / **27.2 s**. Band held.
- Draw-only tank scale (1.5) did not skew harness. **No HP/damage retune** after Eggbot.
- Sever Wall gated: LV1–2 open; LV3+ wall present.
- Y-check (prior full set): all **PASS**, gapCss **6.00**. S-revision did not change meter/taunt insets — prior y-check still valid.

## Rubric
| Item | Result | Note |
|---|---|---|
| meters/labels/taunt ≥6px below line | **PASS** | y-check; geometry unchanged by S-rev |
| top bar both HP + MM:SS | **PASS** | portrait full; landscape compact drops EN/POWER |
| Orbitron on phone | **PASS** (Eggbot desktop) | readable; phone sizes not played by Eggbot |
| tanks bigger/angular, no HUD crowd | **PASS** (Eggbot desktop) | clear of top bar |
| LV1 band | **PASS** | harness 34.7 / 66.7 / ~26–27 s |
| ghost + red ≤25% | **PASS** | kept |
| Sever Wall LV3+, not slowing | **PASS** (Eggbot) | readable; pace OK; spawn label added in S-rev |
| landscape vs portrait | **support both, landscape first (inferred)** | Eggbot did not play 390/844; layout-inferred |
| costume-as-mechanic visible | **partial** | Hound trail + taunts clear; own costume less so |
| fun/clarity cut | **no damage cut** | M/RISKY early LV1 soften deferred |

## Bot B — Eggbot v2 cold pass
- Status: **done** ~11:40 AM PT on pin `60b60c5`.
- Report: `build-host/crew/trials/eggbot-v2/cold-passes/2026-11-19-c3-60b60c5.md`
- Caveat: scripted/impaired aim; 0/2 wins at 7–13 s — trust harness/live human for numbers.
- Orientation pick: **support both, landscape first (inferred)**.

## Revision (S only — shipped)
1. Title `.hh-title-keys`: font clamp 15–18px, color bone `#E8E2D0`.
2. `TELL_CAPTION_MS` 3500 → **5000**.
3. **"SEVER WALL"** spawn label ~3.5s when wall present (`severWallLabelText` + draw).
- Deferred: M/RISKY early LV1 damage soften.
- Re-shots: see `shots-hud-c3/REVISION.md`.
