# 05-enemy-ai — Requirements (planning stub)

## Introduction
Enemy squad behaviour and the two SI wingmen. Planning placeholder only — no
gameplay is implemented against this spec yet. Refine in Kiro before building.

## Requirements

### R1 Enemy squad behaviour
User story: As a player, I want enemies that move, aim, and fire so a match
feels like a fight, not a shooting gallery.
- The system SHALL spawn an enemy squad at match start.
- Enemies SHALL pursue, aim at, and fire on the player within range.
- Enemy fire SHALL respect the same damage/cooldown rules as the player.

### R2 SI wingmen (DEFERRED)
User story: As a player, I want two SI wingmen I can order so the squad reads
as a team.
- Wingmen and the F tap=Follow / hold=Hold-Capture order are **deferred**; not
  an MVP must. The combat slice ships player-vs-enemy only.

### R3 Difficulty / feel
- Enemy accuracy and reaction SHALL be tunable so the starter match is fair.

## MVP status (11/5)
**PHASE 2 — planning only.** This spec is a placeholder so numbering does not
collide with the already-built haunted thin layer (see
`.kiro/specs/haunted-spec/tasks.md`). MVP cuts: no wingmen, no pings, no Static
Surge, no hexes as musts. Nothing here is implemented.
