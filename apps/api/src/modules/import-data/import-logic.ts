/**
 * Pure import mapping + validation (the SAP-migration engine). Side-effect free
 * so column mapping, type coercion and per-row validation are unit-testable with
 * no DB. The service does parsing/persistence and delegates the row logic here.
 */

import { MATERIAL_ITEM_TYPES } from '../material-master/material-state';
import { BOM_ITEM_CATEGORIES } from '../bom-tree/bom-state';

export type ImportSource = 'CSV' | 'EXCEL' | 'SQL_STAGING' | 'IDOC_API';
export const IMPORT_SOURCES: ImportSource[] = ['CSV', 'EXCEL', 'SQL_STAGING', 'IDOC_API'];

export type ImportTarget = 'MATERIAL' | 'BOM' | 'ROUTING';
export const IMPORT_TARGETS: ImportTarget[] = ['MATERIAL', 'BOM', 'ROUTING'];

export type ImportCapabilityStatus = 'READY' | 'CONFIG_REQUIRED' | 'MANUAL_LINK';

export interface ImportCapabilitySource {
  source: ImportSource;
  label: string;
  status: ImportCapabilityStatus;
  detail: string;
  supportedTargets: ImportTarget[];
}

export interface ImportCapabilityTarget {
  target: ImportTarget;
  label: string;
  sapObjects: string[];
  writesTo: string[];
  route: string;
  commitBehavior: string;
  prerequisite: string;
  downstream: string[];
  requiredFields: string[];
}

export interface ImportCapabilityCell {
  source: ImportSource;
  target: ImportTarget;
  status: ImportCapabilityStatus;
  evidence: string;
}

export interface ImportFlowNode {
  key: string;
  label: string;
  status: ImportCapabilityStatus;
  route?: string;
  detail: string;
}

export interface ImportCapabilityGap {
  code: string;
  label: string;
  detail: string;
}

export interface ImportCapabilityMatrix {
  sources: ImportCapabilitySource[];
  targets: ImportCapabilityTarget[];
  cells: ImportCapabilityCell[];
  flow: ImportFlowNode[];
  gaps: ImportCapabilityGap[];
}

export interface FieldSpec {
  field: string;
  label: string;
  required: boolean;
  type: 'string' | 'number' | 'enum' | 'boolean';
  enumValues?: string[];
  /** Header aliases for auto-mapping (lowercased, no spaces). */
  aliases?: string[];
}

