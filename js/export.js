// Building and printing/downloading session summaries and activity logs
// (the signout screen, the "Save Summary" text/PDF exports, and history
// record exports), plus the signout screen's own render function.
import { state } from './state.js';
import { dom } from './dom.js';
import { createTrackingEntry, getSoloPalletBreakdown } from './session.js';

export function buildSkuSummaryRows(sku, data, totalSkuBoxes, bold) {
  const skuCell = bold ? `<strong>${sku}</strong>` : sku;
  const boxCell = bold ? `<strong>${totalSkuBoxes}</strong>` : totalSkuBoxes;
  const currentPattern = data.ti > 0 && data.hi > 0 ? `${data.ti}/${data.hi}` : '-';

  // Count full pallets per Ti/Hi
  const fullCounts = {};
  (data.eventLog || []).forEach(entry => {
    if (entry.type === 'count' && entry.detail === '+1 pallet' && entry.tihi) {
      fullCounts[entry.tihi] = (fullCounts[entry.tihi] || 0) + 1;
    }
  });
  const totalFullPallets = (data.carryPallets || 0) + (data.fullPallets || 0);
  const countedFull = Object.values(fullCounts).reduce((a, b) => a + b, 0);
  if (totalFullPallets > countedFull) {
    fullCounts[currentPattern] = (fullCounts[currentPattern] || 0) + (totalFullPallets - countedFull);
  }

  // Fold partial pallets into the matching Ti/Hi bucket (or current pattern)
  (data.eventLog || []).forEach(entry => {
    if (entry.type === 'partial' && entry.tihi && entry.tihi !== '-') {
      fullCounts[entry.tihi] = (fullCounts[entry.tihi] || 0) + 1;
    }
  });
  // Safety net for any unlogged partial pallets
  const totalPartials = (data.partialPallets || []).length;
  const countedPartials = (data.eventLog || []).filter(e => e.type === 'partial').length;
  if (totalPartials > countedPartials) {
    fullCounts[currentPattern] = (fullCounts[currentPattern] || 0) + (totalPartials - countedPartials);
  }

  const allPatterns = Object.keys(fullCounts);

  if (allPatterns.length === 0) {
    return `<tr><td>${skuCell}</td><td>${currentPattern}</td><td>0</td><td>${boxCell}</td></tr>`;
  }
  if (allPatterns.length === 1) {
    return `<tr><td>${skuCell}</td><td>${allPatterns[0]}</td><td>${fullCounts[allPatterns[0]]}</td><td>${boxCell}</td></tr>`;
  }
  let rows = '';
  allPatterns.forEach((pattern, i) => {
    if (i === 0) {
      rows += `<tr><td rowspan="${allPatterns.length}" style="vertical-align:top;">${skuCell}</td><td>${pattern}</td><td>${fullCounts[pattern]}</td><td rowspan="${allPatterns.length}" style="vertical-align:top;">${boxCell}</td></tr>`;
    } else {
      rows += `<tr><td>${pattern}</td><td>${fullCounts[pattern]}</td></tr>`;
    }
  });
  return rows;
}

