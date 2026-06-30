export const SLIDE_ASSET_CATEGORIES = [
  { id: 'production', label: 'Produccion' },
  { id: 'lean', label: 'Lean / VSM' },
  { id: 'quality', label: 'Calidad' },
  { id: 'safety', label: 'Seguridad' },
  { id: 'ehs', label: 'EHS' },
  { id: 'engineering', label: 'Ingenieria' },
  { id: 'warehouse', label: 'Warehouse' },
  { id: 'npi', label: 'NPI / Launch' },
  { id: 'supplier', label: 'Supplier' },
  { id: 'testing', label: 'Testing' },
  { id: 'packing', label: 'Packing' },
  { id: 'shipping', label: 'Shipping' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'office', label: 'Office' },
] as const;

export type SlideAssetCategory = (typeof SLIDE_ASSET_CATEGORIES)[number]['id'];
export type SlideAssetFilterMode = 'all' | 'favorites' | 'recent';

export const SLIDE_ASSET_USE_CASES = [
  { id: 'visualAid', label: 'Visual aid' },
  { id: 'productionReview', label: 'Production review' },
  { id: 'qualityReview', label: 'Quality review' },
  { id: 'npiLaunch', label: 'NPI launch' },
  { id: 'supplierReview', label: 'Supplier review' },
  { id: 'logisticsReview', label: 'Logistics review' },
  { id: 'safetyReview', label: 'Safety review' },
  { id: 'executiveReview', label: 'Executive review' },
] as const;

export type SlideAssetUseCase = (typeof SLIDE_ASSET_USE_CASES)[number]['id'];

export interface SlideAssetMetadata {
  useCases: SlideAssetUseCase[];
  altText: string;
  pptxFidelity: 'svg-vector' | 'review';
  warning?: string;
}

export interface SlideAssetSymbol {
  id: string;
  label: string;
  category: SlideAssetCategory;
  keywords: string[];
  description: string;
  svg: string;
}

export interface SlideAssetFilterOptions {
  category?: SlideAssetCategory | 'all';
  query?: string;
  mode?: SlideAssetFilterMode;
  useCase?: SlideAssetUseCase | 'all';
  favoriteIds?: Iterable<string>;
  recentIds?: Iterable<string>;
}

export const CATEGORY_LABEL = SLIDE_ASSET_CATEGORIES.reduce((acc, category) => {
  acc[category.id] = category.label;
  return acc;
}, {} as Record<SlideAssetCategory, string>);

export const ASSET_USE_CASE_LABEL = SLIDE_ASSET_USE_CASES.reduce((acc, item) => {
  acc[item.id] = item.label;
  return acc;
}, {} as Record<SlideAssetUseCase, string>);

const CATEGORY_USE_CASES: Record<SlideAssetCategory, SlideAssetUseCase[]> = {
  production: ['visualAid', 'productionReview', 'executiveReview'],
  lean: ['visualAid', 'productionReview'],
  quality: ['qualityReview', 'visualAid'],
  safety: ['visualAid', 'safetyReview'],
  ehs: ['visualAid', 'safetyReview'],
  engineering: ['npiLaunch', 'visualAid'],
  warehouse: ['logisticsReview', 'visualAid'],
  npi: ['npiLaunch', 'productionReview'],
  supplier: ['supplierReview', 'qualityReview'],
  testing: ['qualityReview', 'productionReview'],
  packing: ['logisticsReview', 'visualAid'],
  shipping: ['logisticsReview', 'supplierReview'],
  maintenance: ['visualAid', 'safetyReview'],
  office: ['executiveReview', 'qualityReview'],
};

const ASSET_USE_CASE_OVERRIDES: Record<string, SlideAssetUseCase[]> = {
  'oee-tile': ['productionReview', 'executiveReview'],
  pareto: ['qualityReview', 'executiveReview'],
  capa: ['qualityReview', 'executiveReview'],
  'ncr-tag': ['qualityReview', 'visualAid'],
  'launch-gate': ['npiLaunch', 'executiveReview'],
  ppap: ['npiLaunch', 'supplierReview'],
  'pilot-run': ['npiLaunch', 'productionReview'],
  'supplier-scorecard': ['supplierReview', 'executiveReview'],
  scar: ['supplierReview', 'qualityReview'],
  'yield-chart': ['qualityReview', 'executiveReview'],
  'action-register': ['executiveReview', 'qualityReview'],
  'decision-log': ['executiveReview', 'supplierReview'],
};

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">${body}</svg>`;

