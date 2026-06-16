import {
  actualQtyByPart,
  computeCogs,
  materialActualCost,
  materialPlanCost,
  plannedQtyByPart,
  scrapFromHolds,
  standardLaborHours,
  unitCost,
  usageVarianceByPart,
} from './cogs-math';

const COSTS: Record<string, number> = { P1: 10, P2: 2.5, P3: 100 };
const stdCostOf = (p: string) => COSTS[p] ?? 0;

describe('cogs-math (pure)', () => {
  describe('materialActualCost (live from backflush)', () => {
    it('sums backflushQty × standardCost across events', () => {
      const cost = materialActualCost(
        [
          { part: 'P1', station: 'S1', units: 1, backflushQty: 3 },
          { part: 'P2', station: 'S2', units: 1, backflushQty: 4 },
        ],
        stdCostOf,
      );
      expect(cost).toBe(3 * 10 + 4 * 2.5); // 40
    });

    it('ignores events without a part', () => {
      expect(
        materialActualCost([{ part: null, station: 'S1', units: 1, backflushQty: 9 }], stdCostOf),
      ).toBe(0);
    });
  });

  describe('materialPlanCost (BOM rollup × quantity)', () => {
    it('multiplies per-unit station use factors × std cost × planned qty', () => {
      const stations = [
        { station: 'S1', npExpected: 'P1', useFactor: 2, stdTimeSec: 30 },
        { station: 'S2', npExpected: 'P2', useFactor: 1, stdTimeSec: 60 },
      ];
      // per unit = 2*10 + 1*2.5 = 22.5 ; × 100 planned = 2250
      expect(materialPlanCost(stations, 100, stdCostOf)).toBe(2250);
    });

    it('skips stations with no expected part', () => {
      const stations = [{ station: 'S1', npExpected: null, useFactor: 5, stdTimeSec: 0 }];
      expect(materialPlanCost(stations, 100, stdCostOf)).toBe(0);
    });
  });

  describe('planned vs actual quantity maps', () => {
    const stations = [
      { station: 'S1', npExpected: 'P1', useFactor: 2, stdTimeSec: 30 },
      { station: 'S2', npExpected: 'P1', useFactor: 1, stdTimeSec: 10 }, // same part twice
    ];
    it('aggregates planned qty across stations sharing a part', () => {
      expect(plannedQtyByPart(stations, 10).get('P1')).toBe(30); // (2+1)*10
    });
    it('aggregates actual backflush by part', () => {
      const m = actualQtyByPart([
        { part: 'P1', station: 'S1', units: 1, backflushQty: 5 },
        { part: 'P1', station: 'S2', units: 1, backflushQty: 4 },
      ]);
      expect(m.get('P1')).toBe(9);
    });
  });

  describe('usageVarianceByPart', () => {
    it('computes plan vs actual per part and sorts by |variance|', () => {
      const stations = [
        { station: 'S1', npExpected: 'P1', useFactor: 1, stdTimeSec: 0 },
        { station: 'S2', npExpected: 'P3', useFactor: 1, stdTimeSec: 0 },
      ];
      const events = [
        { part: 'P1', station: 'S1', units: 1, backflushQty: 12 }, // planned 10
        { part: 'P3', station: 'S2', units: 1, backflushQty: 11 }, // planned 10
      ];
      const rows = usageVarianceByPart(stations, events, 10, stdCostOf);
      // P3 variance = (11-10)*100 = 100 ; P1 = (12-10)*10 = 20 → P3 first
      expect(rows[0].part).toBe('P3');
      expect(rows[0].usageVariance).toBe(100);
      const p1 = rows.find((r) => r.part === 'P1')!;
      expect(p1.plannedQty).toBe(10);
      expect(p1.actualQty).toBe(12);
      expect(p1.usageVariance).toBe(20);
      expect(p1.qtyVariance).toBe(2);
    });
  });

  describe('scrapFromHolds', () => {
    it('uses recorded scrapQty when present', () => {
      const r = scrapFromHolds(
        [{ part: 'P1', qty: 50, scrapQty: 5, disposition: 'SCRAP' }],
        stdCostOf,
      );
      expect(r.scrapQty).toBe(5);
      expect(r.scrapCost).toBe(50);
    });
    it('falls back to full held qty for a SCRAP disposition without scrapQty', () => {
      const r = scrapFromHolds(
        [{ part: 'P3', qty: 3, scrapQty: 0, disposition: 'SCRAP' }],
        stdCostOf,
      );
      expect(r.scrapQty).toBe(3);
      expect(r.scrapCost).toBe(300);
    });
    it('ignores non-scrap dispositions with no scrap qty', () => {
      const r = scrapFromHolds(
        [{ part: 'P1', qty: 99, scrapQty: 0, disposition: 'USE_AS_IS' }],
        stdCostOf,
      );
      expect(r.scrapQty).toBe(0);
      expect(r.scrapCost).toBe(0);
    });
  });

  describe('standardLaborHours', () => {
    it('sums units × station std time and converts to hours', () => {
      const hrs = standardLaborHours(
        [
          { part: 'P1', station: 'S1', units: 2, backflushQty: 0 }, // 2*1800 = 3600s
          { part: 'P1', station: 'S2', units: 1, backflushQty: 0 }, // 1*3600 = 3600s
        ],
        (s) => (s === 'S1' ? 1800 : 3600),
      );
      expect(hrs).toBe(2); // 7200s = 2h
    });
  });

  describe('computeCogs', () => {
    it('estimates labor/overhead from rates when no rollup actuals exist', () => {
      const r = computeCogs({
        materialActual: 1000,
        rollupLabor: 0,
        rollupOverhead: 0,
        standardLaborHours: 10,
        laborRate: 45,
        overheadRate: 0.18,
      });
      expect(r.materialCost).toBe(1000);
      expect(r.laborCost).toBe(450); // 10 * 45
      expect(r.laborSource).toBe('STANDARD_TIME_ESTIMATE');
      expect(r.overheadCost).toBe(261); // (1000+450)*0.18
      expect(r.overheadSource).toBe('RATE_ABSORPTION');
      expect(r.cogs).toBe(1711);
    });

    it('prefers recorded actuals from the cost rollup when present', () => {
      const r = computeCogs({
        materialActual: 1000,
        rollupLabor: 800,
        rollupOverhead: 300,
        standardLaborHours: 10,
        laborRate: 45,
        overheadRate: 0.18,
      });
      expect(r.laborCost).toBe(800);
      expect(r.laborSource).toBe('ROLLUP_ACTUAL');
      expect(r.overheadCost).toBe(300);
      expect(r.overheadSource).toBe('ROLLUP_ACTUAL');
      expect(r.cogs).toBe(2100);
    });
  });

  describe('unitCost', () => {
    it('divides cogs by completed units', () => {
      expect(unitCost(2000, 100)).toBe(20);
    });
    it('is 0 when nothing completed', () => {
      expect(unitCost(2000, 0)).toBe(0);
    });
  });
});
