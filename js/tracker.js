// The live tracker table: rendering rows, the tap/long-press interactions on
// each cell, the +1 pallet / partial-pallet modals, Ti/Hi editing and input
// formatting, and the running totals banner.
import { state } from './state.js';
import { dom } from './dom.js';
import { closeModal, setModalActionButtons } from './modal.js';
import { createTrackingEntry, recordSkuEvent, getTiHiString, captureUndoState, logEntry } from './session.js';
import { saveState } from './storage.js';
import { renderSkuTags, deleteSku } from './sku.js';

export function renderTable() {
  dom.trackerRows.innerHTML = '';
  state.skus.forEach(sku => appendTrackerRow(sku));
  recalculateOverallTotals();
}

export function appendTrackerRow(sku) {
  const tr = document.createElement('tr');
  tr.id = `row-${sku}`;
  const data = createTrackingEntry(state.trackingData[sku]);
  state.trackingData[sku] = data;
  const perPallet = data.ti * data.hi;
  const partialPalletsSum = data.partialPallets.reduce((a, b) => a + b, 0);
  const totalBoxes = data.carryBoxes + (data.fullPallets * perPallet) + partialPalletsSum + data.partialBoxes;
  const totalPallets = data.carryPallets + data.fullPallets + data.partialPallets.length;
  tr.innerHTML = `<td><strong class="sku-square" data-sku="${sku}" title="Hold to Edit SKU">${sku}</strong></td><td><input type="text" class="row-tihi tihi-input" data-sku="${sku}" value="${data.ti > 0 && data.hi > 0 ? data.ti + '/' + data.hi : ''}" placeholder="0/0" inputmode="numeric" ${data.ti > 0 && data.hi > 0 ? 'readonly' : ''}><div class="tihi-box-calc" id="tihi-calc-${sku}">${perPallet > 0 ? '=' + perPallet + ' boxes' : ''}</div></td><td><button class="btn-pallet pallet-btn" data-sku="${sku}">+ Count</button></td><td><span class="read-only-val pallets-made-val" data-sku="${sku}" title="Hold for SKU event history" id="count-pallet-${sku}">${totalPallets}</span></td><td><span class="read-only-val" id="total-boxes-${sku}">${totalBoxes}</span></td>`;
  dom.trackerRows.appendChild(tr);
  attachSmartButtonEvents(tr.querySelector('.pallet-btn'), sku);
  attachSkuSquareLongPress(tr.querySelector('.sku-square'), sku);
  attachTiHiLongPress(tr.querySelector('.tihi-input'), sku);
  attachPalletHistoryLongPress(tr.querySelector('.pallets-made-val'), sku);
}

function attachTiHiLongPress(el, sku) {
  if (!el) return;
  let timer = null;
  let openedByHold = false;
  const hasSavedPattern = () => {
    const data = state.trackingData[sku] || createTrackingEntry();
    return data.ti > 0 && data.hi > 0;
  };
  const start = () => {
    if (!hasSavedPattern()) return;
    openedByHold = false;
    timer = setTimeout(() => {
      openedByHold = true;
      if (navigator.vibrate) navigator.vibrate(50);
      openTiHiChangeModal(sku);
    }, 500);
  };
  const cancel = () => clearTimeout(timer);
  el.addEventListener('touchstart', (e) => {
    if (hasSavedPattern()) {
      e.preventDefault();
    }
    start();
  }, { passive: false });
  el.addEventListener('touchend', (e) => {
    cancel();
    if (hasSavedPattern()) {
      e.preventDefault();
    }
    if (!openedByHold && hasSavedPattern()) {
      el.blur();
    }
  });
  el.addEventListener('touchcancel', cancel);
  el.addEventListener('mousedown', (e) => {
    if (hasSavedPattern()) {
      e.preventDefault();
    }
    start();
  });
  el.addEventListener('mouseup', (e) => {
    cancel();
    if (hasSavedPattern()) {
      e.preventDefault();
    }
    if (!openedByHold && hasSavedPattern()) {
      el.blur();
    }
  });
  el.addEventListener('mouseleave', cancel);
  el.addEventListener('click', (e) => {
    if (hasSavedPattern()) {
      e.preventDefault();
      e.stopPropagation();
      el.blur();
    }
  });
}

