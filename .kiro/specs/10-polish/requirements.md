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
- WHEN the balance matrix runs, the sim SHALL evaluate every deployable build
  (all legal legs × core × armR × armL combinations, loadPct ≤ 115) against
  HAUNT LV 1–5 using a seeded, deterministic scripted player policy
  (the baseline policy in balanceCore.mjs).
- WHILE a matrix run is in progress, the sim SHALL NOT touch the DOM, Canvas,
  Web Audio, or any renderer — it SHALL drive src/combat/arena.js only.
- The per-HAUNT-LV win rate of the scripted player (fraction of build × seed
  outcomes where phase === 'win'; the scripted player stands in for a decent
  human, so a high number means the player usually beats the bot) SHALL fall
  within:
    LV 1: 85–100 %  (onboarding: the bot is easy)
    LV 2: 75–95 %
    LV 3: 65–85 %
    LV 4: 50–80 %   (widened from 75 after measuring: 1.17 is the highest
                     LV4 pressure that stays a 7-hit level; 1.18 rounds to
                     LV5's 6-hit cliff and drops to ~48 %)
    LV 5: 40–60 %   (hard but fair: no worse than about 40/60)
  and the sequence SHALL be monotonic non-increasing from LV 1 to LV 5 (each
  LV's mean win rate SHALL NOT exceed the previous LV's mean).
- No individual build's win rate at any HAUNT LV SHALL differ from that LV's
  mean win rate by more than 10 percentage points (no dominant loadout).
- The median duel length SHALL fall between 45 s and 120 s at every HAUNT LV.
- Dash-spam SHALL NOT beat the tell-reading reactive policy (dash in the last
  150 ms of windup) at any LV; its edge over the tell-blind baseline SHALL be
  reported in BALANCE.md.
- WHEN the corner-camp probe policy runs (player holds a corner wall at minimum
  range, baseline aim and fire otherwise), its per-LV win rate SHALL NOT exceed
  the baseline policy's win rate by more than 10 percentage points at any LV.
- Tuning SHALL change numbers only in src/combat/config.js and
  src/ui/hauntLevel.js; no logic, no new files, no content.
- Phone feel SHALL NOT regress: dash timings (DASH_DURATION_MS,
  DASH_BUFFER_MS, DASH_COOLDOWN_MS) and fire timings (FIRE_COOLDOWN_MS,
  ENEMY_SHOT_WINDUP_MS) SHALL remain unchanged unless a strategy probe fails
  and no pure-number fix restores the band.

### R7 Phone + private preview (M5)
- A private Cloudflare Pages preview SHALL load and play on a real phone and
  desktop with no console errors.
- WHEN `npm run build:site` runs, the system SHALL write a static preview of
  the game to deploy/site/ (index.html, src, assets, public).
- The preview SHALL carry a `_headers` file with `X-Robots-Tag: noindex` and a
  robots.txt that disallows all crawlers.
- The README SHALL describe the 1v1 duel (pitch, controls, Costume Contest fit,
  how Kiro was used, credits) and the MIT licence.
- A public deploy and the Devpost submission SHALL need the owner's yes.

### R8 Loadout effects (M4.5)
- The system SHALL give each of the six arm and core parts one combat effect
  that reuses existing systems (no new art, no new system): one clear upside,
  and for most parts a stated reload (fire cooldown) or dash cost, so the
  parts are sidegrades. Tuned table (M4.5 balance pass; the first all-upside
  draft — 17 dmg, x1.35 speed, +25 HP, x0.8 dash, x0.87 reload, x0.88
  incoming — pushed LV5 to ~86 % and was replaced):
  armR-hatchet: shot damage 18, reload x1.32; armR-lancer: projectile speed
  x1.4, reload x1.04; armL-buckler: +22 max HP, dash cooldown x1.5, reload
  x1.18; armL-spotter: dash cooldown x0.85, reload x1.08; core-pulse: reload
  x0.95; core-furnace: projectile speed x1.2, reload x0.97.
- WHERE a part is equipped and FEATURES.loadoutEffects is on, the garage card
  for that part SHALL show one line of text that states the real number
  (for example "COMBAT: shots fly 40% faster, +4% reload").
- A single flag, FEATURES.loadoutEffects in src/combat/config.js, SHALL gate
  every effect and every garage line.
- WHEN FEATURES.loadoutEffects is off, the system SHALL reproduce today's
  behaviour exactly: the same seeded fights SHALL give identical results
  (same winner, same duration, same HP at every tick).
- Each effect SHALL have a unit test, and a test SHALL check that flag-off
  seeded fights are identical to fights run without combatMods.
- WHEN the balance matrix runs with the flag on (16 builds x 200 seeds per LV),
  every LV's win rate SHALL be inside its R6 band (LV1 85-100, LV2 75-95,
  LV3 65-85, LV4 50-80, LV5 40-60), the median duel length SHALL be 45-120 s at
  every LV, and no build SHALL differ from its LV mean by more than 15
  percentage points.
- WHILE the flag is on, dash-spam SHALL still lose to the reactive
  tell-reading probe at every LV.
- Tuning SHALL change numbers only.
- IF the balance acceptance is not clean by Nov 23, THEN the milestone SHALL be
  cut and main SHALL stay unchanged.
