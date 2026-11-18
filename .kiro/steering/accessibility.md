---
inclusion: always
---
# Accessibility (hard rules — a UI task is not done if any fails)
1. Text contrast ≥ 4.5:1; critical HUD numbers ≥ 7:1 on their actual background (tokens list the ratios).
2. Static/fog opacity ≤ 0.35 and never over HUD numbers or menu text.
3. Settings (reachable from title and pause): Static intensity 0–100%, Screen shake 0–100%, No static (flat fog), Reduced motion, Sound/Music volume. Honor `prefers-reduced-motion` by default.
4. No content flashes more than 3 times per second; our flicker cap is 2.
5. Full keyboard play and menus: visible focus (2px ember outline, not glow alone), logical tab order, Esc backs out.
6. Never signal by color alone: the enemy windup telegraph is red plus a shape change and a sound cue, and the player and enemy tanks differ by silhouette.
7. Sound is off until first user action; key audio cues (enemy windup, hit, dash) have a visual equivalent.
8. Buttons/targets ≥ 32px; text ≥ 14px.
Why: judges reward "intuitive" UI; static is our core mechanic, so it must never block reading.
