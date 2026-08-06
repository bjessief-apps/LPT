import { state } from './state.js';
import { dom } from './dom.js';
import { openThreeOptionModal } from './modal.js';
import { saveState, loadSavedSession, finalizeAndSaveSession } from './storage.js';
import { findRecentHistoryMatch, renderWorkHistory } from './history.js';
import {
  createTrackingEntry, startNewSession, startNewSessionWithPreviousSkus,
  restorePreviousDoorSession, renderLogModalList, getSoloPalletBreakdown
} from './session.js';
import { generateSummaryPdf, renderSignoutSummary } from './export.js';
import { addSkuToList } from './sku.js';
import { renderTable, recalculateOverallTotals } from './tracker.js';
import { togglePayoutVisibility } from './payout.js';

// Theme Initialization
const savedTheme = localStorage.getItem('lpt_theme') || 'dark';
if (savedTheme === 'light') {
  dom.bodyEl.classList.add('light-theme');
}
const toggleTheme = () => {
  dom.bodyEl.classList.toggle('light-theme');
  const isLight = dom.bodyEl.classList.contains('light-theme');
  localStorage.setItem('lpt_theme', isLight ? 'light' : 'dark');
  dom.dropdownMenu.classList.remove('show');
};
dom.menuItemTheme.addEventListener('click', toggleTheme);
if (dom.startScreenThemeToggle) {
  dom.startScreenThemeToggle.addEventListener('click', toggleTheme);
}

// Blank-start initialization
state.workerName = '';
state.doorNum = '';
state.manifestBoxes = 0;
state.manifestPallets = 0;
state.startTime = null;
state.endTime = null;
state.skipNameDoorMode = false;
state.skus = [];
state.trackingData = {};
state.activityLogs = [];
state.currentSection = 'trailer-section';
state.lastUndoState = null;
state.sessionSummarySaved = false;
dom.workerNameInput.value = '';
dom.doorNumInput.value = '';
dom.sendersCountInput.value = '';
dom.skuInput.value = '';
dom.midSkuInput.value = '';
clearErrorMessages();
hideAllSections();
dom.trailerSection.classList.remove('hidden');
updateHeaderPreview();
updateMenuVisibility();
updateSkipButtonVisibility();
saveState();

// Hamburger Menu Toggle
dom.hamburgerMenuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  dom.dropdownMenu.classList.toggle('show');
  updateMenuVisibility();
});
document.addEventListener('click', () => {
  dom.dropdownMenu.classList.remove('show');
});
dom.dropdownMenu.addEventListener('click', (e) => {
  e.stopPropagation();
});

export function updateMenuVisibility() {
  if (state.currentSection === 'tracking-section') {
    dom.menuItemSendersCount.classList.remove('hidden');
    dom.menuItemSoloPallets.classList.remove('hidden');
    dom.menuItemPayoutToggle.classList.remove('hidden');
  } else {
    dom.menuItemSendersCount.classList.add('hidden');
    dom.menuItemSoloPallets.classList.add('hidden');
    dom.menuItemPayoutToggle.classList.add('hidden');
  }

  if (state.currentSection === 'tracking-section' || state.currentSection === 'setup-section') {
    dom.menuItemEndSession.classList.remove('hidden');
    dom.menuActiveSessionDivider.classList.remove('hidden');
  } else {
    dom.menuItemEndSession.classList.add('hidden');
    dom.menuActiveSessionDivider.classList.add('hidden');
  }
}

function updateSkipButtonVisibility() {
  if (state.currentSection === 'trailer-section') {
    dom.btnSkipNameDoor.classList.remove('hidden');
  } else {
    dom.btnSkipNameDoor.classList.add('hidden');
  }
}

function updateHeaderPreview() {
  const previewName = dom.workerNameInput.value.trim();
  const previewDoor = dom.doorNumInput.value.trim();
  if (state.currentSection === 'trailer-section') {
    dom.appHeaderBar.classList.add('hidden');
  }
  dom.dispTrailerName.innerText = previewName ? previewName.toUpperCase() : '';
  if (previewDoor) {
    dom.dispTrailerNum.innerText = `DOOR ${previewDoor}`;
    dom.dispTrailerNum.classList.remove('hidden');
  } else {
    dom.dispTrailerNum.classList.add('hidden');
  }
  dom.btnSkipNameDoor.innerText = (previewName || previewDoor) ? 'Next' : 'Skip';
}

