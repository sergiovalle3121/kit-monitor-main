# ERP CORE — Program Backlog

The ERP Core is the transactional backbone of AXOS OS: it moves material, money, and supply signals through MRP, procurement, inventory, costing, and finance for every tenant. Each item below is a small, incremental PR meant to extend the existing modules — never to spin up a parallel screen or a second source of truth.

> INSPECT BEFORE YOU BUILD. AXOS already ships `apps/api/src/modules/{mrp,procurement,suppliers,inventory,accounting,product-costing,cost-rollup,purchase-planning,receiving,shipping,inbound,outbound,packing,material-master,numbering,pick-lists,kits,cycle-counts}` and web routes under `apps/web/src/app/dashboard/{mrp,procurement,suppliers,inventory,finance,receiving,shipping,warehouse,almacen,production-plan}` plus `apps/web/src/components/erp`. Read the relevant module first, reuse costing/pricing/numbering rather than re-implementing, and route all inventory adjustments and financial actions through the Event Ledger at `apps/api/src/modules/event-ledger`. Small + functional + green; `main` deploys to Railway, so never merge red.

## Epics

- **MRP** — material requirements planning, demand/supply netting, planned orders.
- **Procurement** — purchase orders, approvals, supplier pricing.
- **Suppliers** — supplier master, contacts, performance.
- **Inventory** — stock levels, adjustments, lots, locations.
- **Finance** — accounting postings, periods, AP/AR, ledger.
- **Costing** — product costing, cost rollups, variances.
- **Planning** — purchase planning, production plan, capacity signals.
- **Warehouse** — warehouse layout, pick lists, kits, cycle counts.
- **Receiving** — inbound, receiving, putaway.
- **Shipping** — outbound, packing, dispatch.

## Backlog

### MRP

#### ERP-001 — MRP run summary KPI tile
- **Epic:** MRP
- **Objective:** Add a single KPI tile on the MRP dashboard showing the count of open planned orders from the latest run.
- **Probable files:** `apps/web/src/app/dashboard/mrp`, `apps/web/src/components/erp`
- **Acceptance criteria:** Tile renders a numeric count sourced from the existing MRP endpoint; no new screen added.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-002 — Planned order list endpoint filter by item
- **Epic:** MRP
- **Objective:** Add an optional `materialId` query filter to the existing planned orders list endpoint.
- **Probable files:** `apps/api/src/modules/mrp`, `packages/contracts`
- **Acceptance criteria:** Request with `materialId` returns only that item's planned orders; omitting it preserves current behavior.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-003 — Net requirements detail drawer
- **Epic:** MRP
- **Objective:** Add a read-only drawer that shows gross/net requirement breakdown for one selected material.
- **Probable files:** `apps/web/src/app/dashboard/mrp`, `apps/web/src/components/erp`
- **Acceptance criteria:** Selecting a row opens a drawer listing demand, supply, and net for that material; closes cleanly.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-004 — Lead-time field on planned order view
- **Epic:** MRP
- **Objective:** Surface the existing material lead time on the planned order detail view by reusing material-master data.
- **Probable files:** `apps/api/src/modules/mrp`, `apps/api/src/modules/material-master`
- **Acceptance criteria:** Planned order DTO includes `leadTimeDays` read from material-master; value matches the material record.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-005 — Convert planned order to PO action
- **Epic:** MRP
- **Objective:** Add a single action that creates a draft purchase order from one planned order via the existing procurement service.
- **Probable files:** `apps/api/src/modules/mrp`, `apps/api/src/modules/procurement`
- **Acceptance criteria:** Action produces one draft PO with matching item/qty; reuses procurement creation, does not duplicate logic.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

### Procurement

