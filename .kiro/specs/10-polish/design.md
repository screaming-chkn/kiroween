# 10-polish — Design

## Overview
Everything stays static HTML + ES modules + Canvas 2D. Pure logic lives in
small Node-testable modules; DOM and Web Audio stay at the edges (main.js,
src/ui/*, engine/audio.js).

## Components
- `src/engine/audio.js` — SFX recipes (oscillators + one shared noise buffer +
  gain envelopes) into an SFX-bus GainNode. `sfxThrottleGate` and
  `voiceCapGate` (6 voices) are pure. `installAudioGestures(document)` unlocks
  on the first pointerdown / touchend / keydown and clicks DOM buttons.
- `src/combat/sfxEvents.js` — `sfxEventsForTick(prev, next)`: state diff →
  SFX ids (new projectile ids, dash rise, windup edge, HP drops, end of match).
- `src/combat/feel.js` — `gateTick({paused, hitStopMs}, dtMs)` decides if the
  sim steps; `addHitStop` (cap 80 ms); `traumaForImpact(kind, dmg, reduced)`
  feeds the existing camera trauma (quadratic, 12 px cap, 2 px reduced);
  `impactsForTick(prev, next)` finds the hit point from the vanished
  projectile; a 48-slot spark pool drawn as one path per colour.
- `src/engine/settings.js` — `{sfx, music, muted}` in `hh.settings`;
  `busLevels` applies mute without losing slider values.
- `src/engine/music.js` (M3) — `chooseMusicFormat`, `loopPoints`,
  `leadingSilenceS`, `musicTransition` are pure; `LOOP_LENGTH_S` holds the
  musical loop lengths (garage 76.8 s, duel 75.0 s). `cueMusic(scene)` fetches +
  decodes once, loops with AudioBufferSourceNode, crossfades per-loop gains
  into audio.js's music gain node.
- `src/engine/fonts.js` (M3) — `loadGameFonts()` waits (capped 2.5 s) for the
  canvas faces before the arena's first draw; @font-face + preload in
  index.html, woff2 + OFL licences in assets/fonts/.
- `src/ui/title.js`, `src/ui/pauseMenu.js` — DOM overlays in the existing
  phosphor palette. z-order: touch pads 40 < pause button 45 < pause menu 60 <
  garage 100.
- `src/main.js` — boot → title → garage → arena. The update splits into
  `stepSim` (input, arena, SFX, feel) and `stepPresentation` (sparks, kick,
  camera), gated by `gateTick`. Arena listeners share one AbortController.
- Existing feel kept as-is: hit flash (R10), damage numbers, barrel recoil and
  muzzle flash (tankFx), player hit kick, the kill moment (hit-stop → shatter
  → CRT flicker).

## M4 balance

`runFight(build, seed, opts)` gains two new options:

- `opts.hauntLv` (number, 1–5, default 1) — when set, `runFight` calls
  `applyHauntPressure(enemy, hauntLv)` after `createArena`, exactly as
  `src/main.js startArena` does, so the headless sim matches live difficulty.
- `opts.policy` (`'baseline' | 'dashSpam' | 'camp'`, default `'baseline'`) —
  selects the scripted player policy for the duel. `'dashSpam'` triggers a dash
  on every available cooldown (baseline aim/fire otherwise); `'camp'` holds the
  player in a corner at minimum fire range (baseline aim/fire otherwise).

`runLevelMatrix({ seeds, levels, policy })` replaces the flat `runMatrix` for
balance work. It iterates `levels` × builds × seeds, calls
`runFight(build, seed, { hauntLv, policy })` for each combination, and returns
per-LV per-build aggregates (win rate, median duel length, max deviation from LV
mean) in the same shape as `aggregate()`.

`tests/combat/balance.mjs` (the reporting script) calls `runLevelMatrix` for the
baseline policy and each probe policy, then writes
`tests/combat/BALANCE.md` containing:
- a per-LV summary table (win-rate band, median duration, max build deviation),
- a probe table (baseline vs dashSpam vs camp win-rate delta per LV).

The `'reactive'` policy is baseline plus a dash only in the last 150 ms of enemy
windup (`REACTIVE_DASH_WINDOW_MS`). Dash-spam must not beat it at any LV; its edge
over baseline is reported in BALANCE.md (probe table has reactive % and
dashSpam − reactive pp columns, per-LV section uses its own 48 seeds).

`tests/combat/balance.test.js` (CI guard) imports `runLevelMatrix`, runs it
against a small fixed seed set (≥ 20 seeds), and asserts the R6 bands so
`npm test` catches a regression the moment `config.js` or `hauntLevel.js` is
touched.

## M5 ship

- `npm run build:site` (script under scripts/) copies the static game into
  deploy/site/ and writes `_headers` (`/*` → `X-Robots-Tag: noindex`) and
  `robots.txt` (`User-agent: *` / `Disallow: /`). No bundler, no dependencies.
- Hosting is a private Cloudflare Pages preview. Public deploy waits for the
  owner's yes.
- Verification: headless desktop (1280x800) and phone (390x844) runs served
  from deploy/site, then a real-phone test.
- README and the steering files describe the shipped duel.

## Testing
- Unit: SFX mapping, throttle, voice cap; pause freezes ticks; hit-stop timer;
  shake decay + caps + reduced motion; impact points; spark pool; dash tap;
  settings persistence (memory storage, corrupt / blocked storage).
- Headless Chrome (desktop + phone + reduced motion): title → garage → DEPLOY
  → combat → pause, 0 console errors, screenshots in the team deploy folder.

## Open questions
- Font licence and hosting (M3); preview access via the team (M5).

## M4.5 loadout effects

Arms and cores get one combat effect each, behind `FEATURES.loadoutEffects` in
`src/combat/config.js` (R8).

- New pure module `src/combat/loadoutEffects.js` (no DOM, no Canvas, no audio).
  - `LOADOUT_EFFECTS`: partId -> `{ text, mods }`. `text` is the one-line
    garage string with the real number. `mods` holds only the fields that part
    changes.
    - `armR-hatchet`: `{ shotDamage: 17 }`
    - `armR-lancer`: `{ projectileSpeedMult: 1.35 }`
    - `armL-buckler`: `{ maxHpBonus: 25 }`
    - `armL-spotter`: `{ dashCooldownMult: 0.8 }`
    - `core-pulse`: `{ fireCooldownMult: 0.87 }`
    - `core-furnace`: `{ incomingDamageMult: 0.88 }`
  - `combatModsFor(loadout, enabled)` folds the mods of the equipped parts into
    one object with identity defaults: `{ shotDamage, projectileSpeedMult,
    maxHpBonus, dashCooldownMult, fireCooldownMult, incomingDamageMult }`
    (`shotDamage` defaults to today's 14, mults to 1, bonus to 0). When
    `enabled` is false it returns null (callers then omit `combatMods`).
- Wiring.
  - `src/main.js` and the balance harness (`runFight` in balanceCore.mjs) call
    `combatModsFor(loadout, FEATURES.loadoutEffects)` and pass the result to
    `createArena` as `loadoutTotals.combatMods`. With the flag off they set no
    `combatMods` field.
  - `src/combat/arena.js` applies `combatMods` only when it is present: player
    shot damage, projectile speed, max HP (start HP too), dash cooldown, fire
    cooldown, and the multiplier on enemy shot damage. No field means none of
    those code paths change, so flag off is identical to today.
  - `src/ui/garage.js` renders `LOADOUT_EFFECTS[partId].text` as a "COMBAT:"
    line on the part card only when the flag is on.
- No new art or HUD. The HP bar already shows the higher max HP.
- Tests in `tests/combat/loadoutEffects.test.js`: one unit test per effect
  (through `combatModsFor` and a short arena run), null when disabled, and
  seeded fights that are identical with the flag off and with no `combatMods`.
- Balance: rerun with the flag on (`BALANCE_SEEDS=200 npm run test:balance`),
  tune numbers only, record before/after in PLAN.md. If R8 is not clean by
  Nov 23, cut the milestone and leave main unchanged.
