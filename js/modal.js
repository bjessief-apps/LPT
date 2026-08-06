// Generic confirm/choice modal helpers, shared by every feature that needs
// to ask the user a yes/no or three-way question via the single #modal-overlay.
import { dom } from './dom.js';

export function closeModal() {
  dom.modalOverlay.classList.add('hidden');
}
dom.modalCancelBtn.addEventListener('click', closeModal);

export function setModalActionButtons({ showConfirm = true, showSecondary = false } = {}) {
  dom.modalConfirmBtn.style.display = showConfirm ? '' : 'none';
  dom.modalSecondaryBtn.style.display = showSecondary ? '' : 'none';
  dom.modalCancelBtn.style.display = '';
}

export function openConfirmModal(title, bodyHtml, confirmLabel, confirmAction, cancelLabel = 'Cancel') {
  dom.modalTitle.innerText = title;
  dom.modalBody.innerHTML = bodyHtml;
  dom.modalConfirmBtn.className = 'success';
  dom.modalConfirmBtn.innerText = confirmLabel;
  dom.modalConfirmBtn.onclick = () => {
    closeModal();
    confirmAction();
  };
  dom.modalSecondaryBtn.onclick = null;
  setModalActionButtons({ showConfirm: true, showSecondary: false });
  dom.modalCancelBtn.innerText = cancelLabel;
  dom.modalOverlay.classList.remove('hidden');
}

export function openThreeOptionModal(title, bodyHtml, primaryLabel, primaryAction, secondaryLabel, secondaryAction, cancelLabel = 'Cancel') {
  dom.modalTitle.innerText = title;
  dom.modalBody.innerHTML = bodyHtml;
  dom.modalConfirmBtn.className = 'success';
  dom.modalConfirmBtn.innerText = primaryLabel;
  dom.modalConfirmBtn.onclick = () => {
    closeModal();
    primaryAction();
  };
  dom.modalSecondaryBtn.className = 'secondary';
  dom.modalSecondaryBtn.innerText = secondaryLabel;
  dom.modalSecondaryBtn.onclick = () => {
    closeModal();
    secondaryAction();
  };
  setModalActionButtons({ showConfirm: true, showSecondary: true });
  dom.modalCancelBtn.innerText = cancelLabel;
  dom.modalOverlay.classList.remove('hidden');
}
