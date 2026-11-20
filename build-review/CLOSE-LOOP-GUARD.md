# Close-the-Loop Guard — slim MVP

**Date:** 2026-11-19 ~3:52 PM PT (America/Los_Angeles)  
**Branch:** `kiro-close-loop-guard` off `main` / tag `hud-lock-c8` tip `455cf29`  
**Did not touch:** `hud-c9`, gameplay/HUD/combat balance  
**No merge. No public deploy/submit. No MCP. No PBT swap.**

## Honesty label

**LIVE probe: same-turn YES.**

Headless `kiro-cli chat --agent-engine v3 --trust-workspace --no-interactive --model auto --trust-tools=fs_read,fs_write` edited `deploy/kiro-proof/close-loop-guard/PROBE.md`. That save fired `close-loop-probe-save` (`PostFileSave`, exit=0). When the turn completed, trigger **`Stop`** fired (`event=Stop` in `.kiro/hook-runs.log`). The **agent** action on `Stop` injected the Guard prompt into the **same** CLI session: the model then read `.kiro/hook-runs.log` and reasoned about nonzero exits (second generate loop in the same run). It did not emit `CLOSE_LOOP_OK` because failures remained — which is still same-turn steering proof.

Trigger name: docs call the event **Agent Stop**; the PascalCase hook trigger that fires is **`Stop`** (legacy `agentStop` → `Stop`). Diggger brief’s `AgentStop` string was probed via docs + live log; live log shows `event=Stop`.

No IDE. No MCP. No Crew. No Web.

## What shipped

| Path | Role |
|---|---|
| `.kiro/hooks/close-loop-on-stop.json` | `Stop` **agent** inject (same-turn) + `Stop` **command** companion |
| `.kiro/hooks/close-loop-probe-save.json` | Cheap `PostFileSave` logger for the probe marker |
| `scripts/kiro-close-loop-on-stop.mjs` | Writes `STOP-FIRED.txt` + `.kiro/NEXT-PROMPT.md` |
| `scripts/kiro-close-loop-next.mjs` | Alias → `kiro-close-loop-on-stop.mjs` |
| `deploy/kiro-proof/close-loop-guard/` | Prompt, transcript, log excerpts, copies |
| `build-review/CLOSE-LOOP-GUARD.md` | This note |

## Same-turn evidence (excerpts)

```
2026-11-19T23:51:45.884Z close-loop-probe-save event=PostFileSave file=deploy/kiro-proof/close-loop-guard/PROBE.md exit=0 ms=5
2026-11-19T23:51:47.659Z close-loop-stop-log event=Stop file=- exit=1 ms=8
```

Transcript (same process): after the first assistant completion that claimed no follow-up, a second loop began that quoted last hook-runs lines and refused `CLOSE_LOOP_OK` because of nonzero exits — i.e. the Stop agent prompt was injected mid-run.

The probe’s Stop **command** logger initially used nested `sh -c '…'` through `kiro-hook-run.mjs` and exited 1 (`mkdir: missing operand`). That is fixed by `scripts/kiro-close-loop-on-stop.mjs` (no nested shell quoting). Manual invoke after the fix:

```
2026-11-19T23:52:29.372Z close-loop-on-stop event=Stop file=- exit=0 ms=34
```

## Fallback / companion

Even with same-turn YES, the Stop **command** companion still writes:

- `deploy/kiro-proof/close-loop-guard/STOP-FIRED.txt` — Stop fired
- `.kiro/NEXT-PROMPT.md` — durable next-CLI-run prompt from recent `exit!=0` log lines

Do **not** claim the command companion alone is same-turn LLM steering.

## Tests

`npm test` exit 0 after README hook-list update (7 hooks named).

## Credits

See `KIRO-USAGE.md` (probe Auto run; prior baseline ~295.02/877 after Séance film; meter may lag).

## Deviations

- First Stop command logger used bad `sh -c` quoting via `kiro-hook-run.mjs` → exit=1; replaced with dedicated Node script.
- Agent could not re-run `npm test` in the injected turn (`run_command` denied under `--trust-tools=fs_read,fs_write`) — expected; Guard still steered.
- Pre-existing old `exit=1` lines in `hook-runs.log` (HOT-era) distracted the injected turn; companion ignores its own stop lines when building NEXT-PROMPT.
