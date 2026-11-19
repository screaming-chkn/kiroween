---
inclusion: fileMatch
fileMatchPattern: ["src/ui/**/*", "src/render/**/*", "**/*.css"]
---
# Design tokens (single source of truth)
Use only these tokens; never hard-code hex, font or duration values in components. Why: one look, easy to retheme, judges see polish.
## Color
void #0A0D0B · panel #121A15 · phosphor #39FF88 · phosphor-dim #1F9E57 · bone #E8E2D0 · ash #8F9A92 · ember #FF8A3D · blood #FF4D5E · ghost #9FD8FF · rust #B5562D (decoration only)
Enemy tell: windup telegraph uses blood #FF4D5E plus a growing halo shape (never colour alone).
## Type
display: VT323 ≥20px · hud: Share Tech Mono 14–16px, tabular numbers · body: IBM Plex Mono 14–16px · part names: Rajdhani 600. Self-hosted, OFL license in repo.
## Spacing
4px base: 4, 8, 12, 16, 24, 32, 48.
## Motion
fast 120ms · base 200ms · slow 400ms · windup 450ms · hitstop 40–60ms. Easing: ease-out for UI.
## Effects
static-fog-max 0.35 · static-burst-max 0.5 / 150ms / ≤3 per s · scanline-dark 0.08 · bleed-max 1.5px · glow 0 0 8px phosphor @40% · vignette-max 0.25 · flicker ≤2 per s · haunting: border-fog-max 0.35 (14 puffs, 8 on phones, ≤24 wu bleed inside) · trail 16 samples / 700ms · kill-ghost 1400ms / rise 90wu · grid-alpha 0.12 base, 0.08–0.18, 0.2 on windup, ≤2 changes per s · garage haze ≤0.35. Reduced motion: no drift, trail or flicker; vignette stays.
