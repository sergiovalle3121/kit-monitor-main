# OFFICE — Program Backlog

Objective: deliver a premium collaborative office suite inside AXOS — Docs, Sheets and Slides editors plus a unified document library and real-time collaboration — fully embedded in the existing multi-tenant Industrial OS. Every item below extends the established office surface (`apps/api/src/modules/office`, `apps/web/src/app/dashboard/office/[id]`, `apps/web/src/components/office`) rather than introducing parallel screens or modules.

> Before starting any item, INSPECT the existing `office` module, route and components. AXOS already exists: do not duplicate a module, do not create a parallel office page, keep each PR small + functional + green. `main` deploys to Railway, so never merge red.

## Epics

- **Docs** — rich-text document editor and document type.
- **Sheets** — spreadsheet grid, formulas and cell logic.
- **Slides** — deck editor, slides and layouts.
- **Document Library** — listing, foldering and lifecycle of office documents.
- **Collaboration** — presence, comments, real-time editing.
- **Import/Export** — file ingestion and rendering (DOCX/XLSX/PPTX/PDF).
- **Templates** — reusable starting points per document type.
- **Search** — global and in-suite discovery via SearchPalette.
- **Permissions/Audit** — RBAC sharing and event-ledger audit trail.

## Backlog

### Docs

#### OFF-001 — Docs entity + DocumentType discriminator
- **Epic:** Docs
- **Objective:** Add a `DOCS` value to the office document type enum and persist a JSON content column for docs.
- **Probable files:** `apps/api/src/modules/office/entities/document.entity.ts`, `apps/api/src/modules/office/office.types.ts`
- **Acceptance criteria:** A document can be created with type `DOCS`; migration adds/uses the content column without breaking existing rows.
- **Checks:** `git diff --check`; `npm run build` (api); office module tests
- **Status:** PENDING

#### OFF-002 — Docs read-only renderer view
- **Epic:** Docs
- **Objective:** Render a `DOCS` document's stored content as read-only HTML in the office detail route.
- **Probable files:** `apps/web/src/app/dashboard/office/[id]/page.tsx`, `apps/web/src/components/office/DocsViewer.tsx`
- **Acceptance criteria:** Opening a `DOCS` document shows its formatted content; non-docs types are unaffected.
- **Checks:** `git diff --check`; `npm run build` (web)
- **Status:** PENDING

#### OFF-003 — Docs editor toggle (view/edit)
- **Epic:** Docs
- **Objective:** Add an Edit/View toggle button that swaps the docs viewer for an editable surface.
- **Probable files:** `apps/web/src/components/office/DocsEditor.tsx`, `apps/web/src/app/dashboard/office/[id]/page.tsx`
- **Acceptance criteria:** Toggling shows an editable area; toggling back restores the read-only view.
- **Checks:** `git diff --check`; `npm run build` (web)
- **Status:** PENDING

#### OFF-004 — Docs content save endpoint
- **Epic:** Docs
- **Objective:** Add a `PATCH` endpoint to persist docs content for a document id.
- **Probable files:** `apps/api/src/modules/office/office.controller.ts`, `apps/api/src/modules/office/office.service.ts`, `packages/contracts/src/office`
- **Acceptance criteria:** Valid payload updates content and returns the saved document; invalid id returns 404.
- **Checks:** `git diff --check`; `npm run build` (api); office service tests
- **Status:** PENDING

#### OFF-005 — Docs autosave-on-blur wiring
- **Epic:** Docs
- **Objective:** Call the docs save endpoint when the editor loses focus.
- **Probable files:** `apps/web/src/components/office/DocsEditor.tsx`, `apps/web/src/app/dashboard/office/[id]/page.tsx`
- **Acceptance criteria:** Editing then blurring persists content; a save indicator reflects success.
- **Checks:** `git diff --check`; `npm run build` (web)
- **Status:** PENDING

#### OFF-006 — Docs formatting toolbar (bold/italic/lists)
- **Epic:** Docs
- **Objective:** Add a minimal toolbar with bold, italic and bullet-list controls bound to the docs editor.
- **Probable files:** `apps/web/src/components/office/DocsToolbar.tsx`, `apps/web/src/components/office/DocsEditor.tsx`
- **Acceptance criteria:** Each button applies the corresponding formatting to the selection.
- **Checks:** `git diff --check`; `npm run build` (web)
- **Status:** PENDING

