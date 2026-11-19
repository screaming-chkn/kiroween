# 12-haunting — Requirements

## Introduction
Visible haunting for the arena and the garage. The arena and garage should look
haunted, not clean, while combat stays readable and holds 60 fps on phones.
Each effect does one job (ui-style.md). Colours come from design-tokens.md only:
ghost #9FD8FF for spirit effects, phosphor-dim, void, panel. Caps: vignette
≤ 0.25, fog ≤ 0.35, flicker ≤ 2 per second. Canvas 2D and CSS only, no new
image assets. Player-facing text is unchanged.

## Requirements

### R1 Arena tint and vignette
- The arena SHALL draw a ghost-tinted vignette on the FOG layer (screen space,
  under the HUD numbers) with a maximum alpha of 0.25 at the corners and a clear
  centre. Job: focus on the fight.
- WHILE reduced motion is on, the vignette SHALL still be drawn. It never moves.

### R2 Border fog
- The arena SHALL draw FOG_PUFFS = 14 soft fog puffs drifting slowly outside the
  arena border, each with alpha ≤ 0.35. Job: marks the boundary.
- A puff SHALL NOT extend inside the play area by more than a 24 wu bleed.
- WHILE reduced motion is on, the puffs SHALL be drawn static (no drift).

### R3 Ectoplasm trail
- WHILE the enemy is alive, the system SHALL sample its position every 60 ms
  (TRAIL_SAMPLE_MS) into a ring buffer of TRAIL_MAX = 16 preallocated slots and
  draw each sample as a fading ghost-blue dot for TRAIL_LIFE_MS = 700 ms. Job:
  shows where the possessed tank moved.
- The trail SHALL be drawn under the tanks, never over the windup tell or shots,
  and never in blood red.
- WHILE reduced motion is on, the trail SHALL be off.

### R4 Kill ghost
- WHEN a tank is destroyed (win or loss), a ghost sprite SHALL rise from the
  wreck over GHOST_MS = 1400 ms (rise 90 wu, fade out, slight sway). Job: state
  change.
- WHILE reduced motion is on, the ghost SHALL be static: it fades over GHOST_MS
  without rising or swaying.

### R5 Grid flicker
- The arena grid alpha SHALL flicker subtly around a base of 0.12 within
  0.08–0.18, changing value at most 2 times per second. Job: ambient dread.
- WHILE the enemy winds up, the grid alpha SHALL brighten toward 0.2 as the
  windup progresses. This supports the red windup telegraph and never replaces it.
- WHILE reduced motion is on, the grid alpha SHALL stay steady at 0.12.

### R6 Garage
- The garage SHALL show fog and ghost wisps behind the mech preview, made with
  CSS only: layered radial gradients in the ghost and phosphor-dim tokens on
  pseudo-elements that drift with transform and opacity animations.
- The garage SHALL show a faint ghost gradient tint on `.hh-slot`,
  `.hh-preview__art` and the picker.
- Text contrast SHALL stay ≥ 4.5:1 and no haze behind text SHALL exceed 0.35.
- WHILE reduced motion is on (media query or setting), the wisps SHALL be static
  and nothing SHALL animate.

### R7 Performance
- The effects SHALL use Canvas 2D only, with no new image assets.
- Fog puff, ghost and vignette sprites SHALL be pre-rendered once to offscreen
  canvases. The vignette SHALL be re-rendered only on resize.
- The haunting update and draw path SHALL make no per-frame allocations (ring
  buffers and fixed arrays) and particle counts SHALL be capped by constants.
- Headless frame timing at 1280x800 and at phone DPR 2 SHALL stay at 60 fps.
- WHEN the touch UI is active (phones), the haunting SHALL run a lite set:
  no vignette and FOG_PUFFS_LITE = 8 fog puffs (each full effect cost about
  4 ms per frame on the 4x-throttled DPR 2 phone profile).

### R8 Readability
- The windup tell, shots and HP labels SHALL stay as visible as before.
  Checked by before/after screenshots at 1280x800, 390x844 and 844x390, DPR 2.
- Reduced motion SHALL follow `prefers-reduced-motion` through the existing
  `reducedMotion` flag passed into `startArena` and `showGarage`.
