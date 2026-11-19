# HOT-BUGS — sweep (HOT-5)

**When:** 2026-11-19 ~2:05 PM PT (America/Los_Angeles)  
**Branch:** feat/hud-c

## Checked
- `rg TODO|FIXME|XXX src/` → **no matches**
- `rg 'not implemented|HACK|BUG' src/` → **no matches**
- Full `npm test` after HOT-2 (986 passed) green after README hook mention + seance rebuild
- README check required naming new `landscape-hud-on-save.json` (fixed in docs commit)
- Field-check C5b PASS (4/4/10)

## Actionable bugs fixed this hot run
1. README omitted the fifth hook file (test failure) — mentioned `landscape-hud-on-save.json`.
2. Stale `public/seance-tasks.json` after ticking task 5 — rebuilt.

## No further material bugs
No balance/layout bugs found that need code changes beyond the above hygiene.