#### OFF-007 — Docs word/character count footer
- **Epic:** Docs
- **Objective:** Show a live word and character count below the docs editor.
- **Probable files:** `apps/web/src/components/office/DocsStatusBar.tsx`, `apps/web/src/components/office/DocsEditor.tsx`
- **Acceptance criteria:** Count updates as the user types and matches the document content.
- **Checks:** `git diff --check`; `npm run build` (web)
- **Status:** PENDING

### Sheets

#### OFF-008 — Sheets entity + cell-grid storage
- **Epic:** Sheets
- **Objective:** Add a `SHEETS` document type persisting a sparse cell map (address → value).
- **Probable files:** `apps/api/src/modules/office/entities/document.entity.ts`, `apps/api/src/modules/office/office.types.ts`
- **Acceptance criteria:** A `SHEETS` document stores and returns cell values keyed by A1 address.
- **Checks:** `git diff --check`; `npm run build` (api); office module tests
- **Status:** PENDING

#### OFF-009 — Sheets read-only grid view
- **Epic:** Sheets
- **Objective:** Render the stored cell map as a fixed read-only grid in the office detail route.
- **Probable files:** `apps/web/src/components/office/SheetsGrid.tsx`, `apps/web/src/app/dashboard/office/[id]/page.tsx`
- **Acceptance criteria:** Cell values display in the correct row/column; empty cells render blank.
- **Checks:** `git diff --check`; `npm run build` (web)
- **Status:** PENDING

#### OFF-010 — Sheets editable cell input
- **Epic:** Sheets
- **Objective:** Allow editing a single cell on click and committing the value on Enter/blur.
- **Probable files:** `apps/web/src/components/office/SheetsCell.tsx`, `apps/web/src/components/office/SheetsGrid.tsx`
- **Acceptance criteria:** Editing a cell updates local state; Escape cancels the edit.
- **Checks:** `git diff --check`; `npm run build` (web)
- **Status:** PENDING

#### OFF-011 — Sheets cell save endpoint
- **Epic:** Sheets
- **Objective:** Add an endpoint to upsert one or more cell values for a sheets document.
- **Probable files:** `apps/api/src/modules/office/office.controller.ts`, `apps/api/src/modules/office/office.service.ts`, `packages/contracts/src/office`
- **Acceptance criteria:** Posting cell updates persists them; the response reflects updated cells.
- **Checks:** `git diff --check`; `npm run build` (api); office service tests
- **Status:** PENDING

#### OFF-012 — Sheets SUM formula evaluation
- **Epic:** Sheets
- **Objective:** Evaluate `=SUM(range)` server-side when computing cell display values.
- **Probable files:** `apps/api/src/modules/office/sheets/formula.util.ts`, `apps/api/src/modules/office/office.service.ts`
- **Acceptance criteria:** A cell with `=SUM(A1:A3)` returns the summed value; non-formula cells unchanged.
- **Checks:** `git diff --check`; `npm run build` (api); formula util tests
- **Status:** PENDING

#### OFF-013 — Sheets column/row headers
- **Epic:** Sheets
- **Objective:** Render A/B/C column letters and 1/2/3 row numbers around the grid.
- **Probable files:** `apps/web/src/components/office/SheetsGrid.tsx`
- **Acceptance criteria:** Headers align with cells and stay visible while scrolling the grid.
- **Checks:** `git diff --check`; `npm run build` (web)
- **Status:** PENDING

#### OFF-014 — Sheets add-row / add-column controls
- **Epic:** Sheets
- **Objective:** Add buttons to extend the grid by one row or one column.
- **Probable files:** `apps/web/src/components/office/SheetsToolbar.tsx`, `apps/web/src/components/office/SheetsGrid.tsx`
- **Acceptance criteria:** Clicking add-row/add-column grows the visible grid dimensions.
- **Checks:** `git diff --check`; `npm run build` (web)
- **Status:** PENDING

### Slides

#### OFF-015 — Slides entity + slide-array storage
- **Epic:** Slides
- **Objective:** Add a `SLIDES` document type persisting an ordered array of slide objects.
- **Probable files:** `apps/api/src/modules/office/entities/document.entity.ts`, `apps/api/src/modules/office/office.types.ts`
- **Acceptance criteria:** A `SLIDES` document stores and returns slides in order.
- **Checks:** `git diff --check`; `npm run build` (api); office module tests
- **Status:** PENDING

