---
inclusion: fileMatch
fileMatchPattern: ["src/ui/**/*", "src/render/**/*"]
---
# UI style
Mood: haunted CRT cockpit. Every spooky effect must do a job (damage, windup telegraph, state change, focus, error); no pure decoration on interactive elements.
- Layers, bottom to top: map → static/fog → scanlines → HUD text. HUD numbers (HP, power, weight, ammo, timers) are never covered by static, bleed or curvature.
- Use design-tokens.md values only.
- Every screen has designed loading, empty and error states. No placeholder or lorem text, ever.
- Mechs read by silhouette first, color second.
- Garage: list picker per slot (legs, core, two arm slots); no drag-to-slot.
- Copy: short, in-world, plain English; say "possessed" or "the bot", never "AI"; no real names, no trademarks or names from the reference game.
- Haunting (spec 12). Six effects, each with one job, ghost #9FD8FF and phosphor-dim only, Canvas 2D or CSS, no new assets:
  - Vignette (FOG layer, under HUD numbers): focus on the fight. Max alpha 0.25 at corners, clear centre. Still drawn under reduced motion.
  - Border fog (14 puffs outside the border, ≤ 24 wu bleed inside): marks the boundary. Alpha ≤ 0.35. Static under reduced motion.
  - Ectoplasm trail (16 samples, 60 ms apart, 700 ms life, under the tanks): shows where the possessed tank moved. Never blood red, never over the windup tell or shots. Off under reduced motion.
  - Kill ghost (1400 ms, rises 90 wu, fades): state change on a tank kill. Under reduced motion it only fades, no rise or sway.
  - Grid flicker (base 0.12, range 0.08–0.18, ≤ 2 changes per s, brightens to 0.2 on windup): ambient dread and support for the red tell, never a replacement. Steady 0.12 under reduced motion.
  - Garage wisps and panel tint (CSS only, behind the mech preview, haze ≤ 0.35, text contrast ≥ 4.5:1): haunted workshop. Static under reduced motion.
  - Haunting never reduces the visibility of the windup tell, shots or HP labels. Pre-render sprites once, no per-frame allocations. Phones (touch UI) run a lite set: no vignette, 8 fog puffs.
- Before marking a UI task done: screenshot at 1280×720 and 390×844, check against this file.
