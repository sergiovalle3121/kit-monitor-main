import { SMART_KINDS, type SmartKind, type SmartSpec } from './smartart';

export const SMART_ART_PRESET_CATEGORIES = [
  { id: 'operations', label: 'Operations' },
  { id: 'quality', label: 'Quality' },
  { id: 'npi', label: 'NPI / Launch' },
  { id: 'supplier', label: 'Supplier' },
  { id: 'visualAid', label: 'Visual aid' },
] as const;

export type SmartArtPresetCategory = (typeof SMART_ART_PRESET_CATEGORIES)[number]['id'];

export interface SmartArtPreset {
  id: string;
  label: string;
  category: SmartArtPresetCategory;
  description: string;
  useCase: string;
  kind: SmartKind;
  items: string[];
  tags: string[];
}

export interface SmartArtPresetFilterOptions {
  category?: SmartArtPresetCategory | 'all';
  query?: string;
}

export const SMART_ART_PRESET_CATEGORY_LABEL = SMART_ART_PRESET_CATEGORIES.reduce((acc, category) => {
  acc[category.id] = category.label;
  return acc;
}, {} as Record<SmartArtPresetCategory, string>);

export const INDUSTRIAL_SMART_ART_PRESETS: SmartArtPreset[] = [
  {
    id: 'daily-operations-rhythm',
    label: 'Daily ops rhythm',
    category: 'operations',
    description: 'SQDC meeting loop for production reviews.',
    useCase: 'Daily Production Meeting',
    kind: 'cycle',
    items: ['Safety', 'Quality', 'Delivery', 'Cost', 'Actions'],
    tags: ['sqdc', 'daily', 'production', 'meeting', 'operations'],
  },
  {
    id: 'material-flow-review',
    label: 'Material flow review',
    category: 'operations',
    description: 'End-to-end flow from supplier to shipment.',
    useCase: 'Warehouse Flow Review',
    kind: 'process',
    items: ['Supplier', 'Receiving', 'IQC', 'Supermarket', 'Line feed', 'Shipping'],
    tags: ['material', 'warehouse', 'flow', 'receiving', 'shipping'],
  },
  {
    id: 'shift-handoff',
    label: 'Shift handoff',
    category: 'operations',
    description: 'Supervisor handoff checklist for the next shift.',
    useCase: 'Shift Handoff',
    kind: 'list',
    items: ['Plan vs actual', 'Open constraints', 'Safety / EHS', 'Quality holds', 'Next shift actions'],
    tags: ['handoff', 'shift', 'supervisor', 'actions', 'shopfloor'],
  },
  {
    id: 'eight-d-capa-flow',
    label: '8D / CAPA flow',
    category: 'quality',
    description: 'Corrective-action path for customer or internal escapes.',
    useCase: '8D / CAPA Review',
    kind: 'process',
    items: ['D1 Team', 'D2 Problem', 'D3 Containment', 'D4 Root cause', 'D5 Corrective action', 'D6 Validate', 'D7 Prevent', 'D8 Close'],
    tags: ['8d', 'capa', 'quality', 'corrective', 'containment'],
  },
  {
    id: 'quality-containment-loop',
    label: 'Containment loop',
    category: 'quality',
    description: 'Closed-loop containment for quality spills.',
    useCase: 'Quality Review',
    kind: 'cycle',
    items: ['Detect', 'Segregate', 'Contain', 'Verify', 'Release'],
    tags: ['quality', 'containment', 'mrb', 'ncr', 'verify'],
  },
  {
    id: 'risk-priority-matrix',
    label: 'Risk priority matrix',
    category: 'quality',
    description: 'Four-quadrant risk framing for reviews.',
    useCase: 'Launch / Quality Risk Review',
    kind: 'matrix',
    items: ['High impact / low probability', 'High impact / high probability', 'Low impact / low probability', 'Low impact / high probability'],
    tags: ['risk', 'matrix', 'severity', 'probability', 'mitigation'],
  },
  {
    id: 'npi-gate-roadmap',
    label: 'NPI gate roadmap',
    category: 'npi',
    description: 'Gate progression for launch readiness decks.',
    useCase: 'NPI Launch Readiness',
    kind: 'stepUp',
    items: ['RFQ / Feasibility', 'EVT', 'DVT', 'PPAP', 'Run at rate', 'SOP'],
    tags: ['npi', 'launch', 'gate', 'ppap', 'sop'],
  },
  {
    id: 'launch-readiness-target',
    label: 'Launch readiness target',
    category: 'npi',
    description: 'Nested readiness layers around SOP.',
    useCase: 'Launch Readiness Review',
    kind: 'target',
    items: ['SOP', 'PPAP', 'Tooling', 'Capacity', 'Supply', 'Quality'],
    tags: ['launch', 'readiness', 'sop', 'apqp', 'capacity'],
  },
  {
    id: 'supplier-escalation-tree',
    label: 'Supplier escalation tree',
    category: 'supplier',
    description: 'Ownership tree for supplier quality issues.',
    useCase: 'Supplier Business Review',
    kind: 'hierarchy',
    items: ['Supplier issue', 'SCAR owner', 'Purchasing', 'Incoming quality', 'Engineering', 'Customer impact'],
    tags: ['supplier', 'scar', 'quality', 'escalation', 'iqc'],
  },
  {
    id: 'supplier-scorecard-pillars',
    label: 'Supplier scorecard pillars',
    category: 'supplier',
    description: 'Review pillars for supplier performance.',
    useCase: 'Supplier Scorecard',
    kind: 'list',
    items: ['Quality PPM', 'On-time delivery', 'Responsiveness', 'Cost recovery', 'Corrective actions'],
    tags: ['supplier', 'scorecard', 'otd', 'ppm', 'cost'],
  },
  {
    id: 'visual-aid-operator-steps',
    label: 'Operator visual aid steps',
    category: 'visualAid',
    description: 'Large-step process for shopfloor instructions.',
    useCase: 'Visual Aid Work Instruction',
    kind: 'process',
    items: ['Scan work order', 'Confirm material', 'Assemble step', 'Inspect checkpoint', 'Record evidence'],
    tags: ['visual aid', 'operator', 'work instruction', 'checkpoint', 'shopfloor'],
  },
  {
    id: 'safety-alert-response',
    label: 'Safety alert response',
    category: 'visualAid',
    description: 'Simple response flow for EHS communications.',
    useCase: 'Safety Alert',
    kind: 'process',
    items: ['Stop work', 'Make area safe', 'Notify supervisor', 'Contain hazard', 'Resume with approval'],
    tags: ['safety', 'ehs', 'alert', 'hazard', 'visual aid'],
  },
];

