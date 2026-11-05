# 07-ui-crt — Requirements (planning stub)

## Introduction
The haunted CRT cockpit shell: title/menu, settings, possession reveal, and the
séance terminal framing. Planning placeholder only. The possession token swap
and the séance list are already shipped as a thin layer (see
`.kiro/specs/haunted-spec/tasks.md`); this spec tracks the fuller CRT UI for
Phase 2. Refine in Kiro before building.

## Requirements

### R1 CRT shell + settings
User story: As a player, I want a readable CRT cockpit and accessible settings
so the spooky look never blocks play.
- Settings (from title and pause) SHALL expose: static intensity, screen shake,
  no-static (flat fog), reduced motion, colorblind radar, sound/music volume.
- The system SHALL honor `prefers-reduced-motion` by default.
- HUD numbers SHALL keep ≥ 7:1 contrast on their background (accessibility
  steering).

### R2 Possession reveal
User story: As a player, I want the terminal to "wake up" so the haunting reads.
- Possession SHALL be an **instant token/colour swap** for MVP (no static burst,
  no wipe). Already implemented in `src/ui/possession.js`.

### R3 Séance terminal
User story: As a player, I want to see the build's own task ledger recited.
- The séance SHALL be a **plain scrolling list with a cursor** for MVP.
  Already implemented in `src/ui/seance.js`; typewriter animation is optional.

## MVP status (11/5)
**Thin layer SHIPPED** for possession (instant swap) and séance (list + cursor);
tracked under `haunted-spec`. The rest of the CRT shell (title screen, full
settings panel, pause menu) is **Phase 2 — planning only** here. Nothing beyond
the shipped thin layer is implemented against this spec.
