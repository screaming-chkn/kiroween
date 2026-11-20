---
inclusion: fileMatch
fileMatchPattern: 'src/ui/possessedTaunts.js'
---
# Haunt Factory taunt pack (optional)

Optional additive pack. Default bank in `possessed-taunts.md` is unchanged.
Enable only with URL `?tauntPack=factory` (also accept `tauntPack=haunt-factory`).
Without the flag, every pick uses the default 16-line bank word for word.
`src/ui/possessedTaunts.js` mirrors these factory strings word for word when the pack is active.
Copy rule: say "SI"/"wingmen", never "AI". Each line ≤39 chars. Same cooldown / typewriter rules as the default pack.
Drop by deleting this steering section, the FACTORY_TAUNTS bank, the URL gate, and spec 15.

## FACTORY SPAWN
- Assembly line says hello.
- Fresh off the haunt belt.
- Factory floor missed you.

## FACTORY WINDUP
- Conveyor locked. Ring next.
- Stamp press aims for you.

## FACTORY HIT
- Quality check: you failed.

## FACTORY LOW HP
- Warranty void at that HP.

## FACTORY ENEMY DEATH
- Line stopped. Haunt clocks out.

## FACTORY PLAYER DEATH
- Boxed, tagged, shelfed. Next.
