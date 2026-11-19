# 02-mech-builder — Tasks (draft)

- [x] 1. Parts data (~12 parts, 6 slots) + preset mech (R2, R6)
- [x] 2. Weight curve functions + unit tests at breakpoints (R3)
- [x] 3. Loadout totals + power balance (R3, R4)
- [x] 4. Role tag derivation with tie rule (R5)
- [x] 5. PBT: legal loadouts deploy, penalty monotonic/bounded, balance identity (R3, R4)
- [x] 6. Garage list picker UI, keyboard + screen reader (R1)
- [x] 7. Stat bars, role tag, Overdraw and "Too heavy to walk." states (R3–R5)
- [x] 8. localStorage save/restore (R6)
- [ ] 9. Hex part display (R7) — CUT (1v1 pivot)

## Preview feedback 11/2 (SHOULDs, one UI concern per task)
- [x] 10. Stat chips ARM/SPD/DMG/SEN, "vs equipped", 14px non-italic text (R8)
- [x] 11. Overdraw line + stutter confirm on Deploy (R8)
- [x] 12. "cap from LEGS" + role tooltip (R9)
- [x] 13. Three-column layout, taller stat bars, reserved warning line, part hover border (R10)

## Checkpoint fixes 11/5 (hardening of landed tasks; keep tests green)
- [x] 14. Garage a11y: slot container role=group (was list); each slot aria-label starts with its visible label text, e.g. "Legs — Runner Legs — press Enter…" (task 6 polish, a11y rule 5)

## Preview polish 11/5 (SHOULD, optional)
- [x] 15. Mech preview silhouette: `.hh-preview__art` renders a simple top-down SVG (legs/core/arms/back/head) via pure `silhouetteSpec(loadout)` + `refreshPreview` on the garage refresh path; present vs empty slots differ by shape (dashed) + label + opacity, phosphor/bone tokens, no animation. Unit test: tests/mech/silhouette.test.js (task 6 polish, a11y rule 6)

## owner GO 11/12 — wireframe tanks
- [x] 16. 3D wireframe tank units (Necker-box hull + rotating turret + barrel; player hover-tank, enemy heavier twin-barrel tracked tank); render only, hitboxes unchanged; garage silhouette parts get wireframe depth edges

## owner GO 11/12 — light tank FX

- [x] 17. Light render-only tank FX: 1.3× draw scale + phosphor edge glow (additive wide then crisp 1px, brighter front edges), muzzle flash + ~4px/120ms barrel recoil from projectile ids, hover shadow + 1–2px deterministic sine bob (player/enemy out of phase); no src/combat edits, hitboxes unchanged

## owner idea 11/12 — techy edge styles
- [x] 18. Optional tank edge styles behind EDGE_STYLE (dashed-tech default; solid, dashed, tech corner-brackets also available) and two one-colour TANK_PALETTE sets: slightly neon mono-green (default; player #47FF9A, enemy #FF3B5C) and mono-blue (alternate; player #3EF6FF with deeper blue glow, same #FF3B5C red enemy); mid-halo alpha 0.38 (8px under-halo 0.12 and barrel halo 0.18 unchanged); no gold/orange; render only, dash/brackets scaled to hull with a minimum dash length, glow and ticks stay solid
