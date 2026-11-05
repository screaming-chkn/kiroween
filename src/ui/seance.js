/**
 * src/ui/seance.js — HAUNT//HOUND séance terminal.
 *
 * A full-screen CRT overlay that reads the build's own task ledger
 * (`public/seance-tasks.json`, generated from `.kiro/specs/ * /tasks.md`) and
 * renders it as a plain scrolling list with a blinking terminal cursor — as if
 * the machine is reciting what it remembers of its own making.
 *
 * Visual contract (design-tokens.md):
 *   • panel background  #121A15
 *   • done task line    phosphor      #39FF88
 *   • open task line    phosphor-dim  #1F9E57
 *   • body / header     bone          #E8E2D0
 *   • UNLOCKED line     ghost         #9FD8FF, prefixed "UNLOCKED: <part>"
 *   • cursor blinks at 1 Hz; prefers-reduced-motion → solid (no blink)
 *   • focus ring: 2px ember; Escape closes; no static over text.
 *
 * Opening the séance possesses the page (haunted palette); closing restores the
 * sterile palette — an instant class swap (no burst / no wipe for MVP).
 *
 * The data/formatting logic is split into PURE helpers (`seanceLines`,
 * `taskLineText`, `unlockedLineText`, `countDone`) so it is unit-testable in
 * plain Node without a DOM. `mountSeance` owns all DOM/possession side effects.
 *
 * ES modules only; no dependencies.
 */

import { setPossessed, injectPossessionCSS } from './possession.js';

/** Where the generated task ledger lives on the static site. */
export const SEANCE_DATA_URL = 'public/seance-tasks.json';

/**
 * Minimal inline fallback shown if the JSON cannot be fetched (file:// serve,
 * offline). Never leaves the terminal empty — accessibility: designed error
 * state, no lorem.
 */
export const SEANCE_FALLBACK = [
  { spec: 'séance', id: 0, title: 'No ledger found — the dead are quiet.', done: false },
];

// ── Pure model helpers ───────────────────────────────────────────────────────

/**
 * Render one task record to its terminal line text.
 *   done → "[x] <spec> 12. title"
 *   open → "[ ] <spec> 3. title"
 *
 * @param {{spec:string,id:number,title:string,done:boolean}} task
 * @returns {string}
 */
export function taskLineText(task) {
  const box = task.done ? '[x]' : '[ ]';
  return `${box} ${task.spec} ${task.id}. ${task.title}`;
}

/**
 * The ghost UNLOCKED line for a done task that unlocked a part. Carries an
 * explicit text tag (never colour alone — accessibility rule 6).
 *
 * @param {{unlockedPart?:string}} task
 * @returns {string|null} null when the task unlocked nothing.
 */
export function unlockedLineText(task) {
  if (!task || !task.unlockedPart) return null;
  return `UNLOCKED: ${task.unlockedPart}`;
}

/**
 * Count done tasks in a list (for the header summary).
 *
 * @param {Array<{done:boolean}>} tasks
 * @returns {number}
 */
export function countDone(tasks) {
  if (!Array.isArray(tasks)) return 0;
  return tasks.reduce((n, t) => n + (t && t.done ? 1 : 0), 0);
}

/**
 * Flatten a task list into an ordered array of renderable lines. Each task
 * yields a `task` line and, when it unlocked a part, a following `unlocked`
 * line. PURE — the UI maps these straight to DOM nodes.
 *
 * Optional `filter` ('all' | 'done' | 'open') narrows the tasks shown; this is
 * the testable séance list filtering surface.
 *
 * @param {Array<object>} tasks
 * @param {'all'|'done'|'open'} [filter='all']
 * @returns {{kind:'task'|'unlocked', text:string, done:boolean, task:object}[]}
 */
