// ─────────────────────────────────────────────────────────────────────────────
// CFDI 4.0 + complemento Carta Porte 3.1 — XML builder (pure).
//
// Produces the well-formed XML you would hand to a PAC for timbrado, from the
// assembled Carta Porte data + the tenant's fiscal profile. Honest scope: the
// Sello, Certificado and TimbreFiscalDigital come from the issuer's CSD and the
// PAC, so they are intentionally left out (noted in a comment). Unconfigured
// fiscal fields render empty rather than faked, so it's obvious what's missing.
// Pure + side-effect free so it's unit-tested without a DB.
// ─────────────────────────────────────────────────────────────────────────────
import type { CartaPorte } from './documents';

export interface FiscalProfileData {
  emisorRfc: string | null;
  emisorNombre: string | null;
  regimenFiscal: string | null;
  lugarExpedicion: string | null;
  origenDomicilio: string | null;
  permSct: string | null;
  numPermisoSct: string | null;
  configVehicular: string | null;
  aseguraRespCivil: string | null;
  polizaRespCivil: string | null;
  claveProdServDefault: string | null;
}

const xa = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Build the CFDI 4.0 + Carta Porte 3.1 XML (pre-timbrado). */
export function buildCartaPorteXml(
  carta: CartaPorte,
  fiscal: FiscalProfileData,
): string {
  const fecha =
    (carta.fecha || new Date().toISOString().slice(0, 10)) + 'T00:00:00';
  const claveProdServ = fiscal.claveProdServDefault || '';

  const mercanciaNodes = carta.mercancias
    .map(
      (m) =>
        `        <cartaporte31:Mercancia BienesTransp="${xa(claveProdServ)}" Descripcion="${xa(m.descripcion)}" Cantidad="${xa(m.cantidad)}" ClaveUnidad="${xa(m.claveUnidad)}" PesoEnKg="${xa(m.pesoEnKg)}"/>`,
    )
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- Pre-timbrado: faltan Sello, Certificado y TimbreFiscalDigital (CSD del emisor + PAC). -->',
    '<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:cartaporte31="http://www.sat.gob.mx/CartaPorte31"' +
      ` Version="4.0" TipoDeComprobante="T" Fecha="${xa(fecha)}" Moneda="XXX" SubTotal="0" Total="0"` +
      ` Exportacion="01" LugarExpedicion="${xa(fiscal.lugarExpedicion)}">`,
    `  <cfdi:Emisor Rfc="${xa(fiscal.emisorRfc)}" Nombre="${xa(fiscal.emisorNombre)}" RegimenFiscal="${xa(fiscal.regimenFiscal)}"/>`,
    `  <cfdi:Receptor Rfc="${xa(carta.receptor.rfc)}" Nombre="${xa(carta.receptor.nombre)}" DomicilioFiscalReceptor="" RegimenFiscalReceptor="616" UsoCFDI="S01"/>`,
    '  <cfdi:Conceptos>',
    '    <cfdi:Concepto ClaveProdServ="78101800" Cantidad="1" ClaveUnidad="E48" Descripcion="Servicio de transporte de carga" ValorUnitario="0" Importe="0" ObjetoImp="01"/>',
    '  </cfdi:Conceptos>',
    '  <cfdi:Complemento>',
    `    <cartaporte31:CartaPorte Version="3.1" TranspInternac="No" TotalDistRec="0">`,
    '      <cartaporte31:Ubicaciones>',
    `        <cartaporte31:Ubicacion TipoUbicacion="Origen" RFCRemitenteDestinatario="${xa(fiscal.emisorRfc)}" FechaHoraSalidaLlegada="${xa(fecha)}"/>`,
    `        <cartaporte31:Ubicacion TipoUbicacion="Destino" RFCRemitenteDestinatario="${xa(carta.receptor.rfc)}" FechaHoraSalidaLlegada="${xa(fecha)}"/>`,
    '      </cartaporte31:Ubicaciones>',
    `      <cartaporte31:Mercancias PesoBrutoTotal="${xa(carta.pesoBrutoTotal)}" UnidadPeso="KGM" NumTotalMercancias="${xa(carta.numTotalMercancias)}">`,
    mercanciaNodes,
    '        <cartaporte31:Autotransporte' +
      ` PermSCT="${xa(fiscal.permSct)}" NumPermisoSCT="${xa(fiscal.numPermisoSct)}">`,
    `          <cartaporte31:IdentificacionVehicular ConfigVehicular="${xa(fiscal.configVehicular)}" PlacaVM="${xa(carta.transporte.placaVM)}" AnioModeloVM=""/>`,
    `          <cartaporte31:Seguros AseguraRespCivil="${xa(fiscal.aseguraRespCivil)}" PolizaRespCivil="${xa(fiscal.polizaRespCivil)}"/>`,
    '        </cartaporte31:Autotransporte>',
    '      </cartaporte31:Mercancias>',
    '      <cartaporte31:FiguraTransporte>',
    `        <cartaporte31:TiposFigura TipoFigura="01" NombreFigura="${xa(carta.transporte.operador)}"/>`,
    '      </cartaporte31:FiguraTransporte>',
    '    </cartaporte31:CartaPorte>',
    '  </cfdi:Complemento>',
    '</cfdi:Comprobante>',
  ].join('\n');
}