#### ERP-006 — PO status badge component reuse
- **Epic:** Procurement
- **Objective:** Reuse the shared status badge for PO state on the procurement list instead of inline text.
- **Probable files:** `apps/web/src/app/dashboard/procurement`, `apps/web/src/components/erp`
- **Acceptance criteria:** PO rows render the shared badge; no new badge component created.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-007 — PO approval endpoint
- **Epic:** Procurement
- **Objective:** Add one endpoint to transition a PO from draft to approved.
- **Probable files:** `apps/api/src/modules/procurement`, `packages/contracts`
- **Acceptance criteria:** Endpoint sets status to approved only from draft; invalid transitions rejected with 400.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-008 — PO line total rounding fix
- **Epic:** Procurement
- **Objective:** Ensure PO line totals round to the tenant currency precision in one calculation path.
- **Probable files:** `apps/api/src/modules/procurement`, `apps/api/src/modules/product-costing`
- **Acceptance criteria:** Line totals round half-up to currency decimals; reuses shared rounding helper.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-009 — Supplier price lookup on PO line
- **Epic:** Procurement
- **Objective:** Default a PO line unit price from the existing supplier pricing rather than manual entry.
- **Probable files:** `apps/api/src/modules/procurement`, `apps/api/src/modules/suppliers`
- **Acceptance criteria:** New PO line prefills price from supplier pricing when available; reuses pricing source.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-010 — Open PO count KPI tile
- **Epic:** Procurement
- **Objective:** Add a KPI tile showing the number of open purchase orders.
- **Probable files:** `apps/web/src/app/dashboard/procurement`, `apps/web/src/components/erp`
- **Acceptance criteria:** Tile shows open PO count from existing endpoint; no parallel page.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-011 — PO number generation via numbering module
- **Epic:** Procurement
- **Objective:** Route new PO numbers through the shared numbering module instead of ad hoc generation.
- **Probable files:** `apps/api/src/modules/procurement`, `apps/api/src/modules/numbering`
- **Acceptance criteria:** New POs receive a number from the numbering service; sequence is gapless per tenant.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

### Suppliers

#### ERP-012 — Supplier list search by name
- **Epic:** Suppliers
- **Objective:** Add a name search filter to the existing supplier list endpoint.
- **Probable files:** `apps/api/src/modules/suppliers`, `packages/contracts`
- **Acceptance criteria:** Partial name query returns matching suppliers; empty query returns full list.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-013 — Supplier contact subform
- **Epic:** Suppliers
- **Objective:** Add a single contact entry form to the existing supplier detail screen.
- **Probable files:** `apps/web/src/app/dashboard/suppliers`, `apps/api/src/modules/suppliers`
- **Acceptance criteria:** One contact can be added and persists on the supplier; existing layout reused.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-014 — Supplier on-time delivery KPI tile
- **Epic:** Suppliers
- **Objective:** Add a KPI tile for supplier on-time delivery percentage on the supplier detail.
- **Probable files:** `apps/web/src/app/dashboard/suppliers`, `apps/api/src/modules/suppliers`
- **Acceptance criteria:** Tile shows on-time percentage computed from receiving data; reads existing receipts.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-015 — Supplier active/inactive toggle endpoint
- **Epic:** Suppliers
- **Objective:** Add one endpoint to toggle a supplier active flag.
- **Probable files:** `apps/api/src/modules/suppliers`, `packages/contracts`
- **Acceptance criteria:** Toggling updates the flag; inactive suppliers excluded from default list.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-016 — Supplier lead-time field on detail
- **Epic:** Suppliers
- **Objective:** Display the supplier default lead time on the detail view.
- **Probable files:** `apps/web/src/app/dashboard/suppliers`, `apps/api/src/modules/suppliers`
- **Acceptance criteria:** Lead-time value renders from the supplier record; no new endpoint.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

### Inventory

