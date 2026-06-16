import {
  classifyUtilization,
  rollUpLine,
  ModelLoad,
  DEFAULT_SHIFT_MINUTES,
} from './crp';
import { ProductionPlanService } from './production-plan.service';

const model = (over: Partial<ModelLoad> = {}): ModelLoad => ({
  model: 'M',
  revision: 'A',
  woCount: 1,
  unitsRemaining: 0,
  runMinutes: 0,
  changeoverMinutes: 0,
  hasStdTime: true,
  ...over,
});

describe('crp pure helpers', () => {
  describe('classifyUtilization', () => {
    it('maps utilization bands to a verdict (idle/optimal/warning/overloaded)', () => {
      expect(classifyUtilization(0)).toBe('idle');
      expect(classifyUtilization(0.5)).toBe('optimal');
      expect(classifyUtilization(85)).toBe('optimal'); // 85 is not yet "tight"
      expect(classifyUtilization(85.1)).toBe('warning');
      expect(classifyUtilization(100)).toBe('warning'); // exactly full = tight but feasible
      expect(classifyUtilization(100.1)).toBe('overloaded');
      expect(classifyUtilization(150)).toBe('overloaded');
    });
  });

  describe('rollUpLine', () => {
    it('sums run + changeover and computes utilization/feasibility (overloaded)', () => {
      const r = rollUpLine(
        'SMT-1',
        [
          model({
            model: 'A',
            unitsRemaining: 90,
            woCount: 2,
            runMinutes: 540,
            changeoverMinutes: 30,
          }),
        ],
        480,
      );
      expect(r.runMinutes).toBe(540);
      expect(r.changeoverMinutes).toBe(30);
      expect(r.requiredMinutes).toBe(570);
      expect(r.unitsRemaining).toBe(90);
      expect(r.woCount).toBe(2);
      expect(r.utilizationPct).toBe(118.8); // 570/480 → 118.75 → 1dp
      expect(r.feasible).toBe(false);
      expect(r.status).toBe('overloaded');
      expect(r.modelsWithoutStdTime).toBe(0);
    });

    it('is feasible/optimal under capacity and counts models without std time', () => {
      const r = rollUpLine(
        'FIN-2',
        [
          model({
            model: 'B',
            unitsRemaining: 10,
            runMinutes: 60,
            changeoverMinutes: 30,
          }),
          model({
            model: 'NOROUTE',
            unitsRemaining: 5,
            runMinutes: 0,
            changeoverMinutes: 0,
            hasStdTime: false,
          }),
        ],
        480,
      );
      expect(r.requiredMinutes).toBe(90);
      expect(r.feasible).toBe(true);
      expect(r.status).toBe('optimal');
      expect(r.modelsWithoutStdTime).toBe(1);
      expect(r.unitsRemaining).toBe(15);
    });

    it('reports zero utilization (never divides by zero) when no capacity is given', () => {
      const r = rollUpLine(
        'L',
        [model({ unitsRemaining: 5, runMinutes: 30 })],
        0,
      );
      expect(r.utilizationPct).toBe(0);
      expect(r.feasible).toBe(false);
      expect(r.status).toBe('idle');
    });
  });
});

/**
 * Service-level aggregation: open WOs grouped per line, fed through the (mocked)
 * line-engineering capacity calculator, rolled up to a validate-able verdict.
 */
describe('ProductionPlanService.capacityLoad', () => {
  function makeService(lineEng: unknown) {
    return new ProductionPlanService(
      {} as never, // repo (unused; list is stubbed)
      {} as never, // tenantCtx
      {} as never, // numbering
      undefined, // ledger
      lineEng as never,
    );
  }

  it('groups open WOs per line and flags an overbooked line vs a feasible one', async () => {
    const lineEng = {
      capacity: jest.fn(
        async ({
          model: m,
          demandUnits,
        }: {
          model: string;
          demandUnits: number;
        }) =>
          m === 'UNKNOWN'
            ? { requiredMinutes: 0, changeoverMinutes: 0 }
            : { requiredMinutes: demandUnits * 6, changeoverMinutes: 30 },
      ),
    };
    const service = makeService(lineEng);
    jest.spyOn(service, 'list').mockResolvedValue([
      // SMT-1: 90 remaining (100−10) → 540 run + 30 co = 570 > 480 ⇒ overloaded
      {
        line: 'SMT-1',
        model: 'A',
        revision: 'A',
        quantityPlanned: 100,
        quantityCompleted: 10,
        status: 'IN_EXECUTION',
      },
      // FIN-2: 10 remaining → 60 run + 30 co = 90 ≤ 480 ⇒ optimal
      {
        line: 'FIN-2',
        model: 'B',
        revision: 'A',
        quantityPlanned: 10,
        quantityCompleted: 0,
        status: 'RELEASED',
      },
      // COMPLETED WO on FIN-2 is excluded from the load
      {
        line: 'FIN-2',
        model: 'B',
        revision: 'A',
        quantityPlanned: 5,
        quantityCompleted: 5,
        status: 'COMPLETED',
      },
    ] as never);

    const res = await service.capacityLoad({ availableMinutes: 480 });
    expect(res.availableMinutes).toBe(480);

    const byLine = Object.fromEntries(res.lines.map((l) => [l.line, l]));
    expect(byLine['SMT-1']).toMatchObject({
      status: 'overloaded',
      feasible: false,
      requiredMinutes: 570,
      unitsRemaining: 90,
      woCount: 1,
    });
    expect(byLine['FIN-2']).toMatchObject({
      status: 'optimal',
      feasible: true,
      requiredMinutes: 90,
      woCount: 1, // COMPLETED excluded
    });
    // Worst-loaded line surfaces first.
    expect(res.lines[0].line).toBe('SMT-1');
    // Calculator queried once per (line, model) group of open WOs.
    expect(lineEng.capacity).toHaveBeenCalledTimes(2);
  });

  it('defaults to one shift and flags models without a routing/std time', async () => {
    const lineEng = {
      capacity: jest.fn(async () => ({
        requiredMinutes: 0,
        changeoverMinutes: 0,
      })),
    };
    const service = makeService(lineEng);
    jest
      .spyOn(service, 'list')
      .mockResolvedValue([
        {
          line: 'L1',
          model: 'NOROUTE',
          revision: 'A',
          quantityPlanned: 50,
          quantityCompleted: 0,
          status: 'RELEASED',
        },
      ] as never);

    const res = await service.capacityLoad();
    expect(res.availableMinutes).toBe(DEFAULT_SHIFT_MINUTES);
    expect(res.lines[0]).toMatchObject({
      modelsWithoutStdTime: 1,
      status: 'idle',
      unitsRemaining: 50,
    });
  });

  it('degrades to unknown load (no throw) when the calculator is unavailable', async () => {
    const service = makeService(undefined);
    jest
      .spyOn(service, 'list')
      .mockResolvedValue([
        {
          line: 'L1',
          model: 'A',
          revision: 'A',
          quantityPlanned: 5,
          quantityCompleted: 0,
          status: 'RELEASED',
        },
      ] as never);

    const res = await service.capacityLoad();
    expect(res.lines[0].requiredMinutes).toBe(0);
    expect(res.lines[0].modelsWithoutStdTime).toBe(1);
  });
});
