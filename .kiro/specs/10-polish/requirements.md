# 10-polish — Requirements

## Introduction
Submission polish for the 1v1 possessed-tank duel (no phase 2). Milestones
M1–M5: real SFX, game feel + title + pause, fonts + music, a balance pass, and
a real-phone test on a private preview. Judges should feel the game in the
first 30 seconds. No new game systems; $0, no external assets that need a
licence.

## Requirements

### R1 Synthesized SFX (M1)
- The system SHALL voice player fire, enemy fire, hit, player hurt, dash, the
  enemy windup tell, kill/death and UI clicks with Web Audio synthesis (no
  audio files).
- All SFX SHALL route through the SFX bus and honour its volume.
- The system SHALL cap concurrent SFX voices and throttle repeats per sound.
- WHEN the first tap, click or key happens, the system SHALL unlock the
  AudioContext (iOS included).
- WHILE the AudioContext is not yet running, SFX calls SHALL be no-ops that do
  not consume throttle or voice slots.

### R2 Game feel (M2)
- WHEN a player shot hits the enemy, the sim SHALL freeze 40–80 ms (hit-stop);
  the kill SHALL freeze longer (kill moment, 200 ms).
- Camera shake SHALL scale with impact, be capped, and decay to zero; under
  prefers-reduced-motion it SHALL be cut to almost nothing.
- The hit tank SHALL flash white and sparks SHALL fly from the impact point,
  from a fixed-size pool.
- Firing SHALL kick the barrel and nudge the screen against the aim (off under
  reduced motion).
- A dash tap shorter than one sim tick SHALL NOT be lost.

### R3 Title screen (M2)
- On load the system SHALL show a title: the HAUNT//HOUND logo in the CRT
  style, a one-line pitch, a pulsing "press / tap to DEPLOY" and an ambient
  haunted look. One tap or key SHALL go to the garage and unlock audio.
- Title animations SHALL stop under prefers-reduced-motion.

### R4 Pause + audio settings (M2)
- WHEN Esc or P is pressed in combat (desktop), or the pause button is tapped
  (phone), or the tab is hidden, the system SHALL pause.
- WHILE paused, the sim, hit-stop timer, camera and sparks SHALL NOT advance.
- The pause overlay SHALL offer resume, SFX volume, music volume, mute and quit
  to garage. Settings SHALL persist in localStorage.
- Held keys SHALL be released on pause/resume (no stuck movement).

### R5 Fonts + music (M3)
- The CRT fonts named in the design tokens SHALL load (self-hosted, licence
  allowing redistribution) with a monospace fallback.
- The music SHALL be the crew's original loops + stings, compressed for phones
  (OGG, MP3 fallback), loaded only after the first gesture, never blocking
  first paint.
- Loops SHALL be gapless; garage ↔ duel SHALL crossfade (~300 ms); victory /
  defeat stings SHALL play at the end card. All music SHALL use the music bus
  (volume + mute).

### R6 Balance pass (M4)
- A headless balance sim SHALL report win rates per HAUNT LV; HAUNT LV 1 SHALL
  be beatable by a new player and LV 5 SHALL be hard but fair.

### R7 Phone + private preview (M5)
- A private Cloudflare Pages preview SHALL load and play on a real phone and
  desktop with no console errors.
- A public deploy and the Devpost submission SHALL need the owner's yes.
