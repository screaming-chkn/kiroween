---
inclusion: fileMatch
fileMatchPattern: 'src/ui/**'
---
# Possessed taunts (16 lines)
The enemy SI is "possessed": its CRT overlay types short, PG-13 taunts. Each line is ≤39 chars.
`src/ui/possessedTaunts.js` uses these strings word for word; change both together.
Copy rule: say "SI"/"wingmen", never "AI". Windup and hit taunts share one 8 s cooldown and never cut off a line still showing. Low HP fires once per match.
Demo flag (`?demo=1`, `?taunts=demo`, `?seed=demo`) forces the first SPAWN and ENEMY DEATH lines.

## SPAWN
- You built that? I'll wear it next.
- Fresh metal. I can smell the warranty.
- Back again? The haunt missed you.
- I was spec'd to beat you. Task done.

## WINDUP
- Feel that chill? That's the ring.
- Hold still. I'm aiming for your soul.
- Dash late. I dare you.
- One tell. Then the toll.

## HIT
- That one's going in the séance log.
- Rattling your bolts yet?

## LOW HP
- Your HP is a ghost story now.
- So close to joining me.

## ENEMY DEATH
- You can't kill what's already dead.
- Fine. I'll haunt your garage.

## PLAYER DEATH
- Welcome to the haunt. Pull up a chain.
- Another mech for my collection.

## Spec-haunted line
`specTauntLine(tasks, rng)` replaces the player-death line about one time in three with "Task {id} done. So are you." The id comes from a real done task in `public/seance-tasks.json`, written "<spec number>.<id>" for numbered specs (10-polish id 32 is 10.32), else the plain id. If there is no data or the line would pass 39 chars, a normal PLAYER DEATH line is used. Ids are never invented.

## Presentation
- Typewriter 32 ms/char, hold 2000 ms, fade 300 ms.
- Share Tech Mono ≥14px, 1px void outline, ghost blue #9FD8FF; never over HUD numbers.
- Text only: no flashing, honors reduced motion (still typed, no shake).
