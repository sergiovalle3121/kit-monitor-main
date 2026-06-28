# ANALYTICS / BI — Program Backlog

This program owns the AXOS decision layer: the control tower, operational and executive dashboards, a single-sourced KPI catalog, domain analytics (OEE, quality, cost, customer), forecasting, and exportable executive reports. The objective is to turn the existing operational data into trustworthy, fast, and reusable decision surfaces — not to invent new metric definitions per screen.

AXOS already exists. Before building anything here, INSPECT the existing analytics surfaces (`apps/api/src/modules/{analytics,quality-analytics,decision-intelligence,cost-intelligence,control-tower,customer-insights,oee,forecast}` and web routes `apps/web/src/app/dashboard/{reports,intelligence,control-tower,metrics}`). Extend those; never spin up a parallel screen. KPI definitions must be single-sourced — there is one definition of "OEE", "First Pass Yield", "Scrap %", etc., registered in the KPI catalog and reused everywhere rather than re-derived per tile or per report. Keep PRs small, functional, and green; `main` deploys to Railway, so never merge red.

## Epics

- **Control Tower** — real-time operational command surface and live tiles.
- **Dashboards** — configurable operational dashboards and reusable chart/tile components.
- **KPI Catalog** — single source of truth for metric definitions, units, and formulas.
- **Forecast** — demand/throughput forecasting surfaces and accuracy tracking.
- **OEE Analytics** — availability/performance/quality breakdowns and trends.
- **Quality Analytics** — defects, yield, SPC, and nonconformance analytics.
- **Cost Analytics** — cost intelligence, variance, and margin views.
- **Customer Analytics** — customer insights, demand mix, and segmentation.
- **Executive Reports** — scheduled, exportable, board-level reporting.

## Backlog

### KPI Catalog

#### ANL-001 — Define KPI catalog contract
- **Epic:** KPI Catalog
- **Objective:** Add a shared `KpiDefinition` DTO/type (id, name, unit, formula description, domain) to contracts.
- **Probable files:** `packages/contracts/src/analytics/kpi-definition.ts`, `packages/contracts/src/index.ts`
- **Acceptance criteria:** Type exported from contracts and importable by api and web; no runtime logic added.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

#### ANL-002 — KPI registry service skeleton
- **Epic:** KPI Catalog
- **Objective:** Add a read-only `KpiCatalogService` in the analytics module exposing the registered definitions.
- **Probable files:** `apps/api/src/modules/analytics/kpi-catalog.service.ts`, `apps/api/src/modules/analytics/analytics.module.ts`
- **Acceptance criteria:** Service returns the seeded definition list; registered in module providers.
- **Checks:** `git diff --check`; `npm run build`, analytics unit tests
- **Status:** PENDING

#### ANL-003 — Register OEE KPI definition
- **Epic:** KPI Catalog
- **Objective:** Register a single canonical "OEE" definition in the KPI catalog.
- **Probable files:** `apps/api/src/modules/analytics/kpi-catalog.service.ts`, `apps/api/src/modules/oee/oee.service.ts`
- **Acceptance criteria:** OEE appears once in the catalog; oee module references the catalog id rather than redefining the formula text.
- **Checks:** `git diff --check`; `npm run build`, oee tests
- **Status:** PENDING

#### ANL-004 — Register First Pass Yield KPI
- **Epic:** KPI Catalog
- **Objective:** Add a single "First Pass Yield" definition to the catalog.
- **Probable files:** `apps/api/src/modules/analytics/kpi-catalog.service.ts`, `apps/api/src/modules/quality-analytics/quality-analytics.service.ts`
- **Acceptance criteria:** FPY registered once; quality-analytics consumes the catalog id.
- **Checks:** `git diff --check`; `npm run build`, quality-analytics tests
- **Status:** PENDING

