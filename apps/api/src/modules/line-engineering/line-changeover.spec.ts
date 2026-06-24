import { changeoverMatrix, ChangeoverModel } from './line-changeover';

const MODELS: ChangeoverModel[] = [
  {
    label: 'AX-1000',
    stations: [
      { station: 'LOAD', np: 'P1' },
      { station: 'GLUE', np: 'P2' },
      { station: 'TEST', np: 'P9' },
    ],
  },
  {
    label: 'AX-2000',
    stations: [
      { station: 'LOAD', np: 'P1' },
      { station: 'LABEL', np: 'P3' },
      { station: 'TEST', np: 'P9' },
    ],
  },
];

describe('changeoverMatrix (Fase 41)', () => {
  it('rolls up setup, teardown and retool into the changeover seconds', () => {
    const r = changeoverMatrix(MODELS, {
      setupSec: 300,
      teardownSec: 120,
      retoolSec: 180,
    });
    expect(r.labels).toEqual(['AX-1000', 'AX-2000']);
    const ab = r.pairs.find((p) => p.from === 'AX-1000' && p.to === 'AX-2000')!;
    // 1000→2000: add LABEL, drop GLUE, shared LOAD/TEST unchanged.
    expect(ab).toMatchObject({
      added: 1,
      removed: 1,
      retooled: 0,
      unchanged: 2,
    });
    expect(ab.changeoverSec).toBe(420); // 300 + 120
    expect(r.matrix[0][1]).toBe(420);
    expect(r.matrix[0][0]).toBe(0); // diagonal
  });

  it('charges a retool when a shared station changes its expected part', () => {
    const r = changeoverMatrix(
      [
        MODELS[0], // LOAD=P1, GLUE=P2, TEST=P9
        {
          label: 'AX-3000',
          stations: [
            { station: 'LOAD', np: 'PX' }, // same station, different part → retool
            { station: 'TEST', np: 'P9' },
          ],
        },
      ],
      { setupSec: 300, teardownSec: 120, retoolSec: 180 },
    );
    const ac = r.pairs.find((p) => p.from === 'AX-1000' && p.to === 'AX-3000')!;
    // add none, drop GLUE, retool LOAD, TEST unchanged.
    expect(ac).toMatchObject({
      added: 0,
      removed: 1,
      retooled: 1,
      unchanged: 1,
    });
    expect(ac.changeoverSec).toBe(300); // 120 teardown + 180 retool
  });

  it('reports the worst and best (cheapest non-zero) changeover', () => {
    const r = changeoverMatrix(MODELS, { setupSec: 300, teardownSec: 120 });
    // Symmetric here → both directions 420.
    expect(r.worstSec).toBe(420);
    expect(r.bestSec).toBe(420);
  });

  it('applies sensible default rates', () => {
    const r = changeoverMatrix(MODELS);
    expect(r.setupSec).toBe(300);
    expect(r.teardownSec).toBe(120);
    expect(r.retoolSec).toBe(180);
    // add LABEL (300) + drop GLUE (120) = 420 by default.
    expect(r.matrix[0][1]).toBe(420);
  });

  it('returns an empty matrix for fewer than two models', () => {
    const r = changeoverMatrix([MODELS[0]]);
    expect(r.pairs).toEqual([]);
    expect(r.worstSec).toBe(0);
    expect(r.bestSec).toBe(0);
  });
});
