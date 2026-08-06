// Session lifecycle: starting/restoring a trailer count, the single-action
// undo buffer, per-SKU tracking-entry shape, and the activity log/ticker.
import { state } from './state.js';
import { dom } from './dom.js';
import { openConfirmModal, openThreeOptionModal } from './modal.js';
import { findRecentHistoryMatch } from './history.js';
import { saveState } from './storage.js';
import { renderSkuTags } from './sku.js';
import { renderTable } from './tracker.js';
import { switchSection, updateMenuVisibility, updateTrackerHeader } from './main.js';

export function captureUndoState(label) {
  state.lastUndoState = {
    skus: [...state.skus],
    trackingData: JSON.parse(JSON.stringify(state.trackingData)),
    activityLogs: JSON.parse(JSON.stringify(state.activityLogs)),
    topActivity: dom.topActivityTicker.innerHTML,
    undoLabel: label
  };
  if (dom.btnUndoAction) dom.btnUndoAction.classList.remove('hidden');
}

export function clearUndoState() {
  state.lastUndoState = null;
  if (dom.btnUndoAction) dom.btnUndoAction.classList.add('hidden');
}

export function restoreUndoState() {
  if (!state.lastUndoState) return;
  state.skus = [...state.lastUndoState.skus];
  state.trackingData = JSON.parse(JSON.stringify(state.lastUndoState.trackingData));
  state.activityLogs = JSON.parse(JSON.stringify(state.lastUndoState.activityLogs));
  dom.topActivityTicker.innerHTML = state.lastUndoState.topActivity;
  renderSkuTags();
  if (state.currentSection === 'tracking-section') renderTable();
  renderLogModalList();
  saveState();
  clearUndoState();
}

dom.btnUndoAction.addEventListener('click', () => {
  if (!state.lastUndoState) return;
  openConfirmModal(
    'Undo Last Action',
    `<p>Undo this action?</p><p style="font-weight:bold; margin-top:10px;">${state.lastUndoState.undoLabel}</p>`,
    'Undo',
    restoreUndoState,
    'Cancel'
  );
});

export function initializeSessionFromStartScreen() {
  const wVal = dom.workerNameInput.value.trim();
  const dVal = dom.doorNumInput.value.trim();
  const matchedRecord = findRecentHistoryMatch(wVal, dVal);
  if (matchedRecord) {
    openThreeOptionModal(
      `Continue Door #${dVal}?`,
      `<p>A recent session for Door #${dVal} was found in the last 24 hours.</p><p style="margin-top:8px;">Choose whether to continue the prior count or start a fresh count.</p>`,
      'Continue Count',
      () => restorePreviousDoorSession(matchedRecord),
      'Start New Count',
      () => startNewSessionWithPreviousSkus(wVal, dVal, matchedRecord),
      'Cancel'
    );
    return;
  }
  startNewSession(wVal, dVal);
}

export function createTrackingEntry(seed = {}) {
  return {
    ti: Number(seed.ti) || 0,
    hi: Number(seed.hi) || 0,
    fullPallets: Number(seed.fullPallets) || 0,
    partialPallets: Array.isArray(seed.partialPallets) ? [...seed.partialPallets] : [],
    partialBoxes: Number(seed.partialBoxes) || 0,
    carryBoxes: Number(seed.carryBoxes) || 0,
    carryPallets: Number(seed.carryPallets) || 0,
    eventLog: Array.isArray(seed.eventLog) ? [...seed.eventLog] : []
  };
}

export function normalizeTrackingData() {
  state.skus.forEach(sku => {
    state.trackingData[sku] = createTrackingEntry(state.trackingData[sku] || {});
  });
}

export function getTiHiString(data) {
  return data.ti > 0 && data.hi > 0 ? `${data.ti}/${data.hi}` : '-';
}

export function recordSkuEvent(sku, type, detail, tiHiAtMoment) {
  const data = state.trackingData[sku];
  if (!data) return;
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  data.eventLog.unshift({
    time,
    type,
    detail,
    tihi: tiHiAtMoment || getTiHiString(data)
  });
}

