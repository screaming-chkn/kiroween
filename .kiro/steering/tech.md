---
inclusion: always
---
# Tech
- Static site: HTML + JavaScript (ES modules), Canvas 2D/WebGL. No backend for MVP; state in localStorage.
- Hosting: Cloudflare Pages (free tier). A Worker only if a backend becomes necessary.
- Target: desktop Chrome/Firefox, 60fps. Fixed-timestep game loop.
- Phones (portrait, touch) are supported via the touch overlay; desktop 1280x800 is the reference and must not change.
- Audio: Web Audio API, original synth + static bed.
- Tests: small pure-function tests (damage, weight curve, hex rules) runnable with Node, no heavy frameworks.
- Keep dependencies near zero. No secrets or personal info in the repo.

## Hooks
- `.kiro/hooks/test-on-save.json` runs `npm test` on save of `src/**/*.js` or `tests/**/*.js`.
- Keep tests node-only and fast so the hook stays cheap.
