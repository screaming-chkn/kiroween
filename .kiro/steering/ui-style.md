---
inclusion: fileMatch
fileMatchPattern: ["src/ui/**/*", "src/render/**/*"]
---
# UI style
Mood: haunted CRT cockpit. Every spooky effect must do a job (fog of war, damage, state change, focus, error); no pure decoration on interactive elements.
- Layers, bottom to top: map → static/fog → scanlines → HUD text. HUD numbers (HP, power, weight, ammo, timers) are never covered by static, bleed or curvature.
- Use design-tokens.md values only.
- Every screen has designed loading, empty and error states. No placeholder or lorem text, ever.
- Mechs read by silhouette first, color second.
- Garage: list picker per slot (see design review); drag-to-slot only as a later bonus with the list still present.
- Copy: short, in-world, plain English; say SI not AI; no real names, no trademarks or names from the reference game.
- Before marking a UI task done: screenshot at 1280×720 and 390×844, check against this file.
