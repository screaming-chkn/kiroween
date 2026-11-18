---
inclusion: fileMatch
fileMatchPattern: ["src/combat/**", "src/data/parts.js", "src/ui/garage.js"]
---
# Loadout effects (M4.5, spec 10-polish R8)
- One effect per arm or core part: one clear upside, plus (for most parts) a reload or dash cost stated in the same line, so parts are sidegrades.
- Reuse existing systems only: fire rate, shot damage, projectile speed, dash cooldown, HP, incoming damage. No new art, no new systems, no new HUD. The HP bar already shows a higher max HP.
- Every effect has a one-line garage text that states the real number, for example "COMBAT: shots fly 40% faster, +4% reload". Keep the text and the number in `src/combat/loadoutEffects.js` in sync.
- `FEATURES.loadoutEffects` in `src/combat/config.js` gates everything: the mods, the arena code paths and the garage line. Flag off means today's behaviour exactly (same seeded fights, same results). Arena applies `combatMods` only when the field exists.
- Tradeoffs come from weight, power and the stated reload/dash cost — never hidden penalties.
- The balance harness leads its shots with the build's real shot speed (`projectileSpeedMult`), so faster-shot parts are measured fairly.
- Damage rounds to whole numbers, so HP and incoming-damage effects jump in hit-count cliffs (LV5 kills a 140 HP tank in 6 hits of 24). Prefer smooth levers (reload, shot speed, damage on a 1500+ HP enemy, dash).
- Tune numbers only, with the balance harness: `BALANCE_SEEDS=200 npm run test:balance`. Keep R6 and R8 acceptance: every LV in its band, medians 45-120 s, no build more than 15 pp from its LV mean, dashSpam still loses to the reactive probe.
- If R8 is not clean by Nov 23, cut the milestone.

## Current effects (tuned, M4.5)
| Part | Name | Upside | Cost | Garage line |
|---|---|---|---|---|
| armR-hatchet | Hatchet Arm | shot damage 14 -> 18 | reload x1.32 | COMBAT: shots deal 18 (base 14), +32% reload |
| armR-lancer | Lancer Arm | projectile speed x1.4 | reload x1.04 | COMBAT: shots fly 40% faster, +4% reload |
| armL-buckler | Buckler Arm | +22 max HP | dash cooldown x1.5, reload x1.18 | COMBAT: +22 max HP; dash recharge +50%, +18% reload |
| armL-spotter | Spotter Arm | dash cooldown x0.85 | reload x1.08 | COMBAT: dash recharges 15% faster, +8% reload |
| core-pulse | Pulse Core | reload x0.95 | (lighter, less power) | COMBAT: reload 5% faster |
| core-furnace | Furnace Core | projectile speed x1.2, reload x0.97 | (heavier: Runner + Furnace is mid weight) | COMBAT: shots fly 20% faster, reload 3% faster |
