# 15-haunt-factory — Design

## Approach
Additive data + URL gate only. No new systems.

1. Steering `.kiro/steering/haunt-factory-taunts.md` (`inclusion: fileMatch` on `src/ui/possessedTaunts.js`) lists factory lines.
2. `FACTORY_TAUNTS` frozen object mirrors steering. Keep `TAUNTS` byte-identical to main.
3. `isFactoryTauntPack(search)` reads `tauntPack=factory` | `haunt-factory`.
4. `pickTaunt(kind, rng, bank = TAUNTS)` accepts an optional bank.
5. `createTauntMachine({ demo, rng, pack })` — when `pack === 'factory'` and not demo, use `FACTORY_TAUNTS`; else `TAUNTS`.
6. `main.js` passes `pack: isFactoryTauntPack(location.search) ? 'factory' : null` (or equivalent).
7. Tests extend `tests/ui/possessedTaunts.test.js`. Saving `src/ui/possessedTaunts.js` fires `test-on-save`.

## Drop path
Delete `FACTORY_TAUNTS`, gate helpers, pack arg, steering file, and this spec folder; revert main.js one-liner. Or drop the whole branch.