#### OFF-016 — Slides deck viewer with thumbnail rail
- **Epic:** Slides
- **Objective:** Render a deck as a main slide canvas plus a left thumbnail rail.
- **Probable files:** `apps/web/src/components/office/SlidesDeck.tsx`, `apps/web/src/app/dashboard/office/[id]/page.tsx`
- **Acceptance criteria:** Selecting a thumbnail shows that slide in the main canvas.
- **Checks:** `git diff --check`; `npm run build` (web)
- **Status:** PENDING

#### OFF-017 — Slides add/delete slide controls
- **Epic:** Slides
- **Objective:** Add buttons to insert a blank slide and remove the current slide.
- **Probable files:** `apps/web/src/components/office/SlidesToolbar.tsx`, `apps/web/src/components/office/SlidesDeck.tsx`
- **Acceptance criteria:** Adding inserts after the current slide; deleting removes it and reselects a neighbor.
- **Checks:** `git diff --check`; `npm run build` (web)
- **Status:** PENDING

#### OFF-018 — Slides reorder via thumbnail drag
- **Epic:** Slides
- **Objective:** Allow reordering slides by dragging thumbnails in the rail.
- **Probable files:** `apps/web/src/components/office/SlidesThumbnailRail.tsx`, `apps/web/src/components/office/SlidesDeck.tsx`
- **Acceptance criteria:** Dropping a thumbnail updates slide order in local state.
- **Checks:** `git diff --check`; `npm run build` (web)
- **Status:** PENDING

#### OFF-019 — Slides text-block editing
- **Epic:** Slides
- **Objective:** Make title and body text blocks on a slide editable inline.
- **Probable files:** `apps/web/src/components/office/SlideCanvas.tsx`, `apps/web/src/components/office/SlidesDeck.tsx`
- **Acceptance criteria:** Editing a text block updates the slide model; blur commits the change.
- **Checks:** `git diff --check`; `npm run build` (web)
- **Status:** PENDING

#### OFF-020 — Slides deck save endpoint
- **Epic:** Slides
- **Objective:** Add an endpoint to persist the full slides array for a document.
- **Probable files:** `apps/api/src/modules/office/office.controller.ts`, `apps/api/src/modules/office/office.service.ts`, `packages/contracts/src/office`
- **Acceptance criteria:** Saving persists slide order and content; reload returns the saved deck.
- **Checks:** `git diff --check`; `npm run build` (api); office service tests
- **Status:** PENDING

### Document Library

#### OFF-021 — Library list endpoint with type filter
- **Epic:** Document Library
- **Objective:** Add a tenant-scoped endpoint listing office documents, filterable by type.
- **Probable files:** `apps/api/src/modules/office/office.controller.ts`, `apps/api/src/modules/office/office.service.ts`
- **Acceptance criteria:** Listing returns only the current tenant's documents; `?type=DOCS` filters correctly.
- **Checks:** `git diff --check`; `npm run build` (api); office service tests
- **Status:** PENDING

#### OFF-022 — Library landing list view
- **Epic:** Document Library
- **Objective:** Render the document list on the office library index route with type icons.
- **Probable files:** `apps/web/src/app/dashboard/office/page.tsx`, `apps/web/src/components/office/DocumentList.tsx`
- **Acceptance criteria:** Documents display with name, type and updated date; rows link to the detail route.
- **Checks:** `git diff --check`; `npm run build` (web)
- **Status:** PENDING

#### OFF-023 — Library create-document dialog
- **Epic:** Document Library
- **Objective:** Add a "New" dialog to create a Docs/Sheets/Slides document and navigate to it.
- **Probable files:** `apps/web/src/components/office/NewDocumentDialog.tsx`, `apps/web/src/app/dashboard/office/page.tsx`
- **Acceptance criteria:** Choosing a type creates a document and routes to its detail page.
- **Checks:** `git diff --check`; `npm run build` (web)
- **Status:** PENDING

