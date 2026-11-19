# Tank wire styles (draw-only)

Mock silhouette switch for HAUNT//HOUND Canvas 2D wire tanks.

- API: `setTankStyle('mech'|'wedge'|'wheeled'|'heavy'|'stealth')` in `src/ui/tankWire.js`.
- Collision `TANK_SPECS` footprint and `TANK_DRAW_SCALE` (1.5) stay fixed; styles change visual hull/turret/barrel/base only.
- Default style: `wheeled` (8x8 POP). Boot: `?tank=<name>` or assign `globalThis.__HH_TANK_STYLE__ = '<name>'` (CDP shots).
- Colors stay mono-green: player `#47FF9A`, enemy `#FF3B5C`.
- Original modern-tank silhouettes — no named real vehicles, no game IP.
