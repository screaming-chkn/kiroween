# Steering Haunt Factory — optional taunt pack

**Date:** 2026-11-19 ~4:03 PM PT (America/Los_Angeles)  
**Branch:** `kiro-steering-haunt-factory` off `main` / tag `hud-lock-c8` tip `455cf29`  
**Did not touch:** `hud-c9`  
**Tip:** `faa2989` (feature `fd1d8b5`; pushed, not merged)
**No merge. No public deploy/submit.**

## Honesty label

**LIVE Steering → Spec → CLI → Hook.**

1. **Steering** `.kiro/steering/haunt-factory-taunts.md` (`inclusion: fileMatch` on `src/ui/possessedTaunts.js`) lists the factory lines.
2. **Spec** `.kiro/specs/15-haunt-factory/` (requirements / design / tasks).
3. **CLI:** headless `kiro-cli chat --agent-engine v3 --trust-workspace --no-interactive --model auto --trust-tools=fs_read,fs_write`
   - **Run HF1** (~3:54 PM PT): implemented `FACTORY_TAUNTS`, `isFactoryTauntPack`, pack-aware `pickTaunt` / `createTauntMachine`, `main.js` wire, and tests. Transcript: `deploy/kiro-proof/haunt-factory/runHF-transcript.txt`.
   - **Run HF2** (~4:03 PM PT): ticked task 4, JSDoc note, proof marker. Saves fired hooks (below). Transcript: `runHF2-transcript.txt`.
4. **Hooks** (from HF2 on this branch):

```
2026-11-20T00:03:00.071Z seance-on-spec-save event=PostFileSave file=.kiro/specs/15-haunt-factory/tasks.md exit=0 ms=137
2026-11-20T00:03:10.796Z test-on-save event=PostFileSave file=src/ui/possessedTaunts.js exit=0 ms=8314
```

(UTC = 2026-11-19 4:03 PM PT)

No IDE. No MCP. Run Command denied (fs tools only) — expected.

## Enable

```
?tauntPack=factory
# or
?tauntPack=haunt-factory
```

Without the flag, the default 16-line bank is unchanged. `?demo=1` still forces DEMO_SPAWN / DEMO_DEATH (factory does not override demo).

## How to drop

Delete `FACTORY_TAUNTS`, `isFactoryTauntPack`, the `pack` arg on `createTauntMachine` / `pickTaunt`, the `main.js` one-liner, factory tests, `.kiro/steering/haunt-factory-taunts.md`, and `.kiro/specs/15-haunt-factory/`. Or drop the whole branch. No combat / hitbox / HUD / balance leftovers.

## What shipped

| Path | Role |
|---|---|
| `.kiro/steering/haunt-factory-taunts.md` | fileMatch steering (factory copy) |
| `.kiro/specs/15-haunt-factory/` | R1–R4 + design + tasks (all `[x]`) |
| `src/ui/possessedTaunts.js` | `FACTORY_TAUNTS` + gate + pack-aware machine |
| `src/main.js` | passes `pack` from `location.search` |
| `tests/ui/possessedTaunts.test.js` | pack gate + factory picks; default bank asserts kept |
| `deploy/kiro-proof/haunt-factory/` | prompts, transcripts, hook excerpts |
| `build-review/shots-haunt-factory/` | phone + desk shots |
| `team-archive/haunt-factory/` | mirrored shots + proof copies |

## Shot proof

- `hf-phone-land-factory-taunt.png` — **"Fresh off the haunt belt."** (factory spawn)
- `hf-phone-land-default-taunt.png` — **"Back again? The haunt missed you."** (default spawn, no flag)
- `hf-desk-factory-taunt.png` — same factory line on desk
- `hf-phone-land-haunt-factory-alias.png` — `tauntPack=haunt-factory` alias

## Tests

`npm test` green after `npm run build:seance` (spec 15 added → 233 tasks / 211 done). `possessedTaunts: 34 passed`. No balance / hitbox / HUD / combat number edits.

## Credits

See `KIRO-USAGE.md` Haunt Factory entry. No credits bought.