#### OFF-024 — Library rename document
- **Epic:** Document Library
- **Objective:** Add an inline rename action backed by a name `PATCH` endpoint.
- **Probable files:** `apps/web/src/components/office/DocumentList.tsx`, `apps/api/src/modules/office/office.controller.ts`
- **Acceptance criteria:** Renaming updates the list immediately and persists on reload.
- **Checks:** `git diff --check`; `npm run build` (web/api); office service tests
- **Status:** PENDING

#### OFF-025 — Library soft-delete to trash
- **Epic:** Document Library
- **Objective:** Add a delete action that soft-deletes documents (sets `deletedAt`).
- **Probable files:** `apps/api/src/modules/office/office.service.ts`, `apps/web/src/components/office/DocumentList.tsx`
- **Acceptance criteria:** Deleted documents disappear from the default list; row exposes the delete control.
- **Checks:** `git diff --check`; `npm run build` (web/api); office service tests
- **Status:** PENDING

#### OFF-026 — Library folder grouping
- **Epic:** Document Library
- **Objective:** Add an optional `folder` field and group the library list by folder.
- **Probable files:** `apps/api/src/modules/office/entities/document.entity.ts`, `apps/web/src/components/office/DocumentList.tsx`
- **Acceptance criteria:** Documents render grouped by folder; unfiled documents appear under a default group.
- **Checks:** `git diff --check`; `npm run build` (web/api)
- **Status:** PENDING

#### OFF-027 — Library sort by name/date
- **Epic:** Document Library
- **Objective:** Add client-side sort controls for name and updated date.
- **Probable files:** `apps/web/src/components/office/DocumentList.tsx`
- **Acceptance criteria:** Toggling sort reorders the list; the active sort is visually indicated.
- **Checks:** `git diff --check`; `npm run build` (web)
- **Status:** PENDING

### Collaboration

#### OFF-028 — Document comments entity + list endpoint
- **Epic:** Collaboration
- **Objective:** Add a comment entity tied to a document and an endpoint to list its comments.
- **Probable files:** `apps/api/src/modules/office/entities/comment.entity.ts`, `apps/api/src/modules/office/office.controller.ts`
- **Acceptance criteria:** Listing returns comments for a document ordered by creation time.
- **Checks:** `git diff --check`; `npm run build` (api); office module tests
- **Status:** PENDING

#### OFF-029 — Add comment endpoint + composer
- **Epic:** Collaboration
- **Objective:** Add a `POST` comment endpoint and a composer in the document sidebar.
- **Probable files:** `apps/api/src/modules/office/office.service.ts`, `apps/web/src/components/office/CommentsPanel.tsx`
- **Acceptance criteria:** Submitting a comment persists it and appends it to the panel.
- **Checks:** `git diff --check`; `npm run build` (web/api); office service tests
- **Status:** PENDING

#### OFF-030 — Comments panel toggle in detail route
- **Epic:** Collaboration
- **Objective:** Add a toggle to open/close the comments panel on the office detail page.
- **Probable files:** `apps/web/src/app/dashboard/office/[id]/page.tsx`, `apps/web/src/components/office/CommentsPanel.tsx`
- **Acceptance criteria:** Toggling shows/hides the panel without affecting the editor surface.
- **Checks:** `git diff --check`; `npm run build` (web)
- **Status:** PENDING

#### OFF-031 — Presence indicator (active viewers)
- **Epic:** Collaboration
- **Objective:** Show avatars of users currently viewing the document via a presence endpoint.
- **Probable files:** `apps/api/src/modules/office/office.controller.ts`, `apps/web/src/components/office/PresenceBar.tsx`
- **Acceptance criteria:** Opening a document registers presence; the bar lists active viewers.
- **Checks:** `git diff --check`; `npm run build` (web/api)
- **Status:** PENDING

#### OFF-032 — Resolve/unresolve comment
- **Epic:** Collaboration
- **Objective:** Add a resolved flag with an endpoint and a resolve toggle in the panel.
- **Probable files:** `apps/api/src/modules/office/office.service.ts`, `apps/web/src/components/office/CommentsPanel.tsx`
- **Acceptance criteria:** Resolving hides the comment from the default view; unresolving restores it.
- **Checks:** `git diff --check`; `npm run build` (web/api); office service tests
- **Status:** PENDING

### Import/Export