function attachPalletHistoryLongPress(el, sku) {
  if (!el) return;
  let timer = null;
  const start = () => {
    timer = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50);
      openPalletHistoryModal(sku);
    }, 500);
  };
  const cancel = () => clearTimeout(timer);
  el.addEventListener('touchstart', start, { passive: true });
  el.addEventListener('touchend', cancel);
  el.addEventListener('touchcancel', cancel);
  el.addEventListener('mousedown', start);
  el.addEventListener('mouseup', cancel);
  el.addEventListener('mouseleave', cancel);
}

function openPalletHistoryModal(sku) {
  const data = state.trackingData[sku] || createTrackingEntry();
  const rows = (data.eventLog || [])
    .map(evt => `<div style="padding:6px 0; border-bottom:1px dashed var(--border-color); font-size:12px;"><strong>[${evt.time}]</strong> ${evt.detail} <span style="color:var(--text-muted);">(Ti/Hi ${evt.tihi || '-'})</span></div>`)
    .join('');
  dom.modalTitle.innerText = `SKU ${sku} History`;
  dom.modalBody.innerHTML = `<div style="text-align:left; max-height:280px; overflow:auto;">${rows || '<div style="font-size:12px; color:var(--text-muted);">No SKU events yet.</div>'}</div>`;
  setModalActionButtons({ showConfirm: false, showSecondary: false });
  dom.modalCancelBtn.innerText = 'Close';
  dom.modalOverlay.classList.remove('hidden');
}

function openTiHiChangeModal(sku) {
  const data = state.trackingData[sku] || createTrackingEntry();
  const currentPattern = `${data.ti}/${data.hi}`;
  dom.modalTitle.innerText = 'Change Ti/Hi';
  dom.modalBody.innerHTML = `<div class="modal-sku-label">SKU</div><div class="modal-sku-number">${sku}</div><p style="margin: 6px 0 10px 0; font-size:13px;">Current: <strong>${currentPattern}</strong></p><div style="text-align:left; margin-bottom:4px;"><label style="font-size:13px; font-weight:bold; margin-bottom:4px;">New Ti/Hi</label><input type="text" id="modal-change-tihi-input" maxlength="5" placeholder="0/0" inputmode="numeric" value="${currentPattern}" style="margin-bottom:10px;"></div><p style="margin:0; font-size:13px;">Apply to past pallets?</p>`;
  dom.modalConfirmBtn.className = 'success';
  dom.modalConfirmBtn.innerText = 'All pallets';
  dom.modalSecondaryBtn.className = 'secondary';
  dom.modalSecondaryBtn.innerText = 'From now';
  setModalActionButtons({ showConfirm: true, showSecondary: true });
  dom.modalCancelBtn.innerText = 'Cancel';

  const applyPattern = (applyToPast) => {
    const rawVal = document.getElementById('modal-change-tihi-input').value.trim();
    const match = rawVal.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (!match) {
      alert('Use format Ti/Hi (example 8/4).');
      return;
    }
    const oldTi = data.ti;
    const oldHi = data.hi;
    const newTi = parseInt(match[1], 10);
    const newHi = parseInt(match[2], 10);
    if (newTi === oldTi && newHi === oldHi) {
      closeModal();
      return;
    }

    if (!applyToPast) {
      const oldPerPallet = oldTi * oldHi;
      if (data.fullPallets > 0 && oldPerPallet > 0) {
        data.carryBoxes += data.fullPallets * oldPerPallet;
        data.carryPallets += data.fullPallets;
        data.fullPallets = 0;
      }
    }

    data.ti = newTi;
    data.hi = newHi;
    const modeText = applyToPast ? 'all pallets' : 'from now';
    recordSkuEvent(sku, 'edit', `Pattern ${oldTi}/${oldHi} -> ${newTi}/${newHi} (${modeText})`, `${newTi}/${newHi}`);
    logEntry(sku, `Changed Ti/Hi to ${newTi}/${newHi} (${modeText})`);
    updateRowTotals(sku, false);
    flashTiHiInput(sku);
    closeModal();
  };

  dom.modalConfirmBtn.onclick = () => applyPattern(true);
  dom.modalSecondaryBtn.onclick = () => applyPattern(false);
  dom.modalOverlay.classList.remove('hidden');
  const modalTiHiInput = document.getElementById('modal-change-tihi-input');
  attachTiHiInput(modalTiHiInput);
  modalTiHiInput.focus();
}

