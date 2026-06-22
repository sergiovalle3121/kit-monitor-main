/**
 * Baseline semantic catalog — seeded per tenant on first access so the
 * Intelligence Center and CIDE are useful out of the box. Everything here maps
 * to data that already exists in Axos OS. Admins can extend/override later.
 *
 * Metric `resolver` keys must exist in SemanticService's resolver registry to
 * produce a live value; definition-only metrics simply omit it.
 */

export interface SeedMetric {
  key: string;
  name: string;
  description: string;
  unit: string;
  domain: string;
  grain: string;
  formula: string;
  resolver?: string;
  direction?: 'up' | 'down';
}

export interface SeedObject {
  key: string;
  name: string;
  description: string;
  domain: string;
  sourceEntity: string;
  primaryKey: string;
  properties: { name: string; type: string; description?: string }[];
}

export interface SeedLink {
  key: string;
  fromObject: string;
  toObject: string;
  cardinality: 'one_to_one' | 'one_to_many' | 'many_to_one' | 'many_to_many';
  verb: string;
  description: string;
}

export const SEED_METRICS: SeedMetric[] = [
  {
    key: 'inventory_value',
    name: 'Valor de inventario',
    description: 'Valor monetario total del inventario a costo promedio móvil.',
    unit: 'USD',
    domain: 'MATERIALS',
    grain: 'plant',
    formula: 'Σ (cantidad × costo unitario) sobre todas las partes valuadas',
    resolver: 'inventory_value',
    direction: 'down',
  },
  {
    key: 'active_quality_holds',
    name: 'Retenciones de calidad activas',
    description: 'Material actualmente bloqueado por calidad (holds abiertos).',
    unit: 'count',
    domain: 'QUALITY',
    grain: 'plant',
    formula: 'Conteo de holds de calidad en estado activo',
    resolver: 'active_quality_holds',
    direction: 'down',
  },
  {
    key: 'open_sales_orders',
    name: 'Órdenes de venta abiertas',
    description: 'Órdenes de venta (SD) que aún no se completan.',
    unit: 'count',
    domain: 'SALES',
    grain: 'plant',
    formula: 'Conteo de órdenes de venta no cerradas',
    resolver: 'open_sales_orders',
    direction: 'up',
  },
  {
    key: 'suppliers_count',
    name: 'Proveedores en el catálogo',
    description: 'Total de proveedores registrados (AVL).',
    unit: 'count',
    domain: 'MATERIALS',
    grain: 'plant',
    formula: 'Conteo de proveedores',
    resolver: 'suppliers_count',
    direction: 'up',
  },
  {
    key: 'mrp_runs',
    name: 'Corridas de MRP',
    description: 'Corridas de planeación de materiales registradas.',
    unit: 'count',
    domain: 'PLANNING',
    grain: 'plant',
    formula: 'Conteo de corridas de MRP',
    resolver: 'mrp_runs',
    direction: 'up',
  },
  {
    key: 'ledger_events_24h',
    name: 'Eventos del ledger (24 h)',
    description:
      'Actividad transaccional registrada en el Event Ledger en las últimas 24 horas.',
    unit: 'count',
    domain: 'SYSTEM',
    grain: 'plant',
    formula: 'Conteo de eventos del ledger con timestamp ≥ ahora − 24 h',
    resolver: 'ledger_events_24h',
    direction: 'up',
  },
  // ── Definition-only KPIs (cálculo en vivo pendiente de cableado) ──
  {
    key: 'oee',
    name: 'OEE',
    description:
      'Eficiencia general del equipo = Disponibilidad × Rendimiento × Calidad.',
    unit: '%',
    domain: 'PRODUCTION',
    grain: 'line',
    formula: 'Disponibilidad × Rendimiento × Calidad',
    direction: 'up',
  },
  {
    key: 'on_time_delivery',
    name: 'Entrega a tiempo (OTD)',
    description: 'Porcentaje de embarques entregados en o antes de la fecha comprometida.',
    unit: '%',
    domain: 'SHIPPING',
    grain: 'plant',
    formula: 'Embarques a tiempo / embarques totales',
    direction: 'up',
  },
];

