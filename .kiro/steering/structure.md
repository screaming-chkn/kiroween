---
inclusion: always
---
# Structure
- `index.html` entry, `src/main.js` boot (title → garage → arena, sim/presentation split).
- `src/engine/`: loop, input, touch, camera, render, audio, music, fonts, settings.
- `src/combat/`: duel sim and its views. Sim: arena, mech, enemy, projectile, damage, actions, restart, config (all tuning numbers). Feel and presentation: feel, hitFeedback, hud, combatRenderer, endcard, sfxEvents.
- `src/mech/`: loadout, weight, role, silhouette.
- `src/data/`: parts and presets as plain JS data.
- `src/ui/`: DOM and canvas screens. title, garage, pauseMenu, seance, possession, specStamp, hauntLevel, killMoment, endCardView, possessedTaunts, touchControls, phoneCombatUi, tankWire, tankFx.
- `tests/` mirrors `src/` (`engine`, `mech`, `combat`, `ui`). `tests/combat/balance*.mjs` is the balance matrix, `BALANCE.md` its report.
- `scripts/`: Node build scripts (`build-seance-tasks.mjs`; the site build script is added separately).
- `public/seance-tasks.json`: build-ledger data read by the SÉANCE terminal.
- `assets/audio/` original OGG + MP3 loops and stings. `assets/fonts/` woff2 plus OFL licences. Original assets only.
- `.kiro/`: `steering/` (this folder), `specs/NN-name/` (requirements, design, tasks; 01–10 plus `haunted-spec`), `hooks/`, `agents/`, `settings/`. Check tasks off as they land.
- Small modules, one responsibility each. UI files follow design-tokens.md and ui-style.md.
