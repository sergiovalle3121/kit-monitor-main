# Operator Terminal — Shop Floor Experience Roadmap

## Session slice — Programa 03 / Fases 1-164

This slice starts the AXOS MES operator terminal redesign on the connected `plans → mes-execution → /dashboard/operador` flow. It intentionally avoids creating new backend modules and reuses the existing `/mes/executions`, `/mes/board`, confirmation, incident, and andon endpoints.

### Delivered

- Industrial fixed top bar for the operator terminal with operator, shift, line, station, WO, model, machine state, quality state, connectivity, alerts, and live clock.
- Touch-first / glove-friendly controls with larger scan, order, station, and action targets.
- Dark industrial and light industrial toggles local to the terminal.
- Offline/connectivity visibility: the terminal now labels connected state as `Online` and degraded socket state as `Offline / cola local` so future offline queue work has a stable UI slot.
- Real-time production KPI panel for target, actual, remaining, takt placeholder, UPH placeholder, OEE proxy, yield, scrap, rework, downtime, and WIP using the current `/mes/board` payload.
- Industrial scanner layer for keyboard wedge, USB/Bluetooth scanner input, QR, DataMatrix, Code128, WO, serial, lot, and material classification with immediate visual, audio, and vibration feedback.
- Embedded work-instruction viewer for images, PDFs, Office docs/slides, videos, and CAD placeholders with controlled-version context, expanded mode, and no operator screen change.
- Inline quality side panel with defect/NCR entry, scrap and rework visibility, photo evidence names, comments, signature, blocking hold visibility, and quick checklist status.
- Combined Fases 7-14 cockpit slice: extended Andon roles/SLA labels, material/Kanban visibility, embedded genealogy summary, chronological timeline, keyboard shortcuts, offline queue placeholder, <100ms performance target indicators, and consolidated execution command center.
- Combined Fases 15-24 hardening slice: persisted operator preferences, local offline action queue, queued confirm/quality/andon fallback, retry-attempt counters, clear queue control, and cockpit persistence/performance indicators.
- Combined Fases 25-34 reliability slice: extracted scanner/offline utility contracts, colocated scanner regression coverage, and stabilized the operator page around reusable pure parsing logic.
- Combined Fases 35-44 metric-hardening slice: extracted production KPI derivation, colocated metric regression coverage, and made the KPI panel consume tested pure calculations.
- Combined Fases 45-54 maintainability slice: split the embedded work-instruction viewer into a colocated component module with its own visual-aid contract, reducing the operator page surface before the next backend-heavy slices.
- Combined Fases 55-64 scanner-maintainability slice: split scanner feedback UI into a colocated component module while keeping scanner parsing in tested pure utilities.
- Combined Fases 65-74 KPI-maintainability slice: split the production KPI panel into a colocated component module that consumes tested metric utilities.
- Combined Fases 75-84 quality-maintainability slice: split the inline quality side panel into a colocated component module ahead of deeper NCR/evidence backend contracts.
- Combined Fases 85-94 command-center maintainability slice: split the execution command center and Andon role catalog into colocated modules while preserving existing MES endpoints.
- Combined Fases 95-104 topbar-maintainability slice: split the sticky industrial top bar into a colocated module while preserving the operator context, shift clock, connectivity, alerts, glove mode, and theme controls.
- Combined Fases 105-114 actionbar-maintainability slice: split the fixed operator action bar into a colocated module while preserving confirm, incident, and Andon touch targets for tablets and kiosks.
- Combined Fases 115-124 station-alert maintainability slice: split the Andon/material alert strip into a colocated module so station notifications can evolve independently from the board page.
- Combined Fases 125-134 route-rail maintainability slice: split the station route rail into a colocated module with a shared status metadata helper, improving accessibility and preparing richer routing/genealogy overlays.
- Combined Fases 135-144 material-consumption maintainability slice: split the live step-material consumption card into a colocated module, preserving shortage/low-stock indicators while preparing richer Kanban and material ETA contracts.
- Combined Fases 145-154 incident-disposition maintainability slice: split open-quality incident disposition controls into a colocated module so NCR disposition and audit requirements can evolve independently.
- Combined Fases 155-164 work-order-summary maintainability slice: split the WO summary/progress banner into a colocated module, preparing richer model/revision/lot/serial context without growing the board page.
- Downtime reason capture slice: line-stop Andon now requires a downtime reason
  code, opens `mes_downtime_events` with that reason, and writes
  `MES_DOWNTIME_OPENED` evidence to the Event Ledger.

### Next slices

1. Backend contracts for live material ETA, genealogy serial tree, offline queue persistence, and response-time SLA events.
2. Split the consolidated cockpit into smaller shared components once API contracts stabilize.
