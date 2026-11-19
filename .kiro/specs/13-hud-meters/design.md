# 13-hud-meters — Design

## Overview
Three small changes, each in an existing module: screen-space HP meters, a
speaker-coloured taunt under the green line, and an opt-in ghost perk. Pure
logic stays Node-testable. Drawing takes a ctx passed in. No new files beyond
the ones already on this branch, no new assets, no balance changes
(`HAUNT_LEVELS` is untouched).

## Components
### `src/combat/screenHpMeters.js`
```js
export const SCREEN_HP_LAYOUT = 'corner-v';
export const METER_ORANGE = '#FF8A3D';
export const METER_RED = '#FF4D5E';
export const METER_RED_PCT = 0.25;
export const METER_FRAME = '#39FF88';
export const METER_FONT = 'VT323, "Share Tech Mono", monospace';
```
- `meterFillColor(pct)`: red when `pct <= METER_RED_PCT`, else orange.
- `screenHpTopReserve(layout)`: CSS px reserved under the top edge so the tell
  caption clears the meters. corner-v 28, top 36, vertical 0.
- `drawScreenHpMeters(ctx, { player, enemy }, vpW, vpH, opts)` switches on
  `opts.layout ?? SCREEN_HP_LAYOUT`. `corner-v` is the default. `vertical` and
  `top` stay only for A/B mocks.
- corner-v: `topInset` (default 12, min 8) is the y of both bars, supplied by
  `main.js` as the bottom of the green line. Bar thickness is
  `round(vpW * 0.014)` clamped to 12–18. Height is `round(vpH * 0.14)` clamped
  to 72–120. The player bar sits at `leftInset` (default 10), the HOUND bar at
  `vpW - rightInset - thick`. Fill grows from the bottom by hp/maxHp, drawn in
  `meterFillColor`, over a `#0F1A14` track, inside a dotted phosphor frame
  (`setLineDash([2, 3])`). The label is drawn beside the bar, toward the
  centre, with a void outline: `HP {cur}/{max}` for the player, `HOUND
  {cur}/{max}` for the enemy, using `formatHudStat` from `hud.js`. Font size is
  16–22 px in `METER_FONT`.
- Percent is clamped to 0..1 and is 0 when maxHp is missing.

### `src/combat/combatRenderer.js`
- `drawFixedHud` no longer draws an HP row. It keeps EN and POWER (and radar or
  status lines when present) with roomier row padding so the panel does not look
  gapped.
- The over-unit bars on the tanks are not drawn during a live fight. HP lives on
  the screen meters.

### `src/ui/possessedTaunts.js`
- `tauntSpeaker(kind)` returns `'player'` for `playerQuip` and `'hound'` for
  every kind in the current bank.
- `tauntColor(speaker)`: `TAUNT_COLOR_PLAYER` #39FF88 for the player,
  `TAUNT_COLOR_HOUND` #FF4D5E otherwise.
- The machine stores the speaker when a line starts. `current()` returns
  `{ text, typed, alpha, speaker, color }`.
- `tauntUnderLineY({ lineBottom, scale = 1, gap = 6 })` returns
  `lineBottom + gap * scale + max(14, round(14 * scale))`, an alphabetic
  baseline just under the green line.
- `drawPossessedTaunt(ctx, line, pos)` centres the line on `pos.x`, lays it out
  from the full text width so typing does not jitter, keeps a side margin of
  `pos.sidePad` (default 56 * scale) for the corner meters, shrinks once with a
  14 px floor, and fills with `line.color`. It keeps the 1 px void outline.
- `tauntBaselineY` (the old above-the-enemy placement) stays for unit tests and
  fallback only. The 16-line table, `WINDUP_COOLDOWN_MS`, the low-HP latch and
  the demo flags are unchanged.
- Note: `possessed-taunts.md` still says taunts are drawn in ghost blue. The
  shipped colours are the speaker colours above. Task 9 reconciles the steering
  text.

### `src/combat/ghostPerk.js`
```js
export const GHOST_SPAWN_MS = 12000;
export const GHOST_HEAL_FRAC = 0.10;
export const GHOST_RADIUS = 28;
export const GHOST_COLOR = '#9FD8FF';
export const GHOST_CORE = '#E8F7FF';
```
Pure helpers over a plain state `{ active, grabbed, spawned, x, y }`:
- `createGhostPerk()` returns the empty slot.
- `ghostSpawnPoint(player, enemy, arena)`: midpoint of the mechs, clamped 60 wu
  inside the arena.
- `ghostHealAmount(maxHp)`: `max(1, floor(maxHp * GHOST_HEAL_FRAC))`, 0 when
  maxHp is 0 or less.
- `maybeSpawnGhost(perk, elapsedMs, player, enemy, arena)`: returns a new perk
  with `active` and `spawned` set once `elapsedMs >= GHOST_SPAWN_MS`. It returns
  the input unchanged before the gate, after a spawn, or after a grab.
- `tryGrabGhost(perk, player)`: returns `{ perk, player }`. In range, the perk
  becomes `grabbed` and inactive, and the player gets
  `min(maxHp, hp + heal)`. Out of range, both pass through unchanged. It only
  takes the player, so the enemy cannot grab.
- `drawGhostPerk(ctx, perk, nowMs)`: original Canvas wisp. Soft glow, body
  ellipse, three trailing wisps, bright core and two eye dots, pulsing slowly.
  Draws nothing when inactive or grabbed.

