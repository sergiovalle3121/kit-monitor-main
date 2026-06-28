# AXOS Docs roadmap — industrial Word-class editor

AXOS Docs evolves the existing `/dashboard/office` document editor into a Word-class, industrial EMS document system. The current baseline already includes `DocEditor`, autosave, versions, sharing, TipTap, ribbon UI, DOCX/MD/TXT import/export, PDF print flow, and inline comments.

## Roadmap priorities

1. **Persistent review threads**
   - Persist comment threads outside TipTap JSON so review history survives future import/export and can be audited independently.
   - Keep a TipTap `commentId` mark as the visual anchor, backed by `office_document_comments` records.
   - Support replies, `@mentions`, assignment, resolve/reopen, delete, author, timestamps, tenant scope, filters, search, and future notification fan-out.

2. **Track changes parity**
   - Keep insertion/deletion marks for suggested edits.
   - Add server-side change summaries, acceptance/rejection audit events, and reviewer sign-off gates for controlled SOP/work-instruction releases.

3. **Deeper DOCX compatibility**
   - Expand round-trip tests for comments, tables, headers/footers, section breaks, images, styles, citations, footnotes/endnotes, and tracked changes.
   - Preserve industrial document metadata such as document number, revision, owner, effective date, product/customer links, and approval state.

4. **High-fidelity PDF export**
   - Move from browser print as the default to a server-rendered PDF pipeline with deterministic fonts, headers/footers, watermarks, page numbers, signatures, and controlled-copy stamps.

5. **Industrial templates**
   - Ship governed templates for SOP, Work Instruction, 8D, Control Plan, Audit Report, FAI, PPAP support packets, quality alerts, and customer-facing deviation reports.

6. **AXOS domain integration**
   - Add smart fields and embeds for BOM, routing, NCR, CAPA, quality characteristics, customers, suppliers, work orders, and item master data.
   - Support locked domain-backed fields so released documents reflect approved master data while draft documents can stage pending changes.

7. **Enterprise audit and permissions**
   - Add document lifecycle states: draft, in review, approved, effective, obsolete.
   - Log critical actions: create, share, comment, resolve/reopen, accept/reject change, approve, release, export controlled copy, obsolete.
   - Enforce tenant scope and owner/shared edit rules consistently across document content, comments, versions, exports, and future approvals.

## Current implementation slice

The first slice implements persistent comment storage while preserving the existing in-editor comment mark UX:

- New `office_document_comments` table with snake_case database columns (`tenant_id`, `document_id`, `anchor_id`) plus text, mentions, assigned user, quoted text, anchor range, replies, resolved state, resolver, and timestamps.
- New authenticated Office API endpoints for filtering, searching, listing, creating, assigning, replying, resolving/reopening, and deleting document comments.
- `DocComments` now creates and updates server-backed threads when a document id is available, while continuing to update the TipTap mark so comments remain visible in the editor and DOCX export path.

## Execution notes

- Avoid duplicate Office UI components; extend `DocComments`, `DocEditor`, and the existing Office API module.
- Every schema change must go through a TypeORM migration.
- Future high-risk actions should integrate with the centralized audit-log pattern before release-gated workflows are enabled.

## Implementation slice — AXOS smart references

AXOS Docs now starts the industrial integration layer with inline smart references. A document author can insert a visible AXOS token for Work Orders, BOMs, Routings, Models, NCRs, CAPAs, Suppliers, and Customers from the existing Insert ribbon. The token stores a structured entity type and reference id in TipTap JSON instead of pasting plain text, so future slices can resolve it into live previews, permissions-aware links, impact analysis, and controlled document release checks.

Design constraints for this slice:

- Keep the token inline and printable so SOPs and reports remain readable in DOCX/PDF exports.
- Preserve the structured entity/ref id attributes in editor JSON for future live AXOS lookups.
- Avoid duplicating editor components; extend the existing insert extras ribbon group and TipTap node extension set.

## Implementation slice — Controlled document properties and live fields

AXOS Docs now includes a first controlled-document metadata layer. Authors can maintain document number, revision, owner, department, effective date, status, customer, and model from the existing File ribbon, then insert those values as inline document fields. Fields travel inside TipTap JSON and can be refreshed when properties change, giving industrial templates a foundation for controlled SOP/WI/quality records without duplicating data manually.

This is the basis for release workflows, controlled-copy watermarks, revision blocks, approval gates, and AXOS entity binding in later PRs.

## Implementation slice — Version compare foundation for Track Changes

AXOS Docs now adds a first version-compare workflow inside the existing Version History drawer. Reviewers can compare a saved snapshot against the current document, see added/removed lines, and decide whether to restore or continue editing. This is not a full Word-level redline engine yet, but it establishes the compare UX and text extraction path needed for Phase 5 document compare, reviewer sign-off, and server-side revision summaries.

## Implementation slice — Portable HTML export

AXOS Docs now adds a semantic HTML export path alongside DOCX, Markdown, TXT, and print/PDF. The exporter preserves tables, callouts, comments, tracked insertions/deletions, AXOS smart references, document fields, bookmarks, cross-references, task lists, and page breaks as readable HTML. This gives Quality, Engineering, and Operations a portable artifact for Confluence-style knowledge sharing while keeping controlled AXOS metadata visible outside the app.

## Implementation slice — Office Hub document library foundation

The Office Hub now starts the DMS/library phase with richer workspace controls on top of the existing document list. Users can switch between card and list views, filter by owned/shared/favorite/pinned/recent documents, search by title/author/tag, and maintain lightweight local workspace metadata for favorites, pins, and tags. This keeps the current backend contract intact while establishing the interaction model for future server-backed spaces, collections, folders, document cards, and enterprise metadata.

Next server-backed library increments should persist these workspace signals per user and tenant, then add governed folders/spaces, tag administration, thumbnails/previews, and AXOS entity facets.

## Implementation slice — Premium industrial template library

AXOS Docs now ships a broader governed-template foundation for manufacturing, quality, NPI, maintenance, supplier quality, customer quality, and executive QMS workflows. The document template library includes controlled SOP, Work Instruction, PPAP, ECN/ECO, maintenance, calibration, functional test, customer specification, supplier specification, quality manual, production report, lessons learned, launch readiness, and management review templates.

These templates are not blank shells: they preload controlled document properties, live document fields, AXOS smart references, approval blocks, revision history, CTQ tables, reaction plans, and audit-ready sections. This is the first large step toward making AXOS Docs feel like an industrial Word/Confluence/PLM hybrid out of the box.

## Implementation slice — Browser PDF export pipeline

AXOS Docs now has a dedicated PDF export path in addition to the legacy browser print fallback. The exporter reuses the semantic HTML document representation, renders it into `jsPDF`, applies controlled-document headers/footers, page numbers, margins, page size/orientation, visible AXOS refs, live fields, tables, callouts, comments, and tracked insertions/deletions, then downloads a `.pdf` directly from the Export menu.

This is a browser-side bridge toward the final high-fidelity server-rendered PDF pipeline. The same semantic HTML source can later feed a headless renderer with deterministic fonts, watermarks, signatures, release stamps, and controlled-copy audit logging.

## Implementation slice — Controlled document lifecycle API

AXOS Docs now has the first backend lifecycle controls for governed documents: `draft`, `in_review`, `approved`, `effective`, and `obsolete`. Lifecycle transitions create version snapshots, lock approved/effective/obsolete content against edits, and write centralized audit-log entries for submit-review, approve, release, obsolete, and reopen-draft actions.

This establishes the backend foundation for approval workflows, controlled copies, release gates, digital signatures, training acknowledgements, and strict audit evidence for SOP/WI/quality records.

## Implementation slice — Lifecycle controls in the editor shell

The editor now exposes the controlled-document lifecycle directly in the Office shell. Users can see the document state, submit for review, approve, release, obsolete, or reopen draft from the editor, with an optional audit note. Locked lifecycle states force the editor into read-only mode and suppress autosave, aligning the UX with the backend lock semantics.

This makes the lifecycle usable by document owners and reviewers while preserving the existing autosave, sharing, version history, export, and ribbon architecture.

## Implementation slice — Lifecycle-aware document library

The Office Hub now understands controlled-document states. The document library shows lifecycle counters, filters by draft/review/approved/effective/obsolete, displays state badges on cards and list rows, and hides rename actions for locked documents. This gives Quality and Operations an immediate DMS-style view of what is editable, waiting for review, released to production, or obsolete.

## Implementation slice — Server-side library search filters

The Office API list endpoint now accepts server-side filters for search text, lifecycle state, lock status, and owner. This keeps the current Office Hub fast for local interactions while giving future DMS views, saved searches, review queues, and controlled-copy dashboards a backend-supported query surface for documents across title, model, creator, lifecycle, and lock state.

## Implementation slice — Document audit timeline API

AXOS Docs now exposes a document timeline endpoint that combines lifecycle audit logs, explicit/auto versions, and comment activity into one chronological evidence stream. This gives future UI panels, auditors, and quality reviewers a single backend source for “who changed/reviewed/released/commented on this document and when” without scraping TipTap JSON.

## Implementation slice — Audit timeline panel

The editor shell now includes an audit timeline panel that reads the document timeline API and displays lifecycle, version, comment, and audit events in context. Reviewers can inspect recent evidence directly beside export, sharing, lifecycle, and version controls instead of leaving the document.

## Implementation slice — Clickable AXOS smart references

AXOS smart references now resolve to deterministic in-app routes for supported entities such as Work Orders, BOMs, Routings, Models, NCRs, CAPAs, Customers, Suppliers, Materials, Engineering Changes, Maintenance Orders, Fixtures, Test Programs, and NPI projects. The editor renders AXOS refs as clickable tokens, HTML export emits linked refs when possible, and DOCX export uses the same label resolver for consistent visible text.

## Implementation slice — Smart references inspector

The editor shell now includes an inspector for AXOS smart references and live document fields. It walks the TipTap document JSON, deduplicates AXOS refs and doc fields, displays counts, and lets users jump to linked AXOS entities directly from the document context. This is the first UI surface for future impact analysis and live entity previews.

## Implementation slice — Track changes review summary

AXOS Docs now adds a dedicated review-summary panel beside the editor actions. The panel scans the TipTap JSON for `insertion` and `deletion` marks, aggregates pending redlines by author, shows insertion/deletion counts and character impact, and lists recent snippets with timestamps. This gives quality reviewers a fast pre-release gate before lifecycle approval, without replacing the existing in-editor accept/reject controls.

## Implementation slice — Export compatibility preflight

AXOS Docs now includes a compatibility preflight panel that scans the TipTap document model before export/release. It reports unsupported DOCX nodes or marks, missing image sources, long-table PDF risks, inline comments, and pending redlines, producing a simple export score with critical/warning/info counts. This moves Phase 6/7 closer to Word-grade reliability by warning users when a document needs visual validation before DOCX, PDF, or HTML distribution.

## Implementation slice — Controlled release readiness gate

AXOS Docs now includes a release-readiness checklist for controlled documents. The gate checks required document metadata, pending track changes, unresolved comments, and export preflight risks, then presents blockers, warnings, and a readiness score before approval or Effective release. This connects lifecycle governance with editor evidence so SOPs, Work Instructions, and quality records are not released with missing control data or unresolved review work.

## Implementation slice — Document search index foundation

AXOS Docs now has a tenant-scoped document search-index foundation for the DMS phase. The Office API maintains a denormalized `office_document_search_index` row when documents are created, updated, duplicated, or restored from versions. The index extracts visible TipTap text, live document fields, image titles/alt text, and structured AXOS smart references into a lightweight backend search surface.

The library list endpoint can now search inside document body content instead of only title/model/owner, and it accepts `entity` / `refId` filters for future smart-reference views such as “show every controlled document linked to this BOM, routing, NCR, CAPA, supplier, material, or engineering change.” A per-document `search-index` endpoint exposes word counts, reference counts, fields, and linked AXOS references to support inspectors, impact analysis, review queues, and release gates without scraping editor JSON in every UI panel.

## Implementation slice — Search index hardening and rebuild

The document search-index foundation is now hardened for production rollout: smart-reference filters no longer depend on database-specific JSON string spacing, the migration avoids optional PostgreSQL extensions, and each index row stores normalized `refs_text` / `fields_text` alongside structured JSON metadata. This keeps search compatible with the current TypeORM JSON abstraction while preserving a clear upgrade path to Postgres full-text search or vectors later.

A maintenance endpoint can rebuild the index for all documents an admin can see, or for the visible document scope of a non-admin writer. This gives operations a safe backfill path after migrations, restores, template imports, and future importer improvements without forcing users to open/save every document manually.

## Implementation slice — Server-backed document library metadata

AXOS Docs now moves the DMS workspace metadata out of browser-only local state and into governed Office document records. Documents can carry server-backed tags, favorites, pinned state, space, folder path, and collection metadata. The Office API can filter by those facets, the search index includes them in its searchable text, and duplicates inherit workspace placement while clearing personal favorite/pinned flags.

The Office Hub now reads and updates tags/favorites/pins through the backend, while still tolerating older local metadata as a migration fallback. It also surfaces spaces and folder paths as filter chips and visible breadcrumbs on document cards/list rows. This is the foundation for true DMS concepts: spaces, folders, collections, shared review queues, controlled-document libraries, and future server-side facets without losing the existing premium Office Hub UX.

## Implementation slice — Controlled distribution ledger

AXOS Docs now starts controlled-copy evidence for exports and print events. The backend persists an `office_document_distributions` ledger with tenant scope, document id, export/print action, format, copy number, recipient/purpose metadata, actor, and timestamp. Recording a distribution also writes a centralized audit-log event, and document timelines include distribution events alongside lifecycle, versions, comments, and audit entries.

The editor exposes a Distribution panel that lists emitted copies and the export menu records DOCX, PDF, HTML, Markdown, TXT, and print actions. This gives Quality and Operations the first auditable path toward controlled copies, point-of-use evidence, customer/supplier distribution history, and future watermark/signature enforcement.

## Implementation slice — Electronic signature evidence

AXOS Docs now has a first electronic-signature evidence layer for controlled documents. The backend persists signature records with tenant scope, signer identity, meaning, statement, role, content hash, metadata, revocation state, and signed timestamp. Signature creation and revocation write centralized audit-log evidence, and signatures appear in the document timeline alongside lifecycle, versions, comments, and distribution events.

The editor now exposes a Signatures panel where authorized users can sign as reviewed, approved, released, acknowledged, or training acknowledged. Each signature captures a SHA-256 hash of the document payload at signing time, establishing the foundation for future 21 CFR Part 11 style controls, digital certificates, signature watermarks, and training acknowledgement workflows.

## Implementation slice — Document training acknowledgements

AXOS Docs now connects controlled documents to training/read-and-understood workflows. The backend persists document training assignments with tenant scope, assignee, owner, due date, note, status, acknowledgement timestamp, and linked signature id. Owners can assign training to users, assignees can acknowledge their assignment, and acknowledgement automatically creates a `training_ack` electronic signature against the current document hash.

The editor now includes a Training panel for owners and assignees. Owners can assign required reading by email with due dates and notes; assigned users can confirm reading and create signed evidence. Training events are included in the document timeline, giving Quality and Operations a path toward training matrices, line-release gates, and SOP/WI point-of-use compliance.

## Implementation slice — Reviewer routing workflow

AXOS Docs now supports reviewer routing for controlled documents. The backend persists review tasks with tenant scope, reviewer, owner, due date, instructions, decision status, decision note, signature id, and timestamps. Owners can assign reviewers, assignments automatically move draft documents into review, reviewers can approve or reject, and approvals create signed review evidence against the current document hash.

The editor now includes a Review Route panel beside lifecycle, training, signatures, distribution, and audit evidence. This turns AXOS Docs from a passive editor into an active controlled-document workflow engine for SOP/WI approvals, quality review boards, engineering change packages, and release gates.

## Implementation slice — AXOS reference impact analysis

AXOS Docs now starts PLM-style impact analysis from smart references. The Office API exposes an impact endpoint that searches the tenant-scoped document search index for documents linked to a given AXOS entity and reference id, preserving existing owner/shared visibility rules. This turns inline AXOS refs into a queryable dependency graph for BOMs, routings, NCRs, CAPAs, suppliers, customers, materials, and engineering changes.

The editor now includes an Impact panel that extracts smart references from the current document and shows other documents that reference the same AXOS object. This gives Engineering, Quality, and Operations a practical first step toward change-impact review, release blocking, and “where-used” analysis across controlled documentation.

## Implementation slice — Server-side release readiness enforcement

AXOS Docs now has backend release-readiness evidence, not only client-side checks. The Office API exposes a release-readiness endpoint that aggregates unresolved comments, pending/rejected review tasks, pending training acknowledgements, active signatures, lifecycle state, and key metadata warnings. The `release` lifecycle transition now refuses to move a document to Effective when server-side blockers are present.

The editor Release Gate panel now combines local document analysis with server-side governance blockers and warnings. This makes controlled release safer because approvals, training, comments, and signatures are evaluated from authoritative backend evidence before a document can become effective.

## Implementation slice — Controlled evidence packages

AXOS Docs now exposes a server-generated evidence package for each document. The package combines controlled metadata, lifecycle state, content hash, release-readiness evidence, search index metadata, comments, reviewer routing, training assignments, signatures, distributions, versions, and the audit timeline into one downloadable JSON payload.

The editor now includes an Evidence Pack panel for controlled documents. Quality, Engineering, and Operations can generate a point-in-time package before release, customer submission, audit, or engineering-change review without manually stitching together comments, signatures, training records, distribution logs, smart references, and version history.

## Implementation slice — Controlled copy verification metadata

AXOS Docs now enriches every distribution event with verification metadata generated on the backend: content hash, lifecycle state, locked state, document title/model, controlled-copy flag, issued timestamp, and a deterministic verification code derived from the document id, copy number, format, action, lifecycle, and content hash. The distribution audit log also records the verification code and hash.

The Distribution Ledger now surfaces verification codes, hashes, and controlled-copy badges so exported PDFs, DOCX files, HTML packages, prints, and evidence-package downloads can be traced back to the exact released content state. Evidence-package JSON downloads are also recorded as distribution events instead of being invisible side effects.

## Implementation slice — Controlled copy verification workflow

AXOS Docs now supports point-of-use verification for controlled copies. The Office API can verify a distribution copy number and verification code against the server-side distribution ledger, returning the issued lifecycle state, issued content hash, current content hash, controlled-copy flag, recipient, purpose, actor, and whether the issued hash still matches the current document state.

The Distribution Ledger now includes an inline verification form so Quality, supervisors, auditors, and operators can validate a printed/exported copy without leaving the document context. This is the first step toward QR-backed controlled-copy verification at workstations, audit rooms, customer portals, and shop-floor visual-aid stations.

## Implementation slice — Signature integrity verification

AXOS Docs now verifies electronic signatures against the current document hash. The Office API exposes a signature verification endpoint that compares the signature's stored content hash with the current document hash and returns whether the signature is valid, revoked, or stale because content changed after signing.

The Signatures panel now lets reviewers verify each signature in place. This gives controlled SOPs, work instructions, approvals, training acknowledgements, and release signatures a practical integrity check before release, export, audit, or customer submission.

## Implementation slice — Document work queue

AXOS Docs now exposes a backend work queue for document users. The Office API aggregates pending review tasks assigned to the current user, pending training acknowledgements assigned to the current user, and owned documents currently in review, while preserving tenant scope and document visibility.

The Office Hub now shows a Work Queue panel above the library so reviewers, trainees, owners, Quality, and Engineering can jump directly into active document work. This moves AXOS Docs closer to an operational DMS where controlled-document tasks are not buried inside individual documents.

## Implementation slice — Periodic document review scheduling

AXOS Docs now supports periodic review metadata for controlled documents. Office documents can store next review date, review interval, and review owner via TypeORM migration-backed columns, with an audited API action to set the schedule.

The lifecycle menu now lets owners schedule periodic reviews, and the Office Hub work queue includes documents due within the next 30 days. This gives Quality and Engineering a foundation for QMS periodic review programs, SOP recertification, annual WI review, and obsolete-document prevention.

## Implementation slice — Periodic review completion evidence

AXOS Docs now closes the periodic-review loop. Owners or assigned review owners can complete a periodic review through an audited API action that creates electronic reviewed-signature evidence against the current content hash and automatically advances the next review date based on the configured interval.

The lifecycle menu now includes a completion action for periodic reviews. This turns periodic review from passive metadata into an auditable QMS workflow: review due, review completed, signature captured, next review scheduled.
