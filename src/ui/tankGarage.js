/**
 * src/ui/tankGarage.js
 *
 * Tank-upgrade garage: 5 notch bars + credits + tier unlock.
 * Mounted via garage.js::mountGarage (keeps old helpers/CSS tests intact).
 */

import { defaultLoadout } from '../data/presets.js';
import {
  SLOT_ORDER, SLOT_META, MAX_NOTCH, MAX_TIER,
  loadUpgradeState, saveUpgradeState, spendNotch, resetUpgradeState,
  notchLabel, deployTotalsFromUpgrades, barsFull, creditsForNextWin,
  paletteForTier,
} from '../mech/tankUpgrades.js';

function el(tag, attrs = {}) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (v === '' || v === true) node.setAttribute(k, '');
    else if (v !== false && v != null) node.setAttribute(k, String(v));
  }
  return node;
}

const EXTRA_CSS = `
/* ── Tank upgrade bars (feat/tank-upgrades) ─────────── */
.hh-ug-row {
  display: grid;
  grid-template-columns: 72px 1fr auto;
  gap: 8px;
  align-items: center;
  min-height: 44px;
  padding: 8px 10px;
  background: var(--color-panel, #121612);
  border: 1px solid var(--color-phosphor-dim, #1F3D2A);
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 6px;
}
.hh-ug-row:focus-visible, .hh-ug-row.is-active {
  outline: 2px solid var(--color-ember, #FF8A3D);
  outline-offset: 2px;
}
.hh-ug-row__label {
  font-family: 'Share Tech Mono', 'IBM Plex Mono', monospace;
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--color-phosphor, #39FF88);
}
.hh-ug-notches {
  display: flex; gap: 4px; align-items: center; min-height: 12px;
}
.hh-ug-notch {
  flex: 1; height: 12px; border-radius: 2px;
  background: var(--color-void, #0A0D0B);
  border: 1px solid var(--color-phosphor-dim, #1F3D2A);
}
.hh-ug-notch.is-on {
  background: var(--color-phosphor, #39FF88);
  border-color: var(--color-phosphor, #39FF88);
}
.hh-ug-row__value {
  font-family: 'VT323', monospace;
  font-size: 16px;
  color: var(--color-bone, #E8E2D0);
  min-width: 88px;
  text-align: right;
}
.hh-ug-panel {
  padding: 12px;
  background: var(--color-panel, #121612);
  border: 1px solid var(--color-phosphor-dim, #1F3D2A);
  border-radius: 4px;
  min-height: 160px;
}
.hh-ug-panel h2 {
  margin: 0 0 6px;
  font-family: 'Rajdhani', sans-serif;
  font-weight: 600;
  font-size: 20px;
  color: var(--color-phosphor, #39FF88);
  letter-spacing: 0.08em;
}
.hh-ug-flavor {
  margin: 0 0 12px;
  color: var(--color-ash, #8A8F85);
  font-size: 13px;
  font-style: italic;
}
.hh-ug-spend {
  min-height: 44px;
  padding: 0 16px;
  background: var(--color-ember, #FF8A3D);
  color: var(--color-void, #0A0D0B);
  border: none;
  border-radius: 4px;
  font-family: 'Rajdhani', sans-serif;
  font-weight: 600;
  font-size: 16px;
  letter-spacing: 0.06em;
  cursor: pointer;
}
.hh-ug-spend:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.hh-ug-meta {
  display: grid;
  gap: 8px;
  padding: 12px;
  background: var(--color-panel, #121612);
  border: 1px solid var(--color-phosphor-dim, #1F3D2A);
  border-radius: 4px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 13px;
}
.hh-ug-meta strong { color: var(--color-phosphor, #39FF88); }
.hh-ug-tier {
  font-family: 'VT323', monospace;
  font-size: 28px;
  color: var(--color-bone, #E8E2D0);
}
.hh-ug-banner {
  margin: 8px 0 0;
  padding: 8px 10px;
  background: rgba(57,255,136,0.12);
  border: 1px solid var(--color-phosphor, #39FF88);
  color: var(--color-phosphor, #39FF88);
  font-size: 13px;
  border-radius: 4px;
}
.hh-ug-reset {
  min-height: 36px;
  margin-top: 8px;
  padding: 0 12px;
  background: transparent;
  color: var(--color-ghost, #9BB0A0);
  border: 1px solid var(--color-ghost, #9BB0A0);
  border-radius: 4px;
  font-family: 'Share Tech Mono', monospace;
  font-size: 12px;
  cursor: pointer;
}
.hh-ug-help {
  margin: 4px 0 10px;
  color: var(--color-ash, #8A8F85);
  font-size: 12px;
  line-height: 1.35;
}
`;

