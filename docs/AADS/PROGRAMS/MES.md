# MES / SHOP FLOOR — Program Backlog

This backlog defines the floor execution layer for AXOS: the screens and endpoints operators and supervisors use to run, measure, and trace production on the shop floor. The objective is an incremental, scanner-friendly execution surface that ties every quality and genealogy write back to the Event Ledger and keeps supervisors fed with dense live data.

**Before building anything**, INSPECT the existing modules first: backend `apps/api/src/modules/{operator-terminal,mes-execution,oee,genealogy,floor-quality,material-requests,changeover,production-runtime,live,alerts,defect-codes,quality,ncr}` and web routes `apps/web/src/app/dashboard/{operador,production,live,floor-quality,genealogy,material-staging}`, plus `docs/operator-terminal-roadmap.md`. Do NOT create a parallel operator screen — extend `operator-terminal` and `mes-execution`. Every PR stays small, functional, and green; `main` deploys to Railway, so never merge red.

## Epics

1. **Operator Terminal** — the large-button, scanner-first screen where operators run jobs.
2. **Supervisor Console** — dense live oversight of lines, stations, and operators.
3. **Andon** — operator-raised calls, escalation, and response tracking.
4. **Work Instructions** — versioned step content shown at the station.
5. **Quality Capture** — in-line checks, defect codes, and NCR creation from the floor.
6. **Material Requests** — operator-triggered replenishment and staging hand-off.
7. **Genealogy** — component/lot consumption and as-built traceability.
8. **OEE** — availability, performance, quality rollups and tiles.
9. **Downtime** — reason-coded stops and changeover tracking.
10. **Offline Mode** — local capture with a sync/replay queue for unreliable floor networks.

## Backlog

### Operator Terminal

#### MES-001 — Add "Start Job" large-button to operator terminal
- **Epic:** Operator Terminal
- **Objective:** Add a single full-width Start Job button to the existing operator terminal screen that calls the current start endpoint.
- **Probable files:** `apps/web/src/app/dashboard/operador`, `apps/api/src/modules/operator-terminal`
- **Acceptance criteria:** Button is visible only when a job is selected and not running; clicking transitions the job to RUNNING and disables the button.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-002 — Add "Pause Job" button with disabled state
- **Epic:** Operator Terminal
- **Objective:** Add a Pause button next to Start that pauses an in-progress job via the existing mes-execution pause path.
- **Probable files:** `apps/web/src/app/dashboard/operador`, `apps/api/src/modules/mes-execution`
- **Acceptance criteria:** Pause is enabled only while RUNNING; after pause the job shows PAUSED and Start re-enables.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-003 — Add "Complete Quantity" stepper input
- **Epic:** Operator Terminal
- **Objective:** Add one numeric +/- stepper for good-quantity reporting on the active job tile.
- **Probable files:** `apps/web/src/app/dashboard/operador`, `apps/api/src/modules/mes-execution`
- **Acceptance criteria:** Stepper cannot go below zero and posts the quantity to the existing report endpoint on submit.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-004 — Scanner input focus-trap on terminal load
- **Epic:** Operator Terminal
- **Objective:** Auto-focus the badge/work-order scan field when the operator terminal mounts.
- **Probable files:** `apps/web/src/app/dashboard/operador`
- **Acceptance criteria:** Scan field holds focus on load and after each scan submit so a wedge scanner needs no manual click.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-005 — Operator badge login endpoint
- **Epic:** Operator Terminal
- **Objective:** Add one endpoint that resolves a scanned badge ID to the active operator session.
- **Probable files:** `apps/api/src/modules/operator-terminal`
- **Acceptance criteria:** Valid badge returns operator + tenant context; invalid badge returns 404 without leaking other tenants.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-006 — Current-job header tile
- **Epic:** Operator Terminal
- **Objective:** Add a header tile showing work order, part, and target quantity for the active job.
- **Probable files:** `apps/web/src/app/dashboard/operador`, `apps/api/src/modules/mes-execution`
- **Acceptance criteria:** Tile reflects the selected job and clears when no job is active.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-007 — Large "End Job" confirmation flow
- **Epic:** Operator Terminal
- **Objective:** Add an End Job button with a single confirm dialog before completing the run.
- **Probable files:** `apps/web/src/app/dashboard/operador`, `apps/api/src/modules/mes-execution`
- **Acceptance criteria:** Confirm completes the run; cancel keeps it RUNNING; no double-submit on rapid taps.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-008 — Elapsed-time tile for active job
- **Epic:** Operator Terminal
- **Objective:** Add a single tile showing elapsed run time derived from the job start timestamp.
- **Probable files:** `apps/web/src/app/dashboard/operador`
- **Acceptance criteria:** Timer ticks while RUNNING and freezes on PAUSED/complete.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-009 — Operator job queue list
- **Epic:** Operator Terminal
- **Objective:** Show the next queued jobs for the operator's station as a tap-to-select list.
- **Probable files:** `apps/web/src/app/dashboard/operador`, `apps/api/src/modules/production-runtime`
- **Acceptance criteria:** List is scoped to the station and ordered by sequence; selecting loads the job into the header tile.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

