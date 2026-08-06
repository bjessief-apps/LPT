// localStorage persistence: the in-progress session snapshot (auto-restored
// on reload) and the permanent work-history log.
import { state } from './state.js';
import { createTrackingEntry } from './session.js';
import { renderWorkHistory } from './history.js';

export function saveState() {
  const snapshot = {
    workerName: state.workerName,
    doorNum: state.doorNum,
    manifestBoxes: state.manifestBoxes,
    manifestPallets: state.manifestPallets,
    startTime: state.startTime,
    endTime: state.endTime,
    skus: state.skus,
    trackingData: state.trackingData,
    activityLogs: state.activityLogs,
    currentSection: state.currentSection,
    skipNameDoorMode: state.skipNameDoorMode
  };
  try {
    localStorage.setItem('lpt_saved_session', JSON.stringify(snapshot));
  } catch (e) {}
  autoSaveToHistory();
}

export function autoSaveToHistory() {
  if (!state.startTime) return;
  const record = buildSummaryRecord();
  saveRecordToHistory(record);
}

export function loadSavedSession() {
  try {
    const saved = localStorage.getItem('lpt_saved_session');
    if (saved) {
      localStorage.removeItem('lpt_saved_session');
    }
  } catch (e) {
    localStorage.removeItem('lpt_saved_session');
  }
}

export function getStoredHistory() {
  try {
    return JSON.parse(localStorage.getItem('lpt_work_history')) || [];
  } catch (e) {
    return [];
  }
}

export function saveRecordToHistory(record) {
  try {
    const history = getStoredHistory();
    const idx = history.findIndex(h => h.id === record.id);
    if (idx >= 0) {
      history[idx] = record;
    } else {
      history.unshift(record);
    }
    localStorage.setItem('lpt_work_history', JSON.stringify(history));
  } catch (e) {}
}

export function deleteHistoryRecord(id) {
  if (confirm("Are you sure you want to delete this history record?")) {
    try {
      let history = getStoredHistory();
      history = history.filter(item => item.id !== id);
      localStorage.setItem('lpt_work_history', JSON.stringify(history));
      renderWorkHistory();
    } catch (e) {}
  }
}

export function buildSummaryRecord() {
  let grandBoxes = 0;
  let grandPallets = 0;
  state.skus.forEach(sku => {
    const data = createTrackingEntry(state.trackingData[sku]);
    const perPallet = data.ti * data.hi;
    const partialBoxesSum = data.partialPallets.reduce((a, b) => a + b, 0);
    grandBoxes += data.carryBoxes + (data.fullPallets * perPallet) + partialBoxesSum + data.partialBoxes;
    grandPallets += data.carryPallets + data.fullPallets + data.partialPallets.length;
  });
  const now = new Date();
  const dateStr = now.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const durationMs = state.startTime ? ((state.endTime || Date.now()) - state.startTime) : 0;
  const durationMins = Math.floor(durationMs / 60000);
  const hrs = Math.floor(durationMins / 60);
  const mins = durationMins % 60;
  const durationStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins} mins`;
  return {
    id: 'rec_' + (state.startTime || Date.now()),
    timestamp: state.startTime || Date.now(),
    workerName: (state.workerName || '').toUpperCase(),
    doorNum: state.doorNum,
    dateStr,
    durationStr,
    totalTimeMins: durationMins,
    totalBoxes: grandBoxes,
    totalPallets: grandPallets,
    manifestBoxes: state.manifestBoxes,
    manifestPallets: state.manifestPallets,
    skus: [...state.skus],
    trackingData: JSON.parse(JSON.stringify(state.trackingData)),
    activityLogs: JSON.parse(JSON.stringify(state.activityLogs))
  };
}

export function finalizeAndSaveSession() {
  if (state.sessionSummarySaved) return false;
  const record = buildSummaryRecord();
  saveRecordToHistory(record);
  state.sessionSummarySaved = true;
  try {
    localStorage.removeItem('lpt_saved_session');
  } catch (e) {}
  return true;
}
