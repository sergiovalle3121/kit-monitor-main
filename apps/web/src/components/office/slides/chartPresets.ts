import type { ChartSpec, ChartType } from './chart';

export type ChartPresetCategory =
  | 'production'
  | 'quality'
  | 'supplier'
  | 'inventory'
  | 'testing'
  | 'launch';

export interface SlideChartPresetCategory {
  id: ChartPresetCategory;
  label: string;
}

export interface SlideChartPreset {
  id: string;
  label: string;
  category: ChartPresetCategory;
  description: string;
  useCase: string;
  keywords: string[];
  spec: ChartSpec;
}

export interface ChartPresetFilter {
  query?: string;
  category?: ChartPresetCategory | 'all';
  type?: ChartType | 'all';
}

export const CHART_PRESET_CATEGORIES: SlideChartPresetCategory[] = [
  { id: 'production', label: 'Produccion' },
  { id: 'quality', label: 'Calidad' },
  { id: 'supplier', label: 'Proveedor' },
  { id: 'inventory', label: 'Inventario' },
  { id: 'testing', label: 'Pruebas' },
  { id: 'launch', label: 'NPI' },
];

const BLUE = '#2563eb';
const SKY = '#0ea5e9';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const VIOLET = '#7c3aed';
const SLATE = '#475569';

export const INDUSTRIAL_CHART_PRESETS: SlideChartPreset[] = [
  {
    id: 'oee-trend',
    label: 'OEE trend',
    category: 'production',
    description: 'Daily OEE vs target for production reviews.',
    useCase: 'Daily production meeting',
    keywords: ['oee', 'availability', 'performance', 'quality', 'trend'],
    spec: {
      type: 'line',
      title: 'OEE trend vs target',
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      series: [
        { name: 'OEE', data: [82, 84, 79, 87, 86] },
        { name: 'Target', data: [85, 85, 85, 85, 85] },
      ],
      palette: [BLUE, GREEN],
      legend: true,
      showValues: true,
    },
  },
  {
    id: 'defect-pareto',
    label: 'Defect Pareto',
    category: 'quality',
    description: 'Sorted defect counts with cumulative Pareto behavior.',
    useCase: 'Quality review / 8D',
    keywords: ['pareto', 'defects', 'ncr', 'capa', 'quality'],
    spec: {
      type: 'pareto',
      title: 'Top defect Pareto',
      labels: ['Solder bridge', 'Missing part', 'Polarity', 'Cosmetic', 'Label'],
      series: [{ name: 'Defects', data: [38, 24, 17, 9, 6] }],
      palette: [RED, AMBER, BLUE],
      legend: true,
      showValues: true,
    },
  },
  {
    id: 'supplier-score-radar',
    label: 'Supplier score radar',
    category: 'supplier',
    description: 'Supplier performance across delivery, quality, cost, and response.',
    useCase: 'Supplier business review',
    keywords: ['supplier', 'scorecard', 'radar', 'delivery', 'quality'],
    spec: {
      type: 'radar',
      title: 'Supplier scorecard',
      labels: ['Delivery', 'Quality', 'Cost', 'Response', 'Engineering'],
      series: [
        { name: 'Current', data: [88, 92, 76, 81, 85] },
        { name: 'Target', data: [95, 95, 90, 90, 90] },
      ],
      palette: [VIOLET, GREEN],
      legend: true,
    },
  },
  {
    id: 'inventory-abc',
    label: 'Inventory ABC',
    category: 'inventory',
    description: 'ABC inventory value split for risk and working-capital decks.',
    useCase: 'Inventory risk review',
    keywords: ['inventory', 'abc', 'working capital', 'risk'],
    spec: {
      type: 'doughnut',
      title: 'Inventory ABC value mix',
      labels: ['A items', 'B items', 'C items'],
      series: [{ name: 'Value share', data: [72, 20, 8] }],
      palette: [BLUE, AMBER, SLATE],
      legend: true,
      showValues: true,
    },
  },
  {
    id: 'plan-vs-actual',
    label: 'Plan vs actual',
    category: 'production',
    description: 'Planned output against actual output by shift.',
    useCase: 'Production report',
    keywords: ['production', 'plan', 'actual', 'output', 'shift'],
    spec: {
      type: 'bar',
      title: 'Plan vs actual output',
      labels: ['Shift A', 'Shift B', 'Shift C'],
      series: [
        { name: 'Plan', data: [520, 500, 460] },
        { name: 'Actual', data: [508, 486, 472] },
      ],
      palette: [SLATE, GREEN],
      legend: true,
      showValues: true,
    },
  },
  {
    id: 'test-yield',
    label: 'Test yield',
    category: 'testing',
    description: 'First-pass yield and final yield trend for test reviews.',
    useCase: 'Test yield review',
    keywords: ['test', 'yield', 'fpy', 'quality', 'trend'],
    spec: {
      type: 'line',
      title: 'Test yield trend',
      labels: ['W1', 'W2', 'W3', 'W4', 'W5'],
      series: [
        { name: 'FPY', data: [91, 93, 89, 94, 95] },
        { name: 'Final yield', data: [97, 98, 96, 98, 99] },
      ],
      palette: [SKY, GREEN],
      legend: true,
      showValues: true,
    },
  },
  {
    id: 'downtime-waterfall',
    label: 'Downtime waterfall',
    category: 'production',
    description: 'Lost minutes bridge from planned time to recovered time.',
    useCase: 'Downtime review',
    keywords: ['downtime', 'waterfall', 'maintenance', 'lost time'],
    spec: {
      type: 'waterfall',
      title: 'Downtime bridge',
      labels: ['Planned', 'Changeover', 'Material', 'Maintenance', 'Recovered'],
      series: [{ name: 'Minutes', data: [480, -28, -19, -34, 21] }],
      palette: [BLUE, GREEN, RED, AMBER],
      legend: true,
      showValues: true,
    },
  },
  {
    id: 'mrp-shortages',
    label: 'MRP shortages',
    category: 'inventory',
    description: 'Horizontal shortage exposure by material family.',
    useCase: 'MRP shortage review',
    keywords: ['mrp', 'shortage', 'materials', 'inventory'],
    spec: {
      type: 'hbar',
      title: 'Shortage exposure by family',
      labels: ['ICs', 'Connectors', 'PCB', 'Labels', 'Packaging'],
      series: [{ name: 'Open shortages', data: [34, 21, 13, 9, 6] }],
      palette: [AMBER],
      legend: false,
      showValues: true,
    },
  },
  {
    id: 'launch-readiness-gauge',
    label: 'Launch readiness',
    category: 'launch',
    description: 'Single readiness gauge for NPI gate reviews.',
    useCase: 'NPI launch readiness',
    keywords: ['npi', 'launch', 'readiness', 'gate', 'gauge'],
    spec: {
      type: 'gauge',
      title: 'Launch readiness',
      labels: ['Readiness'],
      series: [{ name: 'Readiness', data: [78, 100] }],
      palette: [GREEN, AMBER, RED],
      legend: false,
      showValues: true,
    },
  },
  {
    id: 'capa-aging',
    label: 'CAPA aging',
    category: 'quality',
    description: 'Open CAPA and NCR aging by bucket.',
    useCase: 'CAPA review',
    keywords: ['capa', 'ncr', 'aging', 'quality', '8d'],
    spec: {
      type: 'bar',
      title: 'CAPA aging buckets',
      labels: ['0-7d', '8-14d', '15-30d', '>30d'],
      series: [{ name: 'Open items', data: [6, 9, 7, 3] }],
      palette: [BLUE],
      legend: false,
      showValues: true,
    },
  },
];

