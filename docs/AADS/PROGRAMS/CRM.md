# CRM / COMMERCIAL — Program Backlog

Objective: build the AXOS commercial front — a unified customer 360, quoting and RFQ flow, an external customer portal, and service/ticketing — so sales and support operate on the same tenant data as the rest of the Industrial OS. This is the revenue-facing surface that turns ERP capability into commercial outcomes.

Before building anything, INSPECT what already exists: backend `apps/api/src/modules/{crm,customer-insights,forecast,rma}`, web routes `apps/web/src/app/dashboard/{crm,customers,forecast,rma}`, components `apps/web/src/components/erp`, and `docs/commercial-suite.md`. Never duplicate, never create a parallel screen — extend the existing modules. All quoting/RFQ pricing and costing MUST reuse the ERP modules (`apps/api/src/modules/{product-costing,cost-rollup,procurement}`); do not reimplement pricing. The customer portal is external-facing, so treat security and tenant isolation as first-class. Activity timelines come from `apps/api/src/modules/event-ledger`.

## Epics

- **Customer 360** — consolidated account view aggregating insights, orders, activity, service.
- **Accounts** — company records, hierarchy, ownership.
- **Contacts** — people linked to accounts, roles, communication.
- **Opportunities** — sales pipeline and kanban.
- **RFQ/Quote** — request-for-quote to quote to order, reusing ERP pricing/costing.
- **Customer Portal** — external-facing self-service surface.
- **Service/Tickets** — support tickets, SLA, linkage to RMA.
- **Forecast** — demand/sales forecasting views.
- **Commercial Analytics** — KPIs, dashboards, reporting on the commercial suite.

## Backlog

### Customer 360

