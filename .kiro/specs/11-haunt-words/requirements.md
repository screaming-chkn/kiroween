# 11-haunt-words — Requirements

## Introduction
Haunted copy for the end card, the enemy HUD label and the possessed taunts.
Strings come word for word from the approved copy in
`build-review/hook-copy.md`. No new game systems. Clarity first: buttons and
control labels stay plain. Player-facing text says "possessed" or "the bot",
never "AI".

## Requirements

### R1 End card
- WHEN the player wins below HAUNT LV 5, the end card SHALL show the stamp
  EXORCISED, the subline "The haunt retreats... for now.", and the cause line
  "Spirit banished." (the kill toast).
- WHEN the player wins at HAUNT LV 5 (max), the end card SHALL show the stamp
  LAID TO REST and the subline "Nothing left to haunt. Yet.".
- WHEN the player wins below LV 5, the end card SHALL also show the level-up
  line "THE HAUNT RISES · HAUNT LV {n}. It remembers you." where n is the new
  level.
- WHEN the player loses, the end card SHALL show the stamp POSSESSED, the
  subline "Your mech joins the haunt.", and the cause line
  "Your mech was destroyed." (unchanged).
- The copy helpers SHALL take `{ level, maxLevel }` so the max-level case is
  decided in one place.
- The stamp SHALL be drawn with a max width so every stamp fits the 520 px card.
- The buttons SHALL stay REDEPLOY and GARAGE.

### R2 HUD flavor
- The enemy over-unit bar label SHALL read HOUND (was HP).
- The player HUD labels, DASH and FIRE SHALL stay plain.

### R3 Taunts
- The system SHALL hold 16 taunts in six moments, exactly as in hook-copy.md:
  spawn (4), windup (4), hit on player (2), low player HP (2), enemy death (2),
  player death (2).
- Every line SHALL be at most 39 characters.
- Windup and hit taunts SHALL share one 8 s cooldown and SHALL NOT cut off a
  line that is still showing.
- WHEN player HP first drops to 25% or less in a match, the low-HP taunt SHALL
  fire once for that match.
- WHEN the player loses, a player-death taunt SHALL speak.
- WHILE the demo flag is set, spawn SHALL force spawn[0] and enemy death SHALL
  force enemyDeath[0].
- The steering file `possessed-taunts.md` SHALL list exactly the wired lines.

### R4 Spec-haunted line
- WHEN the player loses and `public/seance-tasks.json` is loaded, about one
  time in three the player-death taunt SHALL be "Task {id} done. So are you."
  where {id} is a real done task from that file, written "<spec number>.<task id>"
  for numbered specs (for example 10.32) and the plain id otherwise.
- IF the line would exceed 39 characters, or no data is loaded, THEN a normal
  player-death line SHALL be used.
- The system SHALL NOT invent task ids.
