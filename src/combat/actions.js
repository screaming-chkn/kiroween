/**
 * src/combat/actions.js
 *
 * Build the player-actions object consumed by updateArena each tick.
 *
 * Responsibility: translate raw input state + camera into the data shape
 * that arena.js expects.  No side-effects; pure function over its arguments.
 *
 * @param {InputState}   inputState   — from src/engine/input.js createInputState()
 * @param {CameraState}  camera       — current camera (x, y, zoom)
 * @param {number}       vpW          — viewport width  in CSS pixels
 * @param {number}       vpH          — viewport height in CSS pixels
 * @param {number}       [shakeX=0]   — current camera shake offset X
 * @param {number}       [shakeY=0]   — current camera shake offset Y
 *
 * @returns {{
 *   move:  { dx: number, dy: number } | null,
 *   aim:   { x: number, y: number },
 *   fire:  boolean,
 *   dash:  boolean,
 * }}
 *
 * The `move` vector is un-normalised here; moveMech() normalises internally
 * so diagonal movement doesn't run faster.
 * `aim` is in world-space coordinates.
 * `fire` is true while LMB is held.
 */

import { ACTIONS }        from '../engine/input.js';
import { screenToWorld }  from '../engine/camera.js';

/**
 * Build player actions from the current input state and camera.
 *
 * @param {import('../engine/input.js').InputState} inputState
 * @param {import('../engine/camera.js').CameraState} camera
 * @param {number} vpW
 * @param {number} vpH
 * @param {number} [shakeX=0]
 * @param {number} [shakeY=0]
 * @returns {{ move: { dx: number, dy: number } | null, aim: { x: number, y: number }, fire: boolean }}
 */
export function buildPlayerActions(inputState, camera, vpW, vpH, shakeX = 0, shakeY = 0) {
  // ── Movement (WASD) ─────────────────────────────────────────────────────────
  let dx = 0;
  let dy = 0;

  if (inputState.isPressed(ACTIONS.MOVE_UP))    dy -= 1;
  if (inputState.isPressed(ACTIONS.MOVE_DOWN))  dy += 1;
  if (inputState.isPressed(ACTIONS.MOVE_LEFT))  dx -= 1;
  if (inputState.isPressed(ACTIONS.MOVE_RIGHT)) dx += 1;

  const move = (dx !== 0 || dy !== 0) ? { dx, dy } : null;

  // ── Aim (mouse → world space) ────────────────────────────────────────────────
  // aimX / aimY are canvas-pixel coordinates captured by onMouseMove.
  // We must convert them to world-space for arena.js.
  const { wx, wy } = screenToWorld(
    inputState.aimX,
    inputState.aimY,
    camera,
    vpW,
    vpH,
    shakeX,
    shakeY,
  );

  const aim = { x: wx, y: wy };

  // ── Fire (LMB held) ─────────────────────────────────────────────────────────
  const fire = inputState.isPressed(ACTIONS.FIRE_PRIMARY);

  // ── Dash (Shift) ────────────────────────────────────────────────────────────
  // True while Shift is held, or for one tick after a quick tap that went down
  // and up between two ticks (otherwise it was lost). arena.js applies a
  // 100 ms buffer so a slightly-early press fires when the cooldown clears.
  const dash = inputState.isPressed(ACTIONS.DASH) ||
    (typeof inputState.consume === 'function' && inputState.consume(ACTIONS.DASH) === 'tap');

  return { move, aim, fire, dash };
}