### `src/combat/arena.js`
- `createArena(loadoutTotals, stats)` sets
  `ghostPerk: stats.enableGhostPerk ? createGhostPerk() : null`.
- `updateArena` runs step 8c after hit resolution and before the phase check:
  when `state.ghostPerk` is non-null it calls `maybeSpawnGhost` with the next
  `elapsedMs`, then `tryGrabGhost` on the post-hit player. The returned state
  always carries `ghostPerk` (null when off), so flag-off fights are unchanged.
- The heal is applied before the win/lose check. `applyDamage` is not involved.

### `src/main.js`
- `startArena` calls `createArena(totals, { enableGhostPerk: true })`. The
  balance harness (`runFight`) does not pass the flag.
- Draw order: `drawGhostPerk` in the ENTITY layer under the tanks and the
  windup tell. `drawScreenHpMeters` in the OVERLAY layer (screen space, above
  fog and scanlines, so the numbers are never covered), with `topInset` set to
  just under the green line and `leftInset` / `rightInset` clear of the touch
  controls.
- The taunt y comes from `tauntUnderLineY({ lineBottom, scale })`, where
  `lineBottom` is the phone HUD bottom or the desktop arena top border. The
  taunt x is the view centre.
- `screenHpTopReserve` feeds the tell caption position so the DASH caption sits
  below the meters.

## C3 update (below the line, top strip, Orbitron)
- `screenHpMeters.js`: `METER_FONT` is `Orbitron, "Share Tech Mono", monospace`.
  New pure helpers: `arenaTopLineSy(camera, vpW, vpH, shakeX, shakeY, arenaCx)`
  (line bottom y in canvas px), `meterTopInset(lineBottom, scale)` (line + 6 px
  scaled), `cornerVGeometry` (group boxes incl. label), `meterSideReserve`.
  Labels are "HP" / "HOUND" drawn under each bar (`textBaseline: top`), so no
  pixel of a group is above `topInset`. `opts.scale` scales bar, font and insets.
- `topBarHud.js` (new): `formatFightClock(ms)`, `topBarCells(state, opts)`
  (text + colour per cell, order `TOP_BAR_ORDER`), `topBarLayout(vpW, scale,
  { insetTop, pauseReserve })` (one row on desktop, two rows under 720 CSS px),
  `topBarHeight`, `drawTopBarHud(ctx, state, vpW, lineBottom, opts)` which clips
  to the strip so it cannot reach the line. Constants:
  `TOP_BAR_HP_PLAYER_COLOR` #39FF88, `TOP_BAR_HP_HOUND_COLOR` #FF4D5E.
- `main.js`: one `lineBottomPx` = max(arena line bottom, strip bottom). Meters
  use `meterTopInset(lineBottom, hudScale)`; the taunt uses `gap: 6` and
  `sidePad = meterSideReserve(...)`; the tell caption sits `lineBottom + 36`
  CSS px. The strip replaces the old corner / bottom-left `drawFixedHUD` call
  (kept in `combatRenderer.js` for tests). `phoneFrame` topPx is the strip
  bottom + 8 px. Desktop `fitZoom` reserves 2 x 40 px so the line clears the
  strip.
- `possessedTaunts.js`: taunt font is Orbitron; lines that still do not fit at
  the 14 px floor wrap (up to 3 lines).
- `pauseMenu.js`: `.hh-pause-btn` is 36 px at the top-right of the strip.
- `fonts.js` waits for Orbitron 400/500/700; `index.html` declares and preloads
  them. `drawHauntLevel` uses Orbitron.
- Tests: `tests/combat/screenHpMeters.test.js` (line helper, ≥6 px, Orbitron),
  `tests/combat/hud.test.js` (clock, cell order, colours, layout).

- Mech art (C3): `TANK_DRAW_SCALE` 1.3 to 1.5 (draw only; `mech.js` collision radii untouched). Hull and turret are chamfered octagon prisms (`prismCorners`, `PRISM_EDGES`), the barrel is a tapered dual-edge stroke (3 px longer) and a needle antenna sits on the turret. `boxCorners`, `footprint` and palettes are unchanged; `drawTankGhost` uses the same chamfered hull and scale.

## Budgets and safety
- No per-frame allocation is added by the meters. The ghost perk is one small
  object, replaced only on spawn and grab.
- The ghost heal is a single +10% swing per fight and is opt-in, so
  `npm run test:balance`, goldens and harness fights are unaffected.
- Meter and taunt text is at least 14 px. Static and fog stay under the HUD
  numbers (ui-style.md layering).
- The windup tell keeps its red halo and shape change. The meters and taunt
  never overlap it.

## Tests
- `tests/combat/screenHpMeters.test.js`: layout constant, `meterFillColor`
  thresholds (1, 0.26, 0.25, 0.1, 0), `screenHpTopReserve`, corner-v draws both
  bars and `HP ` / `HOUND ` labels, orange and red fills, VT323 font and
  phosphor label colour.
- `tests/combat/ghostPerk.test.js`: heal amount, spawn gate, one spawn at the
  midpoint and idempotent after, grab heal, out-of-range, clamp at maxHp, draw
  paints when active, arena spawn and grab over time with
  `enableGhostPerk: true`.
- Taunt tests in `tests/ui/possessedTaunts.test.js` cover `tauntUnderLineY` and
  `tauntColor`.
- Draw functions get no pixel tests. Layout is checked by screenshots (task 10).
