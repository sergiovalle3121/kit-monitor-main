# Packing readiness by passed serial

This slice connects Packing to the existing Assembly -> Testing -> Packaging
weave without adding a parallel quality or packing model.

## Contract

- Source of truth for serialized readiness is `test_flow_units`.
- A serial is eligible for packing only when:
  - `stage = READY_FOR_PACKAGING`
  - `testResult = PASS`
  - `destination = PACKAGING`
- `GET /api/packing/readiness` returns the current tenant-scoped serial picture:
  available, already packed, awaiting test, and blocked/in disposition.
- `shipmentId` narrows packed rows to that shipment while keeping unassigned
  available serials visible, because available serials do not belong to a
  shipment until they are packed.
- Creating or updating a handling unit with `contents[].serials` validates every
  serial against that readiness and rejects serials that are not passed, are still
  awaiting test, are in disposition, or were already assigned to another handling
  unit.
- When serials are provided on a content line, their count must match the line
  quantity so the serialized packing evidence cannot drift from the manifest.

## Intentional non-duplication

- No new table or migration was added.
- No new pass/fail model was created; `testing` and `test-flow` remain the
  quality/test routing source.
- Existing quantity-only packing remains supported, but it is not treated as
  serialized PASS evidence. Serialized conformance requires serials on the
  handling-unit content lines.
