// Work-history lookup (for "continue a recent door?" prompts) and the
// Work History screen's rendering.
import { state } from './state.js';
import { dom } from './dom.js';
import { getStoredHistory, deleteHistoryRecord } from './storage.js';
import { createTrackingEntry } from './session.js';
import { generateHistoryRecordPdf, generateHistoryActivityLogPdf } from './export.js';

export function findRecentHistoryMatch(workerNameValue, doorValue, excludeCurrentSession = false) {
  if (!doorValue) return null;
  const history = getStoredHistory();
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;
  const normalizedWorker = (workerNameValue || '').trim().toUpperCase();
  return history.find(h => {
    // The in-progress session auto-saves itself to history as soon as it
    // starts, so once a session is under way it would otherwise immediately
    // show up as a "recent match" for its own door number.
    if (excludeCurrentSession && state.startTime && h.timestamp === state.startTime) return false;
    if (String(h.doorNum) !== String(doorValue)) return false;
    const recTime = h.timestamp || 0;
    if ((now - recTime) > twentyFourHours) return false;
    if (!normalizedWorker) return true;
    return String(h.workerName || '').toUpperCase() === normalizedWorker;
  });
}

export function renderWorkHistory() {
  const history = getStoredHistory();
  const filterVal = dom.historyNameFilter.value.toLowerCase().trim();
  const filtered = history.filter(item => {
    if (!filterVal) return true;
    return (item.workerName || '').toLowerCase().includes(filterVal);
  });

  if (filtered.length === 0) {
    dom.historyListContainer.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:20px;">No work history found</div>`;
    return;
  }

  const grouped = {};
  filtered.forEach(item => {
    const dateKey = item.dateStr || 'Unknown Date';
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(item);
  });

  state.historyRecordsCache = {};
  let html = '';
  for (const [dateKey, items] of Object.entries(grouped)) {
    const firstTs = items[0] && items[0].timestamp ? items[0].timestamp : null;
    const dayOfWeek = firstTs ? new Date(firstTs).toLocaleDateString(undefined, { weekday: 'long' }) : '';
    const dateDisplayStr = dayOfWeek ? `${dayOfWeek}, ${dateKey}` : dateKey;
    html += `<div class="history-day-group"><div class="history-day-title">📅 ${dateDisplayStr}</div>`;
    items.forEach(h => {
      state.historyRecordsCache[h.id] = h;
      const displayName = (h.workerName || '').toUpperCase();
      const skuTracking = h.trackingData || {};

      const countLogEntries = [];
      (h.skus || []).forEach(sku => {
        const skuData = createTrackingEntry(skuTracking[sku] || {});
        const skuEvents = (skuData.eventLog || []).filter(entry => entry && entry.type === 'count');
        skuEvents.forEach(entry => {
          const isLooseBox = (entry.detail || '').startsWith('Loose boxes');
          const displayDetail = isLooseBox
            ? (entry.detail || '').replace('Loose boxes +', '+').trim() + ' boxes'
            : entry.detail || 'count';
          const tihi = (!isLooseBox && entry.tihi) ? ` • ${entry.tihi}` : '';
          countLogEntries.push(`<div style="font-size:12px; margin-bottom:4px;"><strong>[${entry.time || '--'}]</strong> ${displayDetail} • SKU ${sku}${tihi}</div>`);
        });
      });
      const countLogHtml = countLogEntries.length > 0
        ? countLogEntries.join('')
        : '<div style="font-size:12px; color:var(--text-muted);">No count entries logged.</div>';

      const headerLabel = h.doorNum && displayName ? `Door #${h.doorNum} — ${displayName}` : h.doorNum ? `Door #${h.doorNum}` : displayName || 'Session';
      html += `<div class="history-item"><div style="display:flex; justify-content:space-between; font-weight:bold; color:var(--primary); margin-bottom:4px;"><span>${headerLabel}</span><div style="display:flex;gap:6px;"><button class="secondary" data-summary-id="${h.id}" style="width:auto; padding:2px 8px; font-size:11px; margin-bottom:0;">Save Summary</button><button class="secondary" data-actlog-id="${h.id}" style="width:auto; padding:2px 8px; font-size:11px; margin-bottom:0;">Activity Log</button><button class="danger" data-id="${h.id}" style="width:auto; padding:2px 8px; font-size:11px; margin-bottom:0;">Delete</button></div></div><div style="font-size:13px; color:var(--text-color); display:flex; gap:15px; margin-top:6px; flex-wrap:wrap;"><span>Pallets: <strong>${h.totalPallets}</strong></span><span>Boxes: <strong>${h.totalBoxes}</strong></span><span>Duration: <strong>${h.durationStr}</strong></span></div><details style="margin-top:8px;"><summary style="cursor:pointer; font-weight:bold; color:var(--primary);">Activity Log</summary><div style="margin-top:8px; padding:8px; border:1px solid var(--border-color); border-radius:6px; background:var(--bg-color); max-height:180px; overflow:auto;">${countLogHtml}</div></details></div>`;
    });
    html += `</div>`;
  }
  dom.historyListContainer.innerHTML = html;
  dom.historyListContainer.querySelectorAll('button[data-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      deleteHistoryRecord(e.target.getAttribute('data-id'));
    });
  });
  dom.historyListContainer.querySelectorAll('button[data-summary-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const rec = state.historyRecordsCache[e.target.getAttribute('data-summary-id')];
      if (rec) generateHistoryRecordPdf(rec);
    });
  });
  dom.historyListContainer.querySelectorAll('button[data-actlog-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const rec = state.historyRecordsCache[e.target.getAttribute('data-actlog-id')];
      if (rec) generateHistoryActivityLogPdf(rec);
    });
  });
}
