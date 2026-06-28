import { QualityAnalyticsService, QualityAnalyticsResult } from './quality-analytics.service';
import { NcrSeverity, NcrSourceType, NcrStatus } from '../ncr/entities/ncr.entity';

const analyticsFixture: QualityAnalyticsResult = {
  generatedAt: '2026-06-27T00:00:00.000Z',
  filters: { days: 30, model: null, line: null, supplier: null },
  meta: { totalNcrs: 2, classifiedNcrs: 1, unclassifiedNcrs: 1, catalogSize: 4 },
  defects: { pareto: [{ key: 'solder', label: 'Soldadura', count: 3, pct: 60, cumPct: 60, defectCodeId: 1 }] },
  ppm: { supplier: [{ supplierId: 10, supplierName: 'ACME Components', inspections: 2, inspected: 100, defects: 2, ppm: 20000 }], supplierOverall: 20000, supplierTrend: [], processOverall: 10000, processTrend: [], dpmoAvailable: false },
  yield: { fpyOverall: 98.2, serials: 50, fpyByModel: [], fpyByStation: [{ key: 'ICT-01', serials: 20, firstPass: 18, fpy: 90 }], oqc: { inspected: 10, passed: 9, failed: 1, yieldPct: 90 } },
  cuts: { byModel: [], byLine: [], bySupplier: [] },
  capa: { total: 2, open: 1, closed: 1, overdue: 1, avgCloseDays: 4, byStatus: [], overdueList: [{ capaNumber: 'CAPA-1', partNumber: 'PCB-1', status: 'open', dueDate: '2026-06-01', daysOverdue: 26 }] },
  dispositions: { byType: [{ type: 'scrap', count: 1, units: 5 }], costAvailable: false },
};

function makeService() {
  const service = new QualityAnalyticsService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { find: jest.fn().mockResolvedValue([{ active: true, isCritical: true, type: 'VARIABLE', lsl: 1, usl: 2, nominal: 1.5 }]) } as never,
    {} as never,
    { kpis: jest.fn().mockResolvedValue({ openHolds: 4, byStatus: {}, dispositioned: 2, useAsIs: 1, pctUseAsIs: 0.5, scrapQty: 7, reworkHours: 3, avgDispositionDays: 2.5, overdue: 1 }) } as never,
    { kpis: jest.fn().mockResolvedValue({ total: 3, open: 2, investigating: 1, closed: 1, avgCloseDays: 6.5, byDisposition: { REPAIR: 1 } }) } as never,
    { kpis: jest.fn().mockResolvedValue({ indexedLinks: 10, serialsCovered: 8, lotsTracked: 3, reelsTracked: 1, shipmentLinks: 5, linksMissingLot: 2 }) } as never,
  );
  jest.spyOn(service, 'summary').mockResolvedValue(analyticsFixture);
  jest.spyOn(service as any, 'loadNcrs').mockResolvedValue([
    { id: 1, ncrNumber: 'NCR-1', status: NcrStatus.OPEN, severity: NcrSeverity.CRITICAL, sourceType: NcrSourceType.IN_PROCESS, partNumber: 'PCB-1', category: 'Soldadura', quantityAffected: 12, lotNumber: 'LOT-1', serialNumber: null, workOrder: 'WO-1', customer: 'Customer A', owner: 'QA', createdAt: new Date(Date.now() - 12 * 86_400_000) },
    { id: 2, ncrNumber: 'NCR-2', status: NcrStatus.OPEN, severity: NcrSeverity.MAJOR, sourceType: NcrSourceType.CUSTOMER, partNumber: 'PCB-2', category: 'Funcional', quantityAffected: 1, lotNumber: null, serialNumber: 'SN-2', workOrder: null, customer: 'Customer B', owner: null, createdAt: new Date(Date.now() - 3 * 86_400_000) },
  ]);
  return service;
}