function attachSkuSquareLongPress(el, sku) {
  let timer = null;
  let isLongPress = false;
  const start = () => {
    isLongPress = false;
    timer = setTimeout(() => {
      isLongPress = true;
      if (navigator.vibrate) navigator.vibrate(50);
      openEditSkuModal(sku);
    }, 500);
  };
  const cancel = () => clearTimeout(timer);
  el.addEventListener('touchstart', start, { passive: true });
  el.addEventListener('touchend', cancel);
  el.addEventListener('touchcancel', cancel);
  el.addEventListener('mousedown', start);
  el.addEventListener('mouseup', cancel);
  el.addEventListener('mouseleave', cancel);
}

function openEditSkuModal(sku) {
  dom.modalTitle.innerText = "Edit / Delete SKU";
  dom.modalBody.innerHTML = `<div class="modal-sku-label">Current SKU</div><div class="modal-sku-number">${sku}</div><div style="text-align:left; margin-bottom:12px;"><label style="font-size:13px; font-weight:bold; margin-bottom:4px;">Change SKU Number (3 digits)</label><input type="text" id="modal-edit-sku-input" maxlength="3" value="${sku}" pattern="\\d{3}" inputmode="numeric" style="margin-bottom:0;"></div><button id="modal-delete-sku-btn" class="danger" style="margin-top:10px; width:100%;">🗑️ Delete SKU</button>`;
  dom.modalConfirmBtn.className = "success";
  dom.modalConfirmBtn.innerText = "Save Changes";
  setModalActionButtons({ showConfirm: true, showSecondary: false });
  dom.modalConfirmBtn.onclick = () => {
    const newSkuVal = document.getElementById('modal-edit-sku-input').value.trim();
    if (/^\d{3}$/.test(newSkuVal)) {
      if (newSkuVal !== sku && state.skus.includes(newSkuVal)) {
        alert("SKU " + newSkuVal + " already exists!");
        return;
      }
      if (newSkuVal !== sku) {
        captureUndoState(`Renamed SKU ${sku} to ${newSkuVal}`);
        state.skus = state.skus.map(s => s === sku ? newSkuVal : s);
        state.trackingData[newSkuVal] = state.trackingData[sku];
        delete state.trackingData[sku];
        logEntry(newSkuVal, `Renamed SKU from ${sku} to ${newSkuVal}`);
      }
      renderTable();
      renderSkuTags();
      closeModal();
      saveState();
    } else {
      alert("Please enter the last 3 digits of a SKU.");
    }
  };
  document.getElementById('modal-delete-sku-btn').onclick = () => {
    closeModal();
    deleteSku(sku);
  };
  dom.modalOverlay.classList.remove('hidden');
}

function attachSmartButtonEvents(button, sku) {
  let timer = null;
  let isLongPress = false;
  const start = () => {
    isLongPress = false;
    timer = setTimeout(() => {
      isLongPress = true;
      if (navigator.vibrate) navigator.vibrate(50);
      openPartialModal(sku);
    }, 500);
  };
  const cancel = () => clearTimeout(timer);
  button.addEventListener('touchstart', start, { passive: true });
  button.addEventListener('touchend', (e) => {
    cancel();
    if (!isLongPress) openTapModal(sku);
    e.preventDefault();
  });
  button.addEventListener('touchcancel', cancel);
  button.addEventListener('mousedown', start);
  button.addEventListener('mouseup', cancel);
  button.addEventListener('mouseleave', cancel);
  button.addEventListener('click', (e) => {
    if (e.pointerType === 'mouse' && !isLongPress) openTapModal(sku);
  });
}