dom.menuItemSendersCount.addEventListener('click', () => {
  dom.dropdownMenu.classList.remove('show');
  dom.modalManifestBoxesInput.value = state.manifestBoxes || '';
  dom.modalManifestPalletsInput.value = state.manifestPallets || '';
  dom.sendersCountModalOverlay.classList.remove('hidden');
});

function renderSoloPalletsList() {
  const rows = getSoloPalletBreakdown();
  dom.soloPalletsList.innerHTML = rows.length === 0
    ? `<div style="color:var(--text-muted); text-align:center; padding:10px;">No solo pallets counted yet</div>`
    : rows.map(row => `<div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px dashed var(--border-color);"><span>SKU ${row.sku}</span><span><strong>${row.count}</strong> pallet${row.count === 1 ? '' : 's'} (${row.boxes} boxes)</span></div>`).join('');
}

dom.menuItemSoloPallets.addEventListener('click', () => {
  dom.dropdownMenu.classList.remove('show');
  renderSoloPalletsList();
  dom.soloPalletsModalOverlay.classList.remove('hidden');
});

dom.btnCloseSoloPalletsModal.addEventListener('click', () => {
  dom.soloPalletsModalOverlay.classList.add('hidden');
});

dom.menuItemPayoutToggle.addEventListener('click', () => {
  dom.dropdownMenu.classList.remove('show');
  togglePayoutVisibility();
});

dom.menuItemLog.addEventListener('click', () => {
  dom.dropdownMenu.classList.remove('show');
  renderLogModalList();
  dom.logModalOverlay.classList.remove('hidden');
});

if (dom.btnViewLog) {
  dom.btnViewLog.addEventListener('click', () => {
    renderLogModalList();
    dom.logModalOverlay.classList.remove('hidden');
  });
}

dom.btnCloseLogModal.addEventListener('click', () => {
  dom.logModalOverlay.classList.add('hidden');
});

dom.menuItemEndSession.addEventListener('click', () => {
  dom.dropdownMenu.classList.remove('show');
  if (confirm("Are you sure you want to end this trailer count session?")) {
    state.endTime = Date.now();
    saveState();
    finalizeAndSaveSession();
    switchSection('signout-section');
    renderSignoutSummary();
  }
});

// Log Modal Exports
dom.btnModalExportTxt && dom.btnModalExportTxt.addEventListener('click', () => {
  const w = state.workerName ? state.workerName.toUpperCase() : '';
  const d = state.doorNum ? `Door #${state.doorNum}` : '';
  const titleLine = [d, w].filter(Boolean).join(' | ') || 'Activity Log';
  const divider = '='.repeat(60);
  const subDivider = '-'.repeat(60);
  let lines = [];
  lines.push(divider);
  lines.push('LUMPER PALLET TRACKER — ACTIVITY LOG');
  lines.push(titleLine);
  lines.push(divider);
  lines.push('');
  lines.push(`${'TIME'.padEnd(14)}${'SKU'.padEnd(10)}${'ACTION'.padEnd(28)}RUNNING TOTAL`);
  lines.push(subDivider);
  state.activityLogs.forEach(l => {
    const time = `[${l.time || '--'}]`.padEnd(14);
    const sku = `SKU ${l.sku || '--'}`.padEnd(10);
    const desc = (l.desc || '').padEnd(28);
    const total = `${l.totalBoxes} boxes`;
    lines.push(`${time}${sku}${desc}${total}`);
  });
  lines.push(subDivider);
  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileNameSuffix = state.doorNum && state.doorNum.trim().length > 0 ? `Door_${state.doorNum}` : `Worker_${state.workerName ? state.workerName.toUpperCase() : 'LOG'}`;
  a.download = `${fileNameSuffix}_ActivityLog.txt`;
  a.click();
  URL.revokeObjectURL(url);
});