#### ANL-005 — Register Scrap % KPI
- **Epic:** KPI Catalog
- **Objective:** Add a canonical "Scrap %" definition to the catalog.
- **Probable files:** `apps/api/src/modules/analytics/kpi-catalog.service.ts`
- **Acceptance criteria:** Scrap % present exactly once with unit `%`.
- **Checks:** `git diff --check`; `npm run build`, analytics tests
- **Status:** PENDING

#### ANL-006 — KPI catalog API endpoint
- **Epic:** KPI Catalog
- **Objective:** Expose `GET /analytics/kpis` returning catalog definitions.
- **Probable files:** `apps/api/src/modules/analytics/analytics.controller.ts`, `apps/api/src/modules/analytics/kpi-catalog.service.ts`
- **Acceptance criteria:** Endpoint returns the definition list; tenant-scoped guard applied like sibling routes.
- **Checks:** `git diff --check`; `npm run build`, controller e2e
- **Status:** PENDING

#### ANL-007 — KPI catalog reference page
- **Epic:** KPI Catalog
- **Objective:** Add a read-only KPI reference list under metrics showing name/unit/definition.
- **Probable files:** `apps/web/src/app/dashboard/metrics/page.tsx`, `apps/web/src/app/dashboard/metrics/_components/kpi-catalog-list.tsx`
- **Acceptance criteria:** Page lists catalog KPIs from `GET /analytics/kpis`; no client-side metric math.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

#### ANL-008 — KPI catalog client hook
- **Epic:** KPI Catalog
- **Objective:** Add a `useKpiCatalog` data hook reused by tiles/dashboards.
- **Probable files:** `apps/web/src/app/dashboard/metrics/_hooks/use-kpi-catalog.ts`
- **Acceptance criteria:** Hook fetches and caches catalog; one tile consumes it as proof.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

### Control Tower

#### ANL-009 — Control tower live OEE tile
- **Epic:** Control Tower
- **Objective:** Add one OEE summary tile to the control tower using the catalog-backed OEE value.
- **Probable files:** `apps/web/src/app/dashboard/control-tower/page.tsx`, `apps/web/src/app/dashboard/control-tower/_components/oee-tile.tsx`
- **Acceptance criteria:** Tile renders OEE from the oee endpoint; no recomputed formula on the client.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

#### ANL-010 — Control tower active alarms count tile
- **Epic:** Control Tower
- **Objective:** Add a single tile showing current active alarm count.
- **Probable files:** `apps/web/src/app/dashboard/control-tower/_components/alarms-tile.tsx`, `apps/api/src/modules/control-tower/control-tower.service.ts`
- **Acceptance criteria:** Tile shows count from control-tower service; refreshes on existing poll interval.
- **Checks:** `git diff --check`; `npm run build`, control-tower tests
- **Status:** PENDING

#### ANL-011 — Control tower throughput tile
- **Epic:** Control Tower
- **Objective:** Add a current-shift throughput tile.
- **Probable files:** `apps/web/src/app/dashboard/control-tower/_components/throughput-tile.tsx`
- **Acceptance criteria:** Tile displays throughput for current shift from control-tower data.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

#### ANL-012 — Control tower tile auto-refresh interval
- **Epic:** Control Tower
- **Objective:** Make control tower refresh interval configurable via a single shared constant.
- **Probable files:** `apps/web/src/app/dashboard/control-tower/_components/use-control-tower-refresh.ts`
- **Acceptance criteria:** All tiles use one refresh hook/constant; default unchanged.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

#### ANL-013 — Control tower line status endpoint
- **Epic:** Control Tower
- **Objective:** Add `GET /control-tower/lines/status` returning per-line run/idle/down state.
- **Probable files:** `apps/api/src/modules/control-tower/control-tower.controller.ts`, `apps/api/src/modules/control-tower/control-tower.service.ts`
- **Acceptance criteria:** Endpoint returns line states; tenant-scoped; covered by a unit test.
- **Checks:** `git diff --check`; `npm run build`, control-tower e2e
- **Status:** PENDING

