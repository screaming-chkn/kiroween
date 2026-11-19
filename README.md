# HAUNT//HOUND

Something is possessing the other tank. Duel it, dodge its tell, exorcise it. Climb HAUNT LV 1–5.

HAUNT//HOUND is a 1v1 tank duel that runs in the browser, shown through a haunted CRT cockpit. You bolt a tank together in the garage: legs, a core and two arm slots, with weight and power limits. Then you fight one possessed enemy tank in an arena. It is a static site (HTML, JavaScript ES modules, Canvas 2D) with no backend, no dependencies and no bundler. It plays on desktop and on a phone held in portrait. Built with Kiro for Kiroween 2026.

## How to play

The loop: title → garage → duel → kill moment and end card → REDEPLOY or GARAGE. HAUNT LV 1–5 rises only when you win. Add `?lv=N` (1–5) to the URL to start at that HAUNT LV.

In a duel, the bot shows a red windup telegraph before each shot. The tell lasts 450 ms and is a red halo that grows around the bot, with a sound cue. Dash out of the way before the shot lands. Your hits give hit-stop, camera shake and sparks.

**Loadout matters.** Each arm and core has one combat effect, shown as a `COMBAT:` line on its garage card. Most trade an upside for a stated reload or dash cost:

| Part | Garage line |
|---|---|
| Hatchet Arm | COMBAT: shots deal 18 (base 14), +32% reload |
| Lancer Arm | COMBAT: shots fly 40% faster, +4% reload |
| Buckler Arm | COMBAT: +22 max HP; dash recharge +50%, +18% reload |
| Spotter Arm | COMBAT: dash recharges 15% faster, +8% reload |
| Pulse Core | COMBAT: reload 5% faster |
| Furnace Core | COMBAT: shots fly 20% faster, reload 3% faster |

Legs set speed and weight. Heavier builds get a slower dash. The effects sit behind one flag, `FEATURES.loadoutEffects` in `src/combat/config.js`. With the flag off, the game plays exactly as it did before M4.5, and a golden-fight test checks this.

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
- `npm run test:balance` runs a quick headless balance matrix (48 per-LV seeds, about a minute) and writes the report to the OS temp dir. `npm run test:balance:full` runs the 200-seed matrix (about 7 minutes) and rewrites the committed `tests/combat/BALANCE.md`.
- `npm run build:site` writes a static preview to `deploy/site/`. The preview is served with noindex.

## Costume Contest

Category: "Build any app but show us a haunting user interface that's polished and unforgettable. Bring in spooky design elements that enhance your app's function."

Each spooky element below has a job:

