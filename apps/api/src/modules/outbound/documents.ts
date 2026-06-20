// ─────────────────────────────────────────────────────────────────────────────
// Shipping documents — pure assembly of the Bill of Lading, the Mexican Carta
// Porte (CFDI 3.1 complemento) and the Commercial Invoice from a shipment, its
// content lines and its handling units.
//
// Honest scope (like the SSCC placeholder): we assemble every field we hold and
// list the ones that need configuration (issuer RFC, SAT catalogs, permits, PAC
// timbrado) in `requiresConfig` — we don't fake a fiscally valid CFDI. Pure +
// side-effect free so it's unit-tested without a DB; the service does the IO.
// ─────────────────────────────────────────────────────────────────────────────

export interface DocShipmentLike {
  folio: string | null;
  asn: string | null;
  customerName: string | null;
  destination: string | null;
  incoterm: string;
  carrier: string | null;
  trackingNumber: string | null;
  vehiclePlate: string | null;
  vehicleType: string | null;
  driverName: string | null;
  dockCode: string | null;
  shippedDate: Date | string | null;
  status: string;
}
export interface DocLineLike {
  partNumber: string;
  description: string | null;
  quantity: number;
  uom: string;
  lotNumber: string | null;
  unitPrice: number | null;
  currency: string | null;
}
export interface DocUnitLike {
  sscc: string | null;
  type: string;
  weightKg: number | null;
}

function isoDate(d: Date | string | null): string {
  const dt = d ? (typeof d === 'string' ? new Date(d) : d) : new Date();
  return Number.isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
}
const sumWeight = (units: DocUnitLike[]) =>
  Math.round(units.reduce((a, u) => a + (Number(u.weightKg) || 0), 0) * 1000) /
  1000;
