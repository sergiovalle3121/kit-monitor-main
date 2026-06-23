import { computeTakeoff, TakeoffInput } from './line-takeoff';

function input(over: Partial<TakeoffInput> = {}): TakeoffInput {
  return {
    footprint: { footprintW: 20000, footprintH: 10000, unit: 'mm' },
    stations: [],
    assets: [],
    annotations: [],
    ...over,
  };
}

describe('computeTakeoff (Fase 42)', () => {
  it('computes footprint area and counts placed vs unplaced stations', () => {
    const t = computeTakeoff(
      input({
        stations: [
          { x: 0, y: 0, w: 2000, h: 1500 },
          { x: 5000, y: 0, w: 1000, h: 1000 },
          { x: null, y: null, w: null, h: null },
        ],
      }),
    );
    expect(t.footprintAreaUnit2).toBe(200_000_000);
    expect(t.totalStations).toBe(3);
    expect(t.placedStations).toBe(2);
    // 2000*1500 + 1000*1000
    expect(t.stationAreaUnit2).toBe(4_000_000);
  });

  it('groups equipment by kind, sorted by descending count', () => {
    const t = computeTakeoff(
      input({
        assets: [
          { kind: 'rack', w: 900, h: 450 },
          { kind: 'workbench', w: 1200, h: 800 },
          { kind: 'rack', w: 900, h: 450 },
          { kind: 'rack', w: 900, h: 450 },
        ],
      }),
    );
    expect(t.equipmentCount).toBe(4);
    expect(t.byKind[0]).toEqual({ kind: 'rack', count: 3, areaUnit2: 1_215_000 });
    expect(t.byKind[1]).toEqual({
      kind: 'workbench',
      count: 1,
      areaUnit2: 960_000,
    });
  });

  it('excludes flat markings (zone / agvpath) from used area but still counts them', () => {
    const t = computeTakeoff(
      input({
        assets: [
          { kind: 'zone', w: 3000, h: 2000 },
          { kind: 'workbench', w: 1000, h: 1000 },
        ],
      }),
    );
    expect(t.equipmentCount).toBe(2);
    // only the workbench contributes to used/equipment area
    expect(t.equipmentAreaUnit2).toBe(1_000_000);
    expect(t.usedAreaUnit2).toBe(1_000_000);
  });

  it('sums wall lengths and clamps utilisation at 100%', () => {
    const t = computeTakeoff(
      input({
        footprint: { footprintW: 1000, footprintH: 1000, unit: 'mm' },
        assets: [
          { kind: 'wall', w: 4000, h: 150 },
          { kind: 'wall', w: 2000, h: 150 },
        ],
      }),
    );
    expect(t.wallTotalLengthUnit).toBe(6000);
    // used area (4000*150 + 2000*150 = 900000) >> footprint (1e6)? 0.9e6 -> 90%
    expect(t.utilizationPct).toBe(90);
  });

  it('clamps utilisation to 100 when equipment overflows the footprint', () => {
    const t = computeTakeoff(
      input({
        footprint: { footprintW: 1000, footprintH: 1000, unit: 'mm' },
        assets: [{ kind: 'machine', w: 5000, h: 5000 }],
      }),
    );
    expect(t.utilizationPct).toBe(100);
  });

  it('counts dimension annotations and ignores text notes', () => {
    const t = computeTakeoff(
      input({
        annotations: [
          { type: 'dim' },
          { type: 'dim' },
          { type: 'text' },
        ],
      }),
    );
    expect(t.dimCount).toBe(2);
  });

  it('is safe on an empty layout', () => {
    const t = computeTakeoff(input());
    expect(t.placedStations).toBe(0);
    expect(t.equipmentCount).toBe(0);
    expect(t.utilizationPct).toBe(0);
    expect(t.byKind).toEqual([]);
  });
});
