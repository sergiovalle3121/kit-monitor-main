import {
  buildDefectPareto,
  computeCapaStats,
  computeFpyByGroup,
  computeOqcYield,
  computeSupplierPpm,
  toPareto,
  type CapaLike,
  type DefectCodeLike,
  type IqcLike,
  type NcrLike,
  type TestRecordLike,
} from './quality-analytics.util';

const codeMap = (codes: DefectCodeLike[]) =>
  new Map(codes.map((c) => [c.id, c]));

describe('quality-analytics util · Pareto', () => {
  it('orders by frequency desc and accumulates the percentage to 100', () => {
    const rows = toPareto([
      { key: 'a', label: 'A', count: 5 },
      { key: 'b', label: 'B', count: 3 },
      { key: 'c', label: 'C', count: 2 },
    ]);
    // total = 10 → 50 / 30 / 20, cum 50 / 80 / 100
    expect(rows.map((r) => r.label)).toEqual(['A', 'B', 'C']);
    expect(rows.map((r) => r.pct)).toEqual([50, 30, 20]);
    expect(rows.map((r) => r.cumPct)).toEqual([50, 80, 100]);
    expect(rows[rows.length - 1].cumPct).toBe(100);
  });

  it('drops zero buckets and keeps a deterministic tie-break', () => {
    const rows = toPareto([
      { key: 'z', label: 'Z', count: 2 },
      { key: 'a', label: 'A', count: 2 },
      { key: 'x', label: 'X', count: 0 },
    ]);
    expect(rows).toHaveLength(2); // X (0) dropped
    expect(rows.map((r) => r.label)).toEqual(['A', 'Z']); // tie → alpha
  });

  it('builds a defect Pareto by code and groups uncoded NCRs as "Sin clasificar"', () => {
    const codes: DefectCodeLike[] = [
      {
        id: 1,
        code: 'SOL-COLD',
        description: 'Soldadura fría',
        category: 'solder',
      },
      {
        id: 2,
        code: 'CMP-MISS',
        description: 'Componente faltante',
        category: 'component',
      },
    ];
    const ncrs: NcrLike[] = [
      { id: 1, defectCodeId: 1, createdAt: '2026-01-01' },
      { id: 2, defectCodeId: 1, createdAt: '2026-01-02' },
      { id: 3, defectCodeId: 1, createdAt: '2026-01-03' },
      { id: 4, defectCodeId: 2, createdAt: '2026-01-04' },
      { id: 5, defectCodeId: null, createdAt: '2026-01-05' }, // sin clasificar
      { id: 6, createdAt: '2026-01-06' }, // sin clasificar (undefined)
    ];
    const pareto = buildDefectPareto(ncrs, codeMap(codes));
    expect(pareto[0]).toMatchObject({
      defectCodeId: 1,
      label: 'SOL-COLD',
      count: 3,
      description: 'Soldadura fría',
      category: 'solder',
    });
    // counts: SOL-COLD=3, Sin clasificar=2, CMP-MISS=1 → sorted desc by count
    expect(pareto.map((p) => p.label)).toEqual([
      'SOL-COLD',
      'Sin clasificar',
      'CMP-MISS',
    ]);
    expect(pareto.map((p) => p.count)).toEqual([3, 2, 1]);
    // cumulative ends at 100
    expect(pareto[pareto.length - 1].cumPct).toBe(100);
    // the unclassified bucket carries a null defectCodeId so the UI can drill into it
    const uncl = pareto.find((p) => p.label === 'Sin clasificar');
    expect(uncl?.defectCodeId).toBeNull();
    expect(uncl?.count).toBe(2);
  });
});

