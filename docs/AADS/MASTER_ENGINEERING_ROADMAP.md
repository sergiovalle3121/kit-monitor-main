# AXOS OS — Master Engineering Roadmap

The eight programs that organize all AADS work. Each program owns a slice of the
product, has a dedicated backlog in [`PROGRAMS/`](PROGRAMS/), and feeds the
[`QUEUES/CODEX_QUEUE.md`](QUEUES/CODEX_QUEUE.md).

> **Status legend** — 🟢 mature / shipped · 🟡 partial / in progress · 🔴 early / thin.
> Status is *estimated* from the current module + route inventory and must be
> re-verified by inspection before any PR (rule #2: inspect before create).

| # | Program | Status | Primary code home |
|---|---------|--------|-------------------|
| 1 | OFFICE | 🟡 | `apps/web/src/app/dashboard/office`, `apps/api/src/modules/office`, `components/office` |
| 2 | CAD | 🟡 | `apps/web/src/components/line-engineering`, `apps/web/src/lib/cad`, `apps/api/src/modules/line-engineering` |
| 3 | MES / SHOP FLOOR | 🟢 | `apps/api/src/modules/{operator-terminal,mes-execution,oee,genealogy,floor-quality}` |
| 4 | ERP CORE | 🟢 | `apps/api/src/modules/{erp-core,mrp,procurement,inventory,accounting}` |
| 5 | CRM / COMMERCIAL | 🟡 | `apps/api/src/modules/{crm,customer-insights}`, `dashboard/{crm,customers}` |
| 6 | AI / CIDE | 🟡 | `apps/api/src/modules/{ai,semantic,governance}`, `components/Cide.tsx` |
| 7 | ANALYTICS / BI | 🟡 | `apps/api/src/modules/{analytics,quality-analytics,decision-intelligence}`, `dashboard/reports` |
| 8 | PLATFORM | 🟢 | `apps/api/src/modules/{auth,users,event-ledger,notifications}`, `infra/` |

---

## 1. OFFICE

**Objective.** A premium, collaborative office suite (Docs, Sheets, Slides) plus a
document library, embedded in AXOS so industrial knowledge (work instructions,
SOPs, quotes, reports) is authored and stored in-platform.

**Estimated state.** 🟡 Partial. There is a working `office` backend module, a
`dashboard/office/[id]` editor route, `components/office`, and existing
slides/sheets/docs roadmaps in `/docs`. Collaboration, search and permissions are
the thinnest areas.

**Risks.**
- Real-time collaboration (CRDT/OT) is hard and easy to get subtly wrong.
- Import/export fidelity (DOCX/XLSX/PPTX) is a long tail of edge cases.
- Document permissions must reconcile with platform RBAC, not invent a parallel model.

**Existing modules to inspect.** `apps/api/src/modules/office`,
`apps/web/src/app/dashboard/office`, `apps/web/src/components/office`,
`apps/web/src/app/dev/pptx-*`, `docs/axos-docs-roadmap.md`,
`docs/axos-sheets-industrial-roadmap.md`, `docs/office-slides-roadmap.md`.

**Main epics.** Docs · Sheets · Slides · Document Library · Collaboration ·
Import/Export · Templates · Search · Permissions/Audit.

**Next 10 suggested PRs.**
1. Document Library list view with tenant-scoped filtering.
2. Doc autosave + version snapshot on idle.
3. Sheets: formula bar with `SUM`/`AVG`/`IF` evaluation.
4. Slides: thumbnail rail + reorder.
5. Templates gallery (read-only) backed by `office` module.
6. Office search wired into the global `SearchPalette`.
7. DOCX export for a single Doc.
8. Document share dialog reusing platform RBAC roles.
9. Presence indicators (who's viewing) via existing notifications channel.
10. Audit-log every document open/edit/share to the Event Ledger.

➡ Full backlog: [`PROGRAMS/OFFICE.md`](PROGRAMS/OFFICE.md)

---

## 2. CAD

**Objective.** An AI-assisted 2D CAD / factory-layout tool: a CAD Copilot driven by
OpenAI-compatible (CIDE) commands, a command engine, snapping/layers/measurements,
DXF import/export, symbol libraries and flow optimization for line design.

**Estimated state.** 🟡 Partial. A real CAD command/intent/vision pipeline exists
in `components/line-engineering` (`cad-command`, `cad-intent`, `cad-vision`) plus
`lib/cad` and the API `line-engineering/cad-intent.service.ts`. Geometry tooling
(snapping, layers, DXF) is the area to grow.

**Risks.**
- Geometry/numerical correctness (snapping, measurement units) is unforgiving.
- DXF round-trip fidelity across CAD tools is a deep rabbit hole.
- Copilot commands must be deterministic and reversible (undo) to be trusted.

**Existing modules to inspect.** `apps/web/src/components/line-engineering/cad-*`,
`apps/web/src/lib/cad`, `apps/api/src/modules/line-engineering`,
`apps/api/src/modules/bay-layout`, `apps/api/src/modules/visual-aids`,
`docs/cad-copilot-command-contract.md`, `docs/cad-tool-summary.md`,
`docs/cad-roadmap-fase-66-69.md`.

**Main epics.** CAD Copilot · Command Engine · 2D Layout · Snapping/Grid · Layers ·
Measurements · DXF Import/Export · Symbols · Factory Layout · Flow Optimization ·
CIDE commands.

**Next 10 suggested PRs.**
1. Grid + snap-to-grid toggle on the 2D canvas.
2. Snap-to-endpoint / midpoint for line tools.
3. Layer panel (create/rename/toggle visibility).
4. Distance measurement tool with unit display.
5. Command palette listing supported CAD commands.
6. Undo/redo stack for the command engine.
7. Symbol library panel (insert reusable blocks).
8. DXF import (lines + polylines) → canvas entities.
9. CAD Copilot: "draw a conveyor of length N" intent.
10. Persist layout to `bay-layout` with `tenant_id`.

➡ Full backlog: [`PROGRAMS/CAD.md`](PROGRAMS/CAD.md)

---

## 3. MES / SHOP FLOOR

**Objective.** The execution layer on the floor: operator terminal, supervisor
console, andon, work instructions, quality capture, material requests, genealogy,
OEE, downtime and offline resilience.

**Estimated state.** 🟢 Mature. Backend has `operator-terminal`, `mes-execution`,
`oee`, `genealogy`, `floor-quality`, `material-requests`, `changeover`,
`production-runtime`, `live`. Strongest program in the platform; work is depth +
offline + andon polish.

**Risks.**
- Offline mode + sync conflicts on shared floor devices.
- Real-time andon latency under load.
- Quality capture must write immutable genealogy/ledger records correctly.

**Existing modules to inspect.** `apps/api/src/modules/{operator-terminal,
mes-execution,oee,genealogy,floor-quality,material-requests,changeover,
production-runtime,live,alerts}`, `apps/web/src/app/dashboard/{operador,
production,live,floor-quality,genealogy,material-staging}`,
`docs/operator-terminal-roadmap.md`.

**Main epics.** Operator Terminal · Supervisor Console · Andon · Work Instructions ·
Quality Capture · Material Requests · Genealogy · OEE · Downtime · Offline Mode.

**Next 10 suggested PRs.**
1. Operator terminal: large-button "start/stop unit" with confirm.
2. Downtime reason-code capture on stop.
3. Andon raise/ack flow over the notifications channel.
4. Supervisor console live tile per line (status + count).
5. Work instruction viewer pinned to active WO.
6. Quality capture: pass/fail with defect-code picker.
7. Material request button from the terminal → `material-requests`.
8. OEE availability widget on supervisor console.
9. Genealogy lookup by serial.
10. Offline queue for unit completions with replay on reconnect.

➡ Full backlog: [`PROGRAMS/MES.md`](PROGRAMS/MES.md)

---

## 4. ERP CORE

**Objective.** The transactional backbone: MRP, procurement, suppliers, inventory,
finance, costing, planning, warehouse, receiving and shipping.

**Estimated state.** 🟢 Mature. Backend has `mrp`, `procurement`, `suppliers`,
`inventory`, `accounting`, `product-costing`, `cost-rollup`, `purchase-planning`,
`receiving`, `shipping`, `inbound`, `outbound`, `packing`, `material-master`.
Broad and deep; work is connecting flows and finance polish.

**Risks.**
- Costing/finance correctness — rounding, currency, period close.
- MRP performance on large BOM explosions.
- Inventory accuracy under concurrent transactions.

**Existing modules to inspect.** `apps/api/src/modules/{mrp,procurement,suppliers,
inventory,accounting,product-costing,cost-rollup,purchase-planning,receiving,
shipping,inbound,outbound,packing,material-master,numbering}`,
`apps/web/src/app/dashboard/{mrp,procurement,suppliers,inventory,finance,
receiving,shipping,warehouse,almacen}`.

**Main epics.** MRP · Procurement · Suppliers · Inventory · Finance · Costing ·
Planning · Warehouse · Receiving · Shipping.

**Next 10 suggested PRs.**
1. MRP run summary view (planned orders count + shortages).
2. Procurement: create PO from a planned order.
3. Supplier detail page with on-time-delivery KPI.
4. Inventory adjustment with reason code → Event Ledger.
5. Receiving: scan-to-receive against a PO line.
6. Warehouse bin transfer transaction.
7. Costing: standard-cost rollup display for a model.
8. Finance: AP open-items list.
9. Shipping: packing-list generation for a WO.
10. Planning: WO readiness indicator (material availability).

➡ Full backlog: [`PROGRAMS/ERP.md`](PROGRAMS/ERP.md)

---

## 5. CRM / COMMERCIAL

**Objective.** The commercial front: customer 360, accounts, contacts,
opportunities, RFQ/quote, a customer portal, service/tickets, forecast and
commercial analytics.

**Estimated state.** 🟡 Partial. Backend `crm` and `customer-insights` exist with
`dashboard/crm` and `dashboard/customers` routes plus `docs/commercial-suite.md`.
Quoting, portal and service are the growth areas.

**Risks.**
- RFQ→quote→order handoff must reuse ERP pricing/costing, not duplicate it.
- A customer portal introduces external-facing auth surface (security).
- Forecast accuracy and its reconciliation with planning.

**Existing modules to inspect.** `apps/api/src/modules/{crm,customer-insights,
forecast,rma}`, `apps/web/src/app/dashboard/{crm,customers,forecast,rma}`,
`apps/web/src/components/erp`, `docs/commercial-suite.md`.

**Main epics.** Customer 360 · Accounts · Contacts · Opportunities · RFQ/Quote ·
Customer Portal · Service/Tickets · Forecast · Commercial Analytics.

**Next 10 suggested PRs.**
1. Customer 360 header card (account + key KPIs).
2. Accounts list with search + tenant scope.
3. Contacts CRUD under an account.
4. Opportunity pipeline kanban (stages).
5. RFQ intake form → draft quote.
6. Quote line pricing pulled from costing module.
7. Service ticket create + status flow.
8. Forecast vs actual chart for a customer.
9. Commercial analytics: win-rate tile.
10. Customer activity timeline from Event Ledger.

➡ Full backlog: [`PROGRAMS/CRM.md`](PROGRAMS/CRM.md)

---

## 6. AI / CIDE

**Objective.** The AI layer — CIDE tools, function calling, a semantic layer,
analytics narratives, and domain copilots (CAD, Office, MES, ERP) — with governance
and safety as a first-class concern.

**Estimated state.** 🟡 Partial. Backend `ai` module (`ai-tools.service`,
`cide-provider`, `ai-cards`, `ai-pricing`), `semantic` and `governance` modules,
plus `components/Cide.tsx` and `ChatWidget`. Copilots exist per domain (CAD already
real); the unifying tool/governance layer is the work.

**Risks.**
- Function-calling tools must be permission-checked (a copilot must not bypass RBAC).
- Hallucinated actions on transactional data — needs confirm/undo + audit.
- Cost control and provider abstraction (CIDE = OpenAI-compatible).

**Existing modules to inspect.** `apps/api/src/modules/{ai,semantic,governance,
decision-intelligence}`, `apps/web/src/components/{Cide.tsx,ChatWidget.tsx,chat}`,
`apps/web/src/app/api/ai`, `apps/api/src/modules/ai/README.md`,
`docs/cad-copilot-command-contract.md`.

**Main epics.** CIDE Tools · Function Calling · Semantic Layer · Analytics
Narratives · CAD Copilot · Office Copilot · MES Copilot · ERP Copilot ·
Governance/Safety.

**Next 10 suggested PRs.**
1. CIDE tool registry with JSON-schema definitions.
2. Function-calling executor that enforces RBAC per tool.
3. Semantic layer: register one domain entity for NL query.
4. Analytics narrative: summarize a dashboard KPI in prose.
5. Office copilot: "summarize this doc" action.
6. MES copilot: "why is line X down?" reading live + downtime.
7. ERP copilot: "show shortages for WO N".
8. Governance: per-tenant model/provider config.
9. Safety: confirm-before-write guard on transactional tools.
10. Audit every AI tool invocation to the Event Ledger.

➡ Full backlog: [`PROGRAMS/AI_CIDE.md`](PROGRAMS/AI_CIDE.md)

---

## 7. ANALYTICS / BI

**Objective.** The decision layer: a control tower, dashboards, a KPI catalog,
forecast, and analytics across OEE, quality, cost and customers, plus executive
reports.

**Estimated state.** 🟡 Partial. Backend `analytics`, `quality-analytics`,
`decision-intelligence`, `cost-intelligence`, `control-tower`, `customer-insights`
exist with `dashboard/{reports,intelligence,control-tower,metrics}` routes. A
unified KPI catalog and executive reporting are the gaps.

**Risks.**
- KPI definitions must be single-sourced (one definition of "OEE", not five).
- Query performance on aggregate dashboards over large datasets.
- Report export fidelity (PDF/Excel).

**Existing modules to inspect.** `apps/api/src/modules/{analytics,quality-analytics,
decision-intelligence,cost-intelligence,control-tower,customer-insights,oee,
forecast}`, `apps/web/src/app/dashboard/{reports,intelligence,control-tower,
metrics}`.

**Main epics.** Control Tower · Dashboards · KPI Catalog · Forecast · OEE
Analytics · Quality Analytics · Cost Analytics · Customer Analytics · Executive
Reports.

**Next 10 suggested PRs.**
1. KPI catalog backend: register a KPI with its formula + source.
2. Control tower tile reading a catalog KPI.
3. Dashboard date-range filter shared component.
4. OEE trend chart (availability/performance/quality).
5. Quality analytics: defect Pareto chart.
6. Cost analytics: cost-per-unit by model.
7. Customer analytics: revenue by customer.
8. Forecast vs actual reconciliation view.
9. Executive report: one-page plant summary.
10. PDF export of a report page.

➡ Full backlog: [`PROGRAMS/ANALYTICS.md`](PROGRAMS/ANALYTICS.md)

---

## 8. PLATFORM

**Objective.** The cross-cutting foundation everything else stands on: auth/RBAC,
multi-tenancy, search, notifications, audit/event ledger, settings, API standards,
CI/CD, performance and observability.

**Estimated state.** 🟢 Mature. Backend `auth`, `users`, `event-ledger`,
`notifications`, `numbering`, `governance`; web `middleware.ts`, `WorkspaceGuard`,
`SearchPalette`, `TCodePalette`; `infra/` and CI in `.github`. Solid; work is
hardening, standards and observability.

**Risks.**
- Tenant isolation regressions are the highest-severity class of bug.
- Auth/RBAC changes touch every module — blast radius is large.
- CI/CD changes can break the Railway deploy path.

**Existing modules to inspect.** `apps/api/src/modules/{auth,users,event-ledger,
notifications,numbering,governance,import-data}`, `apps/web/src/middleware.ts`,
`apps/web/src/components/{WorkspaceGuard.tsx,SearchPalette.tsx,TCodePalette.tsx,
searchSources.ts}`, `infra/`, `.github/`, `packages/contracts`.

**Main epics.** Auth/RBAC · Multi-tenancy · Search · Notifications · Audit/Event
Ledger · Settings · API Standards · CI/CD · Performance · Observability.

**Next 10 suggested PRs.**
1. RBAC: centralize role/permission checks in one guard.
2. Tenant-scope assertion helper used by all repositories.
3. Global search source registry extension API.
4. Notification preference settings per user.
5. Event Ledger query API with filters.
6. Settings page scaffold (tenant + user).
7. API standards doc + a shared response envelope.
8. CI: cache the build to speed `Build·Test·Lint·Smoke`.
9. Performance: add DB indexes for hottest queries.
10. Observability: structured request logging + request-id.

➡ Full backlog: [`PROGRAMS/PLATFORM.md`](PROGRAMS/PLATFORM.md)
