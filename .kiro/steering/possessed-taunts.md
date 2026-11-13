---
inclusion: fileMatch
fileMatchPattern: 'src/ui/**'
---
# Possessed taunts (12 lines)
The enemy SI is "possessed": its CRT overlay types short, PG-13 taunts. Each line is ≤39 chars.
`src/ui/possessedTaunts.js` uses these strings word for word; change both together.
Copy rule: say "SI"/"wingmen", never "AI". Windup taunts rate-limited to one per 8 s.
Demo flag (`?demo=1`, `?taunts=demo`, `?seed=demo`) forces the first SPAWN and DEATH lines.

## SPAWN
- Nice build. Did a toddler pick it?
- I've haunted toasters scarier than you.
- Oh good. Spare parts delivered.
- Your loadout is a cry for help.

## WINDUP
- Hold still. This won't hurt me.
- Smile for the afterlife.
- Dodge this, scrap metal.
- Counting down your warranty...

## DEATH
- I'll haunt your save file.
- Lucky. I was lagging.
- Tell the garage... I was robbed.
- This isn't over. I'm literally a ghost.

## Presentation
- Typewriter 32 ms/char, hold 2000 ms, fade 300 ms.
- Share Tech Mono ≥14px, 1px void outline, ghost blue #9FD8FF; never over HUD numbers.
- Text only: no flashing, honors reduced motion (still typed, no shake).
