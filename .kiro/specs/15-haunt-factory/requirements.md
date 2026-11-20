# 15-haunt-factory — Requirements

## Introduction
Optional "Haunt Factory" taunt pack for Devpost combo *Steering → Spec → CLI → Hook*.
Default gameplay and default taunt text MUST stay identical to main without a URL flag.
No combat, balance, hitbox, HUD layout, or FPS changes.

## Requirements

### R1 Optional pack gate
- WHEN the page URL has `tauntPack=factory` (or `tauntPack=haunt-factory`), the taunt machine SHALL pick lines from the factory pack.
- WHEN the flag is absent or any other value, the taunt machine SHALL use the default 16-line bank exactly as on main.
- Demo flags (`?demo=1`, `?taunts=demo`, `?seed=demo`) SHALL still force default DEMO_SPAWN / DEMO_DEATH when demo is on; factory pack does not override demo.

### R2 Factory copy
- The factory pack SHALL provide 4–8 new PG-13 lines across spawn / windup / hit / lowHp / enemyDeath / playerDeath.
- Every factory line SHALL be ≤39 characters.
- Strings SHALL match `.kiro/steering/haunt-factory-taunts.md` word for word.
- Copy says "SI"/"wingmen", never "AI". No owner names, emails, or box paths in game text.

### R3 Isolation / drop
- Factory lines SHALL live in a clearly named export (e.g. `FACTORY_TAUNTS`) separate from `TAUNTS`.
- Removing the pack + URL gate + this spec SHALL restore default behaviour with no leftover combat changes.

### R4 Tests
- Tests SHALL cover: default bank unchanged; `isFactoryTauntPack` / pack gate; pick from factory bank when pack is on; machine onSpawn with pack uses a factory spawn line.
