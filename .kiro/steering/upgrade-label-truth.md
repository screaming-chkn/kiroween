---
inclusion: fileMatch
fileMatchPattern: "(src/mech/tankUpgrades\\.js|src/ui/garage\\.js|src/combat/**)"
---
# Upgrade label truth (LABEL-TRUTH)

- Every `notchLabel` SHALL equal the effect measured in the combat sim. If the
  sim changes, change the label or the number so they match again.
- Do not invent numbers. A label may only state a value that a test reads back
  from the sim or from `src/combat/config.js`.
- When the walls-break flag is on, the TURRET max notch label SHALL include
  "Breaks walls". The flag is on only if the sim lets the player break walls at
  that notch (see `wall-physics.md`).
- Lower notches SHALL NOT claim wall breaking.
- LV1 enemy HP stays 220. Label work never retunes LV1.
- A label test covers every notch of every bar. It fails when a label and its
  measured effect differ.