let extraCssInjected = false;
function injectExtraCss() {
  if (extraCssInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.setAttribute('data-hh-tank-upgrades', '');
  style.textContent = EXTRA_CSS;
  document.head.append(style);
  extraCssInjected = true;
}

/**
 * @param {HTMLElement} root
 * @param {{ onDeploy?: Function, onSeance?: Function }} options
 */
export function mountTankGarage(root, { onDeploy, onSeance } = {}) {
  injectExtraCss();

  let state = loadUpgradeState();
  let active = 'tracks';
  let banner = '';

  const overlay = el('div', {
    class: 'hh-garage', role: 'dialog', 'aria-modal': 'true',
    'aria-label': 'Garage — tank upgrades',
  });

  const header = el('div', { class: 'hh-garage__header' });
  const titleEl = el('h1', { class: 'hh-garage__title', text: 'GARAGE' });
  const subtitleEl = el('p', { class: 'hh-garage__subtitle' });
  subtitleEl.textContent = 'Spend credits on tank bars. Win N pays N credits.';
  header.append(titleEl, subtitleEl);

  const body = el('div', { class: 'hh-garage__body' });
  const slotList = el('div', { class: 'hh-garage__slots', role: 'group', 'aria-label': 'Tank upgrade bars' });
  const pickerPanel = el('div', { class: 'hh-picker', role: 'region', 'aria-label': 'Upgrade detail' });
  const previewCol = el('div', { class: 'hh-preview', role: 'region', 'aria-label': 'Credits and tier' });
  const previewArt = el('div', { class: 'hh-preview__art' });
  const summary = el('div', { class: 'hh-summary', 'aria-live': 'polite', 'aria-atomic': 'true' });
  previewCol.append(previewArt, summary);
  body.append(slotList, pickerPanel, previewCol);

  const help = el('p', { class: 'hh-ug-help' });
  help.textContent = 'Fill every bar to unlock the next tank tier (new color + small base bonus). Bars reset; credits stay.';
  header.append(help);

  const footer = el('div', { class: 'hh-garage__footer' });
  const deployCol = el('div', { class: 'hh-deploy-col' });
  const deployBtn = el('button', { class: 'hh-deploy', type: 'button', 'aria-label': 'Deploy tank' });
  deployBtn.textContent = 'DEPLOY';
  const deployConfirm = el('div', { class: 'hh-deploy-confirm', role: 'alert', hidden: '' });
  deployCol.append(deployBtn, deployConfirm);
  const seanceBtn = el('button', { class: 'hh-seance-btn', type: 'button', 'aria-label': 'Open séance terminal' });
  seanceBtn.textContent = 'SÉANCE';
  seanceBtn.addEventListener('click', () => { if (typeof onSeance === 'function') onSeance(); });
  footer.append(seanceBtn, deployCol);

  const srStatus = el('div', { class: 'hh-sr-status', role: 'status', 'aria-live': 'polite' });
  overlay.append(header, body, footer, srStatus);
  root.append(overlay);

  /** @type {Map<string, HTMLElement>} */
  const rows = new Map();

  for (const slot of SLOT_ORDER) {
    const row = el('div', {
      class: 'hh-ug-row hh-slot',
      tabindex: '0',
      role: 'button',
      'data-slot': slot,
      'aria-label': `${SLOT_META[slot].label} upgrade bar`,
    });
    const label = el('span', { class: 'hh-ug-row__label hh-slot__label', text: SLOT_META[slot].label });
    const notches = el('div', { class: 'hh-ug-notches hh-bar-track', role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': String(MAX_NOTCH) });
    for (let i = 0; i < MAX_NOTCH; i++) {
      notches.append(el('span', { class: 'hh-ug-notch', 'data-i': String(i) }));
    }
    const value = el('span', { class: 'hh-ug-row__value hh-slot__name' });
    row.append(label, notches, value);
    slotList.append(row);
    rows.set(slot, row);
    row.addEventListener('click', () => { active = slot; render(); });
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); active = slot; render(); }
    });
  }

  function announce(msg) {
    srStatus.textContent = '';
    requestAnimationFrame(() => { srStatus.textContent = msg; });
  }

  function renderRows() {
    for (const slot of SLOT_ORDER) {
      const row = rows.get(slot);
      const n = state[slot];
      row.classList.toggle('is-active', slot === active);
      row.querySelectorAll('.hh-ug-notch').forEach((node, i) => {
        node.classList.toggle('is-on', i < n);
      });
      const meter = row.querySelector('.hh-ug-notches');
      meter.setAttribute('aria-valuenow', String(n));
      row.querySelector('.hh-ug-row__value').textContent = notchLabel(slot, n, state);
    }
  }

  function renderPicker() {
    pickerPanel.innerHTML = '';
    const panel = el('div', { class: 'hh-ug-panel' });
    const h = el('h2', { text: SLOT_META[active].label });
    const flavor = el('p', { class: 'hh-ug-flavor', text: SLOT_META[active].flavor });
    const now = el('p');
    now.innerHTML = `Now: <strong>${notchLabel(active, state[active], state)}</strong>`;
    const nextN = Math.min(MAX_NOTCH, state[active] + 1);
    const nextLine = el('p');
    if (state[active] >= MAX_NOTCH) {
      nextLine.textContent = 'Bar full.';
    } else {
      nextLine.innerHTML = `Next: <strong>${notchLabel(active, nextN, state)}</strong> · costs 1 credit`;
    }
    const spend = el('button', { class: 'hh-ug-spend', type: 'button' });
    spend.textContent = state[active] >= MAX_NOTCH ? 'FULL' : 'SPEND 1 CREDIT';
    spend.disabled = state.credits < 1 || state[active] >= MAX_NOTCH;
    spend.addEventListener('click', () => {
      const res = spendNotch(state, active);
      if (!res.ok) {
        announce(res.reason === 'no-credits' ? 'No credits left.' : 'Cannot spend.');
        return;
      }
      state = res.state;
      saveUpgradeState(state);
      if (res.unlockedTier) {
        banner = `TIER ${res.unlockedTier} UNLOCKED — new hull color online. Bars reset.`;
        announce(banner);
      } else {
        banner = '';
        announce(`Upgraded ${SLOT_META[active].label}`);
      }
      render();
    });
    panel.append(h, flavor, now, nextLine, spend);
    pickerPanel.append(panel);
  }

  function renderPreview() {
    summary.innerHTML = '';
    const meta = el('div', { class: 'hh-ug-meta' });
    const tier = el('div', { class: 'hh-ug-tier', text: `TIER ${state.tier}` });
    const pal = paletteForTier(state.tier);
    const credits = el('div');
    credits.innerHTML = `Credits: <strong>${state.credits}</strong>`;
    const wins = el('div');
    wins.innerHTML = `Wins: <strong>${state.wins}</strong> · next payout <strong>${creditsForNextWin(state.wins)}</strong>`;
    const hull = el('div');
    hull.innerHTML = `Hull palette: <strong>${pal}</strong> (C9e silhouette)`;
    const tip = el('div');
    tip.textContent = barsFull(state) && state.tier >= MAX_TIER
      ? 'Max tier. Bars full — trophy rack.'
      : 'Win matches to earn credits. Losses pay 0.';
    meta.append(tier, credits, wins, hull, tip);
    if (banner) meta.append(el('div', { class: 'hh-ug-banner', text: banner }));
    const reset = el('button', { class: 'hh-ug-reset', type: 'button', text: 'RESET PROGRESS' });
    reset.addEventListener('click', () => {
      state = resetUpgradeState();
      saveUpgradeState(state);
      banner = 'Progress wiped.';
      announce(banner);
      render();
    });
    summary.append(meta, reset);
    previewArt.innerHTML = '';
    const art = el('div', { class: 'hh-notice' });
    art.style.minHeight = '48px';
    art.style.padding = '10px';
    art.style.color = 'var(--color-bone, #E8E2D0)';
    art.style.fontFamily = 'VT323, monospace';
    art.style.fontSize = '22px';
    art.textContent = state.tier >= 2 ? '◈ TANK TIER HULL' : '◇ STARTER HULL';
    previewArt.append(art);
  }

  function render() {
    renderRows();
    renderPicker();
    renderPreview();
  }

  deployBtn.addEventListener('click', () => {
    saveUpgradeState(state);
    const loadout = defaultLoadout();
    const totals = deployTotalsFromUpgrades(state);
    if (typeof onDeploy === 'function') onDeploy(loadout, totals);
  });

  render();

  return {
    setLoadout() { /* upgrades garage ignores old part loadouts */ },
    getState: () => ({ ...state }),
    destroy() { overlay.remove(); },
  };
}
