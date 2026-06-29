import type { SmartKind, SmartSpec } from './smartart';

export type SmartArtPresetCategory =
  | 'production'
  | 'quality'
  | 'npi'
  | 'supplier'
  | 'materials'
  | 'safety'
  | 'review';

export interface SmartArtPreset {
  id: string;
  label: string;
  category: SmartArtPresetCategory;
  kind: SmartKind;
  items: string[];
  description: string;
  useCase: string;
  tags: string[];
}

export const SMARTART_PRESET_CATEGORIES: { id: SmartArtPresetCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'Todo' },
  { id: 'production', label: 'Produccion' },
  { id: 'quality', label: 'Calidad' },
  { id: 'npi', label: 'NPI' },
  { id: 'supplier', label: 'Proveedor' },
  { id: 'materials', label: 'Materiales' },
  { id: 'safety', label: 'EHS' },
  { id: 'review', label: 'Revision' },
];

export const INDUSTRIAL_SMARTART_PRESETS: SmartArtPreset[] = [
  {
    id: 'production-flow',
    label: 'Flujo de produccion',
    category: 'production',
    kind: 'process',
    items: ['Plan', 'Kit', 'Build', 'Inspect', 'Ship'],
    description: 'Secuencia editable para daily meetings y reportes de piso.',
    useCase: 'Daily Production Meeting',
    tags: ['daily', 'output', 'process', 'flow', 'shopfloor'],
  },
  {
    id: 'material-swimlane',
    label: 'Material flow swimlane',
    category: 'materials',
    kind: 'swimlane',
    items: ['Supplier: ASN', 'Warehouse: Receive', 'Quality: IQC', 'Line: Consume', 'Shipping: Pack'],
    description: 'Responsables y pasos para recepcion, IQC, consumo y empaque.',
    useCase: 'Warehouse Flow Review',
    tags: ['warehouse', 'iqc', 'shipping', 'lane', 'materials'],
  },
  {
    id: 'quality-containment',
    label: 'Contencion de calidad',
    category: 'quality',
    kind: 'process',
    items: ['Detect', 'Contain', 'Sort', 'Root cause', 'Verify'],
    description: 'Ruta CAPA/NCR desde deteccion hasta verificacion.',
    useCase: '8D / CAPA Review',
    tags: ['8d', 'capa', 'ncr', 'containment', 'quality'],
  },
  {
    id: 'eight-d-timeline',
    label: '8D timeline',
    category: 'quality',
    kind: 'timeline',
    items: ['D1 Team', 'D2 Problem', 'D3 Contain', 'D4 Root cause', 'D5 Correct', 'D6 Verify', 'D7 Prevent', 'D8 Close'],
    description: 'Hitos de 8D listos para explicar avance y cierre.',
    useCase: 'Customer Quality Review',
    tags: ['8d', 'customer', 'quality', 'timeline', 'corrective'],
  },
  {
    id: 'npi-gates',
    label: 'NPI launch gates',
    category: 'npi',
    kind: 'timeline',
    items: ['RFQ', 'DFM', 'EVT', 'PPAP', 'Run at rate', 'SOP'],
    description: 'Gates de lanzamiento para readiness reviews.',
    useCase: 'NPI Launch Readiness',
    tags: ['npi', 'launch', 'apqp', 'ppap', 'sop'],
  },
  {
    id: 'sipoc-review',
    label: 'SIPOC industrial',
    category: 'review',
    kind: 'sipoc',
    items: ['Supplier', 'Inputs', 'Process', 'Outputs', 'Customer'],
    description: 'Vista SIPOC para alinear alcance de proceso o proveedor.',
    useCase: 'Process / Supplier Review',
    tags: ['sipoc', 'supplier', 'customer', 'process', 'scope'],
  },
  {
    id: 'supplier-escalation',
    label: 'Escalacion proveedor',
    category: 'supplier',
    kind: 'hierarchy',
    items: ['Supplier Review', 'SCAR', 'Containment', '8D', 'PPAP recovery'],
    description: 'Arbol de respuesta para problemas criticos de proveedor.',
    useCase: 'Supplier Business Review',
    tags: ['supplier', 'scar', '8d', 'ppap', 'escalation'],
  },
  {
    id: 'risk-funnel',
    label: 'Funnel de riesgo',
    category: 'review',
    kind: 'funnel',
    items: ['Open risks', 'High impact', 'Mitigated', 'Escalate'],
    description: 'Reduce riesgos a acciones ejecutivas claras.',
    useCase: 'Executive Operations Review',
    tags: ['risk', 'executive', 'readiness', 'funnel', 'actions'],
  },
  {
    id: 'vsm-lite',
    label: 'Value stream lite',
    category: 'production',
    kind: 'process',
    items: ['Supplier', 'Receiving', 'Warehouse', 'SMT', 'Test', 'Ship'],
    description: 'Cadena de valor resumida para narrativa operacional.',
    useCase: 'Operations Review',
    tags: ['vsm', 'value stream', 'operations', 'flow', 'smt'],
  },
  {
    id: 'launch-target',
    label: 'Target launch readiness',
    category: 'npi',
    kind: 'target',
    items: ['SOP', 'Run at rate', 'PPAP', 'Tooling', 'Material'],
    description: 'Anillos de readiness para un slide ejecutivo de lanzamiento.',
    useCase: 'Launch Readiness Review',
    tags: ['readiness', 'launch', 'target', 'npi', 'program'],
  },
  {
    id: 'safety-control-cycle',
    label: 'Ciclo EHS',
    category: 'safety',
    kind: 'cycle',
    items: ['Identify', 'Assess', 'Control', 'Verify'],
    description: 'Ciclo de control para alertas de seguridad y auditorias EHS.',
    useCase: 'Safety Alert',
    tags: ['ehs', 'safety', 'audit', 'cycle', 'control'],
  },
  {
    id: 'review-matrix',
    label: 'Matriz de revision',
    category: 'review',
    kind: 'matrix',
    items: ['Output', 'Quality', 'Delivery', 'Actions'],
    description: 'Cuadrantes para cerrar reuniones con foco ejecutivo.',
    useCase: 'Customer Business Review',
    tags: ['cbr', 'review', 'actions', 'quality', 'delivery'],
  },
];