### Supervisor Console

#### MES-010 — Line status grid tile
- **Epic:** Supervisor Console
- **Objective:** Add one dense grid tile listing each line with current state to the supervisor view.
- **Probable files:** `apps/web/src/app/dashboard/production`, `apps/api/src/modules/live`
- **Acceptance criteria:** Each row shows line, state, and active work order; updates from the existing live feed.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-011 — Station occupancy column
- **Epic:** Supervisor Console
- **Objective:** Add an operator-occupancy column to the supervisor station table.
- **Probable files:** `apps/web/src/app/dashboard/production`, `apps/api/src/modules/operator-terminal`
- **Acceptance criteria:** Column shows the logged-in operator per station or "—" when empty.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-012 — Live throughput counter endpoint
- **Epic:** Supervisor Console
- **Objective:** Add one endpoint returning good-quantity reported per line in the current shift.
- **Probable files:** `apps/api/src/modules/live`, `apps/api/src/modules/mes-execution`
- **Acceptance criteria:** Endpoint returns counts per line scoped to tenant and current shift window.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-013 — Supervisor "jump to station" link
- **Epic:** Supervisor Console
- **Objective:** Add a row action that opens the operator terminal for the selected station read-only.
- **Probable files:** `apps/web/src/app/dashboard/production`, `apps/web/src/app/dashboard/operador`
- **Acceptance criteria:** Link navigates with station context preset; no operator actions enabled in supervisor view.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-014 — Shift summary tile
- **Epic:** Supervisor Console
- **Objective:** Add one tile summarizing good/scrap totals for the current shift.
- **Probable files:** `apps/web/src/app/dashboard/production`, `apps/api/src/modules/mes-execution`
- **Acceptance criteria:** Tile shows good, scrap, and yield % for the active shift; refreshes on the live interval.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-015 — Filter console by area
- **Epic:** Supervisor Console
- **Objective:** Add a single area dropdown filter to the line status grid.
- **Probable files:** `apps/web/src/app/dashboard/production`
- **Acceptance criteria:** Selecting an area filters the grid client-side; "All" restores the full list.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

### Andon

#### MES-016 — Raise-Andon button on operator terminal
- **Epic:** Andon
- **Objective:** Add one large Andon call button that creates an alert for the operator's station.
- **Probable files:** `apps/web/src/app/dashboard/operador`, `apps/api/src/modules/alerts`
- **Acceptance criteria:** Tap creates an open alert with station context; button shows ACTIVE state while a call is open.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-017 — Andon reason-code picker
- **Epic:** Andon
- **Objective:** Add a single reason-code selection flow shown when raising an Andon call.
- **Probable files:** `apps/web/src/app/dashboard/operador`, `apps/api/src/modules/alerts`
- **Acceptance criteria:** Operator must pick one reason before the call is created; reason is stored on the alert.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-018 — Andon escalation timer endpoint
- **Epic:** Andon
- **Objective:** Add logic that flags an open Andon call as escalated after a configurable threshold.
- **Probable files:** `apps/api/src/modules/alerts`, `apps/api/src/modules/notifications`
- **Acceptance criteria:** Calls open past the threshold return an escalated flag and trigger one notification.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-019 — Andon acknowledge action
- **Epic:** Andon
- **Objective:** Add an acknowledge endpoint and supervisor button for an open Andon call.
- **Probable files:** `apps/api/src/modules/alerts`, `apps/web/src/app/dashboard/production`
- **Acceptance criteria:** Acknowledging records the responder and timestamp; UI moves the call to ACKNOWLEDGED.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-020 — Andon resolve flow
- **Epic:** Andon
- **Objective:** Add a resolve action that closes an Andon call with a resolution note.
- **Probable files:** `apps/api/src/modules/alerts`, `apps/web/src/app/dashboard/production`
- **Acceptance criteria:** Resolve sets CLOSED state, stores the note, and clears the operator ACTIVE indicator.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-021 — Open-Andon notification to supervisors
- **Epic:** Andon
- **Objective:** Send one notification to the station's supervisor group when an Andon is raised.
- **Probable files:** `apps/api/src/modules/alerts`, `apps/api/src/modules/notifications`
- **Acceptance criteria:** Raising a call dispatches exactly one notification to the supervisor group for that area.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

