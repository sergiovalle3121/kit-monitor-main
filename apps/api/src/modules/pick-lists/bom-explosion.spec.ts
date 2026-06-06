import { explodeBom, BomExplosionInput } from './bom-explosion';

describe('explodeBom', () => {
  const bom: BomExplosionInput[] = [
    {
      partNumber: 'OP-520-0100',
      description: 'Cable harness',
      usageFactor: 2,
      unit: 'EA',
    },
    {
      partNumber: 'OP-520-0101',
      description: 'Screw M3',
      usageFactor: 4,
      unit: 'EA',
    },
  ];

  it('multiplies usage factor by the plan quantity', () => {
    const lines = explodeBom(bom, 10);
    expect(lines).toEqual([
      {
        partNumber: 'OP-520-0100',
        description: 'Cable harness',
        quantityRequired: 20,
        unit: 'EA',
      },
      {
        partNumber: 'OP-520-0101',
        description: 'Screw M3',
        quantityRequired: 40,
        unit: 'EA',
      },
    ]);
  });

  it('consolidates duplicate part numbers across BOM lines', () => {
    const lines = explodeBom(
      [
        { partNumber: 'P-1', usageFactor: 1, unit: 'EA' },
        { partNumber: 'P-1', usageFactor: 3, unit: 'EA' },
      ],
      5,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ partNumber: 'P-1', quantityRequired: 20 });
  });

  it('defaults the unit to EA and tolerates missing usage factors', () => {
    const lines = explodeBom(
      [
        {
          partNumber: 'P-2',
          usageFactor: undefined as unknown as number,
          unit: null,
        },
      ],
      3,
    );
    expect(lines[0]).toEqual({
      partNumber: 'P-2',
      description: null,
      quantityRequired: 0,
      unit: 'EA',
    });
  });

  it('skips rows with a blank part number', () => {
    const lines = explodeBom(
      [
        { partNumber: '   ', usageFactor: 2 },
        { partNumber: 'P-3', usageFactor: 1 },
      ],
      2,
    );
    expect(lines.map((l) => l.partNumber)).toEqual(['P-3']);
  });

  it('rejects non-positive quantities', () => {
    expect(() => explodeBom(bom, 0)).toThrow(/positive number/);
    expect(() => explodeBom(bom, -5)).toThrow(/positive number/);
  });
});