export function buildSummaryExportText() {
  let grandBoxes = 0;
  let grandPallets = 0;
  let skuRowsText = '';
  state.skus.forEach(sku => {
    const data = createTrackingEntry(state.trackingData[sku]);
    const perPallet = data.ti * data.hi;
    const partialBoxesSum = data.partialPallets.reduce((a, b) => a + b, 0);
    const totalSkuBoxes = data.carryBoxes + (data.fullPallets * perPallet) + partialBoxesSum + data.partialBoxes;
    const totalSkuPallets = data.carryPallets + data.fullPallets + data.partialPallets.length;
    grandBoxes += totalSkuBoxes;
    grandPallets += totalSkuPallets;
    const patternCounts = {};
    (data.eventLog || []).forEach(entry => {
      if (entry.type === 'count' && entry.detail === '+1 pallet' && entry.tihi) {
        patternCounts[entry.tihi] = (patternCounts[entry.tihi] || 0) + 1;
      }
    });
    const totalFullPallets = data.carryPallets + data.fullPallets;
    const countedPallets = Object.values(patternCounts).reduce((a, b) => a + b, 0);
    const currentPattern = data.ti > 0 && data.hi > 0 ? `${data.ti}/${data.hi}` : '-';
    if (totalFullPallets > countedPallets) patternCounts[currentPattern] = (patternCounts[currentPattern] || 0) + (totalFullPallets - countedPallets);
    const patternLines = Object.entries(patternCounts).map(([p, n]) => `${p} x${n}`).join(', ');
    skuRowsText += `SKU ${sku} | Pattern(s) ${patternLines || currentPattern} | Total Boxes ${totalSkuBoxes}\n`;
  });

  const avgMinutes = grandPallets > 0 ? Math.max(1, Math.floor((Date.now() - state.startTime) / 60000 / grandPallets)) : null;
  const totalTimeMins = state.startTime ? Math.floor((Date.now() - state.startTime) / 60000) : 0;
  const totalTimeDecimal = (totalTimeMins / 60).toFixed(2);
  const lines = [];
  lines.push('LUMPER PALLET TRACKER - WORK SESSION SUMMARY');
  lines.push(`Worker: ${state.workerName ? state.workerName.toUpperCase() : 'WORKER'}`);
  lines.push(`Door: ${state.doorNum || '---'}`);
  lines.push(`Total Boxes: ${grandBoxes}`);
  lines.push(`Total Pallets: ${grandPallets}`);
  lines.push(`Avg Time / Pallet: ${avgMinutes ? `${avgMinutes} min` : 'N/A'}`);
  lines.push(`Duration: ${totalTimeDecimal}h`);
  lines.push('');
  lines.push('SKU BREAKDOWN');
  lines.push(skuRowsText || 'No SKU data');
  return lines.join('\n');
}