export const INDUSTRIAL_ASSETS: SlideAssetSymbol[] = [
  { id: 'andon', label: 'Andon stack', category: 'production', keywords: ['linea', 'status', 'alarm', 'produccion'], description: 'Line status tower', svg: svg('<rect x="18" y="16" width="60" height="52" rx="10" fill="#111827"/><circle cx="34" cy="36" r="9" fill="#ef4444"/><circle cx="48" cy="36" r="9" fill="#f59e0b"/><circle cx="62" cy="36" r="9" fill="#10b981"/><rect x="30" y="68" width="36" height="8" rx="4" fill="#6b7280"/>') },
  { id: 'workcell', label: 'Workcell', category: 'production', keywords: ['celda', 'maquina', 'manufactura'], description: 'Manufacturing cell', svg: svg('<rect x="16" y="22" width="64" height="46" rx="8" fill="#e0f2fe" stroke="#0284c7" stroke-width="5"/><rect x="26" y="34" width="18" height="18" rx="3" fill="#0284c7"/><path d="M52 34h14v26H52z" fill="#0369a1"/><path d="M18 76h60" stroke="#0f172a" stroke-width="6" stroke-linecap="round"/>') },
  { id: 'assembly-line', label: 'Assembly line', category: 'production', keywords: ['linea', 'ensamble', 'station'], description: 'Stations on a line', svg: svg('<rect x="10" y="44" width="76" height="16" rx="8" fill="#dbeafe"/><rect x="15" y="28" width="16" height="16" rx="4" fill="#2563eb"/><rect x="40" y="28" width="16" height="16" rx="4" fill="#3b82f6"/><rect x="65" y="28" width="16" height="16" rx="4" fill="#60a5fa"/><path d="M20 70h56" stroke="#0f172a" stroke-width="6" stroke-linecap="round"/>') },
  { id: 'oee-tile', label: 'OEE tile', category: 'production', keywords: ['oee', 'kpi', 'dashboard', 'metric'], description: 'Production KPI', svg: svg('<rect x="14" y="18" width="68" height="60" rx="10" fill="#ecfdf5" stroke="#10b981" stroke-width="4"/><path d="M28 58a22 22 0 0 1 40 0" fill="none" stroke="#059669" stroke-width="8" stroke-linecap="round"/><path d="M48 58l14-18" stroke="#0f172a" stroke-width="5" stroke-linecap="round"/><text x="48" y="31" text-anchor="middle" font-size="13" font-weight="700" fill="#065f46">OEE</text>') },
  { id: 'takt-board', label: 'Takt board', category: 'production', keywords: ['takt', 'hourly', 'plan', 'actual'], description: 'Plan vs actual board', svg: svg('<rect x="14" y="16" width="68" height="64" rx="8" fill="#f8fafc" stroke="#64748b" stroke-width="4"/><path d="M24 34h48M24 50h48M24 66h48M40 22v58M58 22v58" stroke="#cbd5e1" stroke-width="3"/><rect x="42" y="36" width="12" height="10" fill="#10b981"/><rect x="60" y="52" width="12" height="10" fill="#f59e0b"/>') },

  { id: 'kanban', label: 'Kanban card', category: 'lean', keywords: ['pull', 'tarjeta', 'supermarket'], description: 'Lean pull signal', svg: svg('<rect x="14" y="18" width="68" height="56" rx="8" fill="#fef3c7" stroke="#d97706" stroke-width="4"/><path d="M26 34h44M26 48h30M26 62h38" stroke="#92400e" stroke-width="6" stroke-linecap="round"/><circle cx="68" cy="58" r="8" fill="#10b981"/>') },
  { id: 'kaizen', label: 'Kaizen burst', category: 'lean', keywords: ['mejora', 'lean', 'continuous'], description: 'Improvement marker', svg: svg('<path d="M48 12l9 24h25L62 51l8 25-22-15-22 15 8-25-20-15h25z" fill="#f59e0b"/><path d="M34 50l9 9 20-24" fill="none" stroke="#111827" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>') },
  { id: 'value-stream', label: 'Value stream', category: 'lean', keywords: ['vsm', 'flujo', 'material', 'information'], description: 'VSM-lite flow', svg: svg('<rect x="10" y="36" width="20" height="20" rx="4" fill="#dbeafe" stroke="#2563eb" stroke-width="4"/><rect x="38" y="36" width="20" height="20" rx="4" fill="#dcfce7" stroke="#16a34a" stroke-width="4"/><rect x="66" y="36" width="20" height="20" rx="4" fill="#fee2e2" stroke="#dc2626" stroke-width="4"/><path d="M30 46h8M58 46h8M20 67c16 12 40 12 56 0" stroke="#0f172a" stroke-width="4" fill="none" stroke-linecap="round"/>') },
  { id: 'heijunka', label: 'Heijunka box', category: 'lean', keywords: ['leveling', 'schedule', 'lean'], description: 'Level loading grid', svg: svg('<rect x="14" y="18" width="68" height="60" rx="8" fill="#f8fafc" stroke="#64748b" stroke-width="4"/><path d="M14 38h68M14 58h68M36 18v60M60 18v60" stroke="#cbd5e1" stroke-width="4"/><rect x="20" y="24" width="10" height="8" rx="2" fill="#f59e0b"/><rect x="42" y="44" width="10" height="8" rx="2" fill="#10b981"/><rect x="66" y="64" width="10" height="8" rx="2" fill="#3b82f6"/>') },

  { id: 'pareto', label: 'Pareto defects', category: 'quality', keywords: ['calidad', 'defectos', 'chart'], description: 'Quality Pareto', svg: svg('<rect x="18" y="58" width="12" height="22" fill="#3b82f6"/><rect x="38" y="42" width="12" height="38" fill="#2563eb"/><rect x="58" y="24" width="12" height="56" fill="#1d4ed8"/><path d="M16 62c18-18 36-25 62-42" fill="none" stroke="#ef4444" stroke-width="5" stroke-linecap="round"/><path d="M14 82h68" stroke="#111827" stroke-width="5" stroke-linecap="round"/>') },
  { id: 'capa', label: 'CAPA', category: 'quality', keywords: ['accion correctiva', '8d', 'calidad'], description: 'Corrective action', svg: svg('<circle cx="48" cy="48" r="34" fill="#dcfce7" stroke="#16a34a" stroke-width="5"/><path d="M32 48l11 11 22-25" fill="none" stroke="#166534" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M70 70l12 12" stroke="#16a34a" stroke-width="7" stroke-linecap="round"/>') },
  { id: 'ncr-tag', label: 'NCR tag', category: 'quality', keywords: ['nonconformance', 'mrb', 'defect'], description: 'Nonconformance marker', svg: svg('<path d="M20 14h38l18 18v50H20z" fill="#fff7ed" stroke="#f97316" stroke-width="5" stroke-linejoin="round"/><path d="M58 14v20h18" fill="#fed7aa" stroke="#f97316" stroke-width="5" stroke-linejoin="round"/><path d="M32 54h32M32 66h24" stroke="#9a3412" stroke-width="6" stroke-linecap="round"/><circle cx="36" cy="34" r="7" fill="#ef4444"/>') },
  { id: 'gage-rnr', label: 'Gage R&R', category: 'quality', keywords: ['measurement', 'msa', 'calibration'], description: 'Measurement system', svg: svg('<circle cx="48" cy="52" r="30" fill="#eff6ff" stroke="#2563eb" stroke-width="5"/><path d="M28 52h40M48 32v40" stroke="#93c5fd" stroke-width="4"/><path d="M48 52l18-15" stroke="#0f172a" stroke-width="6" stroke-linecap="round"/><rect x="31" y="72" width="34" height="8" rx="4" fill="#2563eb"/>') },

  { id: 'ppe', label: 'PPE required', category: 'safety', keywords: ['epp', 'safety', 'operator'], description: 'Operator PPE', svg: svg('<path d="M25 44c0-19 12-31 23-31s23 12 23 31v8H25z" fill="#facc15" stroke="#a16207" stroke-width="4"/><path d="M18 52h60v10a8 8 0 0 1-8 8H26a8 8 0 0 1-8-8z" fill="#fde68a" stroke="#a16207" stroke-width="4"/><path d="M48 16v34" stroke="#a16207" stroke-width="4"/>') },
  { id: 'hazard', label: 'Hazard warning', category: 'safety', keywords: ['riesgo', 'alerta', 'warning'], description: 'Safety hazard', svg: svg('<path d="M48 12l38 68H10z" fill="#fee2e2" stroke="#dc2626" stroke-width="6" stroke-linejoin="round"/><path d="M48 34v22" stroke="#991b1b" stroke-width="8" stroke-linecap="round"/><circle cx="48" cy="68" r="5" fill="#991b1b"/>') },
  { id: 'lockout', label: 'Lockout tagout', category: 'safety', keywords: ['loto', 'lock', 'energy'], description: 'Energy isolation', svg: svg('<rect x="24" y="42" width="48" height="34" rx="8" fill="#fee2e2" stroke="#dc2626" stroke-width="5"/><path d="M34 42V30a14 14 0 0 1 28 0v12" fill="none" stroke="#991b1b" stroke-width="7" stroke-linecap="round"/><path d="M38 58h20" stroke="#991b1b" stroke-width="6" stroke-linecap="round"/>') },
  { id: 'forklift-alert', label: 'Forklift alert', category: 'safety', keywords: ['forklift', 'traffic', 'pedestrian'], description: 'Forklift traffic risk', svg: svg('<rect x="18" y="45" width="42" height="18" rx="4" fill="#f59e0b"/><path d="M60 28v35h14" stroke="#92400e" stroke-width="7" stroke-linecap="round"/><circle cx="28" cy="70" r="7" fill="#111827"/><circle cx="54" cy="70" r="7" fill="#111827"/><path d="M18 32l-8 14M18 32l13 8" stroke="#ef4444" stroke-width="5" stroke-linecap="round"/>') },

  { id: 'spill-kit', label: 'Spill kit', category: 'ehs', keywords: ['derrame', 'environment', 'ehs'], description: 'Environmental response', svg: svg('<rect x="18" y="22" width="60" height="52" rx="8" fill="#ecfeff" stroke="#0891b2" stroke-width="5"/><path d="M48 32c12 14 18 23 18 31a18 18 0 0 1-36 0c0-8 6-17 18-31z" fill="#06b6d4"/><path d="M36 62c6 5 16 6 24 0" stroke="#cffafe" stroke-width="5" stroke-linecap="round"/>') },
  { id: 'chemical', label: 'Chemical control', category: 'ehs', keywords: ['chemical', 'hazmat', 'sds'], description: 'Chemical handling', svg: svg('<path d="M38 14h20v12l20 42a9 9 0 0 1-8 13H26a9 9 0 0 1-8-13l20-42z" fill="#fefce8" stroke="#ca8a04" stroke-width="5" stroke-linejoin="round"/><path d="M31 58h34" stroke="#facc15" stroke-width="10" stroke-linecap="round"/><path d="M39 26h18" stroke="#854d0e" stroke-width="5" stroke-linecap="round"/>') },

  { id: 'ecn', label: 'ECN', category: 'engineering', keywords: ['cambio', 'engineering', 'revision'], description: 'Engineering change', svg: svg('<rect x="20" y="14" width="48" height="68" rx="6" fill="#eef2ff" stroke="#4f46e5" stroke-width="5"/><path d="M32 32h24M32 46h24M32 60h16" stroke="#3730a3" stroke-width="5" stroke-linecap="round"/><path d="M62 54l16 16M78 54L62 70" stroke="#f97316" stroke-width="7" stroke-linecap="round"/>') },
  { id: 'bom-tree', label: 'BOM tree', category: 'engineering', keywords: ['bom', 'estructura', 'materiales'], description: 'Product structure', svg: svg('<circle cx="48" cy="20" r="10" fill="#0ea5e9"/><circle cx="28" cy="66" r="10" fill="#38bdf8"/><circle cx="68" cy="66" r="10" fill="#38bdf8"/><path d="M48 30v14M48 44H28v12M48 44h20v12" stroke="#0f172a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>') },
  { id: 'routing', label: 'Routing steps', category: 'engineering', keywords: ['routing', 'process', 'station'], description: 'Process route', svg: svg('<circle cx="20" cy="48" r="10" fill="#dbeafe" stroke="#2563eb" stroke-width="4"/><circle cx="48" cy="48" r="10" fill="#dcfce7" stroke="#16a34a" stroke-width="4"/><circle cx="76" cy="48" r="10" fill="#fef3c7" stroke="#d97706" stroke-width="4"/><path d="M30 48h8M58 48h8" stroke="#0f172a" stroke-width="5" stroke-linecap="round"/>') },
  { id: 'control-plan', label: 'Control plan', category: 'engineering', keywords: ['apqp', 'inspection', 'plan'], description: 'Control plan grid', svg: svg('<rect x="16" y="18" width="64" height="60" rx="8" fill="#f8fafc" stroke="#475569" stroke-width="4"/><path d="M16 36h64M16 52h64M36 18v60M58 18v60" stroke="#cbd5e1" stroke-width="4"/><path d="M24 28h6M44 45h8M64 63h6" stroke="#16a34a" stroke-width="5" stroke-linecap="round"/>') },

  { id: 'rack', label: 'Warehouse rack', category: 'warehouse', keywords: ['rack', 'warehouse', 'inventory'], description: 'Storage rack', svg: svg('<rect x="14" y="20" width="68" height="56" rx="4" fill="#f8fafc" stroke="#64748b" stroke-width="5"/><path d="M14 39h68M14 58h68M32 20v56M64 20v56" stroke="#94a3b8" stroke-width="5"/><rect x="18" y="24" width="10" height="10" fill="#f59e0b"/><rect x="38" y="43" width="18" height="10" fill="#3b82f6"/><rect x="68" y="62" width="10" height="10" fill="#10b981"/>') },
  { id: 'pallet', label: 'Pallet', category: 'warehouse', keywords: ['pallet', 'material', 'storage'], description: 'Material pallet', svg: svg('<rect x="18" y="34" width="60" height="26" rx="4" fill="#d97706"/><path d="M20 64h56M26 60v12M48 60v12M70 60v12" stroke="#78350f" stroke-width="6" stroke-linecap="round"/><path d="M20 42h56" stroke="#fbbf24" stroke-width="4"/>') },
  { id: 'cycle-count', label: 'Cycle count', category: 'warehouse', keywords: ['conteo', 'inventory', 'audit'], description: 'Inventory count', svg: svg('<rect x="18" y="14" width="48" height="68" rx="6" fill="#f8fafc" stroke="#64748b" stroke-width="5"/><path d="M30 34h24M30 48h24M30 62h16" stroke="#334155" stroke-width="5" stroke-linecap="round"/><circle cx="70" cy="66" r="15" fill="#dbeafe" stroke="#2563eb" stroke-width="5"/><path d="M64 66l5 5 9-12" fill="none" stroke="#1d4ed8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>') },

  { id: 'launch-gate', label: 'Launch gate', category: 'npi', keywords: ['gate', 'launch', 'npi', 'readiness'], description: 'NPI gate review', svg: svg('<rect x="18" y="20" width="60" height="52" rx="10" fill="#eef2ff" stroke="#4f46e5" stroke-width="5"/><path d="M32 62V34h32v28" fill="none" stroke="#3730a3" stroke-width="6" stroke-linejoin="round"/><path d="M48 34v28" stroke="#3730a3" stroke-width="5"/><circle cx="48" cy="26" r="7" fill="#f59e0b"/>') },
  { id: 'ppap', label: 'PPAP packet', category: 'npi', keywords: ['ppap', 'apqp', 'approval'], description: 'Launch approval package', svg: svg('<rect x="24" y="14" width="48" height="68" rx="6" fill="#f8fafc" stroke="#64748b" stroke-width="5"/><path d="M34 34h28M34 48h28M34 62h18" stroke="#334155" stroke-width="5" stroke-linecap="round"/><path d="M62 67l7 7 14-19" fill="none" stroke="#16a34a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>') },
  { id: 'pilot-run', label: 'Pilot run', category: 'npi', keywords: ['pilot', 'run at rate', 'trial'], description: 'Pilot production', svg: svg('<path d="M16 62h64" stroke="#0f172a" stroke-width="6" stroke-linecap="round"/><rect x="20" y="34" width="22" height="20" rx="4" fill="#dbeafe" stroke="#2563eb" stroke-width="4"/><rect x="54" y="34" width="22" height="20" rx="4" fill="#dcfce7" stroke="#16a34a" stroke-width="4"/><path d="M42 44h12" stroke="#0f172a" stroke-width="5" stroke-linecap="round"/><circle cx="31" cy="67" r="6" fill="#2563eb"/><circle cx="65" cy="67" r="6" fill="#16a34a"/>') },

  { id: 'supplier-scorecard', label: 'Supplier scorecard', category: 'supplier', keywords: ['supplier', 'vendor', 'score'], description: 'Supplier performance', svg: svg('<rect x="14" y="18" width="68" height="60" rx="8" fill="#f8fafc" stroke="#64748b" stroke-width="4"/><path d="M28 60l12-16 13 8 16-24" fill="none" stroke="#2563eb" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 70h48" stroke="#cbd5e1" stroke-width="5"/><circle cx="69" cy="28" r="7" fill="#10b981"/>') },
  { id: 'scar', label: 'SCAR', category: 'supplier', keywords: ['corrective', 'supplier', 'quality'], description: 'Supplier corrective action', svg: svg('<rect x="18" y="18" width="60" height="60" rx="10" fill="#fff1f2" stroke="#e11d48" stroke-width="5"/><path d="M32 36h32M32 50h20" stroke="#9f1239" stroke-width="5" stroke-linecap="round"/><path d="M60 58l14 14M74 58L60 72" stroke="#e11d48" stroke-width="6" stroke-linecap="round"/>') },
  { id: 'incoming-inspection', label: 'Incoming IQC', category: 'supplier', keywords: ['iqc', 'receiving', 'inspection'], description: 'Incoming inspection', svg: svg('<rect x="14" y="26" width="46" height="34" rx="6" fill="#dbeafe" stroke="#2563eb" stroke-width="5"/><circle cx="64" cy="58" r="16" fill="none" stroke="#0f172a" stroke-width="6"/><path d="M76 70l10 10" stroke="#0f172a" stroke-width="6" stroke-linecap="round"/><path d="M24 43h24" stroke="#1d4ed8" stroke-width="5" stroke-linecap="round"/>') },

  { id: 'ict-test', label: 'ICT test', category: 'testing', keywords: ['test', 'ict', 'fixture'], description: 'In-circuit test', svg: svg('<rect x="18" y="22" width="60" height="46" rx="8" fill="#ecfeff" stroke="#0891b2" stroke-width="5"/><circle cx="34" cy="45" r="5" fill="#0e7490"/><circle cx="48" cy="45" r="5" fill="#0e7490"/><circle cx="62" cy="45" r="5" fill="#0e7490"/><path d="M30 74h36" stroke="#0f172a" stroke-width="6" stroke-linecap="round"/>') },
  { id: 'burn-in', label: 'Burn-in', category: 'testing', keywords: ['reliability', 'thermal', 'test'], description: 'Thermal reliability test', svg: svg('<rect x="18" y="20" width="60" height="56" rx="8" fill="#fff7ed" stroke="#f97316" stroke-width="5"/><path d="M35 62c-7-10 5-14 0-24M48 62c-7-10 5-14 0-24M61 62c-7-10 5-14 0-24" stroke="#ea580c" stroke-width="5" stroke-linecap="round" fill="none"/>') },
  { id: 'yield-chart', label: 'Yield chart', category: 'testing', keywords: ['yield', 'pass', 'fail', 'chart'], description: 'Test yield review', svg: svg('<rect x="18" y="62" width="12" height="18" fill="#10b981"/><rect x="38" y="48" width="12" height="32" fill="#22c55e"/><rect x="58" y="30" width="12" height="50" fill="#16a34a"/><path d="M18 80h60" stroke="#0f172a" stroke-width="5" stroke-linecap="round"/><circle cx="72" cy="26" r="8" fill="#ef4444"/>') },

  { id: 'carton', label: 'Carton pack', category: 'packing', keywords: ['packing', 'box', 'carton'], description: 'Packing carton', svg: svg('<path d="M18 34l30-16 30 16v34L48 84 18 68z" fill="#fef3c7" stroke="#d97706" stroke-width="5" stroke-linejoin="round"/><path d="M18 34l30 16 30-16M48 50v34" stroke="#92400e" stroke-width="4" stroke-linejoin="round"/>') },
  { id: 'label-verify', label: 'Label verify', category: 'packing', keywords: ['label', 'barcode', 'packing'], description: 'Label verification', svg: svg('<rect x="18" y="20" width="60" height="48" rx="8" fill="#f8fafc" stroke="#64748b" stroke-width="5"/><path d="M30 34v20M38 34v20M48 34v20M58 34v20M66 34v20" stroke="#0f172a" stroke-width="3"/><path d="M34 76l8 8 18-22" fill="none" stroke="#10b981" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>') },

  { id: 'truck', label: 'Shipment truck', category: 'shipping', keywords: ['shipping', 'truck', 'delivery'], description: 'Outbound shipment', svg: svg('<rect x="12" y="38" width="44" height="24" rx="4" fill="#dbeafe" stroke="#2563eb" stroke-width="5"/><path d="M56 46h14l12 16H56z" fill="#bfdbfe" stroke="#2563eb" stroke-width="5" stroke-linejoin="round"/><circle cx="28" cy="68" r="7" fill="#0f172a"/><circle cx="68" cy="68" r="7" fill="#0f172a"/>') },
  { id: 'dock-door', label: 'Dock door', category: 'shipping', keywords: ['dock', 'outbound', 'door'], description: 'Shipping dock', svg: svg('<rect x="22" y="16" width="52" height="64" rx="6" fill="#f8fafc" stroke="#64748b" stroke-width="5"/><path d="M22 32h52M22 48h52M22 64h52" stroke="#cbd5e1" stroke-width="5"/><path d="M34 80h28" stroke="#0f172a" stroke-width="6" stroke-linecap="round"/>') },

  { id: 'pm-wrench', label: 'PM wrench', category: 'maintenance', keywords: ['maintenance', 'pm', 'tooling'], description: 'Preventive maintenance', svg: svg('<path d="M64 14a18 18 0 0 0-20 22L18 62a10 10 0 0 0 14 14l26-26a18 18 0 0 0 22-20l-13 13-16-16z" fill="#e2e8f0" stroke="#475569" stroke-width="5" stroke-linejoin="round"/><circle cx="26" cy="68" r="4" fill="#475569"/>') },
  { id: 'calibration', label: 'Calibration', category: 'maintenance', keywords: ['calibration', 'gage', 'maintenance'], description: 'Calibration status', svg: svg('<circle cx="48" cy="48" r="32" fill="#f8fafc" stroke="#64748b" stroke-width="5"/><path d="M48 20v10M48 66v10M20 48h10M66 48h10" stroke="#94a3b8" stroke-width="5" stroke-linecap="round"/><path d="M48 48l16-12" stroke="#2563eb" stroke-width="6" stroke-linecap="round"/><path d="M32 70l8 8 18-22" fill="none" stroke="#10b981" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>') },

  { id: 'action-register', label: 'Action register', category: 'office', keywords: ['actions', 'meeting', 'owner', 'due'], description: 'Review actions table', svg: svg('<rect x="18" y="16" width="60" height="64" rx="8" fill="#f8fafc" stroke="#64748b" stroke-width="5"/><path d="M30 34h34M30 50h34M30 66h24" stroke="#334155" stroke-width="5" stroke-linecap="round"/><path d="M24 34l4 4 7-10M24 50l4 4 7-10M24 66l4 4 7-10" fill="none" stroke="#10b981" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>') },
  { id: 'decision-log', label: 'Decision log', category: 'office', keywords: ['decision', 'approval', 'review'], description: 'Meeting decision record', svg: svg('<rect x="18" y="18" width="60" height="58" rx="8" fill="#eef2ff" stroke="#4f46e5" stroke-width="5"/><path d="M32 36h32M32 52h20" stroke="#3730a3" stroke-width="5" stroke-linecap="round"/><circle cx="64" cy="62" r="12" fill="#dcfce7" stroke="#16a34a" stroke-width="5"/><path d="M58 62l5 5 9-12" fill="none" stroke="#166534" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>') },
];

