/**
 * Pure import mapping + validation (the SAP-migration engine). Side-effect free
 * so column mapping, type coercion and per-row validation are unit-testable with
 * no DB. The service does parsing/persistence and delegates the row logic here.
 */

import { MATERIAL_ITEM_TYPES } from '../material-master/material-state';
import { BOM_ITEM_CATEGORIES } from '../bom-tree/bom-state';

export type ImportSource = 'CSV' | 'EXCEL' | 'SQL_STAGING' | 'IDOC_API';
export const IMPORT_SOURCES: ImportSource[] = ['CSV', 'EXCEL', 'SQL_STAGING', 'IDOC_API'];

export type ImportTarget = 'MODEL' | 'MATERIAL' | 'BOM' | 'ROUTING';
export const IMPORT_TARGETS: ImportTarget[] = ['MODEL', 'MATERIAL', 'BOM', 'ROUTING'];

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
  MODEL: [
    { field: 'modelNumber', label: 'Número de modelo', required: true, type: 'string', aliases: ['modelnumber', 'modelo', 'model', 'material', 'matnr', 'sku'] },
    { field: 'name', label: 'Nombre del modelo', required: true, type: 'string', aliases: ['name', 'nombre', 'modelname', 'descripcion', 'description', 'maktx'] },
    { field: 'customer', label: 'Cliente', required: false, type: 'string', aliases: ['customer', 'cliente', 'kunnr', 'account'] },
    { field: 'revision', label: 'Revisión', required: false, type: 'string', aliases: ['revision', 'rev', 'aennr'] },
    { field: 'description', label: 'Descripción', required: false, type: 'string', aliases: ['longdescription', 'descripcionlarga', 'notes', 'notas'] },
    { field: 'programId', label: 'Programa', required: false, type: 'string', aliases: ['programid', 'program', 'programa', 'project', 'proyecto'] },
  ],
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
