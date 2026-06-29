/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Structured slide tables. A table is a Fabric `Group` with a `tableSpec`
 * custom prop. The canvas renders rect/text primitives and PPTX export maps the
 * same spec to native editable PowerPoint tables.
 */
import { FabricText, Group, Rect } from 'fabric';

export interface TableSpec {
  rows: number;
  cols: number;
  cells: string[][];
  header: boolean;
  banded: boolean;
  accent?: string;
  presetId?: string;
  presetLabel?: string;
}

export const TABLE_ACCENT = '#2563eb';

export function isTable(o: any): boolean { return !!o && o.type === 'group' && !!o.tableSpec; }

export function defaultTableSpec(rows = 3, cols = 3): TableSpec {
  const cells: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) row.push(r === 0 ? `Columna ${c + 1}` : '');
    cells.push(row);
  }
  return { rows, cols, cells, header: true, banded: true, accent: TABLE_ACCENT };
}

export type TablePresetCategory = 'operations' | 'quality' | 'launch' | 'supplier' | 'logistics';

export interface TablePreset {
  id: string;
  label: string;
  category: TablePresetCategory;
  description: string;
  cells: string[][];
  header?: boolean;
  banded?: boolean;
}

export const TABLE_PRESET_CATEGORY_LABEL: Record<TablePresetCategory, string> = {
  operations: 'Operaciones',
  quality: 'Calidad',
  launch: 'NPI / Launch',
  supplier: 'Supplier',
  logistics: 'Logistica',
};

export const INDUSTRIAL_TABLE_PRESETS: TablePreset[] = [
  {
    id: 'action-register',
    label: 'Action register',
    category: 'operations',
    description: 'Acciones, responsables, fechas y estado para juntas industriales.',
    cells: [
      ['Accion', 'Owner', 'Due', 'Status', 'Decision needed'],
      ['Accion 1', '', '', '', ''],
      ['Accion 2', '', '', '', ''],
      ['Accion 3', '', '', '', ''],
    ],
  },
  {
    id: 'risk-matrix',
    label: 'Risk matrix',
    category: 'quality',
    description: 'Registro de riesgos con severidad, probabilidad y mitigacion.',
    cells: [
      ['Risk', 'Severity', 'Probability', 'Mitigation', 'Owner'],
      ['Risk 1', '', '', '', ''],
      ['Risk 2', '', '', '', ''],
      ['Risk 3', '', '', '', ''],
    ],
  },
  {
    id: 'issue-log',
    label: 'Issue log',
    category: 'operations',
    description: 'Problemas abiertos con contencion y siguiente paso.',
    cells: [
      ['Issue', 'Area', 'Containment', 'Next step', 'Age'],
      ['Issue 1', '', '', '', ''],
      ['Issue 2', '', '', '', ''],
      ['Issue 3', '', '', '', ''],
    ],
  },
  {
    id: 'eight-d-containment',
    label: '8D containment',
    category: 'quality',
    description: 'Resumen editable para D1-D4 y contencion inmediata.',
    cells: [
      ['8D step', 'Evidence', 'Owner', 'Due', 'Status'],
      ['D1 Team', '', '', '', ''],
      ['D2 Problem', '', '', '', ''],
      ['D3 Containment', '', '', '', ''],
      ['D4 Root cause', '', '', '', ''],
    ],
  },
  {
    id: 'supplier-scorecard',
    label: 'Supplier scorecard',
    category: 'supplier',
    description: 'Scorecard de proveedor para quality, delivery y acciones.',
    cells: [
      ['Metric', 'Target', 'Current', 'Trend', 'Action'],
      ['Quality PPM', '', '', '', ''],
      ['OTD', '', '', '', ''],
      ['SCARs', '', '', '', ''],
      ['Responsiveness', '', '', '', ''],
    ],
  },
  {
    id: 'launch-checklist',
    label: 'Launch checklist',
    category: 'launch',
    description: 'Gate review de lanzamiento con PPAP, Run@Rate y readiness.',
    cells: [
      ['Gate item', 'Evidence', 'Ready?', 'Owner', 'Blocker'],
      ['APQP', '', '', '', ''],
      ['PPAP', '', '', '', ''],
      ['Run@Rate', '', '', '', ''],
      ['SOP readiness', '', '', '', ''],
    ],
  },
  {
    id: 'test-summary',
    label: 'Test summary',
    category: 'quality',
    description: 'Resumen de yield, fallas y disposition de pruebas.',
    cells: [
      ['Test area', 'Samples', 'Pass', 'Fail', 'Disposition'],
      ['ICT', '', '', '', ''],
      ['FCT', '', '', '', ''],
      ['Burn-in', '', '', '', ''],
      ['Final audit', '', '', '', ''],
    ],
  },
  {
    id: 'packing-shipping',
    label: 'Packing / shipping',
    category: 'logistics',
    description: 'Readiness de empaque, etiquetas, documentos y embarque.',
    cells: [
      ['Checkpoint', 'Required', 'Actual', 'Owner', 'Status'],
      ['Packing spec', '', '', '', ''],
      ['Label verification', '', '', '', ''],
      ['COC / docs', '', '', '', ''],
      ['Shipment booking', '', '', '', ''],
    ],
  },
  {
    id: 'mrp-shortage',
    label: 'MRP shortage',
    category: 'logistics',
    description: 'Shortage review editable para material, ETA y riesgo.',
    cells: [
      ['Part', 'Need date', 'Short qty', 'ETA', 'Risk'],
      ['PN-0001', '', '', '', ''],
      ['PN-0002', '', '', '', ''],
      ['PN-0003', '', '', '', ''],
    ],
  },
  {
    id: 'quality-pareto-actions',
    label: 'Pareto actions',
    category: 'quality',
    description: 'Top defectos con causa, contencion y accion correctiva.',
    cells: [
      ['Defect', 'Count', 'Root cause', 'Containment', 'Corrective action'],
      ['Defect 1', '', '', '', ''],
      ['Defect 2', '', '', '', ''],
      ['Defect 3', '', '', '', ''],
    ],
  },
];