export function seanceLines(tasks, filter = 'all') {
  const list = Array.isArray(tasks) ? tasks : [];
  const keep = (t) =>
    filter === 'done' ? t.done :
    filter === 'open' ? !t.done :
    true;

  const lines = [];
  for (const task of list) {
    if (!task || !keep(task)) continue;
    lines.push({ kind: 'task', text: taskLineText(task), done: Boolean(task.done), task });
    const unlocked = unlockedLineText(task);
    if (unlocked) {
      lines.push({ kind: 'unlocked', text: unlocked, done: Boolean(task.done), task });
    }
  }
  return lines;
}

// ── CSS ──────────────────────────────────────────────────────────────────────

/** Séance terminal stylesheet. Uses design-token hex values directly (this is
 *  a UI file under src/ui, scoped to the overlay). */
export const SEANCE_CSS = `
.hh-seance {
  position: fixed;
  inset: 0;
  z-index: 200;                 /* above garage (100) so the overlay is on top */
  display: flex;
  flex-direction: column;
  background: #121A15;          /* panel */
  color: #E8E2D0;               /* bone */
  font-family: 'IBM Plex Mono', monospace;
  font-size: 15px;
  line-height: 1.5;
  padding: 24px;
  overflow: hidden;
}
.hh-seance__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #1F9E57;   /* phosphor-dim */
  margin-bottom: 12px;
}
.hh-seance__title {
  font-family: 'VT323', monospace;
  font-size: 28px;
  letter-spacing: 0.12em;
  color: #39FF88;                     /* phosphor */
}
.hh-seance__summary {
  font-family: 'Share Tech Mono', monospace;
  font-size: 14px;
  color: #E8E2D0;                     /* bone */
  font-variant-numeric: tabular-nums;
}
.hh-seance__list {
  flex: 1 1 auto;
  overflow-y: auto;
  margin: 0;
  padding: 0 4px 0 0;
  list-style: none;
}
.hh-seance__line {
  white-space: pre-wrap;
  word-break: break-word;
  padding: 2px 0;
  color: #E8E2D0;                     /* bone (default body) */
}
.hh-seance__line--done  { color: #39FF88; }   /* phosphor */
.hh-seance__line--open  { color: #1F9E57; }   /* phosphor-dim */
.hh-seance__line--unlocked {
  color: #9FD8FF;                     /* ghost */
  padding-left: 20px;
}
.hh-seance__footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid #1F9E57;
  margin-top: 12px;
}
/* blinking terminal cursor — 1 Hz */
.hh-seance__cursor {
  display: inline-block;
  width: 10px;
  height: 18px;
  background: #39FF88;                 /* phosphor */
  animation: hh-seance-blink 1s step-end infinite;
}
@keyframes hh-seance-blink {
  0%, 50%   { opacity: 1; }
  50.01%, 100% { opacity: 0; }
}
/* prefers-reduced-motion → solid cursor, no blink (a11y rule 3/4) */
@media (prefers-reduced-motion: reduce) {
  .hh-seance__cursor { animation: none; opacity: 1; }
}
.hh-seance__close {
  font-family: 'VT323', monospace;
  font-size: 22px;
  color: #0A0D0B;
  background: #39FF88;                 /* phosphor */
  border: none;
  padding: 6px 20px;
  min-height: 40px;
  min-width: 96px;
  cursor: pointer;
  border-radius: 2px;
  letter-spacing: 0.08em;
}
.hh-seance__close:hover { background: #5fffaa; }
.hh-seance__hint {
  font-family: 'Share Tech Mono', monospace;
  font-size: 13px;
  color: #1F9E57;                     /* phosphor-dim */
}
/* visible keyboard focus: 2px ember, not glow alone (a11y rule 5) */
.hh-seance :focus-visible,
.hh-seance__close:focus,
.hh-seance:focus {
  outline: 2px solid #FF8A3D;         /* ember */
  outline-offset: 2px;
}
`;

const STYLE_ID = 'hh-seance-css';

function injectCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = SEANCE_CSS;
  document.head.appendChild(style);
}

// ── Data loading ─────────────────────────────────────────────────────────────

/**
 * Fetch the task ledger, falling back to a tiny inline list on any failure so
 * the terminal always has a designed, non-empty state.
 *
 * @param {string} [url]
 * @returns {Promise<Array<object>>}
 */
export async function loadSeanceTasks(url = SEANCE_DATA_URL) {
  if (typeof fetch !== 'function') return SEANCE_FALLBACK.slice();
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) && data.length ? data : SEANCE_FALLBACK.slice();
  } catch {
    return SEANCE_FALLBACK.slice();
  }
}

// ── Mount ────────────────────────────────────────────────────────────────────

/**
 * Mount the séance overlay into `root`.
 *
 * Side effects: injects CSS, possesses the page (`setPossessed(true)`), focuses
 * the overlay, and binds Escape-to-close. On close/destroy it un-possesses the
 * page (`setPossessed(false)`) and removes itself.
 *
 * @param {HTMLElement} root
 * @param {{ onClose?: () => void, tasks?: Array<object> }} [options]
 * @returns {{ destroy: () => void, setTasks: (t:Array<object>)=>void }}
 */
export function mountSeance(root, { onClose, tasks } = {}) {
  injectPossessionCSS();
  injectCSS();

  // Opening the séance possesses the page — instant swap, no burst/wipe.
  setPossessed(true);

  const overlay = document.createElement('div');
  overlay.className = 'hh-seance';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Séance terminal — build ledger');
  overlay.tabIndex = -1;

  // Header
  const header = document.createElement('div');
  header.className = 'hh-seance__header';
  const title = document.createElement('h2');
  title.className = 'hh-seance__title';
  title.textContent = 'SÉANCE';
  const summary = document.createElement('div');
  summary.className = 'hh-seance__summary';
  summary.setAttribute('role', 'status');
  summary.setAttribute('aria-live', 'polite');
  header.append(title, summary);

  // List
  const list = document.createElement('ul');
  list.className = 'hh-seance__list';
  list.setAttribute('aria-label', 'Build task ledger');

  // Footer: cursor + hint + close
  const footer = document.createElement('div');
  footer.className = 'hh-seance__footer';
  const cursor = document.createElement('span');
  cursor.className = 'hh-seance__cursor';
  cursor.setAttribute('aria-hidden', 'true');
  const hint = document.createElement('span');
  hint.className = 'hh-seance__hint';
  hint.textContent = 'ESC to close the circle';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'hh-seance__close';
  closeBtn.textContent = 'CLOSE';
  closeBtn.setAttribute('aria-label', 'Close séance and return to garage');
  footer.append(cursor, hint, closeBtn);

  overlay.append(header, list, footer);
  root.append(overlay);

  // Render the list from a task array (pure model → DOM).
  function render(taskArr) {
    list.textContent = '';
    const lines = seanceLines(taskArr, 'all');
    for (const line of lines) {
      const li = document.createElement('li');
      li.className = 'hh-seance__line';
      if (line.kind === 'unlocked') {
        li.classList.add('hh-seance__line--unlocked');
      } else {
        li.classList.add(line.done ? 'hh-seance__line--done' : 'hh-seance__line--open');
      }
      li.textContent = line.text;
      list.append(li);
    }
    const total = Array.isArray(taskArr) ? taskArr.length : 0;
    summary.textContent = `${countDone(taskArr)} / ${total} bound`;
  }

  function close() {
    destroy();
    if (typeof onClose === 'function') onClose();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  }

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('keydown', onKeydown);

  function destroy() {
    overlay.removeEventListener('keydown', onKeydown);
    overlay.remove();
    // Leaving the séance lifts the possession — instant swap back to sterile.
    setPossessed(false);
  }

  // Initial content: provided tasks, else async-load the ledger.
  if (Array.isArray(tasks)) {
    render(tasks);
  } else {
    render(SEANCE_FALLBACK); // designed loading/empty state until fetch resolves
    loadSeanceTasks().then(render).catch(() => render(SEANCE_FALLBACK));
  }

  // Focus the overlay so Escape + focus ring work immediately.
  if (typeof overlay.focus === 'function') overlay.focus();

  return {
    destroy,
    setTasks: render,
  };
}
