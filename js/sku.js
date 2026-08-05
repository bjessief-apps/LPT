// Adding, listing, and deleting SKUs (both the setup-screen tag list and the
// live tracker table row that mirrors it once counting has started).
import { state } from './state.js';
import { dom } from './dom.js';
import { createTrackingEntry, captureUndoState } from './session.js';
import { saveState } from './storage.js';
import { appendTrackerRow, renderTable } from './tracker.js';
import { showError } from './main.js';

export function addSkuToList(val) {
  if (/^\d{3}$/.test(val)) {
    if (!state.skus.includes(val)) {
      state.skus.push(val);
      state.trackingData[val] = createTrackingEntry();
      renderSkuTags();
      if (state.currentSection === 'tracking-section') {
        appendTrackerRow(val);
      }
      saveState();
    }
    return true;
  } else {
    showError('error-message-2', 'Please enter exactly 3 digits for the SKU.');
    return false;
  }
}

export function renderSkuTags() {
  if (state.skus.length === 0) {
    dom.skuTags.innerHTML = '';
  } else {
    dom.skuTags.innerHTML = state.skus.map(s => `<span class="sku-tag-badge">${s}<span class="sku-tag-delete" data-sku="${s}" title="Delete SKU">&times;</span></span>`).join('');
    dom.skuTags.querySelectorAll('.sku-tag-delete').forEach(el => {
      el.addEventListener('click', (e) => {
        deleteSku(e.target.getAttribute('data-sku'));
      });
    });
  }
}

export function deleteSku(skuToDelete) {
  if (confirm(`Are you sure you want to delete SKU ${skuToDelete}?`)) {
    captureUndoState(`Deleted SKU ${skuToDelete}`);
    state.skus = state.skus.filter(s => s !== skuToDelete);
    delete state.trackingData[skuToDelete];
    renderSkuTags();
    if (state.currentSection === 'tracking-section') renderTable();
    saveState();
  }
}
