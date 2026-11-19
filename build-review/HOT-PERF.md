# HOT-PERF — phone landscape mid-fight FPS

Measured against http://127.0.0.1:8835/ on tip of worktree (spec 14 R6 target ≥ 55 FPS at 844×390 @3 class).
Headless Chrome + CDP; 6 s rAF sample after DEPLOY. Soft fixes only if unthrottled mean < 55.

| profile | meanFps | p50ms | p95ms | over20ms | busyMs/frame |
|---|---:|---:|---:|---:|---:|
| land-844x390@2 | 60.1 | 16.7 | 16.8 | 0 | 4.55 |
| land-844x390@3 | 60.1 | 16.7 | 16.8 | 0 | 6.4 |
| land-844x390@3-cpu4x | 56.6 | 16.7 | 33.3 | 22 | 16.39 |

Unthrottled gate: **PASS** (ignore cpu4x for soft-fix gate).
Worst unthrottled: land-844x390@2=60.1, land-844x390@3=60.1.

No soft perf changes applied (already ≥ 55 on unthrottled land profiles).