export function createTablePresetSpec(preset: TablePreset, accent = TABLE_ACCENT): TableSpec {
  const cells = preset.cells.map((row) => row.slice());
  const rows = cells.length;
  const cols = Math.max(1, ...cells.map((row) => row.length));
  return {
    rows,
    cols,
    cells,
    header: preset.header ?? true,
    banded: preset.banded ?? true,
    accent,
    presetId: preset.id,
    presetLabel: preset.label,
  };
}

export function getTablePreset(id: string): TablePreset | undefined {
  return INDUSTRIAL_TABLE_PRESETS.find((preset) => preset.id === id);
}

export function createTablePresetSpecById(id: string, accent = TABLE_ACCENT): TableSpec | null {
  const preset = getTablePreset(id);
  return preset ? createTablePresetSpec(preset, accent) : null;
}

export function normalizeCells(spec: TableSpec): string[][] {
  const out: string[][] = [];
  for (let r = 0; r < spec.rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < spec.cols; c++) row.push(spec.cells?.[r]?.[c] ?? '');
    out.push(row);
  }
  return out;
}

interface Opts { left?: number; top?: number; width?: number; text?: string; font?: string }

export function buildTableGroup(spec: TableSpec, opts: Opts = {}): any {
  const accent = spec.accent || TABLE_ACCENT;
  const font = opts.font ?? 'sans-serif';
  const bodyText = opts.text ?? '#1f2937';
  const cells = normalizeCells(spec);
  const cols = Math.max(1, spec.cols), rows = Math.max(1, spec.rows);
  const totalW = opts.width ?? Math.min(840, 150 * cols);
  const cw = totalW / cols, chh = 44;
  const kids: any[] = [];

  for (let r = 0; r < rows; r++) {
    const isHeader = spec.header && r === 0;
    const banded = spec.banded && !isHeader && r % 2 === 1;
    const fill = isHeader ? accent : banded ? tint(accent, 0.10) : '#ffffff';
    for (let c = 0; c < cols; c++) {
      kids.push(new Rect({ left: c * cw, top: r * chh, width: cw, height: chh, fill, stroke: '#cbd5e1', strokeWidth: 1 }));
      const t = cells[r][c];
      if (t) kids.push(new FabricText(String(t), {
        left: c * cw + 10, top: r * chh + chh / 2, width: cw - 20, fontSize: 15,
        fill: isHeader ? '#ffffff' : bodyText, fontFamily: font, fontWeight: isHeader ? 'bold' : 'normal',
        originX: 'left', originY: 'center',
      }));
    }
  }
  const g = new Group(kids, { subTargetCheck: false } as any);
  g.set({ left: opts.left ?? 90, top: opts.top ?? 150 });
  (g as any).tableSpec = { ...spec, cells };
  g.setCoords();
  return g;
}

function tint(hex: string, a: number) {
  const h = hex.replace('#', '');
  if (h.length < 6) return '#eef2ff';
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const mix = (x: number) => Math.round(x * a + 255 * (1 - a));
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}
