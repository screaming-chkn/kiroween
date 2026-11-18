/**
 * src/engine/input.js — Input action map and tap/hold classifier.
 *
 * Design goals
 * ────────────
 * • All logic is in pure, side-effect-free functions so tests need no DOM.
 * • No hex or game-state effect may ever disable input; this module never
 *   checks or applies any such flag.
 * • The action map covers every bindable key/button used in the game loop:
 *     WASD  → move (up/left/down/right)
 *     Mouse → aim (handled externally via mousemove events)
 *     LMB   → fire primary
 *     RMB   → fire secondary
 *     Q     → back / cancel
 *     Shift → dash
 *     E     → interact
 *     Space → ping radar
 *     F     → wingman order  (tap = Follow, hold ≥ holdMs = Hold/Capture)
 *
 * Public API (pure, exported for tests)
 * ──────────────────────────────────────
 *   KEY_TO_ACTION   {string → string}   KeyboardEvent.key → logical action name
 *   BTN_TO_ACTION   {number → string}   MouseEvent.button → logical action name
 *   classifyPress(downMs, upMs, holdMs?) → 'tap' | 'hold'
 *
 * Public API (stateful, for use in the game loop)
 * ─────────────────────────────────────────────────
 *   createInputState()  → InputState
 *
 *   InputState methods:
 *     .onKeyDown(event)
 *     .onKeyUp(event)
 *     .onMouseDown(event)
 *     .onMouseUp(event)
 *     .onMouseMove(event)
 *     .isPressed(action)  → boolean
 *     .consume(action)    → 'tap' | 'hold' | null   (clears the completed press)
 *     .aimX, .aimY        — last known mouse canvas coordinates
 */

// ── Action names ─────────────────────────────────────────────────────────────

/** Logical action names — single source of truth for the rest of the codebase. */
export const ACTIONS = Object.freeze({
  MOVE_UP:        'MOVE_UP',
  MOVE_LEFT:      'MOVE_LEFT',
  MOVE_DOWN:      'MOVE_DOWN',
  MOVE_RIGHT:     'MOVE_RIGHT',
  FIRE_PRIMARY:   'FIRE_PRIMARY',
  FIRE_SECONDARY: 'FIRE_SECONDARY',
  BACK:           'BACK',
  DASH:           'DASH',
  INTERACT:       'INTERACT',
  PING:           'PING',
  WINGMAN:        'WINGMAN',   // F  — tap=Follow / hold=Hold/Capture
});

// ── Pure maps (exported for tests) ───────────────────────────────────────────

/**
 * Maps KeyboardEvent.key values to logical action names.
 * Case-sensitive: browsers report 'w', 'W', 'ArrowUp', etc.
 * We normalise by lower-casing the key before lookup (see state manager).
 */
export const KEY_TO_ACTION = Object.freeze({
  // WASD (lower-case; the state manager lower-cases before lookup)
  'w':          ACTIONS.MOVE_UP,
  'a':          ACTIONS.MOVE_LEFT,
  's':          ACTIONS.MOVE_DOWN,
  'd':          ACTIONS.MOVE_RIGHT,
  // Arrow-key aliases
  'arrowup':    ACTIONS.MOVE_UP,
  'arrowleft':  ACTIONS.MOVE_LEFT,
  'arrowdown':  ACTIONS.MOVE_DOWN,
  'arrowright': ACTIONS.MOVE_RIGHT,
  // Other bindings
  'q':          ACTIONS.BACK,
  'shift':      ACTIONS.DASH,
  'e':          ACTIONS.INTERACT,
  ' ':          ACTIONS.PING,       // Space
  'f':          ACTIONS.WINGMAN,
});

/**
 * Maps MouseEvent.button values to logical action names.
 *   0 = primary (LMB), 2 = secondary (RMB).
 */
export const BTN_TO_ACTION = Object.freeze({
  0: ACTIONS.FIRE_PRIMARY,
  2: ACTIONS.FIRE_SECONDARY,
});

// ── Default hold threshold ────────────────────────────────────────────────────

/** Milliseconds a key must be held to count as a 'hold' rather than a 'tap'. */
export const DEFAULT_HOLD_MS = 250;

// ── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Classify a completed key/button press as either a tap or a hold.
 *
 * This is a pure function with no side effects.
 *
 * @param {number} downMs   Timestamp (ms) when the key went down.
 * @param {number} upMs     Timestamp (ms) when the key came up.
 * @param {number} [holdMs] Threshold in ms; defaults to DEFAULT_HOLD_MS (250).
 * @returns {'tap' | 'hold'}
 *
 * @example
 *   classifyPress(0, 100)        // 'tap'  (100ms < 250ms threshold)
 *   classifyPress(0, 300)        // 'hold' (300ms ≥ 250ms threshold)
 *   classifyPress(0, 250)        // 'hold' (boundary is inclusive)
 */
export function classifyPress(downMs, upMs, holdMs = DEFAULT_HOLD_MS) {
  const duration = upMs - downMs;
  return duration >= holdMs ? 'hold' : 'tap';
}

// ── Stateful input manager (runtime use only) ─────────────────────────────────

/**
 * Create an input state manager.
 *
 * Attach its .onKey* and .onMouse* methods to the DOM, then call
 * .isPressed(action) or .consume(action) from your game-loop update.
 *
 * No hex or game mechanic may disable this manager; it always records input.
 *
 * @returns {InputState}
 */
export function createInputState() {
  /** @type {Map<string, number>} action → downMs timestamp for held keys */
  const heldAt = new Map();

  /** @type {Map<string, 'tap' | 'hold'>} completed presses waiting to be consumed */
  const pending = new Map();

  /** Current mouse position in canvas-space coordinates */
  let aimX = 0;
  let aimY = 0;

  // ── Internal helpers ─────────────────────────────────────────────────────

  function press(action, timeMs) {
    if (!heldAt.has(action)) {
      heldAt.set(action, timeMs);
    }
  }

  function release(action, timeMs) {
    if (heldAt.has(action)) {
      const result = classifyPress(heldAt.get(action), timeMs);
      heldAt.delete(action);
      pending.set(action, result);
    }
  }

  // ── Public interface ──────────────────────────────────────────────────────

  return {
    /** Current mouse aim position (canvas-space x). */
    get aimX() { return aimX; },
    /** Current mouse aim position (canvas-space y). */
    get aimY() { return aimY; },

    /**
     * Call from a 'keydown' event listener.
     * Repeated keydown events while held are ignored (tracks first only).
     * @param {KeyboardEvent} event
     */
    onKeyDown(event) {
      const action = KEY_TO_ACTION[event.key.toLowerCase()];
      if (action) press(action, event.timeStamp);
    },

    /**
     * Call from a 'keyup' event listener.
     * @param {KeyboardEvent} event
     */
    onKeyUp(event) {
      const action = KEY_TO_ACTION[event.key.toLowerCase()];
      if (action) release(action, event.timeStamp);
    },

    /**
     * Call from a 'mousedown' event listener.
     * @param {MouseEvent} event
     */
    onMouseDown(event) {
      const action = BTN_TO_ACTION[event.button];
      if (action) press(action, event.timeStamp);
    },

    /**
     * Call from a 'mouseup' event listener.
     * @param {MouseEvent} event
     */
    onMouseUp(event) {
      const action = BTN_TO_ACTION[event.button];
      if (action) release(action, event.timeStamp);
    },

    /**
     * Call from a 'mousemove' event listener.
     * offsetX/Y give canvas-relative coordinates when the listener is on the canvas.
     * @param {MouseEvent} event
     */
    onMouseMove(event) {
      aimX = event.offsetX;
      aimY = event.offsetY;
    },

    /**
     * Returns true while the given action's key/button is held down.
     * Does not consume the press record.
     * @param {string} action  One of the ACTIONS constants.
     * @returns {boolean}
     */
    isPressed(action) {
      return heldAt.has(action);
    },

    /** Drop held keys + pending presses (e.g. after pause steals focus). */
    reset() {
      heldAt.clear();
      pending.clear();
    },

    /**
     * Consume and return a completed press result for the given action.
     * Returns null if no completed press is waiting.
     * Each completed press is returned exactly once.
     *
     * @param {string} action  One of the ACTIONS constants.
     * @returns {'tap' | 'hold' | null}
     */
    consume(action) {
      const result = pending.get(action) ?? null;
      if (result !== null) pending.delete(action);
      return result;
    },
  };
}
