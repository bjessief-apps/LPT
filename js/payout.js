// Optional pay tracking. Off by default. When it's on, the worker fills in
// their own pay table: rows of "up to N boxes pays $X". The container's pay
// comes from the sender's count (total boxes on the manifest), and "earned"
// pay is that amount prorated by how much of the manifest has been counted
// so far, so a worker can watch their pay add up in real time.
import { state } from './state.js';
import { dom } from './dom.js';
import { getGrandTotalBoxes } from './session.js';

const SETTINGS_KEY = 'lpt_pay_settings';
const VISIBILITY_KEY = 'lpt_payout_visible';

// ---------- settings ----------

function cleanTiers(tiers) {
  return (Array.isArray(tiers) ? tiers : [])
    .map(t => ({ upTo: Math.floor(Number(t.upTo)), pay: Number(t.pay) }))
    .filter(t => t.upTo > 0 && t.pay >= 0 && isFinite(t.pay))
    .sort((a, b) => a.upTo - b.upTo);
}

export function getPaySettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (saved) return { enabled: !!saved.enabled, tiers: cleanTiers(saved.tiers) };
  } catch (e) {}
  return { enabled: false, tiers: [] };
}

export function savePaySettings(settings) {
  const clean = { enabled: !!settings.enabled, tiers: cleanTiers(settings.tiers) };
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(clean)); } catch (e) {}
  return clean;
}

// Pay tracking counts as on only when it's switched on AND has at least one row.
export function isPayTracking() {
  const s = getPaySettings();
  return s.enabled && s.tiers.length > 0;
}

// The tiers to save with a finished session, so its history keeps the pay
// table that was in use that day even if the worker changes it later.
export function getActiveTiers() {
  return isPayTracking() ? getPaySettings().tiers : null;
}

// ---------- math ----------

// Finds the first row whose box limit covers the count. Anything bigger than
// the last row pays the last row's amount.
export function calcTotalPayout(sendersCountBoxes, tiers = getPaySettings().tiers) {
  const boxes = sendersCountBoxes || 0;
  const list = cleanTiers(tiers);
  if (boxes <= 0 || list.length === 0) return 0;
  const match = list.find(t => boxes <= t.upTo) || list[list.length - 1];
  return match.pay;
}

export function calcEarnedPayout(countedBoxes, sendersCountBoxes, tiers = getPaySettings().tiers) {
  const total = calcTotalPayout(sendersCountBoxes, tiers);
  if (total <= 0 || !sendersCountBoxes) return 0;
  const ratio = Math.min(countedBoxes / sendersCountBoxes, 1);
  return total * ratio;
}

export function formatCurrency(amount) {
  return `$${(amount || 0).toFixed(2)}`;
}

// ---------- tracker banner ----------

function isPayoutVisible() {
  try {
    const stored = localStorage.getItem(VISIBILITY_KEY);
    return stored === null ? true : stored === 'true';
  } catch (e) {
    return true;
  }
}

export function togglePayoutVisibility() {
  const next = !isPayoutVisible();
  try { localStorage.setItem(VISIBILITY_KEY, String(next)); } catch (e) {}
  updatePayoutDisplay();
}

export function updatePayoutDisplay() {
  if (!isPayTracking() || !state.manifestBoxes || state.manifestBoxes <= 0 || !isPayoutVisible()) {
    dom.payoutBanner.classList.add('hidden');
    return;
  }
  dom.payoutTotal.innerText = formatCurrency(calcTotalPayout(state.manifestBoxes));
  dom.payoutEarned.innerText = formatCurrency(calcEarnedPayout(getGrandTotalBoxes(), state.manifestBoxes));
  dom.payoutBanner.classList.remove('hidden');
}

// ---------- pay settings window ----------

function rowHtml(t = { upTo: '', pay: '' }) {
  return `<div class="pay-row">
    <input type="number" class="pay-upto" inputmode="numeric" placeholder="e.g. 1000" value="${t.upTo}" aria-label="Up to this many boxes">
    <div class="pay-money"><span>$</span><input type="number" class="pay-amount" inputmode="decimal" step="0.01" placeholder="0.00" value="${t.pay}" aria-label="Pay for this range"></div>
    <button type="button" class="pay-row-remove" aria-label="Remove row">✕</button>
  </div>`;
}

function readRows() {
  return [...dom.payRows.querySelectorAll('.pay-row')].map(r => ({
    upTo: r.querySelector('.pay-upto').value,
    pay: r.querySelector('.pay-amount').value
  }));
}

function syncPayModal() {
  dom.payTableWrap.classList.toggle('hidden', !dom.payEnabledCheckbox.checked);
}

export function openPaySettings() {
  const s = getPaySettings();
  dom.payEnabledCheckbox.checked = s.enabled;
  dom.payRows.innerHTML = (s.tiers.length ? s.tiers : [{ upTo: '', pay: '' }]).map(rowHtml).join('');
  dom.payError.innerText = '';
  syncPayModal();
  dom.payModalOverlay.classList.remove('hidden');
}

function closePaySettings() {
  dom.payModalOverlay.classList.add('hidden');
}

dom.payEnabledCheckbox.addEventListener('change', syncPayModal);
dom.payAddRowBtn.addEventListener('click', () => {
  dom.payRows.insertAdjacentHTML('beforeend', rowHtml());
  const inputs = dom.payRows.querySelectorAll('.pay-upto');
  inputs[inputs.length - 1].focus();
});
dom.payRows.addEventListener('click', (e) => {
  if (e.target.classList.contains('pay-row-remove')) e.target.closest('.pay-row').remove();
});
dom.payCancelBtn.addEventListener('click', closePaySettings);
dom.paySaveBtn.addEventListener('click', () => {
  const enabled = dom.payEnabledCheckbox.checked;
  const rows = readRows().filter(r => r.upTo !== '' || r.pay !== '');
  const clean = cleanTiers(rows);
  if (enabled && clean.length !== rows.length) {
    dom.payError.innerText = 'Each row needs a box count above 0 and a pay amount.';
    return;
  }
  if (enabled && clean.length === 0) {
    dom.payError.innerText = 'Add at least one row, or turn pay tracking off.';
    return;
  }
  if (new Set(clean.map(t => t.upTo)).size !== clean.length) {
    dom.payError.innerText = 'Two rows have the same box count.';
    return;
  }
  savePaySettings({ enabled, tiers: clean });
  closePaySettings();
  updatePayoutDisplay();
});
