# 01-core-engine — Design (skeleton)

## Overview
Fixed-timestep loop (accumulator, dt = 1/60) with interpolated render. Systems register update/render hooks.

## Components
- `engine/loop.js` — start/stop/pause, accumulator.
- `engine/input.js` — action map, tap vs hold detection (F).
- `engine/camera.js` — follow target, shake (capped by reduced motion).
- `engine/render.js` — Canvas layers: world, fog/static, HUD.
- `engine/audio.js` — Web Audio buses: music, sfx, static.

## Data flow
input → actions → systems.update(dt) → render(alpha)

## Testing
Pure-function tests for timestep math and tap/hold detection.

## Open questions
- Canvas 2D vs WebGL for the CRT pass (decide with 07-ui-crt).