#### OFF-033 — DOCX import into Docs document
- **Epic:** Import/Export
- **Objective:** Add an endpoint to convert an uploaded DOCX into a `DOCS` document, reusing existing parsing helpers.
- **Probable files:** `apps/api/src/modules/office/import/docx.import.ts`, `apps/api/src/modules/office/office.controller.ts`
- **Acceptance criteria:** Uploading a DOCX creates a docs document with extracted text/formatting.
- **Checks:** `git diff --check`; `npm run build` (api); import tests
- **Status:** PENDING

#### OFF-034 — XLSX import into Sheets document
- **Epic:** Import/Export
- **Objective:** Add an endpoint to convert an uploaded XLSX into a `SHEETS` cell map.
- **Probable files:** `apps/api/src/modules/office/import/xlsx.import.ts`, `apps/api/src/modules/office/office.controller.ts`
- **Acceptance criteria:** Uploading an XLSX creates a sheets document with populated cells.
- **Checks:** `git diff --check`; `npm run build` (api); import tests
- **Status:** PENDING

#### OFF-035 — PPTX import reusing dev pptx-foreign logic
- **Epic:** Import/Export
- **Objective:** Wire PPTX ingestion into a `SLIDES` document, reusing logic behind the `dev/pptx-foreign` tool.
- **Probable files:** `apps/api/src/modules/office/import/pptx.import.ts`, `apps/web/src/app/dev/pptx-foreign`
- **Acceptance criteria:** Uploading a PPTX creates a slides document with slides extracted; dev tool stays intact.
- **Checks:** `git diff --check`; `npm run build` (web/api); import tests
- **Status:** PENDING

#### OFF-036 — Docs export to PDF endpoint
- **Epic:** Import/Export
- **Objective:** Add an endpoint that returns a PDF rendering of a `DOCS` document.
- **Probable files:** `apps/api/src/modules/office/export/pdf.export.ts`, `apps/api/src/modules/office/office.controller.ts`
- **Acceptance criteria:** Requesting export returns a valid PDF stream for the document content.
- **Checks:** `git diff --check`; `npm run build` (api); export tests
- **Status:** PENDING

#### OFF-037 — Slides export reusing deck-gen
- **Epic:** Import/Export
- **Objective:** Add a slides-to-PPTX export reusing the existing `dev/deck-gen` generation path.
- **Probable files:** `apps/api/src/modules/office/export/pptx.export.ts`, `apps/web/src/app/dev/deck-gen`
- **Acceptance criteria:** Exporting a deck produces a PPTX matching slide content; deck-gen tool unchanged.
- **Checks:** `git diff --check`; `npm run build` (web/api); roundtrip checks (`dev/pptx-roundtrip`)
- **Status:** PENDING

#### OFF-038 — Export/download button in detail route
- **Epic:** Import/Export
- **Objective:** Add a download menu in the document toolbar invoking the matching export endpoint.
- **Probable files:** `apps/web/src/components/office/DocumentToolbar.tsx`, `apps/web/src/app/dashboard/office/[id]/page.tsx`
- **Acceptance criteria:** Choosing a format downloads the exported file for the open document.
- **Checks:** `git diff --check`; `npm run build` (web)
- **Status:** PENDING

### Templates

#### OFF-039 — Template flag on documents
- **Epic:** Templates
- **Objective:** Add an `isTemplate` flag and an endpoint to list templates by type.
- **Probable files:** `apps/api/src/modules/office/entities/document.entity.ts`, `apps/api/src/modules/office/office.service.ts`
- **Acceptance criteria:** Listing templates returns only documents flagged as templates for the type.
- **Checks:** `git diff --check`; `npm run build` (api); office service tests
- **Status:** PENDING

#### OFF-040 — Create document from template
- **Epic:** Templates
- **Objective:** Add an endpoint to clone a template into a new editable document.
- **Probable files:** `apps/api/src/modules/office/office.service.ts`, `apps/api/src/modules/office/office.controller.ts`
- **Acceptance criteria:** Cloning copies template content into a new non-template document.
- **Checks:** `git diff --check`; `npm run build` (api); office service tests
- **Status:** PENDING

#### OFF-041 — Template picker in New dialog
- **Epic:** Templates
- **Objective:** Show available templates in the create-document dialog as starting points.
- **Probable files:** `apps/web/src/components/office/NewDocumentDialog.tsx`
- **Acceptance criteria:** Selecting a template creates a document from it; "Blank" still works.
- **Checks:** `git diff --check`; `npm run build` (web)
- **Status:** PENDING