export function exportSummaryText() {
  const content = buildSummaryExportText();
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileNameSuffix = state.doorNum && state.doorNum.trim().length > 0 ? `Door_${state.doorNum}` : `Worker_${state.workerName.toUpperCase() || 'SUMMARY'}`;
  a.download = `${fileNameSuffix}_Summary.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildSummaryExportHtml() {
  let grandBoxes = 0;
  let grandPallets = 0;
  let skuRowsHtml = '';
  state.skus.forEach(sku => {
    const data = createTrackingEntry(state.trackingData[sku]);
    const perPallet = data.ti * data.hi;
    const partialBoxesSum = data.partialPallets.reduce((a, b) => a + b, 0);
    const totalSkuBoxes = data.carryBoxes + (data.fullPallets * perPallet) + partialBoxesSum + data.partialBoxes;
    const totalSkuPallets = data.carryPallets + data.fullPallets + data.partialPallets.length;
    grandBoxes += totalSkuBoxes;
    grandPallets += totalSkuPallets;
    skuRowsHtml += buildSkuSummaryRows(sku, data, totalSkuBoxes, false);
  });
  const refTime = state.endTime || Date.now();
  const avgMinutes = grandPallets > 0 ? Math.max(1, Math.floor((refTime - state.startTime) / 60000 / grandPallets)) : null;
  const totalTimeMins = state.startTime ? Math.floor((refTime - state.startTime) / 60000) : 0;
  const totalTimeDecimal = (totalTimeMins / 60).toFixed(2);
  const countLogRows = null; // activity log excluded from summary
  const docOpen = '<!doctype html><html><' + 'head><meta charset="utf-8"><title>Session Summary</title>'
    + '<style>body{font-family:Arial,sans-serif;padding:24px;color:#111;}'
    + 'h1{margin-bottom:6px;} p{margin:2px 0;font-size:13px;} h3{margin-top:18px;margin-bottom:6px;}'
    + 'table{width:100%;border-collapse:collapse;margin-top:8px;}'
    + 'th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;font-size:13px;}'
    + 'th{background:#f0f0f0;font-weight:bold;}'
    + 'tr:nth-child(even) td{background:#f9f9f9;}'
    + '*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}</style></' + 'head><' + 'body>';
  const docClose = '</' + 'body></' + 'html>';
  const soloRows = dom.soIncludeSoloCheckbox.checked ? getSoloPalletBreakdown() : [];
  const soloSectionHtml = dom.soIncludeSoloCheckbox.checked
    ? `<h3>Solo Pallets</h3><table><thead><tr><th>SKU</th><th>Solo Pallets</th><th>Solo Boxes</th></tr></thead><tbody>${
        soloRows.length === 0
          ? '<tr><td colspan="3">No solo pallets counted</td></tr>'
          : soloRows.map(row => `<tr><td>${row.sku}</td><td>${row.count}</td><td>${row.boxes}</td></tr>`).join('')
      }</tbody></table>`
    : '';
  const bodyContent = `<h1>Work Session Summary</h1>${state.workerName ? `<p><strong>Worker:</strong> ${state.workerName.toUpperCase()}</p>` : ''}<p><strong>Door:</strong> ${state.doorNum || '---'}</p><p><strong>Total Boxes:</strong> ${grandBoxes}</p><p><strong>Total Pallets:</strong> ${grandPallets}</p><p><strong>Avg Time / Pallet:</strong> ${avgMinutes ? `${avgMinutes} min` : 'N/A'}</p><p><strong>Duration:</strong> ${totalTimeDecimal}h</p><h3>SKU Breakdown</h3><table><thead><tr><th>SKU</th><th>Ti/Hi</th><th>Pallets Made</th><th>Total Boxes</th></tr></thead><tbody>${skuRowsHtml}</tbody></table>${soloSectionHtml}`;
  return docOpen + bodyContent + docClose;
}

export function generateSummaryPdf() {
  const printWindow = window.open('', '_blank', 'width=900,height=1200');
  if (!printWindow) {
    alert('Please allow popups to export the session summary as PDF.');
    return;
  }
  const html = buildSummaryExportHtml();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    setTimeout(() => printWindow.close(), 1000);
  }, 500);
}

export function generateHistoryRecordPdf(record) {
  const recSkus = record.skus || [];
  const recTracking = record.trackingData || {};
  let grandBoxes = 0, grandPallets = 0, skuRowsHtml = '';
  recSkus.forEach(sku => {
    const data = createTrackingEntry(recTracking[sku] || {});
    const perPallet = data.ti * data.hi;
    const partialBoxesSum = data.partialPallets.reduce((a, b) => a + b, 0);
    const totalSkuBoxes = data.carryBoxes + (data.fullPallets * perPallet) + partialBoxesSum + data.partialBoxes;
    const totalSkuPallets = data.carryPallets + data.fullPallets + data.partialPallets.length;
    grandBoxes += totalSkuBoxes;
    grandPallets += totalSkuPallets;
    skuRowsHtml += buildSkuSummaryRows(sku, data, totalSkuBoxes, false);
  });
  const totalTimeMins = record.totalTimeMins || 0;
  const totalTimeDecimal = (totalTimeMins / 60).toFixed(2);
  const avgMinutes = grandPallets > 0 && totalTimeMins > 0 ? Math.max(1, Math.floor(totalTimeMins / grandPallets)) : null;
  const recName = record.workerName || '';
  const recDoor = record.doorNum || '';
  const countLogRows = recSkus.map(sku => {
    const data = createTrackingEntry(recTracking[sku] || {});
    const entries = (data.eventLog || []).filter(e => e && e.type === 'count');
    if (!entries.length) return '';
    const rows = entries.map(e => `<div style="margin:4px 0;">${e.time || '--'} • SKU ${sku} • ${e.tihi || '-'} • ${e.detail || 'count'}</div>`).join('');
    return `<div style="margin-top:8px;"><strong>SKU ${sku}</strong>${rows}</div>`;
  }).join('');
  const docOpen = '<!doctype html><html><' + 'head><meta charset="utf-8"><title>Session Summary</title>'
    + '<style>body{font-family:Arial,sans-serif;padding:24px;color:#111;}'
    + 'h1{margin-bottom:6px;} p{margin:2px 0;font-size:13px;} h3{margin-top:18px;margin-bottom:6px;}'
    + 'table{width:100%;border-collapse:collapse;margin-top:8px;}'
    + 'th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;font-size:13px;}'
    + 'th{background:#f0f0f0;font-weight:bold;}'
    + 'tr:nth-child(even) td{background:#f9f9f9;}'
    + '*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}</style></' + 'head><' + 'body>';
  const docClose = '</' + 'body></' + 'html>';
  const bodyContent = `<h1>Work Session Summary</h1>${recName ? `<p><strong>Worker:</strong> ${recName}</p>` : ''}${recDoor ? `<p><strong>Door:</strong> #${recDoor}</p>` : ''}<p><strong>Date:</strong> ${record.dateStr || ''}</p><p><strong>Total Boxes:</strong> ${grandBoxes}</p><p><strong>Total Pallets:</strong> ${grandPallets}</p><p><strong>Avg Time / Pallet:</strong> ${avgMinutes ? `${avgMinutes} min` : 'N/A'}</p><p><strong>Duration:</strong> ${totalTimeDecimal}h</p><h3>SKU Breakdown</h3><table><thead><tr><th>SKU</th><th>Ti/Hi</th><th>Pallets Made</th><th>Total Boxes</th></tr></thead><tbody>${skuRowsHtml}</tbody></table>`;
  const printWindow = window.open('', '_blank', 'width=900,height=1200');
  if (!printWindow) { alert('Please allow popups to export.'); return; }
  printWindow.document.write(docOpen + bodyContent + docClose);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); setTimeout(() => printWindow.close(), 1000); }, 500);
}

export function generateHistoryActivityLogPdf(record) {
  const recName = record.workerName || '';
  const recDoor = record.doorNum || '';
  const header = recDoor ? `Door #${recDoor}${recName ? ' — ' + recName : ''}` : (recName || 'Activity Log');
  const logs = record.activityLogs || [];
  const rows = logs.map(l =>
    `<tr><td>[${l.time || '--'}]</td><td>SKU ${l.sku || '--'}</td><td>${l.desc || ''}</td><td>${l.totalBoxes !== undefined ? l.totalBoxes + ' boxes' : ''}</td></tr>`
  ).join('');
  const docOpen = '<!doctype html><html><' + 'head><meta charset="utf-8"><title>Activity Log</title>'
    + '<style>body{font-family:Arial,sans-serif;padding:24px;color:#111;}'
    + 'h2{margin-bottom:6px;} p{margin:2px 0 10px;color:#555;font-size:13px;}'
    + 'table{width:100%;border-collapse:collapse;margin-top:12px;}'
    + 'th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;font-size:13px;}'
    + 'th{background:#f0f0f0;} tr:nth-child(even) td{background:#f9f9f9;}'
    + '*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}</style></' + 'head><' + 'body>';
  const docClose = '</' + 'body></' + 'html>';
  const body = `<h2>Activity Log — ${header}</h2><p>${record.dateStr || ''} &nbsp;|  Duration: ${record.durationStr || '--'}</p><table><thead><tr><th>Time</th><th>SKU</th><th>Action</th><th>Running Total</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No entries</td></tr>'}</tbody></table>`;
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) { alert('Please allow popups.'); return; }
  w.document.write(docOpen + body + docClose);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); setTimeout(() => w.close(), 1000); }, 400);
}

