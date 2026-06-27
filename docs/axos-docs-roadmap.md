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