#### CRM-001 — Customer 360 header summary card
- **Epic:** Customer 360
- **Objective:** Add a single header card on the customer detail page showing name, tier, owner, and lifetime value.
- **Probable files:** `apps/web/src/app/dashboard/customers`, `apps/web/src/components/erp`
- **Acceptance criteria:** Header card renders for an existing customer and pulls fields from the current customer endpoint without a new API.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-002 — Customer 360 activity timeline tab
- **Epic:** Customer 360
- **Objective:** Add one tab on the customer page that lists recent activity sourced from event-ledger for that customer.
- **Probable files:** `apps/web/src/app/dashboard/customers`, `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Tab lists ledger events filtered by customer id in reverse-chronological order; empty state shown when none.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-003 — Customer 360 open orders panel
- **Epic:** Customer 360
- **Objective:** Add a panel listing the customer's open orders by reusing the existing order query.
- **Probable files:** `apps/web/src/app/dashboard/customers`, `apps/web/src/components/erp`
- **Acceptance criteria:** Panel shows up to N open orders with status badges; links to existing order detail route.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-004 — Customer 360 insights badges
- **Epic:** Customer 360
- **Objective:** Surface customer-insights signals (churn risk, segment) as small badges in the 360 header.
- **Probable files:** `apps/web/src/app/dashboard/customers`, `apps/api/src/modules/customer-insights`
- **Acceptance criteria:** Badges read from the existing customer-insights endpoint; no new computation added client-side.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-005 — Customer 360 service summary widget
- **Epic:** Customer 360
- **Objective:** Add a widget showing open ticket count and last RMA for the customer.
- **Probable files:** `apps/web/src/app/dashboard/customers`, `apps/api/src/modules/rma`
- **Acceptance criteria:** Widget shows counts derived from existing crm/rma endpoints; zero-state handled.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

### Accounts

#### CRM-006 — Account create form
- **Epic:** Accounts
- **Objective:** Add a single create-account form to the crm module covering name, type, and owner.
- **Probable files:** `apps/web/src/app/dashboard/crm`, `apps/api/src/modules/crm`
- **Acceptance criteria:** Submitting creates one account via the crm endpoint and redirects to its detail page.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-007 — Account edit inline fields
- **Epic:** Accounts
- **Objective:** Allow inline editing of account name and industry on the detail page.
- **Probable files:** `apps/web/src/app/dashboard/crm`, `apps/api/src/modules/crm`
- **Acceptance criteria:** Editing a field persists via PATCH and reflects immediately; validation errors surfaced.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-008 — Account ownership assignment
- **Epic:** Accounts
- **Objective:** Add a single owner-assignment dropdown to set the account sales owner.
- **Probable files:** `apps/web/src/app/dashboard/crm`, `apps/api/src/modules/crm`
- **Acceptance criteria:** Selecting a user updates the account owner field and is visible after reload.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-009 — Account parent/child hierarchy field
- **Epic:** Accounts
- **Objective:** Add a parent-account selector so accounts can reference a parent for hierarchy.
- **Probable files:** `apps/api/src/modules/crm`, `apps/web/src/app/dashboard/crm`
- **Acceptance criteria:** Setting a parent persists and the detail page shows the parent link; self-reference rejected.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-010 — Account list search and filter
- **Epic:** Accounts
- **Objective:** Add a search box and one status filter to the existing accounts list.
- **Probable files:** `apps/web/src/app/dashboard/crm`, `apps/api/src/modules/crm`
- **Acceptance criteria:** Typing filters the existing list query by name; status filter narrows results.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

### Contacts

#### CRM-011 — Contact create under account
- **Epic:** Contacts
- **Objective:** Add a form to create one contact linked to the current account.
- **Probable files:** `apps/web/src/app/dashboard/crm`, `apps/api/src/modules/crm`
- **Acceptance criteria:** New contact is persisted with the account id and appears in the account's contact list.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-012 — Contact role badge
- **Epic:** Contacts
- **Objective:** Add a role field (e.g. buyer, technical) shown as a badge on each contact row.
- **Probable files:** `apps/api/src/modules/crm`, `apps/web/src/app/dashboard/crm`
- **Acceptance criteria:** Role persists on the contact and renders as a badge in the list.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-013 — Contact primary flag
- **Epic:** Contacts
- **Objective:** Allow marking one contact per account as primary.
- **Probable files:** `apps/api/src/modules/crm`, `apps/web/src/app/dashboard/crm`
- **Acceptance criteria:** Setting primary clears the flag on other contacts of the same account; primary shown first.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-014 — Contact email mailto action
- **Epic:** Contacts
- **Objective:** Add a single mailto action button on the contact row.
- **Probable files:** `apps/web/src/app/dashboard/crm`, `apps/web/src/components/erp`
- **Acceptance criteria:** Button opens a mailto link with the contact email; hidden when no email present.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

### Opportunities

#### CRM-015 — Opportunity create card
- **Epic:** Opportunities
- **Objective:** Add a create-opportunity form with title, account, value, and stage.
- **Probable files:** `apps/web/src/app/dashboard/crm`, `apps/api/src/modules/crm`
- **Acceptance criteria:** New opportunity persists with a default stage and appears in the pipeline.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-016 — Opportunity pipeline kanban
- **Epic:** Opportunities
- **Objective:** Render opportunities in a single kanban grouped by stage.
- **Probable files:** `apps/web/src/app/dashboard/crm`, `apps/web/src/components/erp`
- **Acceptance criteria:** Columns map to stages; each opportunity appears in its stage column.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-017 — Opportunity stage drag-to-move
- **Epic:** Opportunities
- **Objective:** Allow dragging a kanban card to change its stage.
- **Probable files:** `apps/web/src/app/dashboard/crm`, `apps/api/src/modules/crm`
- **Acceptance criteria:** Dropping a card persists the new stage via PATCH and survives reload.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-018 — Opportunity expected close date
- **Epic:** Opportunities
- **Objective:** Add an expected-close-date field shown on the card.
- **Probable files:** `apps/api/src/modules/crm`, `apps/web/src/app/dashboard/crm`
- **Acceptance criteria:** Date persists and renders on the card; overdue dates visually flagged.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-019 — Opportunity won/lost close action
- **Epic:** Opportunities
- **Objective:** Add a single action to close an opportunity as won or lost with a reason.
- **Probable files:** `apps/web/src/app/dashboard/crm`, `apps/api/src/modules/crm`
- **Acceptance criteria:** Closing sets terminal stage and stores reason; closed cards excluded from active pipeline.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

### RFQ/Quote

#### CRM-020 — RFQ create from account
- **Epic:** RFQ/Quote
- **Objective:** Add an RFQ create form capturing requested items and target account.
- **Probable files:** `apps/web/src/app/dashboard/crm`, `apps/api/src/modules/crm`
- **Acceptance criteria:** RFQ persists with line items and links to the account; appears in RFQ list.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-021 — Quote line item pricing via costing
- **Epic:** RFQ/Quote
- **Objective:** Populate quote line cost from the product-costing module rather than manual entry.
- **Probable files:** `apps/api/src/modules/crm`, `apps/api/src/modules/product-costing`
- **Acceptance criteria:** Each quote line reads unit cost from product-costing; no pricing logic duplicated in crm.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-022 — Quote rolled-up cost basis
- **Epic:** RFQ/Quote
- **Objective:** Show the rolled-up cost for assembled items on the quote using cost-rollup.
- **Probable files:** `apps/api/src/modules/crm`, `apps/api/src/modules/cost-rollup`
- **Acceptance criteria:** Quote displays rolled-up cost from cost-rollup; matches rollup output for the same item.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-023 — Quote margin field
- **Epic:** RFQ/Quote
- **Objective:** Add a margin percentage per quote line computed from price and costing-derived cost.
- **Probable files:** `apps/api/src/modules/crm`, `apps/web/src/app/dashboard/crm`
- **Acceptance criteria:** Margin recomputes when price changes; cost input comes from the costing module only.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-024 — Quote PDF/print view
- **Epic:** RFQ/Quote
- **Objective:** Add a single print-friendly quote view.
- **Probable files:** `apps/web/src/app/dashboard/crm`, `apps/web/src/components/erp`
- **Acceptance criteria:** Print view renders header, lines, totals; uses existing quote data only.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-025 — Quote to order conversion
- **Epic:** RFQ/Quote
- **Objective:** Add a convert-to-order action that hands the accepted quote to the existing order/procurement flow.
- **Probable files:** `apps/api/src/modules/crm`, `apps/api/src/modules/procurement`
- **Acceptance criteria:** Conversion creates an order through procurement; quote marked accepted; no duplicate order logic in crm.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-026 — Quote status timeline
- **Epic:** RFQ/Quote
- **Objective:** Record quote status changes to event-ledger and show them on the quote.
- **Probable files:** `apps/api/src/modules/crm`, `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Each status change writes one ledger event; timeline reads from event-ledger.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