### Work Instructions

#### MES-022 — Work instruction panel on terminal
- **Epic:** Work Instructions
- **Objective:** Add a read-only panel that shows the active step's instruction text for the current job.
- **Probable files:** `apps/web/src/app/dashboard/operador`, `apps/api/src/modules/mes-execution`
- **Acceptance criteria:** Panel renders the step text for the active operation and is empty when none exists.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-023 — Step-version resolver endpoint
- **Epic:** Work Instructions
- **Objective:** Add one endpoint returning the effective instruction version for a given operation.
- **Probable files:** `apps/api/src/modules/mes-execution`
- **Acceptance criteria:** Endpoint returns the latest released version scoped to tenant; unreleased drafts are excluded.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-024 — Next/Prev step navigation buttons
- **Epic:** Work Instructions
- **Objective:** Add two large buttons to move between work instruction steps on the terminal.
- **Probable files:** `apps/web/src/app/dashboard/operador`
- **Acceptance criteria:** Buttons disable at first/last step; current step index is shown.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-025 — Instruction image thumbnail support
- **Epic:** Work Instructions
- **Objective:** Render a single image attachment on the instruction panel when present.
- **Probable files:** `apps/web/src/app/dashboard/operador`, `apps/api/src/modules/mes-execution`
- **Acceptance criteria:** Image renders if the step has one attachment; layout is unaffected when absent.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-026 — Step acknowledgement checkbox
- **Epic:** Work Instructions
- **Objective:** Add a single "I have read this step" acknowledgement recorded against the run.
- **Probable files:** `apps/web/src/app/dashboard/operador`, `apps/api/src/modules/mes-execution`
- **Acceptance criteria:** Acknowledgement posts step + operator + timestamp and persists for the run.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

### Quality Capture

