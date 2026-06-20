import {
  buildAsn,
  buildPackingList,
  packingListCsv,
  toEdi856,
  type AsnShipmentLike,
  type AsnUnitLike,
} from './asn';

const shipment: AsnShipmentLike = {
  id: 'ship-1',
  folio: 'SHP-2026-000001',
  asn: 'ASN-2026-000001',
  customerName: 'Cliente A',
  destination: 'Guadalajara, MX',
  carrier: 'DHL',
  trackingNumber: '1Z999',
  incoterm: 'DAP',
  status: 'SHIPPED',
  shippedDate: '2026-06-20',
};

// A pallet (tare) containing one carton (pack); plus a standalone box.
const units: AsnUnitLike[] = [
  {
    id: 'pallet-1',
    sscc: '000000000000000017',
    type: 'PALLET',
    parentId: null,
    status: 'LOADED',
    weightKg: 120,
    contents: null,
  },
  {
    id: 'carton-1',
    sscc: '000000000000000024',
    type: 'CARTON',
    parentId: 'pallet-1',
    status: 'LOADED',
    weightKg: 12,
    contents: [{ partNumber: 'PN-1', quantity: 10, serials: ['S1', 'S2'] }],
  },
  {
    id: 'box-1',
    sscc: '000000000000000031',
    type: 'BOX',
    parentId: null,
    status: 'PACKED',
    weightKg: 3,
    contents: [{ partNumber: 'PN-2', quantity: 5 }],
  },
];

describe('buildAsn', () => {
  it('nests packs under their tare and keeps standalone units as tares', () => {
    const asn = buildAsn(shipment, units);
    expect(asn.hierarchy).toHaveLength(2); // pallet-1 + box-1
    const pallet = asn.hierarchy.find((t) => t.id === 'pallet-1')!;
    expect(pallet.packs.map((p) => p.id)).toEqual(['carton-1']);
    const box = asn.hierarchy.find((t) => t.id === 'box-1')!;
    expect(box.packs).toHaveLength(0);
    expect(box.lines[0].partNumber).toBe('PN-2');
  });

  it('rolls up totals across the whole tree', () => {
    const { totals } = buildAsn(shipment, units);
    expect(totals).toMatchObject({
      tares: 2,
      packs: 1,
      units: 3,
      pieces: 15,
      parts: 2,
      loaded: 2,
    });
    expect(totals.weightKg).toBe(135);
  });

  it('carries shipment header fields onto the ASN', () => {
    const asn = buildAsn(shipment, units);
    expect(asn.asn).toBe('ASN-2026-000001');
    expect(asn.shipTo).toEqual({
      name: 'Cliente A',
      destination: 'Guadalajara, MX',
    });
    expect(asn.shipDate).toBe('2026-06-20');
  });
});

describe('buildPackingList + CSV', () => {
  it('flattens one row per content line with totals', () => {
    const pl = buildPackingList(shipment, units);
    // PN-1 (carton) + PN-2 (box) + the empty pallet placeholder row.
    expect(
      pl.rows.some((r) => r.partNumber === 'PN-1' && r.quantity === 10),
    ).toBe(true);
    expect(
      pl.rows.some((r) => r.partNumber === 'PN-2' && r.quantity === 5),
    ).toBe(true);
    expect(pl.totals).toMatchObject({
      units: 3,
      pieces: 15,
      parts: 2,
      weightKg: 135,
    });
  });

  it('renders CSV with a header and a totals line', () => {
    const csv = packingListCsv(buildPackingList(shipment, units));
    const lines = csv.split('\n');
    expect(lines[0]).toBe('SSCC,Tipo,Parte,Cantidad,Series,Peso(kg),Cargada');
    expect(csv).toContain('PN-1');
    expect(csv).toContain('S1 S2');
    expect(lines[lines.length - 1]).toContain('TOTAL 2 partes');
  });
});

describe('toEdi856', () => {
  it('emits a well-formed 856 with HL S→T→P loops, SSCCs and items', () => {
    const edi = toEdi856(buildAsn(shipment, units));
    expect(edi).toContain('ST*856*0001~');
    expect(edi).toContain('BSN*00*ASN-2026-000001*20260620*0000~');
    expect(edi).toContain('HL*1**S~'); // shipment
    expect(edi).toContain('MAN*GM*000000000000000017~'); // pallet SSCC
    expect(edi).toContain('MAN*GM*000000000000000024~'); // carton SSCC
    expect(edi).toContain('LIN**BP*PN-1~');
    expect(edi).toContain('SN1**10*EA~');
    expect(edi).toContain('REF*SE*S1~'); // serial
    expect(edi).toContain('CTT*4~'); // shipment + 2 tares + 1 pack = 4 HL loops
    // SE segment count must equal the number of segments (ST..SE inclusive).
    const segs = edi.split('\n').length;
    expect(edi).toContain(`SE*${segs}*0001~`);
  });
});