export interface SmartArtPresetFilter {
  query?: string;
  category?: SmartArtPresetCategory | 'all';
  kind?: SmartKind | 'all';
}

export function normalizeSmartArtQuery(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

export function filterSmartArtPresets(
  presets: SmartArtPreset[] = INDUSTRIAL_SMARTART_PRESETS,
  filter: SmartArtPresetFilter = {},
): SmartArtPreset[] {
  const category = filter.category ?? 'all';
  const kind = filter.kind ?? 'all';
  const query = normalizeSmartArtQuery(filter.query ?? '');
  return presets.filter((preset) => {
    if (category !== 'all' && preset.category !== category) return false;
    if (kind !== 'all' && preset.kind !== kind) return false;
    if (!query) return true;
    const haystack = normalizeSmartArtQuery([
      preset.label,
      preset.description,
      preset.useCase,
      preset.kind,
      preset.category,
      ...preset.items,
      ...preset.tags,
    ].join(' '));
    return haystack.includes(query);
  });
}

export function smartArtPresetStats(presets: SmartArtPreset[] = INDUSTRIAL_SMARTART_PRESETS) {
  const byCategory = Object.fromEntries(SMARTART_PRESET_CATEGORIES.filter((cat) => cat.id !== 'all').map((cat) => [cat.id, 0])) as Record<SmartArtPresetCategory, number>;
  const byKind: Partial<Record<SmartKind, number>> = {};
  for (const preset of presets) {
    byCategory[preset.category] += 1;
    byKind[preset.kind] = (byKind[preset.kind] ?? 0) + 1;
  }
  return { total: presets.length, byCategory, byKind };
}

export function getSmartArtPresetById(id: string, presets: SmartArtPreset[] = INDUSTRIAL_SMARTART_PRESETS): SmartArtPreset | undefined {
  return presets.find((preset) => preset.id === id);
}

export function smartArtSpecFromPreset(preset: SmartArtPreset): SmartSpec {
  return { kind: preset.kind, items: preset.items.slice() };
}

export function normalizeSmartArtItems(items: string[], fallback = 'Elemento'): string[] {
  const out = items.map((item) => item.trim()).filter(Boolean);
  return out.length ? out : [fallback];
}

export function addSmartArtItem(items: string[], value?: string): string[] {
  return [...items, value ?? `Nodo ${items.length + 1}`];
}

export function updateSmartArtItem(items: string[], index: number, value: string): string[] {
  return items.map((item, i) => (i === index ? value : item));
}

export function removeSmartArtItem(items: string[], index: number): string[] {
  const next = items.filter((_, i) => i !== index);
  return next.length ? next : ['Elemento'];
}

export function moveSmartArtItem(items: string[], from: number, to: number): string[] {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length || from === to) return items.slice();
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
