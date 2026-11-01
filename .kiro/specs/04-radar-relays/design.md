# 04-radar-relays — Design (draft)

## Overview
A coarse visibility grid (e.g. 32 px cells) computed per tick from relays + player; the renderer reads it for the static layer and the radar.

## Components
- `src/radar/visibility.js` — `visibleCells(team, relays, units)`; pure.
- `src/radar/relays.js` — `stepCapture(relay, unitsInRing, dt)`; Scout ×2; contested reset.
- `src/radar/pings.js` — `makePings(units, revealed, rng, hexes)`; seeded RNG for Liar's Eye fakes.
- `src/radar/surge.js` — `surgeRadius(t)` shrinking after 300 s.
- `src/ui/radar.js` — CRT radar draw, colorblind shapes.
- Audio cues go through 01's static/sfx buses.

## Testing
- Unit: capture progress/contest, surge radius at 299/300/360 s.
- PBT: fake-ping ratio with seeded RNG; visibility monotonic (adding a relay never hides a cell).

## Open questions
- Visibility grid size vs perf (measure on 11/5).
