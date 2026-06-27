# Operator Terminal — Shop Floor Experience Roadmap

## Session slice — Programa 03 / Fases 1-14

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

### Next slices

1. Backend contracts for live material ETA, genealogy serial tree, offline queue persistence, and response-time SLA events.
2. Split the consolidated cockpit into smaller shared components once API contracts stabilize.