const SMART_KIND_SET = new Set<SmartKind>(SMART_KINDS.map((kind) => kind.value));

export function normalizeSmartArtPresetQuery(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function presetSearchText(preset: SmartArtPreset): string {
  return normalizeSmartArtPresetQuery([
    preset.id,
    preset.label,
    SMART_ART_PRESET_CATEGORY_LABEL[preset.category],
    preset.description,
    preset.useCase,
    preset.kind,
    ...preset.items,
    ...preset.tags,
  ].join(' '));
}

export function getSmartArtPresetById(
  id: string,
  presets: readonly SmartArtPreset[] = INDUSTRIAL_SMART_ART_PRESETS,
): SmartArtPreset | undefined {
  return presets.find((preset) => preset.id === id);
}

export function cloneSmartArtPresetSpec(preset: SmartArtPreset): SmartSpec {
  return { kind: preset.kind, items: preset.items.slice() };
}

export function filterSmartArtPresets(
  presets: readonly SmartArtPreset[] = INDUSTRIAL_SMART_ART_PRESETS,
  options: SmartArtPresetFilterOptions = {},
): SmartArtPreset[] {
  const category = options.category ?? 'all';
  const query = normalizeSmartArtPresetQuery(options.query ?? '');

  return presets
    .filter((preset) => {
      if (category !== 'all' && preset.category !== category) return false;
      if (!SMART_KIND_SET.has(preset.kind)) return false;
      if (!query) return true;
      return presetSearchText(preset).includes(query);
    })
    .sort((a, b) => {
      const catDelta = SMART_ART_PRESET_CATEGORY_LABEL[a.category].localeCompare(SMART_ART_PRESET_CATEGORY_LABEL[b.category]);
      return catDelta || a.label.localeCompare(b.label);
    });
}

export function smartArtPresetStats(
  presets: readonly SmartArtPreset[] = INDUSTRIAL_SMART_ART_PRESETS,
): { total: number; categories: Record<SmartArtPresetCategory, number> } {
  const categories = SMART_ART_PRESET_CATEGORIES.reduce((acc, category) => {
    acc[category.id] = 0;
    return acc;
  }, {} as Record<SmartArtPresetCategory, number>);

  for (const preset of presets) categories[preset.category] += 1;
  return { total: presets.length, categories };
}
