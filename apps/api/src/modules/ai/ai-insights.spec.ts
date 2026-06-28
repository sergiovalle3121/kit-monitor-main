import {
  buildSituationReport,
  ehsToInsights,
  kpiAlertsToInsights,
  maintenanceToInsights,
  qualityHoldsToInsights,
} from './ai-insights';

const NOW = new Date('2026-06-27T00:00:00Z').getTime();
const PAST = '2026-06-01T00:00:00Z';
const FUTURE = '2026-12-01T00:00:00Z';

describe('kpiAlertsToInsights', () => {
  it('maps critical/warning severities and tolerates junk', () => {
    const out = kpiAlertsToInsights([
      { key: 'oee', name: 'OEE', severity: 'critical', message: 'bajo' },
      { name: 'Scrap', severity: 'warning', message: 'sube' },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ area: 'KPI', severity: 'critical' });
    expect(out[1].severity).toBe('high');
    expect(kpiAlertsToInsights(null)).toEqual([]);
    expect(kpiAlertsToInsights({ error: 'no perm' })).toEqual([]);
  });
});

describe('maintenanceToInsights', () => {
  it('counts only open orders past their due date', () => {
    const orders = [
      { status: 'OPEN', dueDate: PAST }, // overdue
      { status: 'IN_PROGRESS', dueDate: new Date(PAST) }, // overdue (Date)
      { status: 'OPEN', dueDate: FUTURE }, // not due yet
      { status: 'COMPLETED', dueDate: PAST }, // closed
      { status: 'OPEN' }, // no due date
    ];
    const out = maintenanceToInsights(orders, NOW);
    expect(out).toHaveLength(1);
    expect(out[0].title).toContain('2');
    expect(maintenanceToInsights([], NOW)).toEqual([]);
  });
});

describe('qualityHoldsToInsights', () => {
  it('counts active holds only', () => {
    const out = qualityHoldsToInsights([
      { id: 1, isActive: true },
      { id: 2 },
      { id: 3, isActive: false },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].title).toContain('2');
    expect(qualityHoldsToInsights([{ isActive: false }])).toEqual([]);
  });
});

describe('ehsToInsights', () => {
  it('flags critical when any open incident is high severity', () => {
    const crit = ehsToInsights([
      { status: 'INVESTIGATING', severity: 'CRITICAL' },
      { status: 'CLOSED', severity: 'LOW' },
    ]);
    expect(crit[0].severity).toBe('critical');
    const med = ehsToInsights([{ status: 'OPEN', severity: 'LOW' }]);
    expect(med[0].severity).toBe('medium');
    expect(ehsToInsights([{ status: 'CLOSED' }])).toEqual([]);
  });
});

describe('buildSituationReport', () => {
  it('combines sources and ranks most-severe first', () => {
    const report = buildSituationReport(
      {
        kpiAlerts: [{ name: 'OEE', severity: 'warning', message: 'x' }], // high
        ehs: [{ status: 'OPEN', severity: 'CRITICAL' }], // critical
        qualityHolds: [{ isActive: true }], // high
      },
      NOW,
    );
    expect(report[0].severity).toBe('critical');
    expect(report.map((i) => i.area)).toContain('Calidad');
    // ranked: critical before any high
    expect(report[0].area).toBe('EHS');
  });

  it('returns an empty list when nothing needs attention', () => {
    expect(buildSituationReport({}, NOW)).toEqual([]);
  });
});