#### ERP-017 — Stock-on-hand list filter by location
- **Epic:** Inventory
- **Objective:** Add a location filter to the existing stock-on-hand list endpoint.
- **Probable files:** `apps/api/src/modules/inventory`, `packages/contracts`
- **Acceptance criteria:** Location query returns only that location's stock; omitting returns all.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-018 — Single inventory adjustment transaction
- **Epic:** Inventory
- **Objective:** Add one endpoint to post a manual quantity adjustment for a single item/location.
- **Probable files:** `apps/api/src/modules/inventory`, `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Adjustment updates on-hand and writes one Event Ledger entry; reason required.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-019 — Lot expiry column on inventory list
- **Epic:** Inventory
- **Objective:** Surface lot expiry date on the inventory list rows.
- **Probable files:** `apps/web/src/app/dashboard/inventory`, `apps/api/src/modules/inventory`
- **Acceptance criteria:** Expiry date renders per lot row; uses existing lot data.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-020 — Low-stock KPI tile
- **Epic:** Inventory
- **Objective:** Add a KPI tile counting items below reorder point.
- **Probable files:** `apps/web/src/app/dashboard/inventory`, `apps/web/src/components/erp`
- **Acceptance criteria:** Tile shows count of items under reorder point from existing data.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-021 — Inventory move between locations
- **Epic:** Inventory
- **Objective:** Add one transaction to move quantity from one location to another for a single item.
- **Probable files:** `apps/api/src/modules/inventory`, `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Move decrements source and increments destination atomically; one ledger pair written.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-022 — Negative stock guard on adjustment
- **Epic:** Inventory
- **Objective:** Reject adjustments that would drive on-hand below zero unless tenant allows negative stock.
- **Probable files:** `apps/api/src/modules/inventory`
- **Acceptance criteria:** Disallowed negative result returns 400; allowed tenants proceed.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-023 — Cycle count variance display
- **Epic:** Inventory
- **Objective:** Show counted-vs-system variance on the existing cycle count detail.
- **Probable files:** `apps/web/src/app/dashboard/inventory`, `apps/api/src/modules/cycle-counts`
- **Acceptance criteria:** Variance column renders per line; computed from existing count data.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-024 — Post cycle count adjustment to ledger
- **Epic:** Inventory
- **Objective:** Add an action to apply a cycle count variance as an inventory adjustment.
- **Probable files:** `apps/api/src/modules/cycle-counts`, `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Approving a count writes adjustment and one Event Ledger entry per varied line.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

### Finance

#### ERP-025 — GL account list endpoint pagination
- **Epic:** Finance
- **Objective:** Add pagination params to the existing GL account list endpoint.
- **Probable files:** `apps/api/src/modules/accounting`, `packages/contracts`
- **Acceptance criteria:** Page/size params return bounded results with total count; default unchanged.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-026 — Open period guard on posting
- **Epic:** Finance
- **Objective:** Reject any journal posting whose date falls in a closed accounting period.
- **Probable files:** `apps/api/src/modules/accounting`
- **Acceptance criteria:** Posting into a closed period returns 400; open periods post normally.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-027 — Single AP invoice posting transaction
- **Epic:** Finance
- **Objective:** Add one endpoint to post a supplier invoice to the ledger.
- **Probable files:** `apps/api/src/modules/accounting`, `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Balanced debit/credit posted; one Event Ledger entry written; amounts rounded to currency precision.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-028 — Journal entry balance validation
- **Epic:** Finance
- **Objective:** Validate that journal entry debits equal credits before posting.
- **Probable files:** `apps/api/src/modules/accounting`
- **Acceptance criteria:** Unbalanced entries rejected with 400; rounding tolerance respected.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-029 — AP outstanding KPI tile
- **Epic:** Finance
- **Objective:** Add a KPI tile for total outstanding accounts payable.
- **Probable files:** `apps/web/src/app/dashboard/finance`, `apps/web/src/components/erp`
- **Acceptance criteria:** Tile shows outstanding AP total rounded to currency precision from existing data.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-030 — Period close summary endpoint
- **Epic:** Finance
- **Objective:** Add a read-only endpoint returning posting totals for a given period.
- **Probable files:** `apps/api/src/modules/accounting`, `packages/contracts`
- **Acceptance criteria:** Endpoint returns debit/credit totals for the requested period; read-only.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-031 — Ledger entry source link
- **Epic:** Finance
- **Objective:** Display the source document reference on Event Ledger entries in finance view.
- **Probable files:** `apps/web/src/app/dashboard/finance`, `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Each ledger row shows its source ref; reads existing ledger metadata.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

### Costing

#### ERP-032 — Standard cost field on item view
- **Epic:** Costing
- **Objective:** Display the current standard cost on the item detail by reusing product-costing.
- **Probable files:** `apps/web/src/app/dashboard/inventory`, `apps/api/src/modules/product-costing`
- **Acceptance criteria:** Standard cost renders from product-costing; rounded to currency precision.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-033 — Single-item cost rollup trigger
- **Epic:** Costing
- **Objective:** Add an action to run a cost rollup for one selected item.
- **Probable files:** `apps/api/src/modules/cost-rollup`, `apps/api/src/modules/product-costing`
- **Acceptance criteria:** Rollup runs for the item and persists rolled cost; reuses existing rollup engine.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-034 — Cost variance KPI tile
- **Epic:** Costing
- **Objective:** Add a KPI tile showing count of items with standard-vs-actual variance over threshold.
- **Probable files:** `apps/web/src/app/dashboard/finance`, `apps/api/src/modules/product-costing`
- **Acceptance criteria:** Tile shows variance count; reads existing costing data, no recompute.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-035 — Cost rollup component breakdown drawer
- **Epic:** Costing
- **Objective:** Add a read-only drawer showing the rolled cost component breakdown for one item.
- **Probable files:** `apps/web/src/app/dashboard/inventory`, `apps/api/src/modules/cost-rollup`
- **Acceptance criteria:** Drawer lists material/labor/overhead components from existing rollup result.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

### Planning

#### ERP-036 — Purchase plan list filter by buyer
- **Epic:** Planning
- **Objective:** Add a buyer filter to the existing purchase planning list endpoint.
- **Probable files:** `apps/api/src/modules/purchase-planning`, `packages/contracts`
- **Acceptance criteria:** Buyer query returns only that buyer's lines; omitting returns all.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-037 — Suggested PO from purchase plan line
- **Epic:** Planning
- **Objective:** Add an action to create a draft PO from one purchase plan line via procurement.
- **Probable files:** `apps/api/src/modules/purchase-planning`, `apps/api/src/modules/procurement`
- **Acceptance criteria:** One draft PO created matching the plan line; reuses procurement creation.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-038 — Production plan capacity KPI tile
- **Epic:** Planning
- **Objective:** Add a KPI tile showing planned vs available capacity for the current horizon.
- **Probable files:** `apps/web/src/app/dashboard/production-plan`, `apps/web/src/components/erp`
- **Acceptance criteria:** Tile shows capacity utilization percentage from existing plan data.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-039 — Purchase plan horizon selector
- **Epic:** Planning
- **Objective:** Add a horizon (weeks) selector to the purchase planning view.
- **Probable files:** `apps/web/src/app/dashboard/procurement`, `apps/api/src/modules/purchase-planning`
- **Acceptance criteria:** Changing horizon re-queries the existing endpoint; default horizon preserved.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

### Warehouse

#### ERP-040 — Pick list status filter
- **Epic:** Warehouse
- **Objective:** Add a status filter to the existing pick list endpoint.
- **Probable files:** `apps/api/src/modules/pick-lists`, `packages/contracts`
- **Acceptance criteria:** Status query returns matching pick lists; omitting returns all.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-041 — Kit components read-only view
- **Epic:** Warehouse
- **Objective:** Add a read-only panel listing kit components on the warehouse view.
- **Probable files:** `apps/web/src/app/dashboard/warehouse`, `apps/api/src/modules/kits`
- **Acceptance criteria:** Panel lists kit components from existing kit data; read-only.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-042 — Mark pick list line picked
- **Epic:** Warehouse
- **Objective:** Add one endpoint to mark a single pick list line as picked.
- **Probable files:** `apps/api/src/modules/pick-lists`, `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Line transitions to picked; reservation/stock change writes one ledger entry.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-043 — Open pick lists KPI tile
- **Epic:** Warehouse
- **Objective:** Add a KPI tile counting open pick lists on the warehouse dashboard.
- **Probable files:** `apps/web/src/app/dashboard/warehouse`, `apps/web/src/components/erp`
- **Acceptance criteria:** Tile shows open pick list count from existing endpoint.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