export function normalizeAssetQuery(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function assetSearchText(asset: SlideAssetSymbol): string {
  const metadata = getSlideAssetMetadata(asset);
  return normalizeAssetQuery([
    asset.id,
    asset.label,
    CATEGORY_LABEL[asset.category],
    asset.description,
    metadata.altText,
    ...metadata.useCases.map((useCase) => ASSET_USE_CASE_LABEL[useCase]),
    ...asset.keywords,
  ].join(' '));
}

export function getSlideAssetUseCases(asset: SlideAssetSymbol): SlideAssetUseCase[] {
  return ASSET_USE_CASE_OVERRIDES[asset.id] ?? CATEGORY_USE_CASES[asset.category];
}

export function getSlideAssetMetadata(asset: SlideAssetSymbol): SlideAssetMetadata {
  const useCases = getSlideAssetUseCases(asset);
  const hasSvg = asset.svg.startsWith('<svg ') && !/<script\b/i.test(asset.svg);
  const completeSearchMetadata = asset.keywords.length >= 3 && asset.description.trim().length > 3;
  return {
    useCases,
    altText: `${asset.label}: ${asset.description} (${CATEGORY_LABEL[asset.category]}).`,
    pptxFidelity: hasSvg ? 'svg-vector' : 'review',
    warning: !hasSvg
      ? 'Review SVG before PPTX export.'
      : completeSearchMetadata
        ? undefined
        : 'Add search keywords before release.',
  };
}

export function getSlideAssetById(id: string, assets: readonly SlideAssetSymbol[] = INDUSTRIAL_ASSETS): SlideAssetSymbol | undefined {
  return assets.find((asset) => asset.id === id);
}

export function filterSlideAssets(
  assets: readonly SlideAssetSymbol[] = INDUSTRIAL_ASSETS,
  options: SlideAssetFilterOptions = {},
): SlideAssetSymbol[] {
  const category = options.category ?? 'all';
  const query = normalizeAssetQuery(options.query ?? '');
  const favoriteSet = new Set(options.favoriteIds ?? []);
  const recentIds = [...(options.recentIds ?? [])];
  const recentSet = new Set(recentIds);
  const recentRank = new Map(recentIds.map((id, index) => [id, index]));
  const mode = options.mode ?? 'all';
  const useCase = options.useCase ?? 'all';

  return assets
    .filter((asset) => {
      if (category !== 'all' && asset.category !== category) return false;
      if (useCase !== 'all' && !getSlideAssetUseCases(asset).includes(useCase)) return false;
      if (mode === 'favorites' && !favoriteSet.has(asset.id)) return false;
      if (mode === 'recent' && !recentSet.has(asset.id)) return false;
      if (!query) return true;
      return assetSearchText(asset).includes(query);
    })
    .sort((a, b) => {
      if (mode === 'recent') return (recentRank.get(a.id) ?? 9999) - (recentRank.get(b.id) ?? 9999);
      const favDelta = Number(favoriteSet.has(b.id)) - Number(favoriteSet.has(a.id));
      if (favDelta) return favDelta;
      const catDelta = CATEGORY_LABEL[a.category].localeCompare(CATEGORY_LABEL[b.category]);
      return catDelta || a.label.localeCompare(b.label);
    });
}

export function assetCatalogStats(assets: readonly SlideAssetSymbol[] = INDUSTRIAL_ASSETS): {
  total: number;
  categories: Record<SlideAssetCategory, number>;
  useCases: Record<SlideAssetUseCase, number>;
} {
  const categories = SLIDE_ASSET_CATEGORIES.reduce((acc, category) => {
    acc[category.id] = 0;
    return acc;
  }, {} as Record<SlideAssetCategory, number>);
  const useCases = SLIDE_ASSET_USE_CASES.reduce((acc, item) => {
    acc[item.id] = 0;
    return acc;
  }, {} as Record<SlideAssetUseCase, number>);
  for (const asset of assets) {
    categories[asset.category] += 1;
    for (const useCase of getSlideAssetUseCases(asset)) useCases[useCase] += 1;
  }
  return { total: assets.length, categories, useCases };
}
