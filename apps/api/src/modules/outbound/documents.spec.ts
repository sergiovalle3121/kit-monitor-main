import {
  buildBol,
  buildCartaPorte,
  buildCoc,
  buildCommercialInvoice,
  type DocLineLike,
  type DocShipmentLike,
  type DocUnitLike,
} from './documents';

const shipment: DocShipmentLike = {
  folio: 'SHP-2026-000001',
  asn: 'ASN-2026-000001',
  customerName: 'Cliente A',
  destination: 'Guadalajara, MX',
  incoterm: 'DAP',
  carrier: 'DHL',
  trackingNumber: '1Z999',
  vehiclePlate: 'ABC-123',
  vehicleType: 'DRY_VAN',
  driverName: 'Juan Pérez',
  dockCode: 'D-1',
  shippedDate: '2026-06-20',
  status: 'SHIPPED',
};
const lines: DocLineLike[] = [
  {
    partNumber: 'FG-1',
    description: 'Tablero X',
    quantity: 10,
    uom: 'EA',
    lotNumber: 'L1',
    unitPrice: 25,
    currency: 'USD',
  },
  {
    partNumber: 'FG-2',
    description: null,
    quantity: 5,
    uom: 'EA',
    lotNumber: null,
    unitPrice: null,
    currency: 'USD',
  },
];
const units: DocUnitLike[] = [
  { sscc: '000000000000000017', type: 'PALLET', weightKg: 120 },
  { sscc: '000000000000000024', type: 'CARTON', weightKg: 12 },
];

describe('buildBol', () => {
  it('assembles consignee, carrier, vehicle and totals', () => {
    const bol = buildBol(shipment, lines, units);
    expect(bol.bolNumber).toBe('SHP-2026-000001');
    expect(bol.shipTo).toEqual({
      name: 'Cliente A',
      address: 'Guadalajara, MX',
    });
    expect(bol.vehicle).toEqual({ plate: 'ABC-123', type: 'DRY_VAN' });
    expect(bol.driver).toBe('Juan Pérez');
    expect(bol.totals).toEqual({ packages: 2, pieces: 15, weightKg: 132 });
    expect(bol.requiresConfig.length).toBeGreaterThan(0);
  });
});

describe('buildCartaPorte', () => {
  it('maps UoM to SAT clave and rolls gross weight, flagging SAT config', () => {
    const cp = buildCartaPorte(shipment, lines, units);
    expect(cp.version).toBe('3.1');
    expect(cp.receptor.nombre).toBe('Cliente A');
    expect(cp.transporte.placaVM).toBe('ABC-123');
    expect(cp.transporte.operador).toBe('Juan Pérez');
    expect(cp.mercancias[0].claveUnidad).toBe('H87'); // EA → H87
    expect(cp.pesoBrutoTotal).toBe(132);
    expect(cp.numTotalMercancias).toBe(2);
    expect(cp.requiresConfig.some((r) => /RFC/.test(r))).toBe(true);
    expect(cp.requiresConfig.some((r) => /PAC/.test(r))).toBe(true);
  });
});

describe('buildCommercialInvoice', () => {
  it('computes line amounts and subtotal, flags missing prices', () => {
    const inv = buildCommercialInvoice(shipment, lines);
    expect(inv.invoiceNumber).toBe('INV-SHP-2026-000001');
    expect(inv.currency).toBe('USD');
    expect(inv.lines[0].amount).toBe(250); // 10 × 25
    expect(inv.lines[1].amount).toBe(0); // no price
    expect(inv.subtotal).toBe(250);
    expect(inv.total).toBe(250);
    expect(inv.requiresConfig[0]).toMatch(/Precio unitario/);
  });

  it('does not flag missing prices when all lines are priced', () => {
    const priced = lines.map((l) => ({ ...l, unitPrice: 10 }));
    const inv = buildCommercialInvoice(shipment, priced);
    expect(inv.requiresConfig.some((r) => /Precio unitario/.test(r))).toBe(
      false,
    );
    expect(inv.subtotal).toBe(150); // (10+5) × 10
  });
});

describe('buildCoc', () => {
  it('certifies lots/quantities and collects shipped serials', () => {
    const withSerials: DocUnitLike[] = [
      {
        sscc: 's',
        type: 'CARTON',
        weightKg: 5,
        contents: [{ partNumber: 'FG-1', serials: ['SN-1', 'SN-2'] }],
      },
    ];
    const coc = buildCoc(shipment, lines, withSerials);
    expect(coc.certNumber).toBe('COC-SHP-2026-000001');
    expect(coc.items.map((i) => i.partNumber)).toEqual(['FG-1', 'FG-2']);
    expect(coc.serials).toEqual(['SN-1', 'SN-2']);
    expect(coc.totals.pieces).toBe(15);
    expect(coc.statement).toMatch(/certifica/i);
    expect(coc.requiresConfig.length).toBeGreaterThan(0);
  });
});
