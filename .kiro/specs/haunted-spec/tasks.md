# haunted-spec — Tasks (thin layer SHIPPED)

The "haunted" MVP thin layer is intentionally carved out of specs 05–07 so it
can ship on its own without colliding with the 05-enemy-ai / 06-cursed-salvage /
07-ui-crt planning numbering (those remain Phase-2 placeholders).

What this thin layer actually ships (MVP cuts applied — no wingmen, no pings, no
Static Surge, no hexes as musts; possession = instant token swap; séance =
list + cursor):

- [x] 1. Possession theme: sterile↔haunted palettes + instant `.possessed`
  class swap on `<html>`; no static burst, no wipe (`src/ui/possession.js`).
- [x] 2. `injectPossessionCSS()` declares both palettes as `var(--color-*)`;
  called from `main.js` boot so the garage reskins live on possession.
- [x] 3. Garage reads possession vars for a visible swap (title/text/deploy use
  `var(--color-phosphor|bone|void, …)` in `src/ui/garage.js`).
- [x] 4. Séance terminal overlay: full-screen CRT list + 1 Hz blinking cursor,
  Esc/CLOSE to exit, z-index 200 (above garage 100) (`src/ui/seance.js`).
- [x] 5. Opening the séance possesses the page; closing restores sterile
  (`setPossessed(true/false)` in `mountSeance`).
- [x] 6. Build ledger crawler: `scripts/build-seance-tasks.mjs` parses every
  `.kiro/specs/*/tasks.md` into `public/seance-tasks.json` (wired as
  `prebuild` / `build:seance`).
- [x] 7. Garage SÉANCE button + `main.js` `onSeance` wiring to mount the overlay.
- [x] 8. Pure-function tests: `tests/ui/seance.test.js` (parseTasksMd + séance
  helpers) and `tests/ui/possession.test.js` (token maps + toggle), wired into
  `npm run test:ui`.

Phase-2 extensions (static-burst/wipe animation, title/settings/pause shell,
wingmen, pings, Surge, hexes) live in specs 05–07 as open planning placeholders.
