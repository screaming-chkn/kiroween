# 13-hud-meters — Requirements

## Introduction
HUD layout C. HP moves off the mechs onto fixed screen-space meters that stay
readable on a phone in portrait and stay clear of the red windup tell, the DASH
caption and the controls. The top stats panel stops repeating HP. Possessed
trash talk sits under the green HUD / arena line and takes the colour of the
speaker. An occasional original ghost pickup heals the player mid-fight.
Colours come from design-tokens.md. No balance numbers change. Player-facing
text says "possessed" or "the bot", never "AI". No new assets: everything is
Canvas 2D.

## Requirements

### R1 Screen HP meters (layout C / corner-v)
- The arena SHALL draw fixed screen-space HP meters away from the mechs. During
  a live fight there SHALL be no over-unit HP bars on the tanks.
- The layout SHALL be corner-v: a short vertical meter at the top-left of the
  arena view for the player, and a short vertical meter at the top-right for
  HOUND.
- Both meters SHALL sit just under the green HUD / arena header line (inside the
  arena field of view), not at the very top edge of the screen. They SHALL stay
  clear of the mechs, the red windup tell, the DASH caption and the touch and
  desktop controls.
- Labels SHALL read "HP {cur}/{max}" for the player and "HOUND {cur}/{max}" for
  the enemy.
- Module `src/combat/screenHpMeters.js` SHALL export `SCREEN_HP_LAYOUT`
  (`'corner-v'`), `drawScreenHpMeters`, `screenHpTopReserve` and
  `meterFillColor`.

### R2 Meter colour and digital look
- The meter fill SHALL be orange (#FF8A3D) WHILE hp/maxHp is above 0.25.
- WHEN hp/maxHp is 0.25 or less, the fill SHALL turn red (#FF4D5E).
- Labels and numbers SHALL use the self-hosted VT323 (OFL) face, falling back to
  "Share Tech Mono", then monospace. Text SHALL be at least 16 px.
- Meter frames SHALL be dotted phosphor (#39FF88) to match the wireframe
  blueprint UI. Colour is never the only signal: the fill height and the
  numeric label carry the same value.
- The module SHALL export `meterFillColor(pct)`, `METER_ORANGE`, `METER_RED`,
  `METER_RED_PCT` (0.25), `METER_FRAME` and `METER_FONT`.

### R3 Top stats panel without duplicate HP
- The fixed top-left stats panel (`drawFixedHud` in `combatRenderer.js`) SHALL
  show EN, POWER and any radar or status lines that still exist, and SHALL NOT
  show HP.
- HP SHALL appear only on the corner screen meters, so the top strip is not a
  second HP readout.
- The remaining rows SHALL have readable spacing now that the HP row is gone.

### R4 Trash talk under the green line, coloured by speaker
- In-fight possessed taunts SHALL be drawn centred horizontally, just under the
  green HUD / arena line (baseline from `tauntUnderLineY`), not over a mech.
- WHEN the speaker is HOUND (the enemy), the fill colour SHALL be the HOUND red
  token (blood #FF4D5E).
- WHEN the speaker is the player, the fill colour SHALL be phosphor green
  (#39FF88).
- Taunts SHALL NOT collide with the corner meters: the draw keeps side margins
  for them and shrinks the line once (floor 14 px) when it will not fit, so it
  fits a 390 px wide phone view.
- The 16-line table, cooldowns and demo flags in `possessedTaunts.js` and
  `possessed-taunts.md` stay as they are. This requirement covers placement and
  colour only.

### R5 Ghost perk (mid-fight heal)
- An original ghost pickup (Canvas-drawn, no third-party art, ghost token
  #9FD8FF) SHALL be available as an opt-in mid-fight perk.
- Spawn: once per fight when the match clock reaches `GHOST_SPAWN_MS` = 12000 ms,
  at `ghostSpawnPoint`, the midpoint between the mechs kept at least 60 wu off
  the walls.
- Grab: player-only, when the player is within `GHOST_RADIUS` (28 wu) of the
  orb. The enemy SHALL NOT be able to grab it.
- Heal: `GHOST_HEAL_FRAC` = 0.10 of the player's current maxHp, floored, at
  least 1, clamped to maxHp. It heals HP and does not raise maxHp.
- The pickup SHALL be visible as a ghost shape (not colour alone) and SHALL
  never be drawn over HUD numbers.
- Module `src/combat/ghostPerk.js` SHALL export `createGhostPerk`,
  `maybeSpawnGhost`, `tryGrabGhost`, `ghostHealAmount`, `ghostSpawnPoint`,
  `drawGhostPerk` and the constants above.

### R6 Opt-in createArena flag
- `createArena(loadoutTotals, stats)` SHALL attach a `ghostPerk` only when
  `stats.enableGhostPerk` is truthy. Otherwise `state.ghostPerk` SHALL be `null`
  and `updateArena` SHALL skip all ghost logic.
- WHEN the flag is omitted or false, goldens, harness fights and flag-off paths
  SHALL stay stable (no ghost state, same seeded results).
- Live `startArena` wiring MAY pass `enableGhostPerk: true`. The balance harness
  and unit tests that omit it keep the old behaviour.

### R7 Tests and readability
- Unit tests SHALL cover: `meterFillColor` thresholds, the corner-v layout
  drawing both bars and labels, `screenHpTopReserve`, the ghost spawn gate,
  the player-only grab with heal clamp, and the `enableGhostPerk` opt-in.
- Phone-portrait (390x844) and desktop (1280x800) mid-fight screenshots SHALL
  confirm: meters under the green line, orange and red states, a visible ghost,
  and a coloured taunt under the line that covers neither the tell nor the
  controls.
