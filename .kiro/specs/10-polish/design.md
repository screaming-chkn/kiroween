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

## Testing
- Unit: SFX mapping, throttle, voice cap; pause freezes ticks; hit-stop timer;
  shake decay + caps + reduced motion; impact points; spark pool; dash tap;
  settings persistence (memory storage, corrupt / blocked storage).
- Headless Chrome (desktop + phone + reduced motion): title → garage → DEPLOY
  → combat → pause, 0 console errors, screenshots in the crew deploy folder.

## Open questions
- Font licence and hosting (M3); preview access via the access lead (M5).
