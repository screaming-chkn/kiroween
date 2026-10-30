# 01-core-engine — Requirements (skeleton, refine before running in Kiro)

## Introduction
The engine runs the game loop, input, camera, rendering and audio bus that every other system builds on.

## Requirements
### R1 Game loop
User story: As a player, I want smooth, consistent motion so the game feels responsive.
- WHEN the game runs THEN the system SHALL update at a fixed timestep and render at display rate, targeting 60fps on desktop Chrome/Firefox.
- WHEN the tab is hidden THEN the system SHALL pause the simulation.

### R2 Input
User story: As a player, I want keyboard and mouse controls that never get taken away.
- WHEN a key or mouse event happens THEN the system SHALL map it to an action (move, aim, fire, dash, order).
- WHEN F is tapped THEN the system SHALL emit Follow; WHEN F is held THEN it SHALL emit Hold/Capture.
- No game effect (including hexes) SHALL disable input.

### R3 Camera and render
- The system SHALL render a top-down view that follows the player mech.
- The system SHALL respect reduced-motion and No-static settings.

### R4 Audio bus
- The system SHALL provide music, SFX and static channels with independent volume.

### R5 Start fast
- WHEN the player hits Deploy THEN a match SHALL start in under 30 seconds.
