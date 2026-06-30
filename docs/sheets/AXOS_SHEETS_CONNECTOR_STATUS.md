# AXOS Sheets Connector Status

Run date: 2026-06-29

## User-visible contract

Sheets documents now reuse the existing connector freshness model in the OfficeShell status bar. A workbook with AXOS connector tables shows one compact status:

- `No AXOS data` when no connector table is inserted.
- `N AXOS fresh` when all inserted connector ranges are within policy.
- `D/N AXOS due` when at least one connector should be refreshed.
- `R/N AXOS risk` when a connector is stale or has invalid metadata.

The badge tooltip lists connector labels, freshness states, and age in minutes. This keeps connector freshness visible before a user opens the AXOS Data inspector.

## Existing implementation reused

- `apps/web/src/lib/office/axosConnectors.ts` remains the single connector registry and freshness policy source.
- `apps/web/src/app/dashboard/office/[id]/page.tsx` passes workbook content into the existing OfficeShell status bar.
- `apps/web/src/components/office/SheetEditor.tsx` and the Fortune-Sheet editor are not duplicated or replaced.

## Non-redundant next step

After the open `SheetEditor.tsx` PRs land, wire `axosConnectorAudit.ts` into the connector refresh action so each refresh can optionally materialize the existing `AXOS Connector Audit` sheet from the current helper.
