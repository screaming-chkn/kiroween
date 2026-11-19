# 12-haunting — Design

## Overview
One new module, `src/ui/haunting.js`, holds pure Node-testable logic plus
separate draw functions. `main.js` creates the state, ticks it and registers the
draws in the existing render layers. The garage part is CSS inside `GARAGE_CSS`
only. No new assets, no dependencies.

## Components
### `src/ui/haunting.js`
```js
export const HAUNT_FX = Object.freeze({
  TRAIL_MAX: 16, TRAIL_SAMPLE_MS: 60, TRAIL_LIFE_MS: 700,
  FOG_PUFFS: 14, FOG_PUFFS_LITE: 8, GHOST_MS: 1400, GHOST_RISE_WU: 90,
  GRID_BASE: 0.12, GRID_MIN: 0.08, GRID_MAX: 0.18, GRID_WINDUP: 0.2,
  FLICKER_MAX_PER_S: 2, VIGNETTE_MAX: 0.25, FOG_MAX: 0.35,
});
```
Pure logic:
- `hauntFlags(reducedMotion)` → `{ trail, fogDrift, ghostRise, gridFlicker, vignette }`.
  Normal: all true. Reduced: trail, fogDrift, ghostRise, gridFlicker false;
  vignette true.
- `createHauntFx({ reducedMotion, arena: {width,height}, seed })` → state with
  `t` (own clock, ms), trail `xs`, `ys`, `ts` as `Float64Array(TRAIL_MAX)`,
  `head`, `lastSampleMs`, a fixed array of FOG_PUFFS puff objects placed around
  the border from the seed (seeded PRNG, outside the border, at most a 24 wu
  bleed inside), a ghost slot `{ active, x, y, t0 }` and the flags.
- `tickHaunt(fx, dtMs, enemy)` advances `fx.t`. When the trail flag is on, the
  enemy exists and is alive, and `fx.t - lastSampleMs >= TRAIL_SAMPLE_MS`, it
  writes the enemy position into the slot at `head` and advances `head` modulo
  TRAIL_MAX. Otherwise it only advances the clock.
- `liveTrailCount(fx)` counts samples younger than TRAIL_LIFE_MS.
  `trailAlpha(ageMs)` returns a value from about 0.5 down to 0 over
  TRAIL_LIFE_MS, 0 outside it.
- `startGhost(fx, x, y)` sets the ghost slot active at `fx.t`.
  `ghostPose(fx)` → `null` or `{ x, y, alpha, sway }`. Rise is
  `GHOST_RISE_WU * progress` and sway a small sine, both 0 under reduced motion.
  Alpha fades from about 0.6 to 0. It returns `null` after GHOST_MS.
- `gridAlpha(tMs, windupT01, reducedMotion)`: reduced motion returns GRID_BASE.
  Otherwise a deterministic step function: time is cut into steps of
  `1000 / FLICKER_MAX_PER_S` = 500 ms, each step hashes to a value in
  GRID_MIN..GRID_MAX, so the value changes at most 2 times per second. The
  result lerps toward GRID_WINDUP by `windupT01` (clamped 0..1) and is clamped
  to GRID_MIN..GRID_WINDUP.
- `fogPuffOffset(puff, tMs, reducedMotion)` → slow drift `{ dx, dy }` of a few
  wu from slow sines per puff phase; `{ 0, 0 }` under reduced motion. The
  drift keeps the puff inside its allowed band.

Draw functions (Canvas 2D, no allocation per call, colours from tokens):
- `drawBorderFog(ctx, fx)` WORLD layer, after the floor. Blits the cached puff
  sprite per puff at alpha ≤ FOG_MAX.
- `drawEctoTrail(ctx, fx)` ENTITY layer, before the tanks. Ghost-blue dots by
  `trailAlpha(age)`. Never blood red, never drawn over the windup tell or shots.
- `drawKillGhost(ctx, fx)` ENTITY layer, after the shatter. Uses `ghostPose`.
- `drawHauntVignette(ctx, fx, vpW, vpH)` FOG layer, screen space, under HUD
  numbers. Blits the cached vignette (radial gradient, clear centre, ghost
  tint, alpha ≤ VIGNETTE_MAX at the corners).

Sprite cache: module-level offscreen canvases (puff, ghost, vignette) created
lazily. Creation is guarded by `typeof OffscreenCanvas` and `typeof document`,
so Node tests import the module safely and draw functions return early when no
canvas can be made. The vignette is re-rendered only when `vpW` or `vpH` change.

### `src/combat/combatRenderer.js`
`drawWorld` takes an optional `gridAlpha` argument. The default is 0.12, so
behaviour is unchanged when it is omitted. The arena border and floor stay as is.

### `src/main.js`
- `startArena` creates the fx with the existing `reducedMotion` flag, the arena
  size and a seed.
- `stepPresentation` calls `tickHaunt(fx, dtMs, enemy)`. It is skipped while
  paused, so the haunting freezes with the pause and with hit-stop.
- Where `beginKillMoment` fires, `startGhost` is called at the destroyed tank's
  position (player on a loss, enemy on a win).
- Layer registration: `drawBorderFog` in WORLD after the floor, `drawEctoTrail`
  and `drawKillGhost` in ENTITY (trail before the tanks, ghost after the
  shatter), `drawHauntVignette` in FOG. The grid alpha passed to `drawWorld`
  comes from `gridAlpha(fx.t, windupT01, reducedMotion)`.
- The FOG layer callbacks are cleared together with the other layers on restart.

### Garage CSS (`GARAGE_CSS` in `src/ui/garage.js`, no JS)
- `.hh-preview__art::before` and `::after`: layered radial gradients in ghost
  and phosphor-dim, `pointer-events: none`, `z-index` under the SVG. Drift uses
  `transform` and `opacity` keyframes inside
  `@media (prefers-reduced-motion: no-preference)`.
- The existing reduced-motion block turns the animation off (`animation: none`),
  leaving static wisps.
- `.hh-slot`, `.hh-preview__art` and the picker get a faint ghost gradient over
  the panel colour. Haze behind text stays ≤ 0.35 and contrast stays ≥ 4.5:1.

## Budgets and safety
- Trail: 16 samples. Fog: 14 puffs. Ghost: 1 slot. Sprites: 3 offscreen
  canvases. Nothing grows over time.
- Flicker: grid at most 2 changes per second, no other flashing element.
- Fog and vignette stay below the HUD, so HUD numbers are never covered.

## Tests
- `tests/ui/haunting.test.js`: constants, flags, createHauntFx shape, trail ring
  buffer (sampling, lifetime, cap, no growth), ghost lifecycle, gridAlpha cap
  and windup, fog placement and drift, import safe in Node.
- `tests/ui/garage.test.js` (or the existing garage CSS test): CSS string checks.
- Draw functions get no pixel tests.

## Phone lite set (added after the fps check)
`createHauntFx({ lite })` with `lite = isTouchUi()` in main.js: `hauntFlags(reducedMotion, lite)` turns the vignette off and the border fog uses FOG_PUFFS_LITE puffs. Trail, kill ghost and grid flicker are unchanged.