function openTapModal(sku) {
  const activeInput = document.activeElement;
  if (activeInput && activeInput.classList && activeInput.classList.contains('tihi-input')) {
    const activeVal = activeInput.value.trim();
    if (activeVal) {
      activeInput.blur();
    }
  }
  const data = state.trackingData[sku];
  if (data.ti === 0 || data.hi === 0) {
    const rowInput = dom.trackingSection.querySelector(`.tihi-input[data-sku="${sku}"]`);
    if (rowInput && rowInput.value.trim().length > 0) {
      rowInput.focus();
      return;
    }
    alert("Please enter a valid Ti/Hi for SKU " + sku + " first!");
    return;
  }
  dom.modalTitle.innerText = "+1 Completed Pallet";
  dom.modalBody.innerHTML = `<div class="modal-sku-label">SKU</div><div class="modal-sku-number">${sku}</div><label style="display:flex; align-items:center; justify-content:center; gap:8px; font-size:13px; font-weight:normal; color:var(--text-muted); margin-top:4px; cursor:pointer;"><input type="checkbox" id="modal-solo-pallet-checkbox" style="width:auto; margin:0;">Solo pallet (counted alone)</label>`;
  dom.modalConfirmBtn.className = "success";
  dom.modalConfirmBtn.innerText = "Confirm";
  setModalActionButtons({ showConfirm: true, showSecondary: false });
  dom.modalConfirmBtn.onclick = () => {
    const isSolo = document.getElementById('modal-solo-pallet-checkbox').checked;
    captureUndoState(`Added one pallet to SKU ${sku}`);
    state.trackingData[sku].fullPallets += 1;
    recordSkuEvent(sku, 'count', '+1 pallet', getTiHiString(state.trackingData[sku]), isSolo);
    updateRowTotals(sku);
    logEntry(sku, isSolo ? "+1 pallet (solo)" : "+1 pallet");
    closeModal();
  };
  dom.modalOverlay.classList.remove('hidden');
}

