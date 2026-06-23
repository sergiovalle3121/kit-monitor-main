import { layoutCollisions, RectBox } from './line-collision';

const box = (
  id: string,
  cx: number,
  cy: number,
  w = 100,
  h = 100,
  angle = 0,
): RectBox => ({
  id,
  label: id,
  kind: 'station',
  cx,
  cy,
  w,
  h,
  angle,
});

describe('layoutCollisions (OBB validation)', () => {
  it('passes a clean, well-spaced layout', () => {
    const r = layoutCollisions([box('a', 100, 100), box('b', 400, 100)], {
      footprintW: 1000,
      footprintH: 1000,
    });
    expect(r.ok).toBe(true);
    expect(r.conflicts).toHaveLength(0);
  });

  it('detects two overlapping boxes', () => {
    const r = layoutCollisions([box('a', 100, 100), box('b', 150, 100)]);
    expect(r.overlaps).toBe(1);
    expect(r.conflicts[0]).toMatchObject({ type: 'overlap', a: 'a', b: 'b' });
  });

  it('detects overlap only after rotation brings corners together', () => {
    // Axis-aligned they clear (gap on x); rotating one 45° swings a corner in.
    const apart = layoutCollisions([
      box('a', 0, 0, 100, 100),
      box('b', 130, 0, 100, 100),
    ]);
    expect(apart.overlaps).toBe(0);
    const rotated = layoutCollisions([
      box('a', 0, 0, 100, 100, 45),
      box('b', 130, 0, 100, 100, 45),
    ]);
    expect(rotated.overlaps).toBe(1);
  });

  it('flags a clearance violation when boxes are closer than the minimum', () => {
    // Centers 160 apart, each 100 wide → 60 gap. Clearance 100 → violation, not overlap.
    const r = layoutCollisions([box('a', 0, 0), box('b', 160, 0)], {
      minClearance: 100,
    });
    expect(r.overlaps).toBe(0);
    expect(r.clearanceIssues).toBe(1);
    expect(r.conflicts[0].type).toBe('clearance');
  });

  it('does not flag clearance when the gap is comfortable', () => {
    const r = layoutCollisions([box('a', 0, 0), box('b', 400, 0)], {
      minClearance: 100,
    });
    expect(r.ok).toBe(true);
  });

  it('flags boxes that spill outside the footprint', () => {
    const r = layoutCollisions([box('a', 980, 100)], {
      footprintW: 1000,
      footprintH: 1000,
    });
    expect(r.outOfBounds).toBe(1);
    expect(r.conflicts[0]).toMatchObject({
      type: 'out_of_bounds',
      a: 'a',
      b: null,
    });
  });

  it('ignores degenerate (zero-size) boxes and is empty-safe', () => {
    expect(layoutCollisions([]).ok).toBe(true);
    const r = layoutCollisions([box('a', 0, 0, 0, 0), box('b', 0, 0, 0, 0)]);
    expect(r.conflicts).toHaveLength(0);
  });
});
