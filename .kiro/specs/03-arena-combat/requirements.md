# 03-arena-combat — Requirements

## Introduction
The Arena Combat system runs a minimal prototype match: one walled rectangular arena, a player-controlled mech, one enemy bot, projectile combat, HP tracking, and win/lose screens with restart. It is the first playable slice of HAUNT//HOUND — every other combat feature builds on this foundation.

## Requirements

### R1 Arena
User story: As a player, I want a clearly bounded arena so I know where I can move.
- The system SHALL render a rectangular walled arena with solid walls on all four sides.
- WHEN a mech or projectile reaches a wall THEN the system SHALL stop the mech or destroy the projectile at the wall boundary.
- The arena SHALL be at least 1200 × 900 world units so that combat has room to maneuver.

### R2 Player movement
User story: As a player, I want to steer my mech with WASD so movement feels direct and responsive.
- WHEN W, A, S or D is held THEN the system SHALL move the player mech in the corresponding world direction at the mech's effective speed.
- The effective speed SHALL be `baseSpeed × (1 − speedPenalty(loadPct))` where `speedPenalty` and `loadPct` come from 02-mech-builder R3.
- WHEN no movement key is held THEN the mech SHALL decelerate to a stop within one frame (no momentum in MVP).
- The player mech SHALL face the direction of the mouse cursor at all times (aim-to-mouse).

### R3 Player weapon and projectiles
User story: As a player, I want to fire at the enemy so I can deal damage.
- WHEN the player presses LMB THEN the system SHALL spawn a projectile at the player mech's weapon origin, traveling toward the current aim direction.
- The system SHALL enforce a minimum fire cooldown of 300 ms between shots.
- Projectiles SHALL travel at a fixed speed of at least 600 world units/s.
- WHEN a projectile reaches the arena boundary THEN the system SHALL destroy it.
- WHEN a projectile overlaps an enemy mech THEN the system SHALL apply damage to that enemy and destroy the projectile.
- PBT: damage applied to any entity SHALL be non-negative; HP after any hit SHALL be `max(0, HP − damage)`.

### R4 Enemy bot
User story: As a player, I want an enemy that moves and shoots so the match feels like combat.
- The system SHALL spawn one enemy bot in the arena at a position not overlapping the player's start position.
- The enemy bot SHALL use a two-state machine: CHASE (move toward player) and SHOOT (stop and fire when within fire range).
- WHEN the enemy is farther than fireRange from the player THEN it SHALL enter CHASE state and move toward the player at its own effective speed.
- WHEN the enemy is within fireRange of the player THEN it SHALL enter SHOOT state and fire a projectile toward the player on its own fire cooldown.
- WHEN an enemy projectile overlaps the player mech THEN the system SHALL apply damage to the player and destroy the projectile.
- Enemy projectiles and player projectiles SHALL be visually distinct (different color or shape).

### R5 HP and damage
User story: As a player, I want to see health bars so I know how the fight is going.
- The system SHALL track integer HP for both the player mech and the enemy bot; starting HP SHALL be configurable constants.
- WHEN a hit is applied THEN HP SHALL decrease by the weapon's damage value, floored at 0 (never negative).
- The system SHALL display a HUD HP bar for the player at all times during combat (contrast ≥ 7:1 on its background, per accessibility rule 1).
- The system SHALL display an HP bar over the enemy bot.
- PBT: for any sequence of hits with non-negative damage values, final HP SHALL be ≥ 0.

### R6 Win and lose conditions
User story: As a player, I want a clear end state so I know when the match is over.
- WHEN the enemy bot HP reaches 0 THEN the system SHALL pause the match and display a win screen.
- WHEN the player mech HP reaches 0 THEN the system SHALL pause the match and display a lose screen.
- Both screens SHALL show a "Restart" action reachable by keyboard (Enter or Space) and by click.
- WHEN the player activates Restart THEN the system SHALL reset the arena, both mechs, and all projectiles to their initial state without reloading the page.
- The win/lose screens SHALL not flash more than twice per second (accessibility rule 4).

### R7 Accessibility in combat
- WHEN `prefers-reduced-motion` is active or the Reduced Motion setting is on THEN screen shake SHALL be capped at 2 px maximum displacement (honoring 01-core-engine camera cap).
- HUD numbers (HP values) SHALL meet ≥ 7:1 contrast ratio against their background at all times.
- All interactive elements on win/lose screens SHALL have a visible 2 px ember-outline focus indicator and be reachable by Tab.
- Enemy and player projectiles SHALL differ by both color and shape so they are distinguishable without color alone.