export const FIELD_SPECS: Record<ImportTarget, FieldSpec[]> = {
  MATERIAL: [
    { field: 'partNumber', label: 'Número de parte', required: true, type: 'string', aliases: ['partnumber', 'numerodeparte', 'sku', 'material', 'matnr', 'item'] },
    { field: 'description', label: 'Descripción', required: true, type: 'string', aliases: ['description', 'descripcion', 'desc', 'maktx', 'nombre'] },
    { field: 'itemType', label: 'Tipo de item', required: false, type: 'enum', enumValues: MATERIAL_ITEM_TYPES as unknown as string[], aliases: ['itemtype', 'tipo', 'mtart', 'type'] },
    { field: 'category', label: 'Categoría', required: false, type: 'string', aliases: ['category', 'categoria', 'grupo', 'matkl', 'group'] },
    { field: 'baseUom', label: 'UoM base', required: false, type: 'string', aliases: ['baseuom', 'uom', 'unidad', 'meins', 'unit'] },
    { field: 'makeBuy', label: 'Make/Buy', required: false, type: 'enum', enumValues: ['MAKE', 'BUY'], aliases: ['makebuy', 'make_buy', 'procurement', 'beskz'] },
    { field: 'standardCost', label: 'Costo estándar', required: false, type: 'number', aliases: ['standardcost', 'stdcost', 'costo', 'cost', 'stprs', 'price'] },
    { field: 'weight', label: 'Peso', required: false, type: 'number', aliases: ['weight', 'peso', 'ntgew'] },
    { field: 'notes', label: 'Notas', required: false, type: 'string', aliases: ['notes', 'notas', 'remark'] },
  ],
  BOM: [
    { field: 'parentPartNumber', label: 'Ensamble (padre)', required: true, type: 'string', aliases: ['parentpartnumber', 'parent', 'ensamble', 'padre', 'assembly', 'topitem'] },
    { field: 'componentPartNumber', label: 'Componente', required: true, type: 'string', aliases: ['componentpartnumber', 'component', 'componente', 'child', 'idnrk', 'hijo'] },
    { field: 'quantity', label: 'Cantidad', required: true, type: 'number', aliases: ['quantity', 'cantidad', 'qty', 'menge'] },
    { field: 'findNumber', label: 'Posición', required: false, type: 'string', aliases: ['findnumber', 'posicion', 'position', 'posnr', 'pos', 'item'] },
    { field: 'uom', label: 'UoM', required: false, type: 'string', aliases: ['uom', 'unidad', 'meins', 'unit'] },
    { field: 'itemCategory', label: 'Categoría de item', required: false, type: 'enum', enumValues: BOM_ITEM_CATEGORIES as unknown as string[], aliases: ['itemcategory', 'categoria', 'postp'] },
    { field: 'scrapPct', label: 'Scrap %', required: false, type: 'number', aliases: ['scrappct', 'scrap', 'merma', 'ausch'] },
    { field: 'refDes', label: 'RefDes', required: false, type: 'string', aliases: ['refdes', 'referencedesignator', 'designador'] },
    { field: 'revision', label: 'Revisión', required: false, type: 'string', aliases: ['revision', 'rev'] },
    { field: 'phantom', label: 'Phantom', required: false, type: 'boolean', aliases: ['phantom', 'fantasma'] },
  ],
  ROUTING: [
    { field: 'assemblyPartNumber', label: 'Ensamble', required: true, type: 'string', aliases: ['assemblypartnumber', 'assembly', 'ensamble', 'parent', 'material'] },
    { field: 'sequence', label: 'Secuencia', required: true, type: 'number', aliases: ['sequence', 'secuencia', 'vornr', 'opno', 'step'] },
    { field: 'operationName', label: 'Operación', required: true, type: 'string', aliases: ['operationname', 'operacion', 'operation', 'ltxa1', 'nombre'] },
    { field: 'workCenter', label: 'Centro de trabajo', required: false, type: 'string', aliases: ['workcenter', 'centro', 'arbpl', 'station', 'estacion'] },
    { field: 'setupTimeMin', label: 'Setup (min)', required: false, type: 'number', aliases: ['setuptimemin', 'setup', 'preparacion', 'rust'] },
    { field: 'runTimePerUnitMin', label: 'Run/unidad (min)', required: false, type: 'number', aliases: ['runtimeperunitmin', 'run', 'tiempo', 'corrida'] },
    { field: 'description', label: 'Descripción', required: false, type: 'string', aliases: ['description', 'descripcion'] },
    { field: 'visualAidRef', label: 'Visual aid', required: false, type: 'string', aliases: ['visualaidref', 'visualaid', 'instruccion'] },
    { field: 'revision', label: 'Revisión', required: false, type: 'string', aliases: ['revision', 'rev'] },
  ],
};

const targetLabel: Record<ImportTarget, string> = {
  MATERIAL: 'Material Master',
  BOM: 'BOM multinivel',
  ROUTING: 'Routing',
};

function requiredFields(target: ImportTarget): string[] {
  return FIELD_SPECS[target].filter((field) => field.required).map((field) => field.field);
}

