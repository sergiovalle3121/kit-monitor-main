import { stationCompleteness, CompletenessItem } from './line-balance';

const item = (
  station: string,
  sequence: number,
  o: Partial<CompletenessItem> = {},
): CompletenessItem => ({
  station,
  sequence,
  npExpected: o.npExpected ?? null,
  useFactor: o.useFactor ?? null,
  visualAidUrl: o.visualAidUrl ?? null,
  ctq: o.ctq ?? false,
});

describe('stationCompleteness (documentation readiness)', () => {
  it('marks a station complete only with NP + use factor + visual aid', () => {
    const r = stationCompleteness([
      item('full', 1, { npExpected: 'P1', useFactor: 1, visualAidUrl: 'u' }),
      item('noAid', 2, { npExpected: 'P2', useFactor: 1 }),
      item('bare', 3),
    ]);
    expect(r.total).toBe(3);
    expect(r.complete).toBe(1);
    expect(r.completePct).toBe(round4(1 / 3));
    const byName = new Map(r.stations.map((s) => [s.station, s]));
    expect(byName.get('full')).toMatchObject({ complete: true });
    expect(byName.get('noAid')).toMatchObject({
      complete: false,
      hasVisualAid: false,
      hasNp: true,
    });
    expect(byName.get('bare')).toMatchObject({
      hasNp: false,
      hasUseFactor: false,
      hasVisualAid: false,
    });
  });

  it('counts what is missing across the line', () => {
    const r = stationCompleteness([
      item('a', 1, {
        npExpected: 'P1',
        useFactor: 1,
        visualAidUrl: 'u',
        ctq: true,
      }),
      item('b', 2, { useFactor: 1, visualAidUrl: 'u' }), // missing NP
      item('c', 3, { npExpected: 'P3', visualAidUrl: 'u' }), // missing factor
    ]);
    expect(r.missingNp).toBe(1);
    expect(r.missingUseFactor).toBe(1);
    expect(r.missingVisualAid).toBe(0);
    expect(r.ctqCount).toBe(1);
  });

  it('is empty-safe', () => {
    expect(stationCompleteness([])).toMatchObject({
      total: 0,
      complete: 0,
      completePct: 0,
    });
  });
});

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}
