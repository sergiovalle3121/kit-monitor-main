export type Layer = 'control' | 'plan' | 'source' | 'make' | 'deliver' | 'enable';
export type Role =
  | 'admin' | 'planner' | 'buyer' | 'production_supervisor'
  | 'quality_engineer' | 'warehouse_operator' | 'finance' | 'hr';

export interface SubApp {
  id: string;
  name: string;            // sentence case, español
  icon: string;            // nombre de lucide-react
  functions?: string[];    // nivel 3 (opcional)
}

export interface Domain {
  id: string;
  name: string;
  subtitle: string;        // 2–4 palabras
  layer: Layer;
  icon: string;            // lucide-react
  tint: string;            // clase Tailwind de fondo pastel, ej. 'bg-emerald-50'
  accent: string;          // clase Tailwind de color de ícono, ej. 'text-emerald-500'
  roles: Role[];           // quién lo ve (RBAC)
  subApps: SubApp[];
}

export const LAYERS: Record<Layer, { label: string; order: number }> = {
  control: { label: 'Control', order: 0 },
  plan:    { label: 'Planear', order: 1 },
  source:  { label: 'Abastecer', order: 2 },
  make:    { label: 'Producir', order: 3 },
  deliver: { label: 'Entregar', order: 4 },
  enable:  { label: 'Habilitar', order: 5 },
};

