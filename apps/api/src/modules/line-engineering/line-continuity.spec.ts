import { computeContinuity, ContinuityStation, ContinuityLink } from './line-continuity';

const S = (id: string, station: string, sequence: number): ContinuityStation => ({ id, station, sequence });
const L = (from: string, to: string, kind?: string): ContinuityLink => ({ from, to, kind });

// A clean three-station line: A → B → C, in sequence order.
const chain = {
  stations: [S('a', 'EST-10', 10), S('b', 'EST-20', 20), S('c', 'EST-30', 30)],
  links: [L('a', 'b'), L('b', 'c')],
};

describe('computeContinuity (Fase 45)', () => {
  it('grades a clean ordered chain as continuous, 100%', () => {
    const r = computeContinuity(chain);
    expect(r.continuous).toBe(true);
    expect(r.continuityPct).toBe(100);
    expect(r.components).toBe(1);
    expect(r.sources.map((s) => s.station)).toEqual(['EST-10']);
    expect(r.sinks.map((s) => s.station)).toEqual(['EST-30']);
    expect(r.isolated).toEqual([]);
    expect(r.branches).toEqual([]);
    expect(r.backFlow).toEqual([]);
    expect(r.reached).toBe(3);
    expect(r.issues).toEqual([]);
  });

  it('flags an isolated station and the resulting split', () => {
    const r = computeContinuity({
      stations: [...chain.stations, S('d', 'EST-40', 40)],
      links: chain.links, // d is wired to nothing
    });
    expect(r.continuous).toBe(false);
    expect(r.isolated.map((s) => s.station)).toEqual(['EST-40']);
    expect(r.components).toBe(2);
    expect(r.continuityPct).toBe(75); // walk reaches a,b,c = 3 of 4
    expect(r.issues).toContain('1 estación(es) sin conectar al flujo');
    expect(r.issues).toContain('El flujo está partido en 2 tramos inconexos');
  });

  it('detects more than one start and a merge (branch)', () => {
    // A → C and B → C: two entries, C merges them.
    const r = computeContinuity({
      stations: [S('a', 'EST-10', 10), S('b', 'EST-20', 20), S('c', 'EST-30', 30)],
      links: [L('a', 'c'), L('b', 'c')],
    });
    expect(r.continuous).toBe(false);
    expect(r.sources.map((s) => s.station).sort()).toEqual(['EST-10', 'EST-20']);
    expect(r.branches.map((s) => s.station)).toEqual(['EST-30']); // in-degree 2
    expect(r.issues).toContain('2 inicios de línea (debería haber 1)');
  });

  it('exempts intentional return links from back-flow but flags forward-kind ones', () => {
    const ret = computeContinuity({
      stations: chain.stations,
      links: [...chain.links, L('c', 'a', 'return')], // C → A as a return loop
    });
    expect(ret.backFlow).toEqual([]);

    const bad = computeContinuity({
      stations: chain.stations,
      links: [...chain.links, L('c', 'a', 'flow')], // C → A as ordinary flow = contraflujo
    });
    expect(bad.backFlow).toHaveLength(1);
    expect(bad.backFlow[0]).toMatchObject({ fromStation: 'EST-30', toStation: 'EST-10' });
    expect(bad.issues).toContain('1 conexión(es) en contraflujo (van contra la secuencia)');
  });

  it('reports partial continuity for two disconnected sub-paths', () => {
    const r = computeContinuity({
      stations: [S('a', 'EST-10', 10), S('b', 'EST-20', 20), S('c', 'EST-30', 30), S('d', 'EST-40', 40)],
      links: [L('a', 'b'), L('c', 'd')], // two separate pairs
    });
    expect(r.components).toBe(2);
    expect(r.continuityPct).toBe(50); // start a reaches a,b = 2 of 4
    expect(r.continuous).toBe(false);
  });

  it('ignores links that reference unknown stations', () => {
    const r = computeContinuity({
      stations: chain.stations,
      links: [...chain.links, L('zzz', 'a'), L('b', 'qqq')],
    });
    expect(r.danglingLinks).toBe(2);
    expect(r.linkCount).toBe(2); // only the two real links count
    expect(r.continuous).toBe(true);
  });

  it('is safe with no links and with no stations', () => {
    const noLinks = computeContinuity({ stations: chain.stations, links: [] });
    expect(noLinks.continuous).toBe(false);
    expect(noLinks.continuityPct).toBe(0);
    expect(noLinks.components).toBe(3);
    expect(noLinks.isolated).toHaveLength(3);
    expect(noLinks.issues).toContain('No hay conexiones de flujo dibujadas');

    const empty = computeContinuity({ stations: [], links: [] });
    expect(empty.stationCount).toBe(0);
    expect(empty.continuityPct).toBe(0);
    expect(empty.issues).toContain('No hay estaciones que evaluar');
  });
});