const sumPieces = (lines: DocLineLike[]) =>
  lines.reduce((a, l) => a + (Number(l.quantity) || 0), 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Bill of Lading ───────────────────────────────────────────────────────────

export interface Bol {
  bolNumber: string | null;
  date: string;
  shipFrom: { name: string | null; address: string | null };
  shipTo: { name: string | null; address: string | null };
  carrier: string | null;
  vehicle: { plate: string | null; type: string | null };
  driver: string | null;
  dock: string | null;
  freightTerms: string;
  tracking: string | null;
  items: {
    partNumber: string;
    description: string | null;
    quantity: number;
    uom: string;
    lotNumber: string | null;
  }[];
  totals: { packages: number; pieces: number; weightKg: number };
  requiresConfig: string[];
}

export function buildBol(
  shipment: DocShipmentLike,
  lines: DocLineLike[],
  units: DocUnitLike[],
): Bol {
  return {
    bolNumber: shipment.folio,
    date: isoDate(shipment.shippedDate),
    shipFrom: { name: null, address: null },
    shipTo: { name: shipment.customerName, address: shipment.destination },
    carrier: shipment.carrier,
    vehicle: { plate: shipment.vehiclePlate, type: shipment.vehicleType },
    driver: shipment.driverName,
    dock: shipment.dockCode,
    freightTerms: shipment.incoterm,
    tracking: shipment.trackingNumber,
    items: lines.map((l) => ({
      partNumber: l.partNumber,
      description: l.description,
      quantity: l.quantity,
      uom: l.uom,
      lotNumber: l.lotNumber,
    })),
    totals: {
      packages: units.length,
      pieces: sumPieces(lines),
      weightKg: sumWeight(units),
    },
    requiresConfig: [
      'Domicilio del remitente (ship-from)',
      'Términos de flete (prepaid/collect) y firmas',
    ],
  };
}

// ── Carta Porte (MX, CFDI complemento 3.1) ───────────────────────────────────

const UOM_TO_CLAVE: Record<string, string> = {
  EA: 'H87',
  PZ: 'H87',
  PCS: 'H87',
  KG: 'KGM',
  L: 'LTR',
  M: 'MTR',
  BOX: 'XBX',
};
const claveUnidad = (uom: string) =>
  UOM_TO_CLAVE[(uom || '').toUpperCase()] ?? 'H87';

export interface CartaPorte {
  version: '3.1';
  tipoComprobante: 'T';
  idCCP: string | null;
  fecha: string;
  emisor: { nombre: string | null; rfc: string | null };
  receptor: {
    nombre: string | null;
    rfc: string | null;
    domicilio: string | null;
  };
  transporte: {
    transportista: string | null;
    placaVM: string | null;
    unidad: string | null;
    configVehicular: string | null;
    permSCT: string | null;
    numPermisoSCT: string | null;
    operador: string | null;
  };
  mercancias: {
    descripcion: string;
    cantidad: number;
    claveUnidad: string;
    claveProdServ: string | null;
    pesoEnKg: number;
    lote: string | null;
  }[];
  pesoBrutoTotal: number;
  numTotalMercancias: number;
  requiresConfig: string[];
  note: string;
}

export function buildCartaPorte(
  shipment: DocShipmentLike,
  lines: DocLineLike[],
  units: DocUnitLike[],
): CartaPorte {
  const pesoBrutoTotal = sumWeight(units);
  return {
    version: '3.1',
    tipoComprobante: 'T',
    idCCP: shipment.folio,
    fecha: isoDate(shipment.shippedDate),
    emisor: { nombre: null, rfc: null },
    receptor: {
      nombre: shipment.customerName,
      rfc: null,
      domicilio: shipment.destination,
    },
    transporte: {
      transportista: shipment.carrier,
      placaVM: shipment.vehiclePlate,
      unidad: shipment.vehicleType,
      configVehicular: null,
      permSCT: null,
      numPermisoSCT: null,
      operador: shipment.driverName,
    },
    mercancias: lines.map((l) => ({
      descripcion: l.description || l.partNumber,
      cantidad: l.quantity,
      claveUnidad: claveUnidad(l.uom),
      claveProdServ: null,
      pesoEnKg: 0,
      lote: l.lotNumber,
    })),
    pesoBrutoTotal,
    numTotalMercancias: lines.length,
    requiresConfig: [
      'RFC del emisor y receptor',
      'ClaveProdServ por mercancía (catálogo SAT c_ClaveProdServ)',
      'Peso por mercancía',
      'Configuración vehicular y permiso SCT (tipo + número)',
      'Aseguradora y póliza de responsabilidad civil',
      'Timbrado por PAC (CFDI 4.0 + complemento Carta Porte 3.1)',
    ],
    note: 'Representación de datos para Carta Porte 3.1. Requiere catálogos SAT y timbrado por un PAC para validez fiscal.',
  };
}

// ── Commercial invoice ───────────────────────────────────────────────────────

export interface InvoiceLine {
  partNumber: string;
  description: string | null;
  quantity: number;
  uom: string;
  unitPrice: number;
  amount: number;
}
export interface CommercialInvoice {
  invoiceNumber: string | null;
  date: string;
  seller: { name: string | null };
  buyer: { name: string | null; address: string | null };
  incoterm: string;
  currency: string;
  lines: InvoiceLine[];
  subtotal: number;
  total: number;
  requiresConfig: string[];
}

export function buildCommercialInvoice(
  shipment: DocShipmentLike,
  lines: DocLineLike[],
): CommercialInvoice {
  const currency = lines.find((l) => l.currency)?.currency ?? 'MXN';
  const invLines: InvoiceLine[] = lines.map((l) => {
    const unitPrice = Number(l.unitPrice) || 0;
    return {
      partNumber: l.partNumber,
      description: l.description,
      quantity: l.quantity,
      uom: l.uom,
      unitPrice: round2(unitPrice),
      amount: round2((Number(l.quantity) || 0) * unitPrice),
    };
  });
  const subtotal = round2(invLines.reduce((a, l) => a + l.amount, 0));

  const requiresConfig: string[] = [
    'Datos fiscales del emisor (RFC, domicilio)',
    'Impuestos aplicables (IVA / retenciones)',
  ];
  if (lines.some((l) => !(Number(l.unitPrice) > 0))) {
    requiresConfig.unshift('Precio unitario en una o más líneas');
  }

  return {
    invoiceNumber: shipment.folio ? `INV-${shipment.folio}` : null,
    date: isoDate(shipment.shippedDate),
    seller: { name: null },
    buyer: { name: shipment.customerName, address: shipment.destination },
    incoterm: shipment.incoterm,
    currency,
    lines: invLines,
    subtotal,
    total: subtotal,
    requiresConfig,
  };
}
