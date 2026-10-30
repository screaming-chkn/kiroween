---
inclusion: always
---
# Structure
- `index.html` entry. `src/` game code split by spec: `engine/`, `mech/`, `combat/`, `radar/`, `ai/`, `salvage/`, `ui/`.
- `src/data/` parts, hexes and maps as plain JSON/JS data.
- `assets/` original audio and art only. `tests/` mirrors `src/`.
- `.kiro/specs/NN-name/` one spec per system (01-core-engine … 07-ui-crt). Check tasks off as they land.
- Small modules, one responsibility each; UI files follow design-tokens.md and ui-style.md.
