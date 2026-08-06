// Cached references to every DOM element the app touches. Queried once at
// module load time (module scripts run after the document has parsed, so
// every element below is guaranteed to already exist).
export const dom = {
  bodyEl: document.body,
  hamburgerMenuBtn: document.getElementById('hamburger-menu-btn'),
  dropdownMenu: document.getElementById('dropdown-menu'),
  menuItemLog: document.getElementById('menu-item-log'),
  menuItemSendersCount: document.getElementById('menu-item-senders-count'),
  menuItemSoloPallets: document.getElementById('menu-item-solo-pallets'),
  menuItemPayoutToggle: document.getElementById('menu-item-payout-toggle'),
  menuItemTheme: document.getElementById('menu-item-theme'),
  menuItemEndSession: document.getElementById('menu-item-endsession'),
  menuActiveSessionDivider: document.getElementById('menu-active-session-divider'),

  trailerSection: document.getElementById('trailer-section'),
  setupSection: document.getElementById('setup-section'),
  trackingSection: document.getElementById('tracking-section'),
  signoutSection: document.getElementById('signout-section'),
  historySection: document.getElementById('history-section'),

  workerNameInput: document.getElementById('worker-name-input'),
  doorNumInput: document.getElementById('door-num-input'),
  sendersCountInput: document.getElementById('senders-count-input'),
  workerNameLabel: document.querySelector('label[for="worker-name-input"]'),
  doorNumLabel: document.querySelector('label[for="door-num-input"]'),
  btnViewHistory: document.getElementById('btn-view-history'),
  btnSkipNameDoor: document.getElementById('btn-skip-name-door'),
  btnUndoAction: document.getElementById('btn-undo-action'),
  btnBackToTrailer: document.getElementById('btn-back-to-trailer'),
  btnBackFromHistory: document.getElementById('btn-back-from-history'),

  historyNameFilter: document.getElementById('history-name-filter'),
  historyListContainer: document.getElementById('history-list-container'),
  btnExportSummaryPdf: document.getElementById('btn-export-summary-pdf'),
  summaryExportOptions: null, // panel removed
  summaryExportIncludeTimestamps: null,
  btnPerformSummaryTxtExport: null,
  btnPerformSummaryPdfExport: null,
  btnCancelSummaryPdfExport: null,

  skuInput: document.getElementById('sku-input'),
  btnAddSku: document.getElementById('btn-add-sku'),
  btnFinish: document.getElementById('btn-finish-setup'),
  skuTags: document.getElementById('sku-tags'),
  trackerRows: document.getElementById('tracker-rows'),
  midSkuInput: document.getElementById('mid-sku-input'),
  btnMidAddSku: document.getElementById('btn-mid-add-sku'),

  dispTrailerNum: document.getElementById('disp-trailer-num'),
  dispTrailerName: document.getElementById('disp-trailer-name'),
  appHeaderBar: document.getElementById('app-header-bar'),
  grandTotalBoxes: document.getElementById('grand-total-boxes'),
  boxPct: document.getElementById('box-pct'),
  payoutBanner: document.getElementById('payout-banner'),
  payoutEarned: document.getElementById('payout-earned'),
  payoutTotal: document.getElementById('payout-total'),
  btnNewTrailer: document.getElementById('btn-new-trailer'),
  btnViewLog: document.getElementById('btn-view-log'),
  topActivityTicker: document.getElementById('top-activity-ticker'),

  logModalOverlay: document.getElementById('log-modal-overlay'),
  modalActivityLogList: document.getElementById('modal-activity-log-list'),
  btnCloseLogModal: document.getElementById('btn-close-log-modal'),
  btnModalExportTxt: null, // removed
  btnModalExportPdf: document.getElementById('btn-modal-export-pdf'),

  modalOverlay: document.getElementById('modal-overlay'),
  modalTitle: document.getElementById('modal-title'),
  modalBody: document.getElementById('modal-body'),
  modalConfirmBtn: document.getElementById('modal-confirm-btn'),
  modalSecondaryBtn: document.getElementById('modal-secondary-btn'),
  modalCancelBtn: document.getElementById('modal-cancel-btn'),
  sendersCountModalOverlay: document.getElementById('senders-count-modal-overlay'),
  modalManifestBoxesInput: document.getElementById('modal-manifest-boxes-input'),
  modalManifestPalletsInput: document.getElementById('modal-manifest-pallets-input'),
  modalSendersCancelBtn: document.getElementById('modal-senders-cancel-btn'),
  modalSendersSaveBtn: document.getElementById('modal-senders-save-btn'),
  soloPalletsModalOverlay: document.getElementById('solo-pallets-modal-overlay'),
  soloPalletsList: document.getElementById('solo-pallets-list'),
  btnCloseSoloPalletsModal: document.getElementById('btn-close-solo-pallets-modal'),

  startScreenThemeToggle: document.getElementById('start-screen-theme-toggle'),

  soIncludeSoloCheckbox: document.getElementById('so-include-solo-checkbox'),
  soSoloSection: document.getElementById('so-solo-section'),
  soSoloRows: document.getElementById('so-solo-rows'),

  soPayoutBox: document.getElementById('so-payout-box'),
  soTotalPayout: document.getElementById('so-total-payout'),
  soEarnedPayoutBox: document.getElementById('so-earned-payout-box'),
  soEarnedPayout: document.getElementById('so-earned-payout')
};
