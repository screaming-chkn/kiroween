---
inclusion: always
---
# Tech
- Static site: HTML + JavaScript (ES modules), Canvas 2D/WebGL. No backend for MVP; state in localStorage.
- Hosting: Cloudflare Pages (free tier). A Worker only if a backend becomes necessary.
- Target: desktop Chrome/Firefox, 60fps. Fixed-timestep game loop.
- Audio: Web Audio API, original synth + static bed.
- Tests: small pure-function tests (damage, weight curve, hex rules) runnable with Node, no heavy frameworks.
- Keep dependencies near zero. No secrets or personal info in the repo.
