# 08-phone-touch — Requirements

## Introduction
Lean phone pass: on-screen touch controls and a responsive garage so the game is
playable on a ~390×844 phone. No new game systems, no combat tuning changes.

## Requirements

### R1 Touch stick + dead-zone
- WHEN a finger touches the left stick zone, the system SHALL steer the mech by
  the drag vector from the touch-down point, clamped to magnitude 1.
- WHEN the drag is under 0.18 × stick radius, the system SHALL report no movement.

### R2 Fire / Dash buttons, multi-touch
- WHILE a finger holds FIRE, the system SHALL fire; WHILE a finger holds DASH,
  the system SHALL report dash (the arena buffers it like Shift).
- The stick, FIRE and DASH SHALL work simultaneously with independent fingers.
- WHEN a pointer is cancelled, the system SHALL release its control.

### R3 Aim rule
- WHEN the FIRE finger is dragged past the dead-zone from its touch-down point,
  the system SHALL aim in the drag direction.
- ELSE WHEN the stick is active, the system SHALL aim along the move direction.
- ELSE the system SHALL keep the last aim direction (initially right).
- Aim point SHALL be viewport centre + dir × 0.35 × min(width, height), never null.

### R4 Responsive garage (390×844)
- WHEN the viewport is ≤ 700px wide, the garage SHALL stack slots, picker and
  preview in one scrollable column with no horizontal overflow.
- Slot rows, part options, DEPLOY and SÉANCE SHALL be ≥ 44px tall.
- Padding SHALL respect `env(safe-area-inset-*)`.
- Touch controls SHALL show only for coarse pointers, or touch devices ≤ 900px
  wide; a narrow desktop mouse window SHALL NOT get pads.
- Touch controls SHALL be inert once the match ends so end-card taps reach the canvas.

### R5 Desktop unchanged
- At ≥ 1280px (and the default 701–1279px layout) the garage SHALL keep its
  existing rules and behaviour.

### R6 No combat tuning changes
- This spec SHALL NOT modify `src/combat/config.js` or any combat numbers.