### Customer Portal

#### CRM-027 — Portal authenticated landing
- **Epic:** Customer Portal
- **Objective:** Add one external portal landing page scoped to the authenticated customer tenant.
- **Probable files:** `apps/web/src/app/dashboard/customers`, `apps/api/src/modules/crm`
- **Acceptance criteria:** Page only loads data for the signed-in customer; cross-tenant access rejected.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-028 — Portal order status view
- **Epic:** Customer Portal
- **Objective:** Show the customer their own order statuses in the portal.
- **Probable files:** `apps/web/src/app/dashboard/customers`, `apps/api/src/modules/crm`
- **Acceptance criteria:** Only the customer's orders are returned; no internal-only fields exposed.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-029 — Portal quote acceptance
- **Epic:** Customer Portal
- **Objective:** Let a portal customer accept a quote sent to them.
- **Probable files:** `apps/web/src/app/dashboard/customers`, `apps/api/src/modules/crm`
- **Acceptance criteria:** Accepting updates quote status; action restricted to that customer's quotes.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-030 — Portal ticket submission
- **Epic:** Customer Portal
- **Objective:** Add a form for portal customers to open a support ticket.
- **Probable files:** `apps/web/src/app/dashboard/customers`, `apps/api/src/modules/crm`
- **Acceptance criteria:** Submitted ticket is linked to the customer and visible to internal service; input validated.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

### Service/Tickets