- **Windup telegraph ring.** The bot's shot is announced by a red halo that grows over the 450 ms windup. It is the tell you dash against. It is red plus a shape change plus a sound, never colour alone.
- **Possession palette swap** (`src/ui/possession.js`). The UI has a cold, grey "sterile" palette and a haunted green phosphor palette. Opening the SÉANCE terminal flips the page to the possessed palette with one class on `<html>`, and closing it flips back. The colour change tells you the state changed.
- **Possessed taunts** (`src/ui/possessedTaunts.js`). The enemy types 16 short CRT lines across six moments: spawn, shot windup, hitting you, your HP dropping to a quarter, its death and yours. Windup and hit lines share one 8-second limit and never cut off a line. Sometimes your death line quotes the game's own build log: "Task 10.32 done. So are you.", using a real finished task from the specs. The lines are text only, and the first spawn and death lines can be forced for demos with `?demo=1`.
- **SÉANCE terminal.** It is also the build ledger. It reads `public/seance-tasks.json`, which is built from the real spec task files, so the game shows the task list it was built from.
- **CRT title and scanlines.** The title has a glitching logo, scanlines, fog and a pulsing "press to deploy". Static and fog stay under the opacity cap and never cover HUD numbers or menu text. Animations calm down under the system reduced-motion setting.
- **Hit-stop and shake.** A hit freezes the sim for a few frames and shakes the camera, so you can feel that it landed. Shake is capped and drops to near zero under reduced motion.
- **Haunted arena and garage** (`src/ui/haunting.js`). Fog drifts outside the arena wall, the grid lines flicker (at most twice a second, a little more during the bot's windup), an ectoplasm trail follows the bot, and a ghost rises from the wreck when you win. A faint vignette darkens the edges on desktop. In the garage, ghost wisps drift behind the mech preview and the panels carry a faint ghost tint. Every effect draws under the tell, shots and HP labels. Under reduced motion the fog and tint are static, and the trail, ghost rise, flicker and wisps are off. Phones skip the vignette and draw fewer fog puffs to hold 60 fps.
- **HAUNT LV.** The difficulty ramp is the haunting: a possessed enemy gets more health and hits harder at each level.
- **Haunt words.** A win reads EXORCISED ("Spirit banished.") and warns THE HAUNT RISES as the level goes up; a loss reads POSSESSED; a win at LV 5 reads LAID TO REST. The bot's health bar is labelled HOUND. Buttons and controls stay plain.

## How we used Kiro

**Specs.** `.kiro/specs/01-core-engine` to `08-phone-touch` and `haunted-spec` come from the first phase (Oct 30 – Nov 12). The specs for squad features (radar and relays, squad enemy, salvage) were cut in the 1v1 pivot and are marked as cut. `10-polish` covers milestones M1–M5. The 10-polish spec for M1–M3 was written by hand, outside the Kiro IDE. From M4 on, Kiro (kiro-cli, model Auto, headless, file read and write tools only) did the following:

- **M4:** the balance spec, steering, hooks and harness.
- **M5:** the steering rewrite, spec reconcile, `build:site` script and README check.
- **M4.5 (loadout effects):** the R8 spec, design and tasks, a steering note, the first implementation and a property-based test file.
- **M6 (haunt words, on the CLI's v3 engine):** the `11-haunt-words` spec, the end-card copy, the 16 moment-tagged taunts with their tests and wiring, and the taunt steering. The workspace hooks fired on Kiro's own edits: tests, balance check and séance rebuild.
- **M7:** title quick-deploy, the landscape phone layout, scaled garage stat bars and module preloads in the built site.
- **M8 (haunting):** the `12-haunting` spec and steering, the haunting effects module with its tests, the arena wiring and the garage wisps and tint.

Human and agent edits went in separate commits. The Kiro IDE was not used. The full per-run log, with commands, prompts, accounts, credits, and what Kiro wrote versus what we edited, is in [KIRO-USAGE.md](KIRO-USAGE.md).

**Property-based tests.** `tests/combat/loadoutEffects.pbt.test.js` was written by Kiro. It uses a hand-rolled seeded generator with no dependencies, and checks loadout folding laws, bounds over every possible loadout, arena HP and dash invariants, damage never healing, shot damage and speed, and flag-off equivalence. It found no bugs when it was added. `tests/mech/pbt.test.js` comes from the first phase.

**Hooks** (`.kiro/hooks/`, all PostFileSave):

- `test-on-save.json` runs `npm test` when a JS file under `src/` or `tests/` is saved.
- `balance-on-combat-save.json` runs `node tests/combat/balance.test.js` when `src/combat/config.js` or `src/ui/hauntLevel.js` is saved.
- `seance-on-spec-save.json` runs `npm run build:seance` when any spec `tasks.md` is saved.
- `readme-check-on-save.json` runs `node scripts/check-readme.mjs` when `README.md`, `LICENSE` or a hook file is saved.

Each hook command goes through `scripts/kiro-hook-run.mjs`, which logs every firing to `.kiro/hook-runs.log`. Our first ten headless runs used the CLI's default v2 engine, which does not load workspace hooks, so those commands were run by hand. With `kiro-cli chat --agent-engine v3 --trust-workspace` the hooks fire on Kiro's own file edits; the first logged firing is `seance-on-spec-save` rebuilding the séance after Kiro edited a spec `tasks.md`.

**Steering** (`.kiro/steering/`):

- `product.md`: what the game is, the loop, controls, what was cut, copy rules.
- `tech.md`: stack, loop, test commands, hosting, hooks.
- `structure.md`: folder map and where things live.
- `balance.md`: the HAUNT LV ramp, target bands and the tuning workflow.
- `accessibility.md`: hard rules for contrast, static, settings, keyboard and colour.
- `design-tokens.md`: colours, type, spacing, motion and effect limits.
- `ui-style.md`: the haunted CRT mood, where every effect must do a job.
- `possessed-taunts.md`: the 16 enemy taunt lines, the spec-haunted line, and how they are shown.
- `loadout-effects.md`: rules for arm and core effects (one per part, stated cost, flag, tune with the harness).

**The séance view.** `npm run build:seance` builds `public/seance-tasks.json` from every `tasks.md`. The game shows it from the garage SÉANCE button, so it literally shows its own Kiro task list.

**Accounts and credits.** Two Kiro accounts were used, and every run is logged with its account:

- A second, free-tier Kiro account (Google login) ran the first two M4 runs on a Mac mini: 4.81 credits.
- The original Kiro Pro account (GitHub login) ran every later run on the build box: 1.56 credits for M4, 6.32 for M5 (steering rewrite and spec reconcile, the `build:site` script with its tests and the README check hook, and this README's first draft) and 8.51 for M4.5 (loadout-effects spec, steering, implementation draft, property-based tests).

Another 0.62 Pro credits were metered between runs and aren't tied to any one run. Later Pro runs on the CLI's v3 engine (where the workspace hooks fire): 0.13 for the hook probe, 6.99 for M6 (haunt words and taunts), 7.58 for M7 (title deploy, phone layout, stat bars, modulepreload) and 5.20 for M8 (the haunting effects in the arena and garage). **Total: 41.72 credits metered** (Google 4.81, Pro 36.91). Per-run detail is in `KIRO-USAGE.md`.

The first runs used `kiro-cli chat --no-interactive --model auto --trust-tools=fs_read,fs_write` with one focused prompt each; from the probe on, the same command adds `--agent-engine v3 --trust-workspace`. No credits were bought.

## Balance

HAUNT LV scales the enemy's health and shot damage. The ramp is tuned with a headless balance matrix, so the numbers below come from simulated duels. The "player" in this table is a scripted bot, not a human. Target bands and the workflow are in `.kiro/steering/balance.md`.

Per HAUNT LV, baseline run with loadout effects on (200 seeds × 16 builds per level), from `tests/combat/BALANCE.md`:

| LV | Scripted player win % | Median duel (s) | Max build gap from mean (pp) |
|---:|---:|---:|---:|
| 1 | 100.0 | 42.3 | 0.0 |
| 2 | 94.6 | 70.0 | 5.1 |
| 3 | 83.1 | 75.6 | 7.4 |
| 4 | 74.9 | 80.2 | 7.9 |
| 5 | 50.2 | 78.4 | 9.2 |

Dash-spamming still loses to reading the tell at every level.

## Credits

- **Audio:** all music and stings are original, synthesized from scratch with numpy/scipy by the team's music bot. No samples, soundfonts or AI music services were used. They are released with the game under its MIT license and are free to use in the game, its Devpost entry and its trailer. The SFX are synthesized live with Web Audio. See `assets/audio/README.md`.
- **Fonts:** VT323, Share Tech Mono, IBM Plex Mono and Rajdhani, each under the SIL Open Font License 1.1. They are self-hosted from `assets/fonts/`, with the licence files next to them.
- **Code:** Screaming Chicken and the team's coding bots, with Kiro.

## License

MIT. See `LICENSE`.
