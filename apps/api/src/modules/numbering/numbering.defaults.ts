import { ResetPolicy } from './numbering.format';

export interface SequenceDefault {
  docType: string;
  name: string;
  prefix: string;
  pattern: string;
  padding: number;
  resetPolicy: ResetPolicy;
  description?: string;
}

/**
 * Built-in defaults for the standard EMS document types. When a module asks for
 * a folio of a type that has not been configured yet, the service lazily creates
 * the sequence from this registry — so numbering "just works" everywhere while
 * still being fully overridable per tenant/plant from the admin screen.
 */
export const DEFAULT_SEQUENCES: SequenceDefault[] = [
  { docType: 'WORK_ORDER', name: 'Orden de Trabajo', prefix: 'WO', pattern: '{PREFIX}-{YYYY}-{SEQ}', padding: 6, resetPolicy: 'YEARLY', description: 'Órdenes de producción (MES / PP).' },
  { docType: 'PURCHASE_ORDER', name: 'Orden de Compra', prefix: 'PO', pattern: '{PREFIX}-{YYYY}-{SEQ}', padding: 6, resetPolicy: 'YEARLY', description: 'Órdenes de compra a proveedor (MM).' },
  { docType: 'SALES_ORDER', name: 'Orden de Venta', prefix: 'SO', pattern: '{PREFIX}-{YYYY}-{SEQ}', padding: 6, resetPolicy: 'YEARLY', description: 'Pedidos de cliente (SD).' },
  { docType: 'REQUISITION', name: 'Requisición de Compra', prefix: 'REQ', pattern: '{PREFIX}-{YYYY}-{SEQ}', padding: 6, resetPolicy: 'YEARLY', description: 'Requisiciones internas (MM).' },
  { docType: 'RFQ', name: 'Solicitud de Cotización', prefix: 'RFQ', pattern: '{PREFIX}-{YYYY}-{SEQ}', padding: 5, resetPolicy: 'YEARLY', description: 'RFQ a proveedores (Sourcing).' },
  { docType: 'QUOTE', name: 'Cotización a Cliente', prefix: 'QT', pattern: '{PREFIX}-{YYYY}-{SEQ}', padding: 5, resetPolicy: 'YEARLY', description: 'Cotizaciones de venta (SD / CRM).' },
  { docType: 'NCR', name: 'Reporte de No Conformidad', prefix: 'NCR', pattern: '{PREFIX}-{YYYY}-{SEQ}', padding: 5, resetPolicy: 'YEARLY', description: 'No conformidades de calidad.' },
  { docType: 'CAPA', name: 'Acción Correctiva (CAPA / 8D)', prefix: 'CAPA', pattern: '{PREFIX}-{YYYY}-{SEQ}', padding: 5, resetPolicy: 'YEARLY', description: 'Acciones correctivas y preventivas.' },
  { docType: 'ECO', name: 'Cambio de Ingeniería (ECO / ECN)', prefix: 'ECO', pattern: '{PREFIX}-{YYYY}-{SEQ}', padding: 5, resetPolicy: 'YEARLY', description: 'Control de cambios de ingeniería.' },
  { docType: 'ASN', name: 'Aviso de Embarque (ASN)', prefix: 'ASN', pattern: '{PREFIX}-{YYYY}-{SEQ}', padding: 6, resetPolicy: 'YEARLY', description: 'Advance shipping notice (EDI 856).' },
  { docType: 'SHIPMENT', name: 'Embarque', prefix: 'SHP', pattern: '{PREFIX}-{YYYY}-{SEQ}', padding: 6, resetPolicy: 'YEARLY', description: 'Embarques de producto terminado.' },
  { docType: 'RECEIPT', name: 'Recepción de Material', prefix: 'RCV', pattern: '{PREFIX}-{YYYY}-{SEQ}', padding: 6, resetPolicy: 'YEARLY', description: 'Recepciones en almacén (Inbound).' },
  { docType: 'INVOICE', name: 'Factura', prefix: 'INV', pattern: '{PREFIX}-{YYYY}-{SEQ}', padding: 6, resetPolicy: 'YEARLY', description: 'Facturas de venta (AR).' },
  { docType: 'CYCLE_COUNT', name: 'Conteo Cíclico', prefix: 'CC', pattern: '{PREFIX}-{YYYY}{MM}-{SEQ}', padding: 4, resetPolicy: 'MONTHLY', description: 'Conteos cíclicos de inventario.' },
  { docType: 'MAINTENANCE_ORDER', name: 'Orden de Mantenimiento', prefix: 'MO', pattern: '{PREFIX}-{YYYY}-{SEQ}', padding: 6, resetPolicy: 'YEARLY', description: 'Órdenes de mantenimiento (CMMS).' },
  { docType: 'KIT', name: 'Kit de Materiales', prefix: 'KIT', pattern: '{PREFIX}-{YYYY}-{SEQ}', padding: 6, resetPolicy: 'YEARLY', description: 'Kits de surtido por WO.' },
  { docType: 'IMPROVEMENT', name: 'Iniciativa de Mejora', prefix: 'CI', pattern: '{PREFIX}-{YYYY}-{SEQ}', padding: 5, resetPolicy: 'YEARLY', description: 'Iniciativas de mejora continua (Kaizen / Lean / 6σ).' },
  { docType: 'EHS_INCIDENT', name: 'Incidente EHS', prefix: 'INC', pattern: '{PREFIX}-{YYYY}-{SEQ}', padding: 5, resetPolicy: 'YEARLY', description: 'Incidentes de seguridad y medio ambiente.' },
  { docType: 'ASSET', name: 'Activo / Equipo', prefix: 'EQ', pattern: '{PREFIX}-{SEQ}', padding: 5, resetPolicy: 'NEVER', description: 'Activos mantenibles (CMMS).' },
  { docType: 'CONTRACT', name: 'Contrato', prefix: 'CON', pattern: '{PREFIX}-{YYYY}-{SEQ}', padding: 5, resetPolicy: 'YEARLY', description: 'Contratos legales / compliance.' },
  { docType: 'TEST_RECORD', name: 'Registro de Prueba', prefix: 'TST', pattern: '{PREFIX}-{YYYY}{MM}-{SEQ}', padding: 6, resetPolicy: 'MONTHLY', description: 'Resultados de prueba (Test Engineering).' },
  { docType: 'CERTIFICATION', name: 'Certificación', prefix: 'CERT', pattern: '{PREFIX}-{YYYY}-{SEQ}', padding: 5, resetPolicy: 'YEARLY', description: 'Certificaciones de skills (RH).' },
  { docType: 'OPPORTUNITY', name: 'Oportunidad de Venta', prefix: 'OPP', pattern: '{PREFIX}-{YYYY}-{SEQ}', padding: 5, resetPolicy: 'YEARLY', description: 'Oportunidades de venta (CRM / SD).' },
  { docType: 'FIXED_ASSET', name: 'Activo Fijo', prefix: 'FA', pattern: '{PREFIX}-{SEQ}', padding: 5, resetPolicy: 'NEVER', description: 'Activos fijos capitalizados (FIN).' },
  { docType: 'EXPENSE', name: 'Reporte de Gasto', prefix: 'EXP', pattern: '{PREFIX}-{YYYY}-{SEQ}', padding: 5, resetPolicy: 'YEARLY', description: 'Gastos / viáticos (FIN / AP).' },
];

const PATTERN_FALLBACK = '{PREFIX}-{YYYY}-{SEQ}';

export function findDefault(docType: string): SequenceDefault | undefined {
  const key = (docType ?? '').toUpperCase().trim();
  return DEFAULT_SEQUENCES.find((d) => d.docType === key);
}

/**
 * Resolves the effective config for a docType: the registered default if known,
 * otherwise a sensible derived default so unknown types still get a clean folio.
 */
export function resolveDefault(docType: string): SequenceDefault {
  const key = (docType ?? '').toUpperCase().trim();
  return (
    findDefault(key) ?? {
      docType: key,
      name: key,
      prefix: key.replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'DOC',
      pattern: PATTERN_FALLBACK,
      padding: 6,
      resetPolicy: 'YEARLY',
    }
  );
}
