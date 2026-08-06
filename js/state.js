// Shared mutable session state. A single object is exported (rather than
// individual `let` bindings) so every module can read and write the same
// live values without import/export reassignment restrictions.
export const state = {
  workerName: '',
  doorNum: '',
  manifestBoxes: 0,
  manifestPallets: 0,
  startTime: null,
  endTime: null,
  skipNameDoorMode: false,
  skus: [],
  trackingData: {},
  activityLogs: [],
  currentSection: 'trailer-section',
  lastUndoState: null,
  sessionSummarySaved: false,
  historyRecordsCache: {}
};