dom.btnModalExportPdf.addEventListener('click', () => {
  const header = state.doorNum ? `Door #${state.doorNum}${state.workerName ? ' — ' + state.workerName.toUpperCase() : ''}` : (state.workerName ? state.workerName.toUpperCase() : 'Activity Log');
  const rows = state.activityLogs.map(l =>
    `<tr><td>[${l.time}]</td><td>SKU ${l.sku}</td><td>${l.desc}</td><td>${l.totalBoxes} boxes</td></tr>`
  ).join('');
  const docOpen = '<!doctype html><html><' + 'head><meta charset="utf-8"><title>Activity Log</title>'
    + '<style>body{font-family:Arial,sans-serif;padding:24px;color:#111;}'
    + 'table{width:100%;border-collapse:collapse;margin-top:12px;}'
    + 'th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;font-size:13px;}'
    + 'th{background:#f0f0f0;} tr:nth-child(even) td{background:#f9f9f9;}'
    + '*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}</style></' + 'head><' + 'body>';
  const docClose = '</' + 'body></' + 'html>';
  const body = `<h2>Activity Log — ${header}</h2><table><thead><tr><th>Time</th><th>SKU</th><th>Action</th><th>Running Total</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No entries</td></tr>'}</tbody></table>`;
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) { alert('Please allow popups.'); return; }
  w.document.write(docOpen + body + docClose);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); setTimeout(() => w.close(), 1000); }, 400);
});

dom.workerNameInput.value = '';
dom.doorNumInput.value = '';

function clearErrorMessages() {
  ['error-message-1', 'error-message-2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerText = '';
      el.style.display = 'none';
    }
  });
}

function hideAllSections() {
  [dom.trailerSection, dom.setupSection, dom.trackingSection, dom.signoutSection, dom.historySection].forEach(section => {
    if (section) section.classList.add('hidden');
  });
}

export function switchSection(sectionId) {
  state.currentSection = sectionId;
  hideAllSections();
  if (sectionId === 'tracking-section') {
    dom.appHeaderBar.classList.remove('hidden');
    if (state.skipNameDoorMode) {
      dom.dispTrailerName.classList.add('hidden');
      dom.dispTrailerNum.classList.add('hidden');
    } else {
      dom.dispTrailerName.classList.remove('hidden');
      dom.dispTrailerNum.classList.remove('hidden');
    }
  } else {
    dom.appHeaderBar.classList.add('hidden');
  }
  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.remove('hidden');
  }
  if (sectionId === 'trailer-section') {
    clearErrorMessages();
    updateHeaderPreview();
  }
  updateMenuVisibility();
  updateSkipButtonVisibility();
  saveState();
}

export function updateTrackerHeader() {
  dom.dispTrailerName.innerText = state.workerName ? state.workerName.toUpperCase() : '';
  if (state.doorNum && state.doorNum.trim().length > 0) {
    dom.dispTrailerNum.innerText = `DOOR ${state.doorNum}`;
    dom.dispTrailerNum.classList.remove('hidden');
  } else {
    dom.dispTrailerNum.classList.add('hidden');
  }
}

export function showError(elId, msg) {
  const errEl = document.getElementById(elId);
  errEl.innerText = msg;
  errEl.style.display = 'block';
  setTimeout(() => { errEl.style.display = 'none'; }, 3000);
}

function updateStartScreenPreview() {
  updateHeaderPreview();
}

dom.workerNameInput.addEventListener('input', updateStartScreenPreview);
dom.doorNumInput.addEventListener('input', () => {
  let val = dom.doorNumInput.value.replace(/\D/g, '');
  if (val.length > 3) val = val.slice(0, 3);
  dom.doorNumInput.value = val;
  updateStartScreenPreview();
});

dom.btnViewHistory.addEventListener('click', () => {
  renderWorkHistory();
  switchSection('history-section');
});

dom.workerNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    dom.workerNameInput.blur();
    dom.doorNumInput.focus();
  }
});
dom.doorNumInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    dom.doorNumInput.blur();
    if (dom.doorNumInput.value.trim().length === 3) {
      dom.sendersCountInput.focus();
    }
  }
});
dom.sendersCountInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    dom.sendersCountInput.blur();
    dom.btnSkipNameDoor.click();
  }
});

updateStartScreenPreview();

// WORK HISTORY
dom.btnExportSummaryPdf.addEventListener('click', () => {
  generateSummaryPdf();
});

dom.btnBackFromHistory.addEventListener('click', () => {
  if (state.trackingData && Object.keys(state.trackingData).length > 0) {
    switchSection('tracking-section');
  } else {
    switchSection('trailer-section');
  }
});

dom.historyNameFilter.addEventListener('input', () => {
  renderWorkHistory();
});

// 1. TRAILER SETUP STEP

