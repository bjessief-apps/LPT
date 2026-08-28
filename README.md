# Lumper Pallet Tracker (LPT)

LPT is a browser-based app for tracking pallet and box counts by SKU during a trailer unload shift, built to support work in a lumper job position.

## What it does

- Starts a work session with optional worker name, door number, and sender's box count.
- Lets you add 3-digit SKUs and track counts per SKU.
- Supports:
  - full pallet counts (`+1 pallet`)
  - unique/partial pallet counts (custom Ti/Hi)
  - loose box adds
- Shows running totals and completion percentage when sender's count is provided.
- Shows estimated payout progress based on sender's count tiers.
- Keeps an activity log and supports undo for the latest action.
- Generates printable summaries and activity logs.
- Stores work history locally in the browser.

## Access

This app is published and accessible through GitHub Pages on your GitHub.io site.

## How it works

The app is a single-page frontend (HTML/CSS/vanilla JS modules) with no backend.

1. **Start screen (`trailer-section`)**
   - Enter name/door/sender's count or skip.
   - Can open **Work History**.
2. **SKU setup (`setup-section`)**
   - Add SKUs before counting.
3. **Live tracker (`tracking-section`)**
   - Set Ti/Hi for each SKU.
   - Tap `+ Count` for a full pallet.
   - Long-press `+ Count` for partial pallet / loose boxes.
   - Long-press SKU to rename/delete.
   - Long-press pallet count to view SKU event history.
4. **Signout summary (`signout-section`)**
   - Final totals, duration, payout, and SKU breakdown.
   - Export summary.
5. **History (`history-section`)**
   - View, filter, export, and delete saved past sessions.

## Data and persistence

Data is stored in `localStorage`:

- `lpt_work_history`: saved session records
- `lpt_saved_session`: in-progress snapshot
- `lpt_theme`: light/dark theme preference
- `lpt_payout_visible`: payout banner visibility

No data is sent to a server.

## Project structure

- `/home/runner/work/LPT/LPT/index.html` – app layout and sections
- `/home/runner/work/LPT/LPT/css/style.css` – styling/theme
- `/home/runner/work/LPT/LPT/js/main.js` – app bootstrap, section switching, main event wiring
- `/home/runner/work/LPT/LPT/js/state.js` – shared mutable session state
- `/home/runner/work/LPT/LPT/js/dom.js` – cached DOM references
- `/home/runner/work/LPT/LPT/js/sku.js` – SKU add/render/delete logic
- `/home/runner/work/LPT/LPT/js/tracker.js` – counting interactions and totals
- `/home/runner/work/LPT/LPT/js/session.js` – session lifecycle, undo, activity logging
- `/home/runner/work/LPT/LPT/js/storage.js` – localStorage/history persistence
- `/home/runner/work/LPT/LPT/js/history.js` – work history filtering/rendering
- `/home/runner/work/LPT/LPT/js/export.js` – printable summary/activity exports
- `/home/runner/work/LPT/LPT/js/payout.js` – payout calculations and display
- `/home/runner/work/LPT/LPT/js/modal.js` – shared modal behavior