function openPartialModal(sku) {
  const activeInput = document.activeElement;
  if (activeInput && activeInput.classList && activeInput.classList.contains('tihi-input')) {
    const activeVal = activeInput.value.trim();
    if (activeVal) {
      activeInput.blur();
    }
  }
  const data = state.trackingData[sku];
  const perPallet = data.ti * data.hi;
  if (perPallet === 0) {
    const rowInput = dom.trackingSection.querySelector(`.tihi-input[data-sku="${sku}"]`);
    if (rowInput && rowInput.value.trim().length > 0) {
      rowInput.focus();
      return;
    }
    alert("Please enter a valid Ti/Hi for SKU " + sku + " first!");
    return;
  }
  dom.modalTitle.innerText = "Add to SKU";
  dom.modalBody.innerHTML = `<div class="modal-sku-label">SKU</div><div class="modal-sku-number">${sku}</div><p style="font-size:12px; color:var(--text-muted); margin-bottom:15px;">Standard Pallet: <strong>${perPallet}</strong> boxes (${data.ti}/${data.hi})</p><div style="text-align:left; margin-bottom:12px;"><label style="font-size:13px; font-weight:bold; margin-bottom:4px;">Unique Pallet (Ti/Hi)</label><input type="text" id="modal-unique-pallet" class="modal-tihi-input" placeholder="0/0" inputmode="numeric" style="margin-bottom:0;"><div class="tihi-box-calc" id="modal-tihi-calc" style="text-align:left; margin-top:4px; min-height:16px;"></div></div><div style="text-align:left; margin-bottom:5px;"><label style="font-size:13px; font-weight:bold; margin-bottom:4px;">+Extra Boxes</label><input type="number" id="modal-single-boxes" placeholder="e.g., 5" inputmode="numeric" style="margin-bottom:0;"><div id="modal-add-total-preview" style="margin-top:6px; font-size:12px; color:var(--primary); font-weight:bold;">Total boxes to add: 0</div></div>`;
  dom.modalConfirmBtn.className = "success";
  dom.modalConfirmBtn.innerText = "Add to Count";
  setModalActionButtons({ showConfirm: true, showSecondary: false });
  dom.modalConfirmBtn.onclick = () => {
    const actionParts = [];
    const uniqueValStr = document.getElementById('modal-unique-pallet').value;
    const singleVal = parseInt(document.getElementById('modal-single-boxes').value, 10);
    let updated = false;
    const match = uniqueValStr.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (match) {
      const uTi = parseInt(match[1], 10);
      const uHi = parseInt(match[2], 10);
      const uBoxes = uTi * uHi;
      if (uBoxes > 0) {
        captureUndoState(`Added unique pallet ${uTi}/${uHi} (${uBoxes} boxes) to SKU ${sku}`);
        state.trackingData[sku].partialPallets.push(uBoxes);
        recordSkuEvent(sku, 'partial', `Partial pallet ${uTi}/${uHi} (${uBoxes} boxes)`, `${uTi}/${uHi}`);
        actionParts.push(`+1 partial pallet (${uTi}/${uHi})`);
        updated = true;
      }
    }
    if (!isNaN(singleVal) && singleVal > 0) {
      if (!updated) captureUndoState(`Added ${singleVal} loose boxes to SKU ${sku}`);
      state.trackingData[sku].partialBoxes += singleVal;
      recordSkuEvent(sku, 'count', `Loose boxes +${singleVal}`, getTiHiString(state.trackingData[sku]));
      actionParts.push(`+${singleVal} boxes`);
      updated = true;
    }
    if (updated) {
      updateRowTotals(sku);
      logEntry(sku, actionParts.join(' '));
      closeModal();
    } else {
      alert("Please enter a valid Ti/Hi pattern (e.g., 8/4) or single boxes.");
    }
  };
  dom.modalOverlay.classList.remove('hidden');
  setTimeout(() => {
    const uInput = document.getElementById('modal-unique-pallet');
    const singleInput = document.getElementById('modal-single-boxes');
    const previewEl = document.getElementById('modal-add-total-preview');
    const updateLiveAddTotal = () => {
      const uniqueMatch = (uInput.value || '').match(/^(\d{1,2})\/(\d{1,2})$/);
      const uniqueBoxes = uniqueMatch ? ((parseInt(uniqueMatch[1], 10) || 0) * (parseInt(uniqueMatch[2], 10) || 0)) : 0;
      const singleBoxes = parseInt(singleInput.value, 10) || 0;
      previewEl.innerText = `Total boxes to add: ${uniqueBoxes + singleBoxes}`;
    };
    if (uInput) {
      attachTiHiInput(uInput);
      uInput.addEventListener('input', updateLiveAddTotal);
      uInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const currentMatch = uInput.value.match(/^(\d{1,2})\/(\d{1,2})$/);
          if (currentMatch) {
            e.preventDefault();
            dom.modalConfirmBtn.click();
          }
        }
      });
      uInput.focus();
    }
    if (singleInput) {
      singleInput.addEventListener('input', updateLiveAddTotal);
      singleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          dom.modalConfirmBtn.click();
        }
      });
    }
    updateLiveAddTotal();
  }, 200);
}