export function startNewSession(workerNameValue, doorValue) {
  state.workerName = workerNameValue ? workerNameValue.toUpperCase() : '';
  state.doorNum = doorValue;
  state.manifestBoxes = 0;
  state.manifestPallets = 0;
  state.startTime = Date.now();
  state.skus = [];
  state.trackingData = {};
  state.activityLogs = [];
  state.sessionSummarySaved = false;
  updateMenuVisibility();
  renderSkuTags();
  switchSection('setup-section');
}

export function startNewSessionWithPreviousSkus(workerNameValue, doorValue, record) {
  state.workerName = workerNameValue ? workerNameValue.toUpperCase() : '';
  state.doorNum = doorValue;
  state.manifestBoxes = 0;
  state.manifestPallets = 0;
  state.startTime = Date.now();
  state.skus = record.skus ? [...record.skus] : [];
  state.trackingData = {};
  state.skus.forEach(sku => {
    state.trackingData[sku] = createTrackingEntry();
  });
  state.activityLogs = [];
  state.sessionSummarySaved = false;
  updateMenuVisibility();
  renderSkuTags();
  switchSection('setup-section');
}

export function restorePreviousDoorSession(record) {
  state.workerName = record.workerName || '';
  state.doorNum = record.doorNum;
  state.manifestBoxes = record.manifestBoxes || 0;
  state.manifestPallets = record.manifestPallets || 0;
  state.startTime = record.timestamp || Date.now();
  state.skus = record.skus ? [...record.skus] : [];
  state.trackingData = record.trackingData ? JSON.parse(JSON.stringify(record.trackingData)) : {};
  normalizeTrackingData();
  state.activityLogs = Array.isArray(record.activityLogs) && record.activityLogs.length > 0
    ? JSON.parse(JSON.stringify(record.activityLogs))
    : [{ time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), sku: '---', desc: `Continued Door #${state.doorNum}` }];
  state.endTime = null;
  state.sessionSummarySaved = false;
  updateTrackerHeader();
  switchSection('tracking-section');
  renderTable();
  renderLogModalList();
  if (state.activityLogs.length > 0) {
    const last = state.activityLogs[0];
    dom.topActivityTicker.innerHTML = `📋 [${last.time}] SKU ${last.sku}: ${last.desc}`;
  }
  updateMenuVisibility();
}

export function getGrandTotalBoxes() {
  return state.skus.reduce((sum, sku) => {
    const data = createTrackingEntry(state.trackingData[sku]);
    const perPallet = data.ti * data.hi;
    const partialPalletsSum = data.partialPallets.reduce((a, b) => a + b, 0);
    return sum + data.carryBoxes + (data.fullPallets * perPallet) + partialPalletsSum + data.partialBoxes;
  }, 0);
}

export function logEntry(sku, actionDescription) {
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const totalBoxes = getGrandTotalBoxes();
  state.activityLogs.unshift({ time: timeStr, sku: sku, desc: actionDescription, totalBoxes });
  dom.topActivityTicker.innerHTML = `📋 [${timeStr}] SKU ${sku}: ${actionDescription}`;
  renderLogModalList();
  saveState();
}

export function renderLogModalList() {
  const content = state.activityLogs.length === 0
    ? `<div style="color:var(--text-muted); text-align:center; padding:10px;">No entries recorded yet</div>`
    : state.activityLogs.map(log => `<div class="log-row" style="display:flex; justify-content:space-between; padding: 6px 0; border-bottom: 1px dashed var(--border-color); color: var(--text-muted); gap:10px;"><span style="font-weight:bold; color:var(--primary); min-width:100px;">[${log.time}]</span><span style="flex:1; min-width:120px;">SKU ${log.sku}</span><span style="flex:1; min-width:140px;">${log.desc}</span><span style="min-width:110px; text-align:right;">${log.totalBoxes} total</span></div>`).join('');
  dom.modalActivityLogList.innerHTML = content;
}