describe('QualityAnalyticsService.commandCenter', () => {
  it('joins analytics, floor quality, RMA, genealogy and CTQ readiness into one payload', async () => {
    const service = makeService();

    const result = await service.commandCenter({ days: 30 });

    expect(result.analytics).toBe(analyticsFixture);
    expect(result.lanes.find((lane) => lane.key === 'mrb')).toMatchObject({ metric: 4, risk: '1 overdue · 7 scrap qty' });
    expect(result.lanes.find((lane) => lane.key === 'customer')).toMatchObject({ metric: 2, risk: '80% links con lote' });
    expect(result.customer.rma?.open).toBe(2);
    expect(result.customer.genealogy?.shipmentLinks).toBe(5);
    expect(result.customer.traceabilityCoveragePct).toBe(80);
    expect(result.ctq).toMatchObject({ active: 1, critical: 1, variable: 1, withSpecWindow: 1 });
    expect(result.drilldowns.supplierRisks[0]).toMatchObject({ title: 'ACME Components', metric: 20000, metricLabel: 'PPM proveedor' });
    expect(result.drilldowns.containmentCandidates[0]).toMatchObject({ title: 'NCR-1 · PCB-1', metric: 12 });
    expect(result.drilldowns.customerImpacts[0]).toMatchObject({ title: 'Customer A', metric: 1 });
    expect(result.drilldowns.capaWatch[0]).toMatchObject({ title: 'CAPA-1', metric: 26 });
    expect(result.battleRhythm.productionBlockers[0]).toMatchObject({ title: 'NCR-1 · PCB-1', priority: 'now' });
    expect(result.battleRhythm.shipmentBlockers[0]).toMatchObject({ title: 'NCR-2 · PCB-2', priority: 'today' });
    expect(result.battleRhythm.ownerLoad[0]).toMatchObject({ title: 'QA', metric: 1 });
    expect(result.actionPlan.holdCandidates[0]).toMatchObject({ title: 'Crear hold para NCR-1', endpoint: '/quality/holds', permission: 'QUALITY_WRITE' });
    expect(result.actionPlan.mrbCandidates[0]).toMatchObject({ title: 'Preparar MRB para NCR-1', endpoint: '/floor-quality/holds/:id/mrb' });
    expect(result.actionPlan.recallCandidates[0].payloadTemplate).toMatchObject({ lotNumber: 'LOT-1', workOrder: 'WO-1' });
    expect(result.aging.buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(2);
    expect(result.aging.staleNcrs[0]).toMatchObject({ ncrNumber: 'NCR-1', daysOpen: 12, owner: 'QA' });
    expect(result.aging.ownerEscalations[0]).toMatchObject({ owner: 'QA', maxDaysOpen: 12, critical: 1 });
    expect(result.aging.slaPolicies.find((policy) => policy.key === 'critical-any')).toMatchObject({ dueDays: 1 });
    expect(result.aging.slaBreaches[0]).toMatchObject({ ncrNumber: 'NCR-1', dueDays: 1, daysLate: 11 });
    expect(result.containment.lots).toEqual(['LOT-1']);
    expect(result.containment.serials).toEqual(['SN-2']);
    expect(result.mrb).toMatchObject({ affectedUnits: 13, dispositionedUnits: 5, pendingUnits: 8 });
  });

  it('degrades optional service joins without failing the command center', async () => {
    const service = makeService();
    (service as unknown as { floorQuality: { kpis: jest.Mock }; rma: { kpis: jest.Mock }; genealogy: { kpis: jest.Mock } }).floorQuality.kpis.mockRejectedValueOnce(new Error('floor down'));
    (service as unknown as { floorQuality: { kpis: jest.Mock }; rma: { kpis: jest.Mock }; genealogy: { kpis: jest.Mock } }).rma.kpis.mockRejectedValueOnce(new Error('rma down'));
    (service as unknown as { floorQuality: { kpis: jest.Mock }; rma: { kpis: jest.Mock }; genealogy: { kpis: jest.Mock } }).genealogy.kpis.mockRejectedValueOnce(new Error('genealogy down'));

    const result = await service.commandCenter({ days: 30 });

    expect(result.mrb.floorKpis).toBeNull();
    expect(result.customer.rma).toBeNull();
    expect(result.customer.genealogy).toBeNull();
    expect(result.customer.traceabilityCoveragePct).toBeNull();
    expect(result.drilldowns.containmentCandidates).toHaveLength(2);
    expect(result.battleRhythm.productionBlockers).toHaveLength(1);
    expect(result.actionPlan.holdCandidates).toHaveLength(2);
    expect(result.aging.staleNcrs.length).toBeGreaterThan(0);
    expect(result.aging.slaBreaches.length).toBeGreaterThan(0);
    expect(result.lanes.find((lane) => lane.key === 'mrb')?.risk).toBe('1 tipos de disposición activos');
  });
});