#### MES-027 — In-line pass/fail check button pair
- **Epic:** Quality Capture
- **Objective:** Add Pass and Fail buttons for the active quality check on the terminal.
- **Probable files:** `apps/web/src/app/dashboard/floor-quality`, `apps/api/src/modules/floor-quality`
- **Acceptance criteria:** Result posts to floor-quality and writes one entry to the Event Ledger.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-028 — Defect-code picker on Fail
- **Epic:** Quality Capture
- **Objective:** Add a single reason-code flow that requires a defect code when a check fails.
- **Probable files:** `apps/web/src/app/dashboard/floor-quality`, `apps/api/src/modules/defect-codes`
- **Acceptance criteria:** Fail cannot submit without a defect code; selected code is stored on the result.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-029 — Create NCR from failed check
- **Epic:** Quality Capture
- **Objective:** Add a button that opens an NCR pre-filled from the failed check context.
- **Probable files:** `apps/web/src/app/dashboard/floor-quality`, `apps/api/src/modules/ncr`
- **Acceptance criteria:** NCR is created with part, defect code, and run reference; Event Ledger records the creation.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-030 — Scrap quantity capture
- **Epic:** Quality Capture
- **Objective:** Add a single scrap-quantity input with a required reason code on the terminal.
- **Probable files:** `apps/web/src/app/dashboard/operador`, `apps/api/src/modules/quality`
- **Acceptance criteria:** Scrap submit requires a reason and posts quantity + reason; ledger entry written.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-031 — First-piece inspection prompt
- **Epic:** Quality Capture
- **Objective:** Show a one-time first-piece inspection prompt when a run starts a new part.
- **Probable files:** `apps/web/src/app/dashboard/floor-quality`, `apps/api/src/modules/floor-quality`
- **Acceptance criteria:** Prompt appears once per run; completing it records a first-piece result.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-032 — Quality result ledger writer
- **Epic:** Quality Capture
- **Objective:** Ensure every floor-quality write emits one Event Ledger record.
- **Probable files:** `apps/api/src/modules/floor-quality`, `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Each pass/fail/scrap write produces exactly one ledger entry with run context.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

### Material Requests

#### MES-033 — Request-material button on terminal
- **Epic:** Material Requests
- **Objective:** Add one large button that raises a replenishment request for the active part.
- **Probable files:** `apps/web/src/app/dashboard/operador`, `apps/api/src/modules/material-requests`
- **Acceptance criteria:** Tap creates an OPEN request with station + part; button shows pending state.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-034 — Material request staging board tile
- **Epic:** Material Requests
- **Objective:** Add a tile on the staging view listing open requests for the area.
- **Probable files:** `apps/web/src/app/dashboard/material-staging`, `apps/api/src/modules/material-requests`
- **Acceptance criteria:** Open requests appear ordered by created time; fulfilled ones drop off.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-035 — Fulfill material request action
- **Epic:** Material Requests
- **Objective:** Add a fulfill button that closes a request and stamps the handler.
- **Probable files:** `apps/web/src/app/dashboard/material-staging`, `apps/api/src/modules/material-requests`
- **Acceptance criteria:** Fulfill sets FULFILLED with handler + timestamp and clears the operator pending state.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-036 — Material request notification
- **Epic:** Material Requests
- **Objective:** Send one notification to material handlers when a request is raised.
- **Probable files:** `apps/api/src/modules/material-requests`, `apps/api/src/modules/notifications`
- **Acceptance criteria:** Creating a request dispatches exactly one notification to the area handler group.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

### Genealogy

#### MES-037 — Scan-to-consume component endpoint
- **Epic:** Genealogy
- **Objective:** Add one endpoint that records a scanned component/lot consumed by the active run.
- **Probable files:** `apps/api/src/modules/genealogy`, `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Valid scan links component lot to run and writes one Event Ledger entry.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-038 — Component scan field on terminal
- **Epic:** Genealogy
- **Objective:** Add a scanner-focused field that posts consumed components to the genealogy endpoint.
- **Probable files:** `apps/web/src/app/dashboard/operador`, `apps/api/src/modules/genealogy`
- **Acceptance criteria:** Each scan appends to a consumed list and refocuses for the next scan.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-039 — As-built consumed list tile
- **Epic:** Genealogy
- **Objective:** Show the components consumed so far for the active run as a read-only list.
- **Probable files:** `apps/web/src/app/dashboard/genealogy`, `apps/api/src/modules/genealogy`
- **Acceptance criteria:** Tile lists consumed lots for the run; empty state shown when none.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-040 — Lot validity check on consume
- **Epic:** Genealogy
- **Objective:** Reject consumption of an expired or quarantined lot at the consume endpoint.
- **Probable files:** `apps/api/src/modules/genealogy`
- **Acceptance criteria:** Invalid lot returns a 4xx with a clear reason and writes no genealogy link.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

### OEE

#### MES-041 — Availability tile
- **Epic:** OEE
- **Objective:** Add one OEE availability tile for the selected line on the production view.
- **Probable files:** `apps/web/src/app/dashboard/production`, `apps/api/src/modules/oee`
- **Acceptance criteria:** Tile shows availability % for the current shift from the existing oee module.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-042 — Performance tile
- **Epic:** OEE
- **Objective:** Add an OEE performance tile sourced from runtime vs. ideal cycle.
- **Probable files:** `apps/web/src/app/dashboard/production`, `apps/api/src/modules/oee`
- **Acceptance criteria:** Tile shows performance % for the selected line and shift.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-043 — Quality factor tile
- **Epic:** OEE
- **Objective:** Add an OEE quality-factor tile driven by good vs. total quantity.
- **Probable files:** `apps/web/src/app/dashboard/production`, `apps/api/src/modules/oee`
- **Acceptance criteria:** Tile shows quality % consistent with the shift good/scrap totals.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-044 — Combined OEE score endpoint
- **Epic:** OEE
- **Objective:** Add one endpoint returning the combined OEE score for a line and shift.
- **Probable files:** `apps/api/src/modules/oee`
- **Acceptance criteria:** Endpoint returns A x P x Q with each factor, scoped to tenant and shift.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-045 — OEE trend sparkline
- **Epic:** OEE
- **Objective:** Add a single sparkline showing OEE over the last several shifts.
- **Probable files:** `apps/web/src/app/dashboard/production`, `apps/api/src/modules/oee`
- **Acceptance criteria:** Sparkline renders the last N shift scores; empty state when no history.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