export function cloneChartSpec(spec: ChartSpec): ChartSpec {
  return {
    type: spec.type,
    title: spec.title,
    labels: spec.labels.slice(),
    series: spec.series.map((series) => ({ name: series.name, data: series.data.slice() })),
    palette: spec.palette?.slice(),
    stacked: spec.stacked,
    legend: spec.legend,
    showValues: spec.showValues,
  };
}

export function getSlideChartPreset(id: string): SlideChartPreset | undefined {
  return INDUSTRIAL_CHART_PRESETS.find((preset) => preset.id === id);
}

export function chartPresetToSpec(id: string): ChartSpec | null {
  const preset = getSlideChartPreset(id);
  return preset ? cloneChartSpec(preset.spec) : null;
}

export function filterSlideChartPresets(filter: ChartPresetFilter = {}): SlideChartPreset[] {
  const query = normalize(filter.query ?? '');
  const category = filter.category ?? 'all';
  const type = filter.type ?? 'all';

  return INDUSTRIAL_CHART_PRESETS.filter((preset) => {
    if (category !== 'all' && preset.category !== category) return false;
    if (type !== 'all' && preset.spec.type !== type) return false;
    if (!query) return true;
    return presetSearchText(preset).includes(query);
  });
}

export function chartPresetCategoryLabel(category: ChartPresetCategory): string {
  return CHART_PRESET_CATEGORIES.find((item) => item.id === category)?.label ?? category;
}

export function chartTypePptxNote(type: ChartType): string {
  if (type === 'pareto') return 'PPTX export keeps the editable frequency series; cumulative line is approximated by the current writer.';
  if (type === 'waterfall') return 'PPTX export keeps the editable first series; waterfall bridge styling is approximated.';
  if (type === 'gauge') return 'PPTX export maps this gauge to an editable doughnut-style chart; the needle is AXOS-rendered.';
  if (type === 'radar' || type === 'scatter' || type === 'bubble') return 'PPTX export keeps the editable chartSpec data with limited native PowerPoint fidelity for this chart type.';
  return 'PPTX export uses the existing native chartSpec path for this chart type.';
}

function presetSearchText(preset: SlideChartPreset): string {
  return normalize([
    preset.id,
    preset.label,
    preset.description,
    preset.useCase,
    preset.category,
    chartPresetCategoryLabel(preset.category),
    preset.spec.type,
    preset.spec.title,
    ...preset.keywords,
    ...preset.spec.labels,
    ...preset.spec.series.map((series) => series.name),
  ].join(' '));
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
