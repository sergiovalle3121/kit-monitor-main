import { deriveReadiness, ReadinessDemandLine } from '@axos/contracts';

/**
 * Pure-logic coverage for the Clear-to-Build readiness derivation that replaced
 * the old hard-coded `green` mock. Each axis (materials / quality / shipping) is
 * exercised across its honest states.
 */
describe('deriveReadiness', () => {
  const stock = (entries: Array<[string, number]>) =>
    new Map<string, number>(entries);
  const demand = (lines: ReadinessDemandLine[]) => lines;

  // A fixed "now" so shipping math is deterministic.
  const now = new Date('2026-06-16T12:00:00Z');
  const days = (n: number) => new Date(now.getTime() + n * 86_400_000);

  describe('materials', () => {
    it('green when every part is fully covered by available stock', () => {
      const r = deriveReadiness({
        demand: demand([
          { partNumber: 'A', quantityRequired: 5 },
          { partNumber: 'B', quantityRequired: 2 },
        ]),
        availableByPart: stock([
          ['A', 5],
          ['B', 9],
        ]),
        heldParts: new Set(),
        dueDate: days(5),
        now,
      });
      expect(r.materials).toBe('green');
      expect(r.detail.shortParts).toBe(0);
      expect(r.detail.shortages).toHaveLength(0);
    });

    it('yellow when some (but not all) parts are short', () => {
      const r = deriveReadiness({
        demand: demand([
          { partNumber: 'A', quantityRequired: 5 },
          { partNumber: 'B', quantityRequired: 2 },
        ]),
        availableByPart: stock([
          ['A', 1],
          ['B', 9],
        ]),
        heldParts: new Set(),
        dueDate: days(5),
        now,
      });
      expect(r.materials).toBe('yellow');
      expect(r.detail.shortParts).toBe(1);
      expect(r.detail.shortages[0]).toMatchObject({
        partNumber: 'A',
        required: 5,
        available: 1,
        shortage: 4,
      });
    });

    it('red when every part is short', () => {
      const r = deriveReadiness({
        demand: demand([
          { partNumber: 'A', quantityRequired: 5 },
          { partNumber: 'B', quantityRequired: 2 },
        ]),
        availableByPart: stock([
          ['A', 0],
          ['B', 1],
        ]),
        heldParts: new Set(),
        dueDate: days(5),
        now,
      });
      expect(r.materials).toBe('red');
      expect(r.detail.shortParts).toBe(2);
    });

    it('unknown when there is no BOM/kit demand to evaluate', () => {
      const r = deriveReadiness({
        demand: [],
        availableByPart: stock([]),
        heldParts: new Set(),
        dueDate: days(5),
        now,
      });
      expect(r.materials).toBe('unknown');
      expect(
        r.detail.reasons.some((x) => /Sin lista de materiales/.test(x)),
      ).toBe(true);
    });

    it('treats a missing inventory position as zero available', () => {
      const r = deriveReadiness({
        demand: demand([{ partNumber: 'A', quantityRequired: 3 }]),
        availableByPart: stock([]), // no position for A
        heldParts: new Set(),
        dueDate: days(5),
        now,
      });
      expect(r.materials).toBe('red');
      expect(r.detail.shortages[0]).toMatchObject({
        partNumber: 'A',
        available: 0,
        shortage: 3,
      });
    });

    it('sorts shortages by magnitude (worst first)', () => {
      const r = deriveReadiness({
        demand: demand([
          { partNumber: 'A', quantityRequired: 10 },
          { partNumber: 'B', quantityRequired: 100 },
          { partNumber: 'C', quantityRequired: 5 },
        ]),
        availableByPart: stock([
          ['A', 1],
          ['B', 1],
          ['C', 1],
        ]),
        heldParts: new Set(),
        dueDate: days(5),
        now,
      });
      expect(r.detail.shortages.map((s) => s.partNumber)).toEqual([
        'B',
        'A',
        'C',
      ]);
    });
  });

  describe('quality', () => {
    it('red when any demanded part is under an active hold', () => {
      const r = deriveReadiness({
        demand: demand([
          { partNumber: 'A', quantityRequired: 1 },
          { partNumber: 'B', quantityRequired: 1 },
        ]),
        availableByPart: stock([
          ['A', 5],
          ['B', 5],
        ]),
        heldParts: new Set(['B']),
        dueDate: days(5),
        now,
      });
      expect(r.quality).toBe('red');
      expect(r.detail.heldParts).toEqual(['B']);
    });

    it('green when no demanded part is held (holds on unrelated parts ignored)', () => {
      const r = deriveReadiness({
        demand: demand([{ partNumber: 'A', quantityRequired: 1 }]),
        availableByPart: stock([['A', 5]]),
        heldParts: new Set(['Z']), // not in demand
        dueDate: days(5),
        now,
      });
      expect(r.quality).toBe('green');
      expect(r.detail.heldParts).toEqual([]);
    });

    it('unknown when there is no demand to evaluate', () => {
      const r = deriveReadiness({
        demand: [],
        availableByPart: stock([]),
        heldParts: new Set(['A']),
        dueDate: days(5),
        now,
      });
      expect(r.quality).toBe('unknown');
    });
  });

  describe('shipping', () => {
    it('green when the commit date is comfortably ahead', () => {
      const r = deriveReadiness({
        demand: demand([{ partNumber: 'A', quantityRequired: 1 }]),
        availableByPart: stock([['A', 5]]),
        heldParts: new Set(),
        dueDate: days(3),
        now,
      });
      expect(r.shipping).toBe('green');
      expect(r.detail.daysToDue).toBe(3);
    });

    it('yellow when due today', () => {
      const r = deriveReadiness({
        demand: demand([{ partNumber: 'A', quantityRequired: 1 }]),
        availableByPart: stock([['A', 5]]),
        heldParts: new Set(),
        dueDate: now,
        now,
      });
      expect(r.shipping).toBe('yellow');
      expect(r.detail.daysToDue).toBe(0);
    });

    it('red when past due', () => {
      const r = deriveReadiness({
        demand: demand([{ partNumber: 'A', quantityRequired: 1 }]),
        availableByPart: stock([['A', 5]]),
        heldParts: new Set(),
        dueDate: days(-2),
        now,
      });
      expect(r.shipping).toBe('red');
      expect(r.detail.daysToDue).toBe(-2);
    });

    it('unknown when there is no commit date', () => {
      const r = deriveReadiness({
        demand: demand([{ partNumber: 'A', quantityRequired: 1 }]),
        availableByPart: stock([['A', 5]]),
        heldParts: new Set(),
        dueDate: null,
        now,
      });
      expect(r.shipping).toBe('unknown');
      expect(r.detail.daysToDue).toBeNull();
    });
  });

  it('produces an all-green summary for the fully-ready case', () => {
    const r = deriveReadiness({
      demand: demand([{ partNumber: 'A', quantityRequired: 2 }]),
      availableByPart: stock([['A', 10]]),
      heldParts: new Set(),
      dueDate: days(4),
      now,
    });
    expect(r).toMatchObject({
      materials: 'green',
      quality: 'green',
      shipping: 'green',
    });
    expect(r.timestamp).toBeInstanceOf(Date);
  });
});