export function renderSignoutSummary() {
  let grandBoxes = 0;
  let grandPallets = 0;
  let skuRowsHtml = '';
  state.skus.forEach(sku => {
    const data = createTrackingEntry(state.trackingData[sku]);
    const perPallet = data.ti * data.hi;
    const partialBoxesSum = data.partialPallets.reduce((a, b) => a + b, 0);
    const totalSkuBoxes = data.carryBoxes + (data.fullPallets * perPallet) + partialBoxesSum + data.partialBoxes;
    const totalSkuPallets = data.carryPallets + data.fullPallets + data.partialPallets.length;
    grandBoxes += totalSkuBoxes;
    grandPallets += totalSkuPallets;
    skuRowsHtml += buildSkuSummaryRows(sku, data, totalSkuBoxes, true);
  });

  if (state.skipNameDoorMode) {
    document.getElementById('so-trailer').classList.add('hidden');
    document.getElementById('so-worker-name').classList.add('hidden');
  } else {
    if (state.doorNum && state.doorNum.trim().length > 0) {
      document.getElementById('so-trailer').classList.remove('hidden');
      document.getElementById('so-trailer').innerText = `Door #${state.doorNum}`;
    } else {
      document.getElementById('so-trailer').classList.add('hidden');
    }
    if (state.workerName && state.workerName.trim().length > 0) {
      document.getElementById('so-worker-name').classList.remove('hidden');
    } else {
      document.getElementById('so-worker-name').classList.add('hidden');
    }
  }

  // Check state.manifestBoxes (if left blank/0, show without /)
  const boxPctEl = document.getElementById('so-box-pct');
  if (state.manifestBoxes > 0) {
    const boxPercentage = ((grandBoxes / state.manifestBoxes) * 100).toFixed(1);
    document.getElementById('so-boxes').innerText = `${grandBoxes} / ${state.manifestBoxes}`;
    boxPctEl.innerText = `${boxPercentage}% Completed`;
    boxPctEl.classList.remove('hidden');
  } else {
    document.getElementById('so-boxes').innerText = grandBoxes;
    boxPctEl.classList.add('hidden');
  }

  // Check state.manifestPallets (if left blank/0, show without /)
  const palletPctEl = document.getElementById('so-pallet-pct');
  if (state.manifestPallets > 0) {
    const palletPercentage = ((grandPallets / state.manifestPallets) * 100).toFixed(1);
    document.getElementById('so-pallets').innerText = `${grandPallets} / ${state.manifestPallets}`;
    palletPctEl.innerText = `${palletPercentage}% Completed`;
    palletPctEl.classList.remove('hidden');
  } else {
    document.getElementById('so-pallets').innerText = grandPallets;
    palletPctEl.classList.add('hidden');
  }
  const refTime = state.endTime || Date.now();
  const avgMinutes = grandPallets > 0 ? Math.max(1, Math.floor((refTime - state.startTime) / 60000 / grandPallets)) : null;
  document.getElementById('so-avg-pallet').innerText = avgMinutes ? `${avgMinutes} min` : 'N/A';
  const totalTimeMins = state.startTime ? Math.floor((refTime - state.startTime) / 60000) : 0;
  const totalTimeDecimal = (totalTimeMins / 60).toFixed(2);
  document.getElementById('so-total-time').innerText = `${totalTimeDecimal}h`;
  document.getElementById('so-worker-name').innerText = state.workerName ? state.workerName.toUpperCase() : '';

  document.getElementById('so-sku-rows').innerHTML = skuRowsHtml;

  dom.soIncludeSoloCheckbox.checked = false;
  renderSoloSummarySection();
}

function renderSoloSummarySection() {
  const included = dom.soIncludeSoloCheckbox.checked;
  dom.soSoloSection.classList.toggle('hidden', !included);
  if (!included) return;
  const rows = getSoloPalletBreakdown();
  dom.soSoloRows.innerHTML = rows.length === 0
    ? `<tr><td colspan="3">No solo pallets counted</td></tr>`
    : rows.map(row => `<tr><td>${row.sku}</td><td>${row.count}</td><td>${row.boxes}</td></tr>`).join('');
}

dom.soIncludeSoloCheckbox.addEventListener('change', renderSoloSummarySection);