### Receiving

#### ERP-044 — Inbound shipment list filter by PO
- **Epic:** Receiving
- **Objective:** Add a PO filter to the existing inbound shipment list endpoint.
- **Probable files:** `apps/api/src/modules/inbound`, `packages/contracts`
- **Acceptance criteria:** PO query returns only matching inbound shipments; omitting returns all.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-045 — Single line receipt transaction
- **Epic:** Receiving
- **Objective:** Add one endpoint to receive a single PO line into stock.
- **Probable files:** `apps/api/src/modules/receiving`, `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Receipt increments on-hand and writes one Event Ledger entry; PO line received qty updated.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-046 — Over-receipt tolerance guard
- **Epic:** Receiving
- **Objective:** Reject receipts exceeding the PO line ordered qty beyond tenant tolerance.
- **Probable files:** `apps/api/src/modules/receiving`
- **Acceptance criteria:** Over-tolerance receipt returns 400; within tolerance proceeds.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-047 — Putaway location prompt on receipt
- **Epic:** Receiving
- **Objective:** Capture a putaway location when receiving a line on the receiving screen.
- **Probable files:** `apps/web/src/app/dashboard/receiving`, `apps/api/src/modules/receiving`
- **Acceptance criteria:** Selected location is persisted with the receipt; reuses location list.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-048 — Pending receipts KPI tile
- **Epic:** Receiving
- **Objective:** Add a KPI tile counting PO lines awaiting receipt.
- **Probable files:** `apps/web/src/app/dashboard/receiving`, `apps/web/src/components/erp`
- **Acceptance criteria:** Tile shows pending receipt count from existing data.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

### Shipping

#### ERP-049 — Outbound order list filter by status
- **Epic:** Shipping
- **Objective:** Add a status filter to the existing outbound order list endpoint.
- **Probable files:** `apps/api/src/modules/outbound`, `packages/contracts`
- **Acceptance criteria:** Status query returns matching outbound orders; omitting returns all.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-050 — Pack single shipment line
- **Epic:** Shipping
- **Objective:** Add one endpoint to mark a shipment line as packed.
- **Probable files:** `apps/api/src/modules/packing`, `packages/contracts`
- **Acceptance criteria:** Line transitions to packed; invalid state returns 400.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-051 — Dispatch shipment transaction
- **Epic:** Shipping
- **Objective:** Add one endpoint to dispatch a packed shipment and relieve stock.
- **Probable files:** `apps/api/src/modules/shipping`, `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Dispatch decrements on-hand and writes one Event Ledger entry; only packed shipments allowed.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-052 — Shipments-ready-to-dispatch KPI tile
- **Epic:** Shipping
- **Objective:** Add a KPI tile counting packed shipments awaiting dispatch.
- **Probable files:** `apps/web/src/app/dashboard/shipping`, `apps/web/src/components/erp`
- **Acceptance criteria:** Tile shows ready-to-dispatch count from existing data.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### ERP-053 — Packing slip read-only view
- **Epic:** Shipping
- **Objective:** Add a read-only packing slip panel for one shipment.
- **Probable files:** `apps/web/src/app/dashboard/shipping`, `apps/api/src/modules/packing`
- **Acceptance criteria:** Panel lists shipment lines and quantities from existing packing data; read-only.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING
