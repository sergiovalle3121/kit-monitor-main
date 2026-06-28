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

## Persistent Docs review comments

Docs review comments now use the shared Office anchored-comment backend (`office_comments`) instead of adding another Docs-only comment path. The Docs endpoint keeps the existing `/office-documents/:id/comments` contract for the TipTap UI, but stores root threads as generic Office comments with `anchorType = text` or `document`, the TipTap mark id in `objectId`, the selected range in `rangeRef` (`from:to`), and the quoted text/block label in `anchorLabel`. Replies are stored as child `office_comments` rows via `parentId`, matching the Slides thread model and avoiding a third comment implementation.

The web Docs panel loads API threads first, merges them with local TipTap marks, supports reply/resolve/reopen/assignment, and only falls back to local mark state when the comments API is unavailable.
