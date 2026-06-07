import { LineControlTowerService } from './line-control-tower.service';

/** Lightweight mocks of the floor services (read-only aggregator). */
function build(overrides: {
  wos?: any[];
  calls?: any[];
  holds?: any[];
  andons?: any[];
} = {}) {
  const plan = { list: jest.fn().mockResolvedValue(overrides.wos ?? []) } as any;
  const staging = { listReplenishCalls: jest.fn().mockResolvedValue(overrides.calls ?? []) } as any;
  const quality = { listHolds: jest.fn().mockResolvedValue(overrides.holds ?? []) } as any;
  const operator = { listFloorEvents: jest.fn().mockResolvedValue(overrides.andons ?? []) } as any;
  return new LineControlTowerService(plan, staging, operator, quality);
}

describe('LineControlTowerService', () => {
  it('rolls up per line with plan-vs-real adherence', async () => {
    const svc = build({
      wos: [
        { id: 'w1', line: 'L1', status: 'IN_EXECUTION', quantityPlanned: 10, quantityCompleted: 5, materialReady: true, qualityClear: true, faiRequired: false, scheduledDate: null, model: 'M1' },
      ],
    });
    const s = await svc.summary();
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0].adherencePct).toBe(0.5);
    expect(s.lines[0].woReady).toBe(1);
    expect(s.global).toBe('green');
  });

  it('turns a line red on an open quality hold mapped via its WO', async () => {
    const svc = build({
      wos: [{ id: 'w1', line: 'L1', status: 'IN_EXECUTION', quantityPlanned: 10, quantityCompleted: 0, materialReady: true, qualityClear: false, faiRequired: false, model: 'M1' }],
      holds: [{ woId: 'w1', status: 'HELD' }],
    });
    const s = await svc.summary();
    expect(s.lines[0].light).toBe('red');
    expect(s.lines[0].openHolds).toBe(1);
    expect(s.global).toBe('red');
  });

  it('turns a line red on a critical andon and amber on pending replenishment', async () => {
    const svc = build({
      wos: [
        { id: 'w1', line: 'L1', status: 'RELEASED', quantityPlanned: 10, quantityCompleted: 0, materialReady: false, qualityClear: true, faiRequired: false, model: 'M1' },
        { id: 'w2', line: 'L2', status: 'IN_EXECUTION', quantityPlanned: 10, quantityCompleted: 0, materialReady: true, qualityClear: true, faiRequired: false, model: 'M2' },
      ],
      calls: [{ woId: 'w1', status: 'OPEN', reason: 'KANBAN' }],
      andons: [{ line: 'L2', type: 'ANDON_MACHINE', status: 'OPEN', severity: 'CRITICAL' }],
    });
    const s = await svc.summary();
    const l1 = s.lines.find((l) => l.line === 'L1')!;
    const l2 = s.lines.find((l) => l.line === 'L2')!;
    expect(l1.light).toBe('amber'); // pending replenishment
    expect(l2.light).toBe('red'); // critical andon
    expect(s.global).toBe('red');
    expect(s.totals.openReplenish).toBe(1);
    expect(s.totals.openAndons).toBe(1);
  });

  it('is resilient when a source throws (returns empty, no crash)', async () => {
    const plan = { list: jest.fn().mockResolvedValue([{ id: 'w1', line: 'L1', status: 'RELEASED', quantityPlanned: 5, quantityCompleted: 0, materialReady: true, qualityClear: true, faiRequired: false, model: 'M' }]) } as any;
    const staging = { listReplenishCalls: jest.fn().mockRejectedValue(new Error('down')) } as any;
    const quality = { listHolds: jest.fn().mockRejectedValue(new Error('down')) } as any;
    const operator = { listFloorEvents: jest.fn().mockResolvedValue([]) } as any;
    const svc = new LineControlTowerService(plan, staging, operator, quality);
    const s = await svc.summary();
    expect(s.lines).toHaveLength(1);
    expect(s.global).toBe('green');
  });
});