function updateRowTotals(sku, shouldFlashSku = true) {
  const data = state.trackingData[sku];
  const perPallet = data.ti * data.hi;
  const partialPalletsSum = data.partialPallets.reduce((a, b) => a + b, 0);
  const totalBoxes = data.carryBoxes + (data.fullPallets * perPallet) + partialPalletsSum + data.partialBoxes;
  const totalPallets = data.carryPallets + data.fullPallets + data.partialPallets.length;
  document.getElementById(`count-pallet-${sku}`).innerText = totalPallets;
  document.getElementById(`total-boxes-${sku}`).innerText = totalBoxes;
  const calcEl = document.getElementById(`tihi-calc-${sku}`);
  if (calcEl) calcEl.innerText = perPallet > 0 ? `=${perPallet} boxes` : '';
  const tiHiInput = dom.trackingSection.querySelector(`.tihi-input[data-sku="${sku}"]`);
  if (tiHiInput) {
    const hasPattern = data.ti > 0 && data.hi > 0;
    tiHiInput.value = hasPattern ? `${data.ti}/${data.hi}` : '';
    tiHiInput.readOnly = hasPattern;
  }
  if (shouldFlashSku) flashSkuSquare(sku);
  recalculateOverallTotals();
  saveState();
}

function flashSkuSquare(sku) {
  const row = document.getElementById(`row-${sku}`);
  if (!row) return;
  const square = row.querySelector('.sku-square');
  if (!square) return;
  square.classList.remove('flash-green');
  // Restart animation on rapid repeated updates.
  void square.offsetWidth;
  square.classList.add('flash-green');
  setTimeout(() => {
    square.classList.remove('flash-green');
  }, 1000);
}

function flashTiHiInput(sku) {
  const input = dom.trackingSection.querySelector(`.tihi-input[data-sku="${sku}"]`);
  if (!input) return;
  input.classList.remove('flash-invert');
  // Restart animation on repeated pattern updates.
  void input.offsetWidth;
  input.classList.add('flash-invert');
  setTimeout(() => {
    input.classList.remove('flash-invert');
  }, 1000);
}

function formatTiHiValue(val) {
  val = val.replace(/[^0-9/]/g, '');
  let parts = val.split('/');
  let ti = parts[0] || '';
  let hi = parts.length > 1 ? parts.slice(1).join('') : null;
  if (hi === null && ti.length > 2) {
    hi = ti.slice(2);
    ti = ti.slice(0, 2);
  } else {
    if (ti.length > 2) ti = ti.slice(0, 2);
    if (hi !== null && hi.length > 2) hi = hi.slice(0, 2);
  }
  return hi !== null ? `${ti}/${hi}` : ti;
}

function attachTiHiInput(el) {
  el.addEventListener('input', () => {
    const formatted = formatTiHiValue(el.value);
    el.value = formatted;
  });
  el.addEventListener('keydown', (e) => {
    const val = el.value;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!val.includes('/') && val.length > 0) {
        el.value = formatTiHiValue(val + '/');
      }
    }
    if (e.key === '/') {
      e.preventDefault();
      if (!val.includes('/') && val.length > 0) {
        el.value = formatTiHiValue(val + '/');
      }
    }
  });
}

export function recalculateOverallTotals() {
  let grandBoxes = 0;
  let grandPallets = 0;
  state.skus.forEach(sku => {
    const data = createTrackingEntry(state.trackingData[sku]);
    const perPallet = data.ti * data.hi;
    const partialPalletsSum = data.partialPallets.reduce((a, b) => a + b, 0);
    grandBoxes += data.carryBoxes + (data.fullPallets * perPallet) + partialPalletsSum + data.partialBoxes;
    grandPallets += data.carryPallets + data.fullPallets + data.partialPallets.length;
  });

  // Check manifestBoxes: if left blank/0, display count without /
  if (state.manifestBoxes > 0) {
    dom.grandTotalBoxes.innerText = `${grandBoxes} / ${state.manifestBoxes}`;
    const boxPercentage = ((grandBoxes / state.manifestBoxes) * 100).toFixed(1);
    dom.boxPct.innerText = `${boxPercentage}% Complete`;
    dom.boxPct.classList.remove('hidden');
  } else {
    dom.grandTotalBoxes.innerText = grandBoxes;
    dom.boxPct.classList.add('hidden');
  }

  // Check manifestPallets: if left blank/0, display count without /
  if (state.manifestPallets > 0) {
    dom.grandTotalPallets.innerText = `${grandPallets} / ${state.manifestPallets}`;
    const palletPercentage = ((grandPallets / state.manifestPallets) * 100).toFixed(1);
    dom.palletPct.innerText = `${palletPercentage}% Complete`;
    dom.palletPct.classList.remove('hidden');
  } else {
    dom.grandTotalPallets.innerText = grandPallets;
    dom.palletPct.classList.add('hidden');
  }
}

