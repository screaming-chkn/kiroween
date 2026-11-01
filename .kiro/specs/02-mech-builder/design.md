# 02-mech-builder — Design (draft)

## Overview
Pure model + thin UI. The model is pure functions over a loadout object so it can be property-tested in Node.

## Components
- `src/mech/loadout.js` — `equip(loadout, part)`, `totals(loadout, parts)` → {weight, capacity, loadPct, powerOut, powerDraw, balance}.
- `src/mech/weight.js` — `speedPenalty(loadPct)`, `dashCooldownMult(loadPct)`, `canDeploy(loadPct)`.
- `src/mech/role.js` — `roleTag(loadout, parts)`.
- `src/data/parts.js` — parts table; `src/data/presets.js` — starter mech.
- `src/ui/garage.js` — slot list, parts list, stat bars, Deploy button (tokens from design-tokens.md).

## Data model
```
Part { id, slot, name, weight, powerOut?, powerDraw?, stats:{armor,speed,damage,sensor}, roles:[], hexId?, flavor }
Loadout { legs, core, armL, armR, back, head }  // part ids
```

## Weight curve
Piecewise linear: (0,0) → (80,0) → (100,0.15) → (115,0.45); >115 blocked.

## Testing
- Unit: curve breakpoints 80/100/115/115.01, power balance, role ties.
- PBT (small seeded generator, no deps; fast-check optional): random legal loadouts deploy; penalty monotonic and bounded; balance identity.

## Open questions
- Exact leg capacities and part numbers (feel feel pass 11/5).
