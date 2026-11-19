# HUD C8 — thin tank, full frame, spacing unit

- Tank (wheeled default): fewer/thinner strokes; dotted/dashed wheels, mast, panel lines; less glow bloom (single thin halo). Hitbox / `TANK_DRAW_SCALE` 1.5 unchanged. P1 green / enemy red.
- Arena border: full 4-side neon-blue double/inset (`#4DD8FF` / `#7FE3FF`) with symmetric tech corner brackets. Inset so camera clamp does not clip strokes.
- Spacing: one unit `HUD_SPACE = 8` CSS px (`src/ui/phoneCombatUi.js`). Apply to taunt (`TAUNT_ABOVE_GAP`), meter field gap, label gap, edge-arrow gaps, stick/fire edge. Keep top gap = bottom gap (C6 letterbox).
- Kill laugh: single voice + one echo in `RECIPES.explode`; no layered second source.