dom.trackingSection.addEventListener('focusin', (e) => {
  if (e.target.classList.contains('tihi-input')) {
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }
});

dom.trackingSection.addEventListener('pointerdown', (e) => {
  const activeEl = document.activeElement;
  if (!activeEl || !activeEl.classList || !activeEl.classList.contains('tihi-input')) return;
  if (e.target === activeEl) return;
  if (activeEl.value.trim().length > 0) {
    activeEl.blur();
  }
}, true);

dom.trackingSection.addEventListener('keydown', (e) => {
  if (e.target.classList.contains('tihi-input')) {
    const el = e.target;
    let val = el.value;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!val.includes('/') && val.length > 0) {
        el.value = val + '/';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        el.blur();
      }
      return;
    }
    if (e.key === '/') {
      e.preventDefault();
      if (!val.includes('/') && val.length > 0) {
        el.value = val + '/';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    if (e.key === 'Backspace') {
      const pos = el.selectionStart;
      if (pos > 0 && val[pos - 1] === '/') {
        e.preventDefault();
        el.value = val.slice(0, pos - 1) + val.slice(pos);
        el.setSelectionRange(pos - 1, pos - 1);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }
});

dom.trackingSection.addEventListener('input', (e) => {
  if (e.target.classList.contains('tihi-input')) {
    const el = e.target;
    let val = el.value.replace(/[^0-9/]/g, '');
    const sku = el.getAttribute('data-sku');
    const calcEl = document.getElementById(`tihi-calc-${sku}`);
    let parts = val.split('/');
    let ti = parts[0] || '';
    let hi = parts.length > 1 ? parts.slice(1).join('') : null;
    if (hi === null && ti.length > 2) {
      hi = ti.slice(2, 4);
      ti = ti.slice(0, 2);
    } else {
      if (ti.length > 2) ti = ti.slice(0, 2);
      if (hi !== null && hi.length > 2) hi = hi.slice(0, 2);
    }
    el.value = hi !== null ? `${ti}/${hi}` : ti;
    const tNum = parseInt(ti, 10) || 0;
    const hNum = parseInt(hi, 10) || 0;
    if (tNum > 0 && hNum > 0) {
      if (calcEl) calcEl.innerText = `=${tNum * hNum} boxes`;
    } else if (calcEl) {
      calcEl.innerText = '';
    }
  }
});

dom.trackingSection.addEventListener('focusout', (e) => {
  if (e.target.classList.contains('tihi-input')) {
    const el = e.target;
    const sku = el.getAttribute('data-sku');
    const val = el.value.trim();
    const currentTi = state.trackingData[sku].ti;
    const currentHi = state.trackingData[sku].hi;
    const currentStr = currentTi > 0 && currentHi > 0 ? `${currentTi}/${currentHi}` : '';
    if (val !== currentStr) {
      const match = val.match(/^(\d{1,2})\/(\d{1,2})$/);
      if (match) {
        const newTi = parseInt(match[1], 10);
        const newHi = parseInt(match[2], 10);
        if (currentTi === 0 && currentHi === 0) {
          state.trackingData[sku].ti = newTi;
          state.trackingData[sku].hi = newHi;
          recordSkuEvent(sku, 'edit', `Pattern set to ${newTi}/${newHi}`, `${newTi}/${newHi}`);
          logEntry(sku, `Set Ti/Hi pattern to ${newTi}/${newHi}`);
          updateRowTotals(sku, false);
          flashTiHiInput(sku);
        } else {
          el.value = currentStr;
        }
      } else if (val === '') {
        if (currentTi > 0 || currentHi > 0) {
          el.value = currentStr;
        }
      } else {
        el.value = currentStr;
      }
    }
  }
});