export function buildImportCapabilityMatrix(options: {
  idocApiConfigured?: boolean;
} = {}): ImportCapabilityMatrix {
  const idocReady = options.idocApiConfigured === true;
  const allTargets = [...IMPORT_TARGETS];
  const sources: ImportCapabilitySource[] = [
    {
      source: 'CSV',
      label: 'CSV',
      status: 'READY',
      detail: 'Browser upload parsed into rows, then validated and committed by import-data.',
      supportedTargets: allTargets,
    },
    {
      source: 'EXCEL',
      label: 'Excel',
      status: 'READY',
      detail: 'First worksheet parsed into the same row contract used by CSV.',
      supportedTargets: allTargets,
    },
    {
      source: 'SQL_STAGING',
      label: 'SQL staging',
      status: 'READY',
      detail: 'External jobs can post staging rows through the same preview and commit path.',
      supportedTargets: allTargets,
    },
    {
      source: 'IDOC_API',
      label: 'SAP IDoc/API',
      status: idocReady ? 'READY' : 'CONFIG_REQUIRED',
      detail: idocReady
        ? 'External feed adapter is configured and can supply rows to the shared mapper.'
        : 'Adapter interface exists, but no live SAP connector is configured in this deployment.',
      supportedTargets: allTargets,
    },
  ];

  const targets: ImportCapabilityTarget[] = [
    {
      target: 'MATERIAL',
      label: targetLabel.MATERIAL,
      sapObjects: ['MATMAS', 'OData Material'],
      writesTo: ['mm_material'],
      route: '/dashboard/materials',
      commitBehavior: 'Creates or updates material-master rows by partNumber.',
      prerequisite: 'None beyond required mapped fields.',
      downstream: ['Product models', 'BOM', 'Routing', 'MRP'],
      requiredFields: requiredFields('MATERIAL'),
    },
    {
      target: 'BOM',
      label: targetLabel.BOM,
      sapObjects: ['BOMMAT', 'STPO/STKO extract'],
      writesTo: ['bom_headers', 'bom_components'],
      route: '/dashboard/bom',
      commitBehavior: 'Finds or creates the BOM node, then adds component lines idempotently by findNumber and material.',
      prerequisite: 'Parent and component materials must exist, unless createMissingMaterials is explicitly enabled.',
      downstream: ['MRP', 'Planning kit explosion', 'Cost rollup'],
      requiredFields: requiredFields('BOM'),
    },
    {
      target: 'ROUTING',
      label: targetLabel.ROUTING,
      sapObjects: ['Routing/CA01 extract', 'Operations extract'],
      writesTo: ['rt_routings', 'rt_operations'],
      route: '/dashboard/routing',
      commitBehavior: 'Finds or creates the routing by assembly and revision, then adds missing operation sequences.',
      prerequisite: 'Assembly material must exist, unless createMissingMaterials is explicitly enabled.',
      downstream: ['Backflush preview', 'MES execution', 'Line engineering'],
      requiredFields: requiredFields('ROUTING'),
    },
  ];

  const cells = sources.flatMap((source) =>
    targets.map((target) => ({
      source: source.source,
      target: target.target,
      status: source.source === 'IDOC_API' && !idocReady ? 'CONFIG_REQUIRED' as const : 'READY' as const,
      evidence: source.source === 'IDOC_API' && !idocReady
        ? 'NotConfiguredFeedAdapter throws before commit; use CSV/Excel/staging until SAP credentials are wired.'
        : `${source.label} rows use ${target.label} validation and commit through existing domain services.`,
    })),
  );

  return {
    sources,
    targets,
    cells,
    flow: [
      {
        key: 'sap',
        label: 'SAP payloads',
        status: idocReady ? 'READY' : 'CONFIG_REQUIRED',
        detail: idocReady ? 'IDoc/API feed can supply source rows.' : 'Use file/staging import until the SAP adapter is configured.',
      },
      {
        key: 'import-data',
        label: 'Import Data',
        status: 'READY',
        route: '/dashboard/import',
        detail: 'Single mapper, preview, validation, commit, and ledger path.',
      },
      {
        key: 'product-model',
        label: 'Product Model',
        status: 'MANUAL_LINK',
        route: '/dashboard/models',
        detail: 'No direct import target yet; models link to material/BOM after the master data lands.',
      },
      {
        key: 'material-master',
        label: 'Material Master',
        status: 'READY',
        route: '/dashboard/materials',
        detail: 'MATERIAL target writes the canonical mm_material records.',
      },
      {
        key: 'bom',
        label: 'BOM',
        status: 'READY',
        route: '/dashboard/bom',
        detail: 'BOM target writes through BomTreeService, using materials as parents/components.',
      },
      {
        key: 'routing',
        label: 'Routing',
        status: 'READY',
        route: '/dashboard/routing',
        detail: 'ROUTING target writes through RoutingService for operations and timings.',
      },
    ],
    gaps: [
      ...(idocReady ? [] : [{
        code: 'SAP_CONNECTOR_NOT_CONFIGURED',
        label: 'SAP connector configuration',
        detail: 'The adapter contract exists, but live SAP credentials/endpoints are intentionally not stored in the repo.',
      }]),
      {
        code: 'PRODUCT_MODEL_IMPORT_TARGET',
        label: 'Product model import target',
        detail: 'Product models are present in AXOS, but import-data currently lands material, BOM, and routing only.',
      },
    ],
  };
}