export const DOMAINS: Domain[] = [
  {
    id: 'mission-control', name: 'Mission Control', subtitle: 'War room',
    layer: 'control', icon: 'RadioTower', tint: 'bg-cyan-50', accent: 'text-cyan-500',
    roles: ['admin', 'planner', 'production_supervisor', 'finance'],
    subApps: [
      { id: 'exec-board', name: 'Tablero ejecutivo', icon: 'LayoutDashboard' },
      { id: 'alerts', name: 'Alertas y excepciones', icon: 'Bell' },
      { id: 'control-tower', name: 'Torre de control de cadena', icon: 'Network' },
      { id: 'sop-cockpit', name: 'Cockpit S&OP', icon: 'Target' },
    ],
  },
  {
    id: 'planning', name: 'Planeación', subtitle: 'Demanda y suministro',
    layer: 'plan', icon: 'LineChart', tint: 'bg-violet-50', accent: 'text-violet-500',
    roles: ['admin', 'planner'],
    subApps: [
      { id: 'forecast', name: 'Pronóstico de demanda', icon: 'TrendingUp' },
      { id: 'sop-ibp', name: 'S&OP / IBP', icon: 'GitMerge' },
      { id: 'mps', name: 'Plan maestro (MPS)', icon: 'CalendarRange' },
      { id: 'mrp', name: 'MRP', icon: 'ListTree' },
      { id: 'aps', name: 'Capacidad finita (APS)', icon: 'Gauge' },
      { id: 'whatif', name: 'Simulación what-if', icon: 'FlaskConical' },
    ],
  },
  {
    id: 'procurement', name: 'Compras y proveedores', subtitle: 'Sourcing y riesgo',
    layer: 'source', icon: 'ShoppingCart', tint: 'bg-teal-50', accent: 'text-teal-500',
    roles: ['admin', 'buyer', 'planner'],
    subApps: [
      { id: 'rfq', name: 'Sourcing / RFQ', icon: 'FileText' },
      { id: 'srm', name: 'Proveedores y scorecards', icon: 'Users' },
      { id: 'po', name: 'Órdenes de compra', icon: 'ClipboardList' },
      { id: 'allocation', name: 'Allocation y escasez', icon: 'AlertTriangle' },
      { id: 'avl', name: 'AVL / AML', icon: 'ListChecks' },
      { id: 'comp-risk', name: 'Riesgo EOL / falsificación', icon: 'ShieldAlert' },
    ],
  },
  {
    id: 'inventory', name: 'Inventario y materiales', subtitle: 'Custodia de material',
    layer: 'source', icon: 'Boxes', tint: 'bg-blue-50', accent: 'text-blue-500',
    roles: ['admin', 'warehouse_operator', 'planner'],
    subApps: [
      { id: 'stock', name: 'Existencias por ubicación', icon: 'Warehouse' },
      { id: 'lot-serial', name: 'Lote, serie y date-code', icon: 'ScanBarcode' },
      { id: 'cycle-count', name: 'Conteos cíclicos', icon: 'RefreshCw' },
      { id: 'kitting', name: 'Kitting y staging', icon: 'PackagePlus' },
      { id: 'vmi', name: 'Consignación / VMI', icon: 'Handshake' },
    ],
  },
  {
    id: 'engineering', name: 'Ingeniería', subtitle: 'NPI y PLM',
    layer: 'make', icon: 'Cpu', tint: 'bg-indigo-50', accent: 'text-indigo-500',
    roles: ['admin', 'quality_engineer', 'production_supervisor'],
    subApps: [
      { id: 'bom', name: 'Gestión de BOM', icon: 'ListTree' },
      { id: 'eco', name: 'Cambios ECO / ECN', icon: 'GitPullRequest' },
      { id: 'dfx', name: 'DFM / DFx', icon: 'Ruler' },
      { id: 'routing-design', name: 'Diseño de ruta y proceso', icon: 'Workflow' },
      { id: 'doc-control', name: 'Control documental', icon: 'FileStack' },
      { id: 'npi-gating', name: 'Gating de NPI', icon: 'Flag' },
    ],
  },
  {
    id: 'production', name: 'Producción', subtitle: 'MES de piso',
    layer: 'make', icon: 'Factory', tint: 'bg-amber-50', accent: 'text-amber-500',
    roles: ['admin', 'production_supervisor', 'warehouse_operator'],
    subApps: [
      { id: 'work-orders', name: 'Órdenes de trabajo', icon: 'ClipboardCheck' },
      { id: 'shop-floor', name: 'Control de piso y dispatch', icon: 'MonitorCog' },
      { id: 'smt', name: 'Líneas SMT y ensamble', icon: 'CircuitBoard' },
      { id: 'oee', name: 'OEE y desempeño', icon: 'Activity' },
      { id: 'labor-machine', name: 'Mano de obra y máquina', icon: 'Timer' },
      { id: 'wip-genealogy', name: 'WIP y genealogía', icon: 'GitBranch' },
    ],
  },
  {
    id: 'quality', name: 'Calidad', subtitle: 'QMS y normas',
    layer: 'make', icon: 'ShieldCheck', tint: 'bg-emerald-50', accent: 'text-emerald-500',
    roles: ['admin', 'quality_engineer'],
    subApps: [
      { id: 'iqc', name: 'Inspección de entrada (IQC)', icon: 'PackageSearch' },
      { id: 'ipqc-oqc', name: 'En proceso y final', icon: 'SearchCheck' },
      { id: 'ncr-capa', name: 'NCR / CAPA', icon: 'AlertOctagon' },
      { id: 'spc', name: 'SPC y gráficas de control', icon: 'BarChart3' },
      { id: 'traceability', name: 'Trazabilidad', icon: 'Fingerprint' },
      { id: 'audits', name: 'Auditorías y normas', icon: 'BadgeCheck' },
      { id: 'calibration', name: 'Calibración', icon: 'Crosshair' },
    ],
  },
  {
    id: 'maintenance', name: 'Mantenimiento', subtitle: 'Activos y TPM',
    layer: 'make', icon: 'Wrench', tint: 'bg-orange-50', accent: 'text-orange-500',
    roles: ['admin', 'production_supervisor'],
    subApps: [
      { id: 'asset-register', name: 'Registro de equipos', icon: 'HardDrive' },
      { id: 'pm', name: 'Preventivo y predictivo', icon: 'CalendarClock' },
      { id: 'maint-calibration', name: 'Calibración', icon: 'Crosshair' },
      { id: 'spares', name: 'Refacciones', icon: 'Cog' },
      { id: 'downtime', name: 'Tiempos muertos', icon: 'TimerOff' },
    ],
  },
  {
    id: 'logistics', name: 'Logística y comercio exterior', subtitle: 'Entrega y aduana',
    layer: 'deliver', icon: 'Truck', tint: 'bg-sky-50', accent: 'text-sky-500',
    roles: ['admin', 'warehouse_operator', 'finance'],
    subApps: [
      { id: 'wms', name: 'Almacén (WMS / EWM)', icon: 'Warehouse' },
      { id: 'inbound-outbound', name: 'Entradas y salidas', icon: 'ArrowLeftRight' },
      { id: 'shipping', name: 'Embarques y flete', icon: 'Ship' },
      { id: 'customs', name: 'Aduana / IMMEX / pedimentos', icon: 'FileBadge' },
      { id: 'trade-compliance', name: 'Cumplimiento comercial', icon: 'Scale' },
    ],
  },
  {
    id: 'finance', name: 'Finanzas', subtitle: 'Costos y contabilidad',
    layer: 'enable', icon: 'DollarSign', tint: 'bg-green-50', accent: 'text-green-500',
    roles: ['admin', 'finance'],
    subApps: [
      { id: 'gl', name: 'Libro mayor (GL)', icon: 'BookOpen' },
      { id: 'ap-ar', name: 'Cuentas por pagar y cobrar', icon: 'Receipt' },
      { id: 'product-costing', name: 'Costeo de producto', icon: 'Calculator' },
      { id: 'cost-accounting', name: 'Costos y varianzas', icon: 'PieChart' },
      { id: 'project-pnl', name: 'P&L por contrato', icon: 'TrendingUp' },
    ],
  },
  {
    id: 'people', name: 'Personas y SST', subtitle: 'Plantilla y seguridad',
    layer: 'enable', icon: 'Users', tint: 'bg-rose-50', accent: 'text-rose-500',
    roles: ['admin', 'hr', 'production_supervisor'],
    subApps: [
      { id: 'workforce', name: 'Plantilla, turnos y tiempos', icon: 'CalendarDays' },
      { id: 'skills', name: 'Skills y certificaciones', icon: 'GraduationCap' },
      { id: 'ehs', name: 'EHS: incidentes y EPP', icon: 'HardHat' },
      { id: 'training', name: 'Capacitación', icon: 'BookMarked' },
    ],
  },
  {
    id: 'admin', name: 'Administración', subtitle: 'Identidad y datos',
    layer: 'enable', icon: 'Lock', tint: 'bg-pink-50', accent: 'text-pink-500',
    roles: ['admin'],
    subApps: [
      { id: 'iam', name: 'IAM / SSO / roles (RBAC)', icon: 'KeyRound' },
      { id: 'mdm', name: 'Datos maestros (MDM)', icon: 'Database' },
      { id: 'audit-log', name: 'Bitácora de auditoría', icon: 'ScrollText' },
      { id: 'tenant-config', name: 'Configuración multi-tenant', icon: 'Building2' },
      { id: 'integrations', name: 'Integraciones y API', icon: 'Plug' },
    ],
  },
];