dom.btnBackToTrailer.addEventListener('click', () => {
  dom.workerNameInput.value = state.workerName;
  dom.doorNumInput.value = state.doorNum;
  dom.sendersCountInput.value = state.manifestBoxes || '';
  switchSection('trailer-section');
});

dom.btnSkipNameDoor.addEventListener('click', () => {
  const wVal = dom.workerNameInput.value.trim();
  const dVal = dom.doorNumInput.value.trim();
  const sendersCountVal = parseInt(dom.sendersCountInput.value, 10) || 0;
  if (!wVal && !dVal) {
    state.skipNameDoorMode = true;
    saveState();
    startNewSession('', '', 0);
    return;
  }

  if (!dVal || sendersCountVal <= 0) {
    showError('error-message-1', "Door number and Sender's Count (total boxes) are required.");
    return;
  }

  const matchedRecord = findRecentHistoryMatch(wVal, dVal);
  if (!matchedRecord) {
    state.skipNameDoorMode = false;
    saveState();
    startNewSession(wVal, dVal, sendersCountVal);
    return;
  }

  openThreeOptionModal(
    `Door #${dVal} Found in Recent History`,
    `<p>A recent session for Door #${dVal} was found. Choose how to continue.</p>`,
    'Continue Door',
    () => restorePreviousDoorSession(matchedRecord),
    'Start New',
    () => {
      state.skipNameDoorMode = false;
      saveState();
      startNewSessionWithPreviousSkus(wVal, dVal, matchedRecord, sendersCountVal);
    },
    'Cancel'
  );
});

// 2. SKU SETUP STEP
dom.btnAddSku.addEventListener('click', () => {
  if (addSkuToList(dom.skuInput.value.trim())) {
    dom.skuInput.value = '';
    dom.skuInput.focus();
  }
});

dom.skuInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && addSkuToList(dom.skuInput.value.trim())) {
    dom.skuInput.value = '';
  }
});

dom.midSkuInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (addSkuToList(dom.midSkuInput.value.trim())) {
      dom.midSkuInput.value = '';
    }
  }
});

dom.btnMidAddSku.addEventListener('click', () => {
  if (addSkuToList(dom.midSkuInput.value.trim())) {
    dom.midSkuInput.value = '';
  }
});

dom.btnFinish.addEventListener('click', () => {
  const wVal = (dom.workerNameInput.value.trim() || state.workerName || '').trim();
  const dVal = dom.doorNumInput.value.trim();
  const matchedRecord = findRecentHistoryMatch(wVal, dVal, true);

  if (matchedRecord && dVal) {
    openThreeOptionModal(
      `Continue Door #${dVal}?`,
      `<p>A recent session for Door #${dVal} was found in the last 24 hours.</p><p style="margin-top:8px;">Continue the prior count or start a new count with the SKUs you entered.</p>`,
      'Continue Count',
      () => restorePreviousDoorSession(matchedRecord),
      'Start New Count',
      () => {
        state.workerName = wVal.toUpperCase();
        state.doorNum = dVal;
        state.manifestPallets = 0;
        state.startTime = Date.now();
        state.activityLogs = [];
        state.sessionSummarySaved = false;
        const freshTrackingData = {};
        state.skus.forEach(sku => {
          freshTrackingData[sku] = createTrackingEntry();
        });
        state.trackingData = freshTrackingData;
        updateTrackerHeader();
        switchSection('tracking-section');
        renderTable();
        saveState();
      },
      'Cancel'
    );
    return;
  }

  updateTrackerHeader();
  switchSection('tracking-section');
  renderTable();
});

dom.btnNewTrailer.addEventListener('click', () => {
  finalizeAndSaveSession();
  try { localStorage.removeItem('lpt_saved_session'); } catch(e) {}
  location.reload();
});

function closeSendersCountModal() {
  dom.sendersCountModalOverlay.classList.add('hidden');
}
dom.modalSendersCancelBtn.addEventListener('click', closeSendersCountModal);
dom.modalSendersSaveBtn.addEventListener('click', () => {
  state.manifestBoxes = parseInt(dom.modalManifestBoxesInput.value, 10) || 0;
  state.manifestPallets = parseInt(dom.modalManifestPalletsInput.value, 10) || 0;
  recalculateOverallTotals();
  saveState();
  if (state.currentSection === 'signout-section') {
    renderSignoutSummary();
  }
  closeSendersCountModal();
});

// Load session on startup
loadSavedSession();
switchSection('trailer-section');
updateHeaderPreview();
