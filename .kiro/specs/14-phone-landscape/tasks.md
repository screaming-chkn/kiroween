# 14-phone-landscape — Tasks

- [x] 1. requirements.md and design.md for the shipped C5 landscape touch layout (R1–R8)
- [x] 2. Steering `.kiro/steering/phone-landscape.md` (thumb arc, gutter, safe area, hit sizes, gaps, perf, defaults not locked)
- [x] 3. `tests/engine/touchLayout.pbt.test.js` (seeded PRNG, no deps) and wire it into `npm test` in package.json (R1, R2, R3, R4, R7)
- [x] 4. Hook `.kiro/hooks/landscape-hud-on-save.json` (PostFileSave, via `scripts/kiro-hook-run.mjs`) (R8)
- [x] 5. Exercise the hook by saving a matched file, and log each firing and result (R8)
- [x] 6. Measure mid-fight FPS on 844×390 @ DPR 3 class, write a note; soft fixes only if < 55 (R6)
- [x] 7. Mark R1–R5 acceptance against `tests/engine/touch.test.js` and `tests/combat/landscapeHud.test.js`, and report the Fire right-inset open item to the owner (R1, R2, R3, R4, R5)
