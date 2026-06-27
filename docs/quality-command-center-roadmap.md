# Quality Command Center Roadmap

The `/dashboard/quality` cockpit is the operational entry point for the existing AXOS quality stack. It does not replace NCR, CTQ, measurements, floor quality, holds, RMA, genealogy, inspections, defect codes, or analytics; it organizes them into one command-center view for EMS quality teams.

## Existing foundations

- NCR lifecycle: `/ncr` supports the main no-conformance list, detail, status flow, and classification work.
- Quality analytics: `/quality/analytics` aggregates defect Pareto, supplier/process PPM, FPY, OQC yield, CAPA, model/line cuts, and disposition summaries.
- CTQ and SPC foundation: `/quality/characteristics`, `/quality/measurements`, and `/quality/measurements/summary` provide critical characteristics, readings, LSL/Nominal/USL context, and out-of-spec summaries.
- MRB and containment: `/floor-quality/holds`, `/floor-quality/kpis`, `/floor-quality/where-used`, `/quality/holds/active`, `/quality/dispositions`, and `/quality/transfers` cover floor holds, inventory holds, disposition, quarantine movement, and where-used lookup.
- Customer and traceability loops: `/rma` and `/genealogy` already cover RMA/customer quality and serial/lot traceability.

## Implemented in this phase

- Premium hero that frames quality as an end-to-end EMS command center.
- Operational KPI strip using NCR, quality analytics, and floor-quality KPI endpoints with graceful empty states.
- Horizontal quality flow rail from IQC through RMA/Genealogy.
- Attention queue that surfaces critical NCRs, overdue CAPA signals, MRB holds, and uncontained NCRs.
- Risk panels for repeated defects, supplier PPM risk, and model/line concentration.
- Organized module grid linking to existing quality routes instead of creating parallel screens.

## Next PR candidates

1. Add a backend command-center summary endpoint to avoid multiple client-side requests and normalize partial-failure metadata.
2. Extend CAPA entities with explicit due dates and effectiveness status if not already present in production data.
3. Add CTQ control-chart and Cpk cards once the statistical service is available.
4. Connect supplier SCAR workflows to incoming quality defects and supplier PPM.
5. Add shipment/customer-impact panels using genealogy, RMA, and shipping data.
6. Add role-specific saved views for IQC, IPQC, MRB, SQE, and customer quality.
