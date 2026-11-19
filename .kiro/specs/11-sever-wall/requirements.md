# Sever Wall: requirements

Original obstacle name: **Sever Wall**. Original geometry; no reference-game names or assets.

1. **Gating.** The wall exists only at HAUNT LV 3, 4 and 5. LV1 and LV2 stay an open field. `createArena(totals, { hauntLv })` builds it; `main.js` reads the level before creating the arena, so REDEPLOY and a win-ramp both get the right layout. `stats.severWall` (true/false) overrides the level for test harnesses. Omitting the level means no wall. The balance harness passes `hauntLv` into `createArena` so LV3+ fights include the wall; LV1–2 stay open.
2. **Geometry.** One vertical slab on the arena midline (`SEVER_WALL_X/Y` in `config.js`), 120 wu long (about 1.5 tank widths, tank taken as 80 wu), 16 wu thick. Two flank corridors stay open above and below.
3. **Movement.** The wall blocks mechs. A player move into it slides along the wall or stops. A dash that bumps the wall loses its remaining burst (the cooldown keeps running). The bot slides around the wall when it meets it head-on. No bump SFX yet; silent.
4. **Shots.** Projectiles of both sides die on contact. No bounce.
5. **Draw.** World-space slab, void fill, bone outer stroke and phosphor inner stroke (double wireframe), fully opaque. It sits on the WORLD layer, under the HUD, meters and taunt.
6. **Not changed.** `HAUNT_LEVELS` HP and damage, LV1/LV2 layout, all other tuning numbers.
7. **Follow-up.** Re-run `npm run test:balance` (or full) to re-check the LV3–5 bands with the wall present; no numbers were tuned here.
8. **Tests.** `tests/combat/severWall.test.js`.