#### CRM-031 — Ticket create internal
- **Epic:** Service/Tickets
- **Objective:** Add an internal ticket create form with subject, priority, and account.
- **Probable files:** `apps/web/src/app/dashboard/crm`, `apps/api/src/modules/crm`
- **Acceptance criteria:** Ticket persists with default open status and appears in the ticket queue.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-032 — Ticket status kanban
- **Epic:** Service/Tickets
- **Objective:** Render tickets in a single kanban grouped by status.
- **Probable files:** `apps/web/src/app/dashboard/crm`, `apps/web/src/components/erp`
- **Acceptance criteria:** Columns map to ticket statuses; tickets render in their column.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-033 — Ticket assignment
- **Epic:** Service/Tickets
- **Objective:** Add an assignee dropdown to route a ticket to a user.
- **Probable files:** `apps/api/src/modules/crm`, `apps/web/src/app/dashboard/crm`
- **Acceptance criteria:** Assigning persists and the assignee appears on the ticket card.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-034 — Ticket link to RMA
- **Epic:** Service/Tickets
- **Objective:** Allow linking a ticket to an existing RMA record.
- **Probable files:** `apps/api/src/modules/crm`, `apps/api/src/modules/rma`
- **Acceptance criteria:** Linked RMA shows on the ticket and navigates to the existing RMA detail route.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-035 — Ticket SLA due indicator
- **Epic:** Service/Tickets
- **Objective:** Add an SLA due date and an overdue indicator on the ticket card.
- **Probable files:** `apps/api/src/modules/crm`, `apps/web/src/app/dashboard/crm`
- **Acceptance criteria:** Due date persists; overdue tickets visually flagged based on current date.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

### Forecast

#### CRM-036 — Forecast trend chart
- **Epic:** Forecast
- **Objective:** Add one line chart of forecasted demand over time from the forecast module.
- **Probable files:** `apps/web/src/app/dashboard/forecast`, `apps/api/src/modules/forecast`
- **Acceptance criteria:** Chart reads the existing forecast endpoint; no new computation client-side.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-037 — Forecast per-account filter
- **Epic:** Forecast
- **Objective:** Add an account filter to the forecast view.
- **Probable files:** `apps/web/src/app/dashboard/forecast`, `apps/api/src/modules/forecast`
- **Acceptance criteria:** Selecting an account scopes the existing forecast query to that account.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-038 — Forecast vs actual overlay
- **Epic:** Forecast
- **Objective:** Overlay actual orders against forecast on the existing chart.
- **Probable files:** `apps/web/src/app/dashboard/forecast`, `apps/api/src/modules/forecast`
- **Acceptance criteria:** Actuals series uses existing order data; both series render on the same axis.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

### Commercial Analytics

#### CRM-039 — Pipeline value KPI tile
- **Epic:** Commercial Analytics
- **Objective:** Add one KPI tile summing open opportunity value.
- **Probable files:** `apps/web/src/app/dashboard/crm`, `apps/api/src/modules/crm`
- **Acceptance criteria:** Tile reflects the sum of active opportunities; updates when pipeline changes.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-040 — Win rate metric
- **Epic:** Commercial Analytics
- **Objective:** Add a win-rate metric computed from won vs closed opportunities.
- **Probable files:** `apps/api/src/modules/crm`, `apps/web/src/app/dashboard/crm`
- **Acceptance criteria:** Metric equals won / (won + lost) over the selected period; zero-division handled.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-041 — Quote conversion chart
- **Epic:** Commercial Analytics
- **Objective:** Add a chart of quotes issued vs converted to orders.
- **Probable files:** `apps/web/src/app/dashboard/crm`, `apps/api/src/modules/crm`
- **Acceptance criteria:** Chart uses existing quote/order data; conversion counts match converted quotes.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING

#### CRM-042 — Ticket backlog trend
- **Epic:** Commercial Analytics
- **Objective:** Add a small chart of open ticket count over time.
- **Probable files:** `apps/web/src/app/dashboard/crm`, `apps/api/src/modules/crm`
- **Acceptance criteria:** Trend derives from existing ticket data; empty period handled gracefully.
- **Checks:** `git diff --check`; if code: `npm run build`, relevant tests
- **Status:** PENDING