#### ANL-014 — Control tower line status strip
- **Epic:** Control Tower
- **Objective:** Render a compact per-line status strip from the new endpoint.
- **Probable files:** `apps/web/src/app/dashboard/control-tower/_components/line-status-strip.tsx`
- **Acceptance criteria:** Strip shows colored per-line states; consumes `GET /control-tower/lines/status`.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

### Dashboards

#### ANL-015 — Reusable KPI tile component
- **Epic:** Dashboards
- **Objective:** Extract one shared `KpiTile` (label, value, unit, delta) for reuse across dashboards.
- **Probable files:** `apps/web/src/app/dashboard/metrics/_components/kpi-tile.tsx`
- **Acceptance criteria:** Component renders label/value/unit; used by at least one existing tile to avoid duplication.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

#### ANL-016 — Shared time-range selector
- **Epic:** Dashboards
- **Objective:** Add one reusable time-range selector (today/7d/30d) for dashboard pages.
- **Probable files:** `apps/web/src/app/dashboard/metrics/_components/time-range-select.tsx`
- **Acceptance criteria:** Selector emits a normalized range value; wired into one dashboard.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

#### ANL-017 — Trend line chart wrapper
- **Epic:** Dashboards
- **Objective:** Add a single reusable trend line chart wrapper around the existing chart lib.
- **Probable files:** `apps/web/src/app/dashboard/metrics/_components/trend-chart.tsx`
- **Acceptance criteria:** Wrapper renders a time series from props; one dashboard uses it.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

#### ANL-018 — Metrics overview KPI row
- **Epic:** Dashboards
- **Objective:** Compose a single KPI row (OEE, FPY, Scrap %) on the metrics page using catalog values.
- **Probable files:** `apps/web/src/app/dashboard/metrics/page.tsx`
- **Acceptance criteria:** Row shows three catalog-backed tiles; no inline metric math.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

#### ANL-019 — Empty/loading state for dashboard tiles
- **Epic:** Dashboards
- **Objective:** Add consistent loading and empty states to the KPI tile component.
- **Probable files:** `apps/web/src/app/dashboard/metrics/_components/kpi-tile.tsx`
- **Acceptance criteria:** Tile shows skeleton while loading and a clear empty state when no data.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

#### ANL-020 — Dashboard data hook for KPI value
- **Epic:** Dashboards
- **Objective:** Add a `useKpiValue(kpiId, range)` hook resolving a single catalog KPI value.
- **Probable files:** `apps/web/src/app/dashboard/metrics/_hooks/use-kpi-value.ts`
- **Acceptance criteria:** Hook returns value+unit from analytics endpoint keyed by catalog id.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

### Forecast

#### ANL-021 — Forecast accuracy KPI registration
- **Epic:** Forecast
- **Objective:** Register a single "Forecast Accuracy (MAPE)" KPI in the catalog.
- **Probable files:** `apps/api/src/modules/analytics/kpi-catalog.service.ts`, `apps/api/src/modules/forecast/forecast.service.ts`
- **Acceptance criteria:** MAPE KPI present once; forecast module references the catalog id.
- **Checks:** `git diff --check`; `npm run build`, forecast tests
- **Status:** PENDING

#### ANL-022 — Forecast vs actual endpoint
- **Epic:** Forecast
- **Objective:** Add `GET /forecast/vs-actual` returning forecast and actual series for a range.
- **Probable files:** `apps/api/src/modules/forecast/forecast.controller.ts`, `apps/api/src/modules/forecast/forecast.service.ts`
- **Acceptance criteria:** Endpoint returns aligned series; tenant-scoped; unit tested.
- **Checks:** `git diff --check`; `npm run build`, forecast e2e
- **Status:** PENDING

#### ANL-023 — Forecast vs actual chart
- **Epic:** Forecast
- **Objective:** Render forecast vs actual using the shared trend chart on the intelligence route.
- **Probable files:** `apps/web/src/app/dashboard/intelligence/_components/forecast-vs-actual-chart.tsx`
- **Acceptance criteria:** Chart overlays both series from `GET /forecast/vs-actual`; reuses `TrendChart`.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

### OEE Analytics

#### ANL-024 — OEE breakdown endpoint
- **Epic:** OEE Analytics
- **Objective:** Add `GET /oee/breakdown` returning availability/performance/quality components.
- **Probable files:** `apps/api/src/modules/oee/oee.controller.ts`, `apps/api/src/modules/oee/oee.service.ts`
- **Acceptance criteria:** Endpoint returns three components consistent with the catalog OEE definition.
- **Checks:** `git diff --check`; `npm run build`, oee e2e
- **Status:** PENDING

#### ANL-025 — OEE breakdown chart
- **Epic:** OEE Analytics
- **Objective:** Render an OEE component breakdown chart on the metrics route.
- **Probable files:** `apps/web/src/app/dashboard/metrics/_components/oee-breakdown-chart.tsx`
- **Acceptance criteria:** Chart shows A/P/Q from `GET /oee/breakdown`; no client recomputation.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

#### ANL-026 — OEE query index review
- **Epic:** OEE Analytics
- **Objective:** Add/verify a single DB index supporting the OEE breakdown query.
- **Probable files:** `apps/api/src/modules/oee/entities/oee-record.entity.ts`, `apps/api/src/migrations/*`
- **Acceptance criteria:** Index migration added; breakdown query uses it (EXPLAIN noted in PR).
- **Checks:** `git diff --check`; `npm run build`, migration runs clean
- **Status:** PENDING

### Quality Analytics

#### ANL-027 — Defect Pareto endpoint
- **Epic:** Quality Analytics
- **Objective:** Add `GET /quality-analytics/defects/pareto` returning top defect categories by count.
- **Probable files:** `apps/api/src/modules/quality-analytics/quality-analytics.controller.ts`, `apps/api/src/modules/quality-analytics/quality-analytics.service.ts`
- **Acceptance criteria:** Endpoint returns ordered categories with counts; tenant-scoped; unit tested.
- **Checks:** `git diff --check`; `npm run build`, quality-analytics e2e
- **Status:** PENDING

#### ANL-028 — Defect Pareto chart
- **Epic:** Quality Analytics
- **Objective:** Render a defect Pareto chart in the reports quality section.
- **Probable files:** `apps/web/src/app/dashboard/reports/quality/_components/defect-pareto-chart.tsx`
- **Acceptance criteria:** Chart shows top defects from the Pareto endpoint; reuses chart wrapper.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

#### ANL-029 — Yield trend tile (catalog FPY)
- **Epic:** Quality Analytics
- **Objective:** Add a yield trend tile fed by the catalog FPY KPI.
- **Probable files:** `apps/web/src/app/dashboard/reports/quality/_components/yield-trend-tile.tsx`
- **Acceptance criteria:** Tile renders FPY trend using the catalog id; no inline yield math.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

### Cost Analytics

#### ANL-030 — Cost variance KPI registration
- **Epic:** Cost Analytics
- **Objective:** Register a single "Cost Variance" KPI in the catalog.
- **Probable files:** `apps/api/src/modules/analytics/kpi-catalog.service.ts`, `apps/api/src/modules/cost-intelligence/cost-intelligence.service.ts`
- **Acceptance criteria:** Cost Variance present once; cost-intelligence references the catalog id.
- **Checks:** `git diff --check`; `npm run build`, cost-intelligence tests
- **Status:** PENDING

#### ANL-031 — Cost by category endpoint
- **Epic:** Cost Analytics
- **Objective:** Add `GET /cost-intelligence/by-category` returning cost grouped by category.
- **Probable files:** `apps/api/src/modules/cost-intelligence/cost-intelligence.controller.ts`, `apps/api/src/modules/cost-intelligence/cost-intelligence.service.ts`
- **Acceptance criteria:** Endpoint returns grouped totals; tenant-scoped; unit tested.
- **Checks:** `git diff --check`; `npm run build`, cost-intelligence e2e
- **Status:** PENDING

