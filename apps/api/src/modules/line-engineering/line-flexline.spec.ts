import { flexLineAnalysis, FlexModelRoute } from './line-flexline';

const ROUTES: FlexModelRoute[] = [
  // Shared backbone: LOAD, TEST. A-specific: GLUE. B-specific: LABEL.
  {
    model: 'AX-1000',
    revision: 'A',
    stations: ['LOAD', 'GLUE', 'TEST'],
    bottleneckSec: 55,
  },
  {
    model: 'AX-2000',
    revision: 'A',
    stations: ['LOAD', 'LABEL', 'TEST'],
    bottleneckSec: 48,
  },
];

describe('flexLineAnalysis (Fase 40)', () => {
  it('finds the shared backbone and per-model unique stations', () => {
    const r = flexLineAnalysis('SMT-1', ROUTES);
    expect(r.line).toBe('SMT-1');
    expect(r.modelCount).toBe(2);

    const byStation = Object.fromEntries(r.stations.map((s) => [s.station, s]));
    // LOAD and TEST are used by both → shared backbone.
    expect(byStation.LOAD.sharedByAll).toBe(true);
    expect(byStation.TEST.sharedByAll).toBe(true);
    expect(byStation.GLUE).toMatchObject({ usageCount: 1, sharedByAll: false });
    expect(byStation.LABEL.usageCount).toBe(1);

    expect(r.sharedStations).toBe(2); // LOAD, TEST
    expect(r.totalUniqueStations).toBe(4); // LOAD, TEST, GLUE, LABEL
    expect(r.commonalityPct).toBe(50); // 2/4

    const a = r.models.find((m) => m.model === 'AX-1000')!;
    expect(a).toMatchObject({
      stationCount: 3,
      uniqueStations: 1,
      bottleneckSec: 55,
    });
  });

  it('sorts stations by how many models share them', () => {
    const r = flexLineAnalysis('SMT-1', ROUTES);
    // The two shared (usageCount 2) come before the single-use ones.
    expect(r.stations[0].usageCount).toBe(2);
    expect(r.stations[r.stations.length - 1].usageCount).toBe(1);
  });

  it('treats a single-model line as fully common', () => {
    const r = flexLineAnalysis('SMT-9', [ROUTES[0]]);
    expect(r.modelCount).toBe(1);
    expect(r.sharedStations).toBe(3);
    expect(r.commonalityPct).toBe(100);
    expect(r.models[0].uniqueStations).toBe(3); // all unique to the lone model
  });

  it('labels non-default revisions and counts a station once per model', () => {
    const r = flexLineAnalysis('SMT-1', [
      {
        model: 'AX-1000',
        revision: 'B',
        stations: ['LOAD', 'LOAD', 'TEST'],
        bottleneckSec: 30,
      },
      {
        model: 'AX-2000',
        revision: 'A',
        stations: ['LOAD'],
        bottleneckSec: 20,
      },
    ]);
    const load = r.stations.find((s) => s.station === 'LOAD')!;
    // Duplicate LOAD in the first route counts once for that model.
    expect(load.usageCount).toBe(2);
    expect(load.models).toContain('AX-1000 · B');
    expect(load.models).toContain('AX-2000');
  });

  it('returns an empty result for no routes', () => {
    const r = flexLineAnalysis('SMT-1', []);
    expect(r.modelCount).toBe(0);
    expect(r.stations).toEqual([]);
    expect(r.commonalityPct).toBe(0);
  });
});
