# WP-006 — Search & Sharing Integration

- **Packet:** WP-006
- **Program:** OFFICE / PLATFORM
- **Queue items:** CQ-013, CQ-014
- **Owns (writable):** `apps/web/src/components/SearchPalette.tsx`, `apps/web/src/components/searchSources.ts`, `apps/web/src/components/office/ShareDialog.tsx`
- **Reads (read-only):** `apps/api/src/modules/{office,auth,users}/**`
- **Depends on:** WP-003 (office surface), WP-004 (RBAC for sharing)
- **Concurrency:** run **after** WP-003 + WP-004 merge. Safe alongside WP-001/002/005. Avoid running simultaneously with WP-003 (both can touch `components/office`).
- **Status:** PENDING
- **Owner agent:** —

> Owns the global search registration and the share dialog only. Reuse the
> platform RBAC for sharing (read `auth`/`users`) — never invent a parallel
> permission model. Inspect existing `SearchPalette`/`searchSources` before
> editing. Small, functional, green. Never merge red.

## Scope

Wire office documents into global search and add an RBAC-backed share dialog —
the cross-cutting integration items separated from the office core so they don't
race WP-003 on the same files.

## Items

### CQ-013 — Office search in global SearchPalette
- **Objective:** Register office docs as a search source.
- **Probable files:** `apps/web/src/components/{SearchPalette.tsx,searchSources.ts}`
- **Acceptance criteria:** Typing a doc title surfaces it; selecting opens it; tenant-scoped.

### CQ-014 — Document share dialog reusing platform RBAC
- **Objective:** Share dialog granting access via existing roles.
- **Probable files:** `apps/web/src/components/office/ShareDialog.tsx` (reads `auth`/`users`)
- **Acceptance criteria:** Grants/revokes by role; enforced on read; reuses RBAC, not a new ACL.

## Checks
- `git diff --check`; `npm run build` (web); search-source + share tests.
- CI `Build · Test · Lint · Smoke` green before merge.

## Definition of done
- [ ] Items merged via small PR(s); only `Owns:` files modified.
- [ ] Reuses platform RBAC + existing search registry; no duplication.
- [ ] Status → DONE; logged in `../STATUS/DONE.md`.
