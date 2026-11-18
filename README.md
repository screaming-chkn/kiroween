# HAUNT//HOUND

Something is possessing the other tank. Duel it, dodge its tell, exorcise it. Climb HAUNT LV 1–5.

HAUNT//HOUND is a 1v1 tank duel that runs in the browser, shown through a haunted CRT cockpit. You bolt a tank together in the garage: legs, a core and two arm slots, with weight and power limits. Then you fight one possessed enemy tank in an arena. It is a static site (HTML, JavaScript ES modules, Canvas 2D) with no backend, no dependencies and no bundler. It plays on desktop and on a phone held in portrait. Built with Kiro for Kiroween 2026.

## How to play

The loop: title → garage → duel → kill moment and end card → REDEPLOY or GARAGE. HAUNT LV 1–5 rises only when you win.

In a duel, the bot shows a red windup telegraph before each shot. The tell lasts 450 ms and is a red halo that grows around the bot, with a sound cue. Dash out of the way before the shot lands. Your hits give hit-stop, camera shake and sparks.

| Action | Desktop | Phone (portrait) |
|---|---|---|
| Move | WASD or arrow keys | Drag the stick on the left half of the screen |
| Aim | Mouse | Drag the FIRE button |
| Fire | Hold left mouse button | FIRE button, bottom-right |
| Dash | Shift | DASH button, left of FIRE |
| Pause | Esc or P | On-screen pause button |

Run it locally. Any static server from the repo root works:

```
python3 -m http.server 8080
```

Then open http://localhost:8080.

Other commands (plain Node, no framework):

- `npm test` runs the engine, mech, combat and UI suites.
- `npm run test:balance` runs the headless balance matrix and rewrites `tests/combat/BALANCE.md`.
- `npm run build:site` writes a static preview to `deploy/site/`. The preview is served with noindex.

## Costume Contest

Category: "Build any app but show us a haunting user interface that's polished and unforgettable. Bring in spooky design elements that enhance your app's function."

Each spooky element below has a job:

- **Windup telegraph ring.** The bot's shot is announced by a red halo that grows over the 450 ms windup. It is the tell you dash against. It is red plus a shape change plus a sound, never colour alone.
- **Possession palette swap** (`src/ui/possession.js`). The UI has a cold, grey "sterile" palette and a haunted green phosphor palette. Opening the SÉANCE terminal flips the page to the possessed palette with one class on `<html>`, and closing it flips back. The colour change tells you the state changed.
- **Possessed taunts** (`src/ui/possessedTaunts.js`). The enemy types short CRT lines when it spawns, when it winds up a shot, and when it dies. Windup lines are limited to one per 8 seconds. The lines are text only, and the first spawn and death lines can be forced for demos with `?demo=1`.
- **SÉANCE terminal.** It is also the build ledger. It reads `public/seance-tasks.json`, which is built from the real spec task files, so the game shows the task list it was built from.
- **CRT title and scanlines.** The title has a glitching logo, scanlines, fog and a pulsing "press to deploy". Static and fog stay under the opacity cap and never cover HUD numbers or menu text. Animations calm down under the system reduced-motion setting.
- **Hit-stop and shake.** A hit freezes the sim for a few frames and shakes the camera, so you can feel that it landed. Shake is capped and drops to near zero under reduced motion.
- **HAUNT LV.** The difficulty ramp is the haunting: a possessed enemy gets more health and hits harder at each level.

## How we used Kiro

**Specs.** `.kiro/specs/01-core-engine` to `08-phone-touch` and `haunted-spec` come from the first phase (Oct 30 – Nov 17). The specs for squad features (radar and relays, squad enemy, salvage) were cut in the 1v1 pivot and are marked as cut. `10-polish` covers milestones M1–M5. The 10-polish spec for M1–M3 was written by hand, outside the Kiro IDE. From M4 on, Kiro (kiro-cli, model Auto, headless, file read and write tools only) wrote the M4 balance spec, steering, hooks and harness, and the M5 steering rewrite, spec reconcile, `build:site` script and README check. Human and agent edits went in separate commits.

**Hooks** (`.kiro/hooks/`, all PostFileSave):

- `test-on-save.json` runs `npm test` when a JS file under `src/` or `tests/` is saved.
- `balance-on-combat-save.json` runs `node tests/combat/balance.test.js` when `src/combat/config.js` or `src/ui/hauntLevel.js` is saved.
- `seance-on-spec-save.json` runs `npm run build:seance` when any spec `tasks.md` is saved.
- `readme-check-on-save.json` runs `node scripts/check-readme.mjs` when `README.md`, `LICENSE` or a hook file is saved.

The Kiro IDE runs these hooks on save. The headless CLI runs did not trigger them, so the same commands were run by hand.

**Steering** (`.kiro/steering/`):

- `product.md`: what the game is, the loop, controls, what was cut, copy rules.
- `tech.md`: stack, loop, test commands, hosting, hooks.
- `structure.md`: folder map and where things live.
- `balance.md`: the HAUNT LV ramp, target bands and the tuning workflow.
- `accessibility.md`: hard rules for contrast, static, settings, keyboard and colour.
- `design-tokens.md`: colours, type, spacing, motion and effect limits.
- `ui-style.md`: the haunted CRT mood, where every effect must do a job.
- `possessed-taunts.md`: the 12 enemy taunt lines and how they are shown.

**The séance view.** `npm run build:seance` builds `public/seance-tasks.json` from every `tasks.md`. The game shows it from the garage SÉANCE button, so it literally shows its own Kiro task list.

**Accounts and credits.** Two Kiro accounts were used, and every run is logged with its account:

- A second, free-tier Kiro account (Google login) ran the first two M4 runs on a Mac mini: 4.81 credits.
- The original Kiro Pro account (GitHub login) ran every later run on the build box: 1.56 credits for M4 and 6.32 for M5 (steering rewrite and spec reconcile, the `build:site` script with its tests and the README check hook, and this README's first draft).

All runs used `kiro-cli chat --no-interactive --model auto --trust-tools=fs_read,fs_write` with one focused prompt each. No credits were bought.

## Balance

HAUNT LV scales the enemy's health and shot damage. The ramp is tuned with a headless balance matrix, so the numbers below come from simulated duels. The "player" in this table is a scripted bot, not a human. Target bands and the workflow are in `.kiro/steering/balance.md`.

Per HAUNT LV, baseline run (200 seeds × 16 builds per level), from `tests/combat/BALANCE.md`:

| LV | Scripted player win % | Median duel (s) |
|---:|---:|---:|
| 1 | 100.0 | 52.4 |
| 2 | 93.3 | 64.8 |
| 3 | 84.6 | 70.5 |
| 4 | 77.0 | 74.5 |
| 5 | 47.3 | 73.9 |

## Credits

- **Audio:** all music and stings are original, synthesized from scratch with numpy/scipy by the team's music tooling. No samples, soundfonts or AI music services were used. They are released with the game under its MIT license and are free to use in the game, its Devpost entry and its trailer. The SFX are synthesized live with Web Audio. See `assets/audio/README.md`.
- **Fonts:** VT323, Share Tech Mono, IBM Plex Mono and Rajdhani, each under the SIL Open Font License 1.1. They are self-hosted from `assets/fonts/`, with the licence files next to them.
- **Code:** Screaming Chicken and the crew's bots, with Kiro.

## License

MIT. See `LICENSE`.
