import { ControlTowerService } from './control-tower.service';

/**
 * Unit test with mocked area services — verifies the aggregator builds cards,
 * derives per-area health, and reduces to the worst-of overall health.
 */
describe('ControlTowerService', () => {
  function build(overrides: Record<string, any> = {}) {
    const kpi = (data: any) => ({ kpis: async () => data });
    const improvement = kpi({ implemented: 3, inProgress: 2, realizedSavings: 12000 });
    const ehs = kpi({ open: 0, recordableCount: 0, totalLostDays: 0, daysSinceLastRecordable: 120 });
    const maintenance = kpi({ ordersOpen: 0, ordersOverdue: 0, pmCompliance: 100, assetsDown: 0 });
    const legal = kpi({ active: 5, expiring30: 0, expired: 0 });
    const testing = kpi({ totalTests: 100, fail: 1, yieldPct: 99, firstPassYieldPct: 98 });
    const procurement = kpi({ open: 0, awaitingReceipt: 0, overdue: 0, otdPct: 95 });
    const people = kpi({ valid: 10, expiring30: 0, expired: 0, skills: 4 });
    const hr = {
      workforceOverview: async () => ({ headcount: 24, turnoverPct: 8, absenteeismPct: 2, openOpenings: 0 }),
      staffingRisk: async () => [{ band: 'LOW' }, { band: 'MEDIUM' }],
    };
    const quality = kpi({ openHolds: 0, overdue: 0, scrapQty: 0, reworkHours: 0 });
    return new ControlTowerService(
      overrides.improvement ?? (improvement as any),
      overrides.ehs ?? (ehs as any),
      overrides.maintenance ?? (maintenance as any),
      overrides.legal ?? (legal as any),
      overrides.testing ?? (testing as any),
      overrides.procurement ?? (procurement as any),
      overrides.people ?? (people as any),
      overrides.hr ?? (hr as any),
      overrides.quality ?? (quality as any),
    );
  }

  it('aggregates all areas with green overall when healthy', async () => {
    const summary = await build().summary();
    expect(summary.areas.length).toBe(9);
    expect(summary.overall).toBe('green');
    const ehsCard = summary.areas.find((a) => a.key === 'ehs');
    expect(ehsCard?.headline).toMatch(/120 días/);
  });

  it('escalates the workforce pillar to red when a staffing cell is critical', async () => {
    const hr = {
      workforceOverview: async () => ({ headcount: 20, turnoverPct: 40, absenteeismPct: 8, openOpenings: 6 }),
      staffingRisk: async () => [{ band: 'CRITICAL' }, { band: 'HIGH' }],
    };
    const summary = await build({ hr }).summary();
    const wf = summary.areas.find((a) => a.key === 'workforce');
    expect(wf?.health).toBe('red');
    expect(wf?.headline).toMatch(/crítico/);
    expect(summary.overall).toBe('red');
  });

  it('turns an area red and bubbles up to overall', async () => {
    const procurement = { kpis: async () => ({ open: 3, awaitingReceipt: 2, overdue: 2, otdPct: 80 }) };
    const summary = await build({ procurement }).summary();
    const po = summary.areas.find((a) => a.key === 'procurement');
    expect(po?.health).toBe('red');
    expect(summary.overall).toBe('red');
  });

  it('survives a failing area (defensive) without breaking the rest', async () => {
    const ehs = { kpis: async () => { throw new Error('boom'); } };
    const summary = await build({ ehs }).summary();
    // EHS card is dropped, the other eight remain.
    expect(summary.areas.find((a) => a.key === 'ehs')).toBeUndefined();
    expect(summary.areas.length).toBe(8);
  });
});