#### OFF-042 — Save current document as template
- **Epic:** Templates
- **Objective:** Add a toolbar action that flags the current document as a template.
- **Probable files:** `apps/web/src/components/office/DocumentToolbar.tsx`, `apps/api/src/modules/office/office.service.ts`
- **Acceptance criteria:** Saving as template sets the flag; the document then appears in the template picker.
- **Checks:** `git diff --check`; `npm run build` (web/api)
- **Status:** PENDING

### Search

#### OFF-043 — Office documents search source
- **Epic:** Search
- **Objective:** Register an office documents source in the global SearchPalette.
- **Probable files:** `apps/web/src/components/searchSources.ts`, `apps/web/src/components/SearchPalette.tsx`
- **Acceptance criteria:** Searching by document name surfaces office results that route to the detail page.
- **Checks:** `git diff --check`; `npm run build` (web)
- **Status:** PENDING

#### OFF-044 — Office search endpoint by name/content
- **Epic:** Search
- **Objective:** Add a tenant-scoped search endpoint matching document name and text content.
- **Probable files:** `apps/api/src/modules/office/office.controller.ts`, `apps/api/src/modules/office/office.service.ts`
- **Acceptance criteria:** Query returns matching documents scoped to the tenant; empty query returns none.
- **Checks:** `git diff --check`; `npm run build` (api); office service tests
- **Status:** PENDING

#### OFF-045 — In-document find bar
- **Epic:** Search
- **Objective:** Add a find bar that highlights matches within the open Docs document.
- **Probable files:** `apps/web/src/components/office/FindBar.tsx`, `apps/web/src/app/dashboard/office/[id]/page.tsx`
- **Acceptance criteria:** Typing highlights matches and shows a match count; clearing removes highlights.
- **Checks:** `git diff --check`; `npm run build` (web)
- **Status:** PENDING

### Permissions/Audit

#### OFF-046 — Document share roles entity
- **Epic:** Permissions/Audit
- **Objective:** Add a document-share entity (user/role + access level) reusing auth/users primitives.
- **Probable files:** `apps/api/src/modules/office/entities/document-share.entity.ts`, `apps/api/src/modules/auth`
- **Acceptance criteria:** Shares persist with viewer/editor levels tied to a document and principal.
- **Checks:** `git diff --check`; `npm run build` (api); office module tests
- **Status:** PENDING

#### OFF-047 — Enforce edit guard on save endpoints
- **Epic:** Permissions/Audit
- **Objective:** Add a guard so only editor-level principals can hit content save endpoints.
- **Probable files:** `apps/api/src/modules/office/guards/document-access.guard.ts`, `apps/api/src/modules/office/office.controller.ts`
- **Acceptance criteria:** Viewer-level users get 403 on save; editors succeed.
- **Checks:** `git diff --check`; `npm run build` (api); guard tests
- **Status:** PENDING

#### OFF-048 — Share dialog UI
- **Epic:** Permissions/Audit
- **Objective:** Add a share dialog to grant viewer/editor access to a user.
- **Probable files:** `apps/web/src/components/office/ShareDialog.tsx`, `apps/web/src/app/dashboard/office/[id]/page.tsx`
- **Acceptance criteria:** Granting access creates a share and lists current collaborators.
- **Checks:** `git diff --check`; `npm run build` (web)
- **Status:** PENDING

#### OFF-049 — Audit office events to event-ledger
- **Epic:** Permissions/Audit
- **Objective:** Emit event-ledger entries on document create, update and share.
- **Probable files:** `apps/api/src/modules/office/office.service.ts`, `apps/api/src/modules/event-ledger`
- **Acceptance criteria:** Each create/update/share writes a ledger event with actor and document id.
- **Checks:** `git diff --check`; `npm run build` (api); office service tests
- **Status:** PENDING

#### OFF-050 — Document activity/audit tab
- **Epic:** Permissions/Audit
- **Objective:** Add an activity tab listing event-ledger entries for the open document.
- **Probable files:** `apps/web/src/components/office/ActivityPanel.tsx`, `apps/web/src/app/dashboard/office/[id]/page.tsx`
- **Acceptance criteria:** The tab shows audit events for the document in reverse-chronological order.
- **Checks:** `git diff --check`; `npm run build` (web)
- **Status:** PENDING