export const SEED_OBJECTS: SeedObject[] = [
  {
    key: 'WorkOrder',
    name: 'Orden de trabajo',
    description: 'Orden transaccional autorizada para producir N unidades.',
    domain: 'PLANNING',
    sourceEntity: 'plans',
    primaryKey: 'workOrder',
    properties: [
      { name: 'workOrder', type: 'string', description: 'Folio de la WO' },
      { name: 'model', type: 'string', description: 'Modelo / producto' },
      { name: 'status', type: 'string' },
      { name: 'line', type: 'string' },
    ],
  },
  {
    key: 'Material',
    name: 'Material / número de parte',
    description: 'Número de parte del maestro de materiales.',
    domain: 'MATERIALS',
    sourceEntity: 'material_master',
    primaryKey: 'partNumber',
    properties: [
      { name: 'partNumber', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'standardCost', type: 'number', description: 'Costo estándar' },
    ],
  },
  {
    key: 'Supplier',
    name: 'Proveedor',
    description: 'Proveedor en la lista aprobada (AVL).',
    domain: 'MATERIALS',
    sourceEntity: 'suppliers',
    primaryKey: 'id',
    properties: [
      { name: 'name', type: 'string' },
      { name: 'code', type: 'string' },
      { name: 'status', type: 'string' },
    ],
  },
  {
    key: 'BOM',
    name: 'Lista de materiales',
    description: 'Estructura multinivel de componentes de un modelo.',
    domain: 'ENGINEERING',
    sourceEntity: 'bom',
    primaryKey: 'id',
    properties: [
      { name: 'model', type: 'string' },
      { name: 'revision', type: 'string' },
    ],
  },
  {
    key: 'QualityHold',
    name: 'Retención de calidad',
    description: 'Bloqueo de material por una condición de calidad.',
    domain: 'QUALITY',
    sourceEntity: 'quality',
    primaryKey: 'id',
    properties: [
      { name: 'partNumber', type: 'string' },
      { name: 'reason', type: 'string' },
      { name: 'status', type: 'string' },
    ],
  },
  {
    key: 'Customer',
    name: 'Cliente',
    description: 'Cliente final (SD).',
    domain: 'SALES',
    sourceEntity: 'erp_sd',
    primaryKey: 'customerCode',
    properties: [
      { name: 'customerCode', type: 'string' },
      { name: 'name', type: 'string' },
    ],
  },
  {
    key: 'LedgerEvent',
    name: 'Evento del ledger',
    description: 'Registro inmutable de una acción transaccional (auditoría).',
    domain: 'SYSTEM',
    sourceEntity: 'ledger_events',
    primaryKey: 'id',
    properties: [
      { name: 'domain', type: 'string' },
      { name: 'action', type: 'string' },
      { name: 'timestamp', type: 'datetime' },
    ],
  },
];

export const SEED_LINKS: SeedLink[] = [
  {
    key: 'wo_consumes_material',
    fromObject: 'WorkOrder',
    toObject: 'Material',
    cardinality: 'one_to_many',
    verb: 'consume',
    description: 'La WO consume materiales según su BOM/ruteo.',
  },
  {
    key: 'wo_built_from_bom',
    fromObject: 'WorkOrder',
    toObject: 'BOM',
    cardinality: 'many_to_one',
    verb: 'se construye con',
    description: 'La WO se produce a partir de una BOM/revisión.',
  },
  {
    key: 'material_sourced_from_supplier',
    fromObject: 'Material',
    toObject: 'Supplier',
    cardinality: 'many_to_many',
    verb: 'se surte de',
    description: 'Un material puede surtirse de uno o más proveedores (AVL).',
  },
  {
    key: 'wo_audited_by_ledger',
    fromObject: 'WorkOrder',
    toObject: 'LedgerEvent',
    cardinality: 'one_to_many',
    verb: 'auditada por',
    description: 'Cada acción sobre la WO genera eventos en el ledger.',
  },
  {
    key: 'hold_blocks_material',
    fromObject: 'QualityHold',
    toObject: 'Material',
    cardinality: 'many_to_one',
    verb: 'bloquea',
    description: 'Una retención de calidad bloquea un material.',
  },
  {
    key: 'customer_orders_wo',
    fromObject: 'Customer',
    toObject: 'WorkOrder',
    cardinality: 'one_to_many',
    verb: 'ordena',
    description: 'La demanda del cliente origina órdenes de trabajo.',
  },
];
