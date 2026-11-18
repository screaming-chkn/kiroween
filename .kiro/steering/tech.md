---
inclusion: always
---
# Tech
- Static site: HTML + JavaScript ES modules, Canvas 2D. No backend, no dependencies, no bundler. State in localStorage (`hh.settings`, garage save).
- Loop: 60 fps fixed-step sim (`src/engine/loop.js`). `main.js` splits each update into `stepSim` (input, arena, SFX, feel) and `stepPresentation` (sparks, kick, camera), gated by pause and hit-stop.
- Targets: desktop 1280x800 is the reference and must not change. Phones in portrait are supported through the touch overlay.
- Audio: synthesized Web Audio SFX (`src/engine/audio.js`, `src/combat/sfxEvents.js`). Original music loops and stings in `assets/audio` (OGG with MP3 fallback, `src/engine/music.js`). Fonts self-hosted under OFL in `assets/fonts` (`src/engine/fonts.js`). Volume and mute in `src/engine/settings.js`.
- Tests are plain Node, no framework:
  - `npm test` runs engine, mech, combat and UI suites.
  - `npm run test:balance` runs the headless balance matrix and rewrites `tests/combat/BALANCE.md`.
  - `npm run build:seance` rebuilds `public/seance-tasks.json` from the spec task files.
  - `npm run build:site` writes a static preview to `deploy/site/` (script added separately).
- Hosting: private Cloudflare Pages preview, served with noindex (`_headers` and `robots.txt`). A public deploy needs the owner's yes.

## Hooks (`.kiro/hooks/`, schema v1, all PostFileSave)
- `test-on-save.json`: matcher `(^|/)(src|tests)/.*\.js$`, runs `npm test`.
- `balance-on-combat-save.json`: matcher `src/combat/config.js` or `src/ui/hauntLevel.js`, runs `node tests/combat/balance.test.js`.
- `seance-on-spec-save.json`: matcher `.kiro/specs/*/tasks.md`, runs `npm run build:seance`.
- Keep tests node-only and fast so the hooks stay cheap.