describe('quality-analytics util · Supplier PPM (from iqc_inspections)', () => {
  it('computes ppm = defects / inspected * 1e6 per supplier and ranks desc', () => {
    const iqc: IqcLike[] = [
      // Supplier A: 1000 inspected, 5 defects → 5000 ppm
      {
        sampleSize: 600,
        defectsFound: 3,
        supplier: { id: 1, name: 'Prov A' },
        createdAt: '2026-01-10',
      },
      {
        sampleSize: 400,
        defectsFound: 2,
        supplier: { id: 1, name: 'Prov A' },
        createdAt: '2026-02-10',
      },
      // Supplier B: 500 inspected, 10 defects → 20000 ppm
      {
        sampleSize: 500,
        defectsFound: 10,
        supplier: { id: 2, name: 'Prov B' },
        createdAt: '2026-01-12',
      },
    ];
    const ppm = computeSupplierPpm(iqc);
    expect(ppm).toHaveLength(2);
    // Ranked worst-first: B (20000) before A (5000)
    expect(ppm[0]).toMatchObject({
      supplierId: 2,
      supplierName: 'Prov B',
      inspected: 500,
      defects: 10,
      ppm: 20000,
    });
    expect(ppm[1]).toMatchObject({
      supplierId: 1,
      supplierName: 'Prov A',
      inspected: 1000,
      defects: 5,
      ppm: 5000,
    });
    expect(ppm[1].inspections).toBe(2);
  });

  it('returns null ppm when nothing was inspected (avoids divide-by-zero)', () => {
    const ppm = computeSupplierPpm([
      {
        sampleSize: 0,
        defectsFound: 0,
        supplier: { id: 9, name: 'Sin muestra' },
        createdAt: '2026-01-01',
      },
    ]);
    expect(ppm[0].ppm).toBeNull();
  });

  it('buckets inspections without a supplier as "Sin proveedor"', () => {
    const ppm = computeSupplierPpm([
      {
        sampleSize: 100,
        defectsFound: 1,
        supplier: null,
        createdAt: '2026-01-01',
      },
    ]);
    expect(ppm[0]).toMatchObject({
      supplierId: null,
      supplierName: 'Sin proveedor',
      ppm: 10000,
    });
  });
});

describe('quality-analytics util · First Pass Yield', () => {
  it('uses the first test per serial within each group', () => {
    const records: TestRecordLike[] = [
      // M1: S1 fails first then passes (retest) → counts as fail. S2 passes.
      {
        serialNumber: 'S1',
        result: 'FAIL',
        model: 'M1',
        testedAt: '2026-06-01T10:00:00Z',
      },
      {
        serialNumber: 'S1',
        result: 'PASS',
        model: 'M1',
        testedAt: '2026-06-01T11:00:00Z',
      },
      {
        serialNumber: 'S2',
        result: 'PASS',
        model: 'M1',
        testedAt: '2026-06-01T10:00:00Z',
      },
      // M2: S3 passes.
      {
        serialNumber: 'S3',
        result: 'PASS',
        model: 'M2',
        testedAt: '2026-06-01T10:00:00Z',
      },
    ];
    const byModel = computeFpyByGroup(records, (r) => r.model || 'Sin modelo');
    const m1 = byModel.find((g) => g.key === 'M1');
    const m2 = byModel.find((g) => g.key === 'M2');
    expect(m1).toMatchObject({ serials: 2, firstPass: 1, fpy: 50 }); // S1 fail-first, S2 pass
    expect(m2).toMatchObject({ serials: 1, firstPass: 1, fpy: 100 });
  });
});

describe('quality-analytics util · CAPA status', () => {
  it('classifies open/closed/overdue and averages the close time', () => {
    const now = new Date('2026-06-23T00:00:00Z');
    const capas: CapaLike[] = [
      // closed in 10 days
      {
        capaNumber: 'C1',
        partNumber: 'P',
        status: 'closed',
        createdAt: '2026-06-01T00:00:00Z',
        closedAt: '2026-06-11T00:00:00Z',
      },
      // open, overdue (due 3 days ago)
      {
        capaNumber: 'C2',
        partNumber: 'P',
        status: 'in_progress',
        createdAt: '2026-05-01T00:00:00Z',
        dueDate: '2026-06-20T00:00:00Z',
      },
      // open, not due yet
      {
        capaNumber: 'C3',
        partNumber: 'P',
        status: 'open',
        createdAt: '2026-06-10T00:00:00Z',
        dueDate: '2026-07-10T00:00:00Z',
      },
    ];
    const stats = computeCapaStats(capas, now);
    expect(stats).toMatchObject({
      total: 3,
      open: 2,
      closed: 1,
      overdue: 1,
      avgCloseDays: 10,
    });
    expect(stats.overdueList[0]).toMatchObject({
      capaNumber: 'C2',
      daysOverdue: 3,
    });
  });
});

describe('quality-analytics util · OQC yield', () => {
  it('sums final-inspection quantities into a pass yield', () => {
    const oqc = computeOqcYield([
      {
        quantityInspected: 100,
        quantityPassed: 95,
        quantityFailed: 5,
        createdAt: '2026-06-01',
      },
      {
        quantityInspected: 100,
        quantityPassed: 90,
        quantityFailed: 10,
        createdAt: '2026-06-02',
      },
    ]);
    expect(oqc).toMatchObject({
      inspected: 200,
      passed: 185,
      failed: 15,
      yieldPct: 92.5,
    });
  });
});
