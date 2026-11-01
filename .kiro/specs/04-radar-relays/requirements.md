# 04-radar-relays — Requirements (draft, refine in Kiro)

## Introduction
CRT static is the fog of war. Relays clear it, the radar shows pings (some fake), and sound tells real mechs from ghosts.

## Requirements
### R1 Static fog
User story: As a player, I want static to hide what I can't see so scouting matters.
- The system SHALL render clear vision inside captured relay range and around the player, and static outside it.
- WHEN the player takes damage THEN static intensity SHALL rise and decay back over time.
- WHEN No-static is on THEN the system SHALL draw flat fog that carries the same information.
- Static SHALL be drawn under the HUD; HUD contrast SHALL stay ≥ 7:1 for numbers (accessibility steering).

### R2 Relays
- The map SHALL have 3 relays in the MVP.
- WHEN a mech stands in a relay's capture ring THEN capture progress SHALL advance (Scout role ×2) and SHALL reset if contested.
- WHEN capture completes THEN the relay SHALL belong to that team and reveal its radius for that team.

### R3 Radar pings
- The radar SHALL show enemy mechs inside revealed areas and pings for noise outside them.
- WHEN Liar's Eye is equipped THEN 1 in 4 pings SHALL be fake (seeded, testable).
- WHEN the player presses Space THEN the radar SHALL pulse and the player SHALL be revealed to enemies for a short time.
- Colorblind radar SHALL use shape plus color for every ping type.
- PBT: over N pings with Liar's Eye, the fake ratio SHALL converge to 0.25 ± tolerance; without it, fake pings from hexes SHALL be 0.

### R4 Sound detection
- Real mechs SHALL emit footstep cues; phantom pings SHALL emit whispers.
- WHEN Loud Bones is equipped THEN footstep range SHALL double and the player SHALL auto-ping every 10 s.
- Every audio cue SHALL have a visual equivalent on the radar.

### R5 Static Surge
- WHEN the match clock reaches 5:00 THEN fog SHALL close from the map edge toward the relays and the enemy core shield SHALL drop.

### R6 Never take input
- No static, ping or hex effect SHALL remove or alter player input.