### Downtime

#### MES-046 — Downtime reason-code button
- **Epic:** Downtime
- **Objective:** Add a Stop button that opens a reason-code picker to log a downtime event.
- **Probable files:** `apps/web/src/app/dashboard/operador`, `apps/api/src/modules/production-runtime`
- **Acceptance criteria:** Stop requires a reason code and opens a downtime event with start timestamp.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-047 — Resume from downtime action
- **Epic:** Downtime
- **Objective:** Add a Resume button that closes the open downtime event and resumes the run.
- **Probable files:** `apps/web/src/app/dashboard/operador`, `apps/api/src/modules/production-runtime`
- **Acceptance criteria:** Resume stamps the end timestamp, computes duration, and returns the job to RUNNING.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-048 — Changeover start/end capture
- **Epic:** Downtime
- **Objective:** Add a changeover toggle that records start and end against the existing changeover module.
- **Probable files:** `apps/web/src/app/dashboard/operador`, `apps/api/src/modules/changeover`
- **Acceptance criteria:** Toggle opens then closes one changeover record with duration.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-049 — Downtime Pareto tile
- **Epic:** Downtime
- **Objective:** Add a single tile ranking downtime reasons by total duration for the shift.
- **Probable files:** `apps/web/src/app/dashboard/production`, `apps/api/src/modules/production-runtime`
- **Acceptance criteria:** Tile lists top reason codes by minutes lost for the current shift.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-050 — Open-downtime banner on terminal
- **Epic:** Downtime
- **Objective:** Show a persistent banner while a downtime event is open on the operator terminal.
- **Probable files:** `apps/web/src/app/dashboard/operador`
- **Acceptance criteria:** Banner shows the open reason and elapsed time; clears on Resume.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

### Offline Mode

#### MES-051 — Local capture queue scaffold
- **Epic:** Offline Mode
- **Objective:** Add a client-side sync/replay queue that buffers terminal actions when offline.
- **Probable files:** `apps/web/src/app/dashboard/operador`
- **Acceptance criteria:** Actions enqueue locally while offline and persist across reload until replayed.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-052 — Online/offline status indicator
- **Epic:** Offline Mode
- **Objective:** Add a single connectivity indicator to the operator terminal header.
- **Probable files:** `apps/web/src/app/dashboard/operador`
- **Acceptance criteria:** Indicator reflects online/offline state and the count of queued actions.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-053 — Queue replay on reconnect
- **Epic:** Offline Mode
- **Objective:** Replay buffered actions from the sync/replay queue in order when connectivity returns.
- **Probable files:** `apps/web/src/app/dashboard/operador`, `apps/api/src/modules/mes-execution`
- **Acceptance criteria:** Queued actions replay sequentially on reconnect and dequeue on success.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-054 — Idempotent replay keys on endpoints
- **Epic:** Offline Mode
- **Objective:** Accept a client idempotency key on report endpoints so replayed actions are not double-counted.
- **Probable files:** `apps/api/src/modules/mes-execution`
- **Acceptance criteria:** Replaying an action with the same key returns the original result without duplicating the write.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### MES-055 — Replay conflict surface
- **Epic:** Offline Mode
- **Objective:** Surface failed replays from the sync/replay queue for operator review.
- **Probable files:** `apps/web/src/app/dashboard/operador`
- **Acceptance criteria:** Actions that fail replay are flagged in a small list with retry; successful ones leave the queue.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING
