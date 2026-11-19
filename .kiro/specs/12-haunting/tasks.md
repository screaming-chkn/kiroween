# 12-haunting — Tasks

- [x] 1. src/ui/haunting.js: HAUNT_FX constants, hauntFlags, createHauntFx (preallocated Float64Array trail, fog puffs, ghost slot, clock) + tests (R1, R7)
- [x] 2. Trail ring buffer: tickHaunt sampling every 60 ms, liveTrailCount, trailAlpha, lifetime 700 ms, cap 16, no growth, off under reduced motion + tests (R3, R7)
- [x] 3. Ghost lifecycle: startGhost, ghostPose (rise, fade, sway), null after 1400 ms, static fade under reduced motion + tests (R4)
- [x] 4. gridAlpha: step flicker (value changes over 10 s ≤ 20), clamp 0.08–0.18, windup brightens toward 0.2, reduced motion steady 0.12 + tests (R5)
- [x] 5. Fog puff placement outside the border (≤ 24 wu bleed), fogPuffOffset drift, none under reduced motion + tests (R2)
- [x] 6. Draw functions drawBorderFog, drawEctoTrail, drawKillGhost, drawHauntVignette with lazily cached offscreen sprites, Node-safe import, no pixel tests (R1, R2, R3, R4, R7)
- [x] 7. combatRenderer.drawWorld optional gridAlpha argument (default 0.12) and main.js wiring: layers, tickHaunt in stepPresentation, startGhost at beginKillMoment, FOG layer cleared on restart (R1, R2, R3, R4, R5, R7, R8)
- [x] 8. Garage CSS in GARAGE_CSS: wisps on .hh-preview__art pseudo-elements, ghost tint on .hh-slot, .hh-preview__art and the picker, reduced-motion off-switch + CSS string tests (R6, R8)
- [x] 9. Steering: "Haunting" section in ui-style.md (six effects, jobs, caps, reduced-motion behaviour) and haunting caps in the Effects line of design-tokens.md (R1, R2, R3, R4, R5, R6, R7)
- [x] 10. Readability and fps check: before/after screenshots at 1280x800, 390x844 and 844x390 DPR 2, headless frame timing at 1280x800 and phone DPR 2 (R7, R8)
