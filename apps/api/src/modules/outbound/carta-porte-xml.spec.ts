import { buildCartaPorteXml, type FiscalProfileData } from './carta-porte-xml';
import {
  buildCartaPorte,
  type DocShipmentLike,
  type DocUnitLike,
  type DocLineLike,
} from './documents';

const lines: DocLineLike[] = [
  { partNumber: 'FG-1', description: 'Tablero', quantity: 10, uom: 'EA', lotNumber: 'L1', unitPrice: 25, currency: 'USD' },
];

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
const units: DocUnitLike[] = [
  {
    sscc: '000000000000000017',
    type: 'CARTON',
    weightKg: 12,
    contents: [{ partNumber: 'FG-1', quantity: 10, serials: ['S1'] }],
  },
];
const fiscal: FiscalProfileData = {
  emisorRfc: 'AAA010101AAA',
  emisorNombre: 'Mi Empresa SA de CV',
  regimenFiscal: '601',
  lugarExpedicion: '44100',
  origenDomicilio: 'Planta GDL',
  permSct: 'TPAF01',
  numPermisoSct: 'PERM-123',
  configVehicular: 'C2',
  aseguraRespCivil: 'Seguros XYZ',
  polizaRespCivil: 'POL-9',
  claveProdServDefault: '01010101',
};

describe('buildCartaPorteXml', () => {
  const carta = buildCartaPorte(shipment, lines, units);
  const xml = buildCartaPorteXml(carta, fiscal);

  it('is well-formed CFDI 4.0 + Carta Porte 3.1 with issuer + transport data', () => {
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<cfdi:Comprobante');
    expect(xml).toContain('Version="4.0"');
    expect(xml).toContain('Rfc="AAA010101AAA"');
    expect(xml).toContain('RegimenFiscal="601"');
    expect(xml).toContain('<cartaporte31:CartaPorte Version="3.1"');
    expect(xml).toContain('PermSCT="TPAF01"');
    expect(xml).toContain('ConfigVehicular="C2"');
    expect(xml).toContain('PlacaVM="ABC-123"');
    expect(xml).toContain('NombreFigura="Juan Pérez"');
  });

  it('emits a Mercancia per content line with the default SAT product key', () => {
    expect(xml).toContain('BienesTransp="01010101"');
    expect(xml).toContain('ClaveUnidad="H87"'); // EA → H87 (from buildCartaPorte)
    expect(xml).toMatch(/NumTotalMercancias="1"/);
  });

  it('escapes XML and notes the pending timbrado', () => {
    const cp = buildCartaPorte(
      { ...shipment, customerName: 'A & B <Co>' },
      [],
      units,
    );
    const x = buildCartaPorteXml(cp, fiscal);
    expect(x).toContain('Nombre="A &amp; B &lt;Co&gt;"');
    expect(x).toContain('faltan Sello, Certificado');
  });
});