#### ANL-032 — Cost breakdown tile
- **Epic:** Cost Analytics
- **Objective:** Add a cost-by-category tile on the intelligence route.
- **Probable files:** `apps/web/src/app/dashboard/intelligence/_components/cost-by-category-tile.tsx`
- **Acceptance criteria:** Tile renders category totals from the new endpoint.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

### Customer Analytics

#### ANL-033 — Customer demand mix endpoint
- **Epic:** Customer Analytics
- **Objective:** Add `GET /customer-insights/demand-mix` returning volume share by customer.
- **Probable files:** `apps/api/src/modules/customer-insights/customer-insights.controller.ts`, `apps/api/src/modules/customer-insights/customer-insights.service.ts`
- **Acceptance criteria:** Endpoint returns share by customer; tenant-scoped; unit tested.
- **Checks:** `git diff --check`; `npm run build`, customer-insights e2e
- **Status:** PENDING

#### ANL-034 — Customer demand mix chart
- **Epic:** Customer Analytics
- **Objective:** Render a customer demand mix chart on the intelligence route.
- **Probable files:** `apps/web/src/app/dashboard/intelligence/_components/demand-mix-chart.tsx`
- **Acceptance criteria:** Chart shows share by customer from the demand-mix endpoint; reuses chart wrapper.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

#### ANL-035 — Top customers tile
- **Epic:** Customer Analytics
- **Objective:** Add a top-N customers tile by volume.
- **Probable files:** `apps/web/src/app/dashboard/intelligence/_components/top-customers-tile.tsx`
- **Acceptance criteria:** Tile lists top customers from customer-insights data.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

### Executive Reports

#### ANL-036 — Executive KPI summary endpoint
- **Epic:** Executive Reports
- **Objective:** Add `GET /reports/executive/summary` aggregating catalog KPIs for a period.
- **Probable files:** `apps/api/src/modules/analytics/analytics.controller.ts`, `apps/api/src/modules/analytics/analytics.service.ts`
- **Acceptance criteria:** Endpoint returns the canonical KPI set from the catalog; tenant-scoped; unit tested.
- **Checks:** `git diff --check`; `npm run build`, analytics e2e
- **Status:** PENDING

#### ANL-037 — Executive report page shell
- **Epic:** Executive Reports
- **Objective:** Add an executive summary view under reports composing existing tiles.
- **Probable files:** `apps/web/src/app/dashboard/reports/_components/executive-summary.tsx`, `apps/web/src/app/dashboard/reports/reports.types.ts`
- **Acceptance criteria:** View renders the executive summary from the new endpoint; reuses `KpiTile`.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

#### ANL-038 — Executive report PDF export fidelity
- **Epic:** Executive Reports
- **Objective:** Wire the executive summary into the existing reports export with correct units/labels.
- **Probable files:** `apps/web/src/app/dashboard/reports/reports.utils.ts`, `apps/web/src/app/dashboard/reports/_components/executive-summary.tsx`
- **Acceptance criteria:** Exported file shows the same KPI values/units as the screen (no rounding drift).
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

#### ANL-039 — Executive report CSV export
- **Epic:** Executive Reports
- **Objective:** Add a CSV export of the executive KPI summary reusing existing export utils.
- **Probable files:** `apps/web/src/app/dashboard/reports/reports.utils.ts`
- **Acceptance criteria:** CSV contains one row per catalog KPI with value and unit; reuses shared util.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING

#### ANL-040 — Executive report period selector
- **Epic:** Executive Reports
- **Objective:** Wire the shared time-range selector into the executive report view.
- **Probable files:** `apps/web/src/app/dashboard/reports/_components/executive-summary.tsx`
- **Acceptance criteria:** Changing range refetches the summary endpoint; reuses `TimeRangeSelect`.
- **Checks:** `git diff --check`; `npm run build`
- **Status:** PENDING
