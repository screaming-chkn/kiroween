# 11-haunt-words — Design

## Overview
Copy and wiring only. Pure text logic stays in Node-testable modules; drawing
stays in the view files. Strings are copied from `build-review/hook-copy.md`.

## Components
- `src/combat/endcard.js` — copy helpers take `{ level, maxLevel }`:
  `titleText`/`stampText`, `subtitleText`, `causeText` return the win/loss/max
  strings. Max-level win is `level >= maxLevel`. `endCardText` passes the
  options through.
- `src/ui/hauntLevel.js` — `levelUpText(newLevel)` returns
  "THE HAUNT RISES · HAUNT LV {n}. It remembers you.", or '' at or below LV 1
  or when no rise happened.
- `src/ui/endCardView.js` — draws stamp, subline, cause and the level-up line
  (win below LV 5 only). The stamp uses `fillText(text, x, y, maxWidth)` with a
  max width inside the 520 px card, so LAID TO REST and EXORCISED fit. Buttons
  unchanged. Opts gain `level` and `maxLevel`.
- `src/ui/possessedTaunts.js` — `TAUNTS` table with keys spawn, windup, hit,
  lowHp, enemyDeath, playerDeath (16 lines). Machine methods: `onSpawn`,
  `onWindup`, `onHit`, `onLowHp`, `onEnemyDeath` (`onDeath` kept as alias),
  `onPlayerDeath`. Windup and hit share one 8 s cooldown and are ignored while
  `current()` is non-null. Low HP is a once-per-match latch cleared by `reset()`.
  Pure `specTauntLine(tasks, rng)` returns the spec line or null: it fires on
  `rng() < 1/3`, picks a done task, formats the id, and returns null if the
  line exceeds 39 characters or no done tasks exist. `onPlayerDeath` takes an
  optional spec line and falls back to the table.
- Enemy bar label: HOUND, in the over-unit bar draw code (`src/combat/hud.js`
  or `combatRenderer.js`, wherever the label "HP" for the enemy is drawn).
- `src/main.js` — wires `onHit` (player hurt), `onLowHp` (player HP ≤ 25% of
  max, first time), `onPlayerDeath` (on loss, with `specTauntLine` from the
  loaded seance data), passes the new level and `MAX_HAUNT_LEVEL` to the end
  card, and fetches `public/seance-tasks.json` once (failure means no spec line).
- `.kiro/steering/possessed-taunts.md` — lists exactly the 16 wired lines.

## Tests to update
- `tests/combat/endcard.test.js` — new strings, max-level case, loss unchanged.
- `tests/ui/endCardView.test.js` — stamp, subline, level-up line, max width.
- `tests/ui/hauntLevel.test.js` — `levelUpText`.
- `tests/ui/possessedTaunts.test.js` — 16 lines, ≤39 chars, shared cooldown,
  no cut-off, low-HP latch, demo lines, `onDeath` alias, `specTauntLine`
  (format, real ids only, length fallback, no data).
- Steering parity: test that the steering file lists exactly the table lines,
  if such a test exists.
