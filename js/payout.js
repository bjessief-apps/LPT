// Flat-rate job payout, tiered by the sender's count (total boxes expected
// on the manifest, entered up front on the trailer screen). "Earned" payout
// is the total prorated by how much of that manifest has been counted so
// far, so a lumper can watch their pay accrue in real time.
import { state } from './state.js';
import { dom } from './dom.js';
import { getGrandTotalBoxes } from './session.js';

const VISIBILITY_KEY = 'lpt_payout_visible';

export function calcTotalPayout(sendersCountBoxes) {
  const boxes = sendersCountBoxes || 0;
  if (boxes <= 0) return 0;
  if (boxes <= 500) return 100;
  if (boxes <= 1500) return 130;
  if (boxes <= 3500) return 180;
  if (boxes <= 5500) return 230;
  if (boxes <= 7500) return 280;
  return 280 + (boxes - 7500) * 0.05;
}

export function calcEarnedPayout(countedBoxes, sendersCountBoxes) {
  const total = calcTotalPayout(sendersCountBoxes);
  if (total <= 0 || !sendersCountBoxes) return 0;
  const ratio = Math.min(countedBoxes / sendersCountBoxes, 1);
  return total * ratio;
}

export function formatCurrency(amount) {
  return `$${(amount || 0).toFixed(2)}`;
}

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
  if (!state.manifestBoxes || state.manifestBoxes <= 0 || !isPayoutVisible()) {
    dom.payoutBanner.classList.add('hidden');
    return;
  }
  dom.payoutTotal.innerText = formatCurrency(calcTotalPayout(state.manifestBoxes));
  dom.payoutEarned.innerText = formatCurrency(calcEarnedPayout(getGrandTotalBoxes(), state.manifestBoxes));
  dom.payoutBanner.classList.remove('hidden');
}
