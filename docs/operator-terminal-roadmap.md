# Operator Terminal — Shop Floor Experience Roadmap

## Session slice — Transactional Execution Backbone

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
- Transactional Execution Backbone slice: added a pure station readiness engine, Go/No-Go UI, action gating, replayable offline queue targets for confirm/incident/andon, and a ledger-backed operational timeline using existing `/ledger/work-order/:wo` data.
- Certification gate slice: connected station readiness to the existing `/people/certification-check` endpoint so operator↔station certification can warn/block confirmation from real People data.
- Andon response slice: station alerts now ACK/resolve Andon calls through existing `/mes/andon/:id/ack|resolve` endpoints so support response is transactional from the terminal.
- Critical transaction validation slice: confirm/incident/andon actions are validated before submit/replay, carry `clientRequestId`, and reject malformed offline payloads before they hit MES endpoints.
- Extended Andon contract slice: MES execution now accepts supervisor, materialist, engineering and tooling Andon types so the terminal’s extended support buttons are backed by real transactions.
- Andon routing visibility slice: `/mes/board` now serializes Andon `responseRole` and the terminal displays who must respond in alerts and timeline.
- Material request transaction slice: `/mes/board` exposes execution `planId`/`kitId`, and the material panel can create real `/material-requests` from short materials.
- Traceability event slice: `/mes/board` now returns recent confirmation events with step, serial, lot, operator, scrap, and idempotency metadata so the terminal can show real genealogy/audit context instead of a placeholder.
- Offline server replay slice: `/mes/offline/replay` accepts replayable confirm/incident/andon queue items, validates endpoint shapes server-side, reuses existing MES transaction methods, and returns per-action success/failure results for the terminal queue.
- Live as-built genealogy slice: the terminal now detects the latest confirmed serial and reads the existing `/genealogy/as-built/by-serial/:serial` tree to show component, lot/reel, and capture-gap context inside the embedded genealogy panel.
- Serial trace search slice: the embedded genealogy panel now lets operators type any serial and inspect its existing as-built tree without leaving `/dashboard/operador`.
- Where-used containment slice: operators can enter a material lot in the embedded genealogy panel and inspect the existing `/genealogy/where-used/by-lot` recall scope, affected serials, shipments, and customers from the terminal.
- Containment NCR escalation slice: where-used results can prefill a blocking quality incident/NCR request with lot, affected serial count, shipment count, and customer scope so containment can move directly into MES quality workflow.
- Containment audit link slice: containment escalations now carry structured lot/serial/shipment/customer metadata into the incident payload and MES quality ledger metadata, and open incidents expose `ncrId` back to the terminal.
- Containment status panel slice: the embedded command center now reads quality ledger containment metadata and groups audited NCR/containment items by lot with serial, shipment, customer, and NCR status context.
- Quality NCR visibility slice: inline quality and disposition panels now surface open NCR/hold status from board incidents so containment follow-up is visible at the station.
- Containment disposition audit slice: terminal disposition actions now send resolvedBy/note context for NCR holds and MES disposition ledger metadata retains the NCR id and operator note.
- Follow-up SLA slice: the command center now derives visible owner/SLA tasks from containment lots, active Andons, and material requests so operators see who owns each open follow-up.
- Follow-up ACK audit slice: operators can acknowledge follow-up SLA tasks from the command center and `/mes/follow-ups/ack` records the acknowledgement in the Event Ledger with owner/source/status context.
- Follow-up escalation audit slice: operators can escalate SLA follow-ups from the command center and `/mes/follow-ups/escalate` records escalated owner/reason context in the Event Ledger.
- Follow-up ledger state slice: command-center follow-ups now read ACK/escalation ledger history by follow-up key, show acknowledged/escalated state, and disable repeated ACK/ESC actions.

### Next slices

1. Add persisted operator-terminal sync audit storage if regulatory offline replay evidence requires server-side queue retention beyond MES events.
2. Add ownership reassignment rules and SLA breach timers based on persisted follow-up state.