export interface RowError {
  field: string;
  message: string;
}

export interface ValidatedRow {
  rowIndex: number;
  data: Record<string, any>;
  errors: RowError[];
  valid: boolean;
}

const normalizeHeader = (h: string): string =>
  (h ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents (descripción → descripcion)
    .toLowerCase()
    .replace(/[\s_\-./]/g, '');

/** Auto-suggest a mapping from detected headers to target fields by alias. */
export function suggestMapping(
  target: ImportTarget,
  headers: string[],
): Record<string, string> {
  const specs = FIELD_SPECS[target];
  const normHeaders = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  const mapping: Record<string, string> = {};
  for (const spec of specs) {
    const candidates = [spec.field.toLowerCase(), ...(spec.aliases ?? [])];
    const hit = normHeaders.find((h) => candidates.includes(h.norm));
    if (hit) mapping[spec.field] = hit.raw;
  }
  return mapping;
}

function coerceNumber(raw: any): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(String(raw).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}

function coerceBoolean(raw: any): boolean {
  const s = String(raw ?? '').trim().toLowerCase();
  return ['1', 'true', 'x', 'si', 'sí', 'yes', 'y'].includes(s);
}

/** Map a raw source row to target fields and validate/coerce it. */
export function validateRow(
  target: ImportTarget,
  rawRow: Record<string, any>,
  mapping: Record<string, string>,
  rowIndex: number,
): ValidatedRow {
  const specs = FIELD_SPECS[target];
  const data: Record<string, any> = {};
  const errors: RowError[] = [];

  for (const spec of specs) {
    const sourceCol = mapping[spec.field];
    const rawValue = sourceCol ? rawRow[sourceCol] : undefined;
    const present = rawValue !== undefined && rawValue !== null && String(rawValue).trim() !== '';

    if (!present) {
      if (spec.required) errors.push({ field: spec.field, message: `${spec.label} es obligatorio.` });
      continue;
    }

    if (spec.type === 'number') {
      const n = coerceNumber(rawValue);
      if (n === null) continue;
      if (Number.isNaN(n)) {
        errors.push({ field: spec.field, message: `${spec.label} debe ser numérico (recibido "${rawValue}").` });
      } else {
        data[spec.field] = n;
      }
    } else if (spec.type === 'boolean') {
      data[spec.field] = coerceBoolean(rawValue);
    } else if (spec.type === 'enum') {
      const v = String(rawValue).trim().toUpperCase();
      if (!(spec.enumValues ?? []).includes(v)) {
        errors.push({
          field: spec.field,
          message: `${spec.label} inválido: "${rawValue}". Permitido: ${(spec.enumValues ?? []).join(', ')}.`,
        });
      } else {
        data[spec.field] = v;
      }
    } else {
      data[spec.field] = String(rawValue).trim();
    }
  }

  return { rowIndex, data, errors, valid: errors.length === 0 };
}

export interface PreviewSummary {
  total: number;
  valid: number;
  errors: number;
}

export function validateRows(
  target: ImportTarget,
  rows: Record<string, any>[],
  mapping: Record<string, string>,
): { rows: ValidatedRow[]; summary: PreviewSummary } {
  const validated = rows.map((r, i) => validateRow(target, r, mapping, i));
  return {
    rows: validated,
    summary: {
      total: validated.length,
      valid: validated.filter((v) => v.valid).length,
      errors: validated.filter((v) => !v.valid).length,
    },
  };
}
