# 06-cursed-salvage — Requirements (planning stub)

## Introduction
Post-match Salvage: pick 1 of 3 offered parts, some cursed with a hex. Planning
placeholder only — no gameplay is implemented against this spec yet. Refine in
Kiro before building.

## Requirements

### R1 Salvage offer
User story: As a player, I want to pick a reward after a match so the meta loop
has stakes.
- WHEN a match ends THEN the system SHALL offer 3 salvage parts.
- The player SHALL pick exactly 1; the choice SHALL persist to the garage.

### R2 Cursed parts
User story: As a player, I want some rewards to carry a risk so choices matter.
- Some offered parts SHALL be cursed and SHALL carry a visible text tag (never
  colour alone — accessibility steering rule 6).
- A hex SHALL NEVER take input away from the player.

### R3 Hexes (DEFERRED as musts)
- Liar's Eye, Hungry Core, Loud Bones are **deferred**; not MVP musts. If they
  land, each SHALL be a pure, testable rule.

## MVP status (11/5)
**PHASE 2 — planning only.** Placeholder spec; numbering reserved after the
haunted thin layer. MVP cuts: hexes are not musts, no pings/Surge. Nothing here
is implemented.
