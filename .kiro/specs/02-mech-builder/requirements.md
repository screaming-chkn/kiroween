# 02-mech-builder — Requirements (draft, refine in Kiro)

## Introduction
The Garage lets the player bolt a mech together from parts in six slots, within Weight and Power budgets. The build decides the role tag and the stats the match uses.

## Requirements
### R1 Slots and list picker
User story: As a player, I want to pick a part for each slot from a clear list so I can build fast with keyboard, mouse or a screen reader.
- The system SHALL provide six slots: Legs, Core, Arm L, Arm R, Back, Head.
- WHEN the player selects a slot THEN the system SHALL list compatible parts with stat deltas versus the equipped part.
- WHEN the player confirms a part THEN the system SHALL equip it and update all stats within one frame.
- The picker SHALL be fully operable by keyboard (arrows, Enter, Esc) and expose labels to screen readers.

### R2 Parts data
- The system SHALL load parts from plain data in `src/data/parts.js` (id, slot, name, weight, powerDraw or powerOut, stats, flavor, optional hexId).
- Every part SHALL have at least one stat upside (no dead picks).
- The MVP SHALL ship about 12 parts covering all six slots.

### R3 Weight budget and curve
User story: As a player, I want to see how heavy my build is so I know how it will move.
- The system SHALL compute load% = total weight / leg capacity × 100.
- WHEN load% ≤ 80 THEN speed penalty SHALL be 0.
- WHEN 80 < load% ≤ 100 THEN speed penalty SHALL rise linearly to 15%.
- WHEN 100 < load% ≤ 115 THEN speed penalty SHALL rise linearly to 45% and dash cooldown SHALL double.
- WHEN load% > 115 THEN Deploy SHALL be blocked with the text "Too heavy to walk."
- PBT: for any legal loadout with load% ≤ 115, Deploy SHALL be allowed; the penalty SHALL be monotonic non-decreasing in load% and stay within [0, 0.45].

### R4 Power budget
- The system SHALL compute power balance = core output − sum of draws.
- WHEN power balance < 0 THEN the build SHALL be marked Overdraw and weapons SHALL stutter in match (fire rate scaled by output/draw), never blocked.
- PBT: displayed power balance SHALL equal output − draws for any loadout.

### R5 Role tag
- The system SHALL derive a live role tag (SCOUT, BRUISER, LONGSHOT; WARDEN stretch) from part role tags, highest weighted count wins, ties broken by the Core part.
- WHEN any part changes THEN the tag and stat bars SHALL update.

### R6 Persistence and start fast
- The system SHALL save the current build to localStorage and restore it on load.
- WHEN there is no save THEN the system SHALL equip a preset legal mech so Deploy works immediately (supports 01 R5).

### R7 Hex parts
- WHEN a cursed part is equipped THEN the system SHALL show its hex name, upside, downside and visual mark (candle, cracked glass, chain).
- No hex SHALL remove or alter player input (steering rule).

## Preview feedback 11/2 (SHOULDs)

### R8 Readable stats
- Stat chips SHALL use full words or unique codes (ARM SPD DMG SEN); deltas SHALL be labelled "vs equipped".
- Part descriptions and tonnage/draw text SHALL be ≥ 14px, non-italic, ≥ 4.5:1 on panel.
- WHEN the build is overdrawn THEN the garage SHALL show "Overdrawn: fire rate -X%"; WHEN Deploy is pressed with negative power THEN a confirm line "Weapons will stutter. Deploy anyway?" SHALL show (Deploy still allowed).

### R9 Explain the numbers
- The load readout SHALL say "cap from LEGS" next to used/cap, so a cap change (e.g. 80→110 when legs change) is explained.
- The role tag SHALL have a one-line tooltip naming the parts that set it (e.g. "Role from: Back + Legs").

### R10 Garage layout
- At ≥ 1280 px wide the garage SHALL use three columns: slots | part list | mech preview + stats; stat bars ≥ 12px tall with 12px labels.
- The warning line's height SHALL be reserved so the footer does not jump when a warning appears.
- Parts SHALL show a bone border on hover.
