/**
 * Catálogo de puestos (job catalog) for a contract-manufacturing (EMS) plant,
 * modeled on how CMs like Flex/Jabil structure their org: a hierarchy of
 * levels (Operador → Director) within each department.
 *
 * Each position maps to a single `role` — the access group that decides which
 * areas of the app the person can see (enforced by useVisibleDomains and the
 * domain `roles`). The user only ever sees their position label; the role id is
 * internal. `level` is used for display today and will gate fine-grained
 * actions (view vs manage vs approve) later.
 */

export type RoleId =
  | 'admin' // system administrator (manages users/access)
  | 'executive' // plant director / ops manager — sees everything, no user admin
  | 'planner'
  | 'warehouse_operator' // materiales y almacén
  | 'production_supervisor'
  | 'quality_engineer'
  | 'engineering'
  | 'buyer'
  | 'finance'
  | 'hr';

export const LEVELS: Record<number, string> = {
  1: 'Operador',
  2: 'Líder / Técnico',
  3: 'Supervisor',
  4: 'Gerente',
  5: 'Director',
};

export interface Department {
  id: string;
  label: string;
  description: string;
  comingSoon?: boolean; // area not built yet — shown but not selectable
}

export interface Position {
  id: string;
  label: string;
  departmentId: string;
  level: number;
  role: RoleId;
}

export const DEPARTMENTS: Department[] = [
  { id: 'direccion', label: 'Dirección', description: 'Vista ejecutiva de toda la planta' },
  { id: 'planeacion', label: 'Planeación', description: 'Demanda, plan maestro y publicación' },
  { id: 'materiales', label: 'Materiales y Almacén', description: 'Inventario, surtido y kitting' },
  { id: 'produccion', label: 'Producción', description: 'Piso, líneas y ejecución' },
  { id: 'calidad', label: 'Calidad', description: 'Inspección, NCR y CAPA' },
  { id: 'ingenieria', label: 'Ingeniería', description: 'NPI, BOM y proceso' },
  { id: 'finanzas', label: 'Finanzas', description: 'Costos y P&L' },
  { id: 'compras', label: 'Compras', description: 'Sourcing y proveedores', comingSoon: true },
  { id: 'logistica', label: 'Logística', description: 'Embarques y aduana', comingSoon: true },
  { id: 'mantenimiento', label: 'Mantenimiento', description: 'Activos y TPM', comingSoon: true },
  { id: 'personas', label: 'Personas y SST', description: 'Plantilla y seguridad', comingSoon: true },
];

export const POSITIONS: Position[] = [
  // Dirección
  { id: 'plant_director', label: 'Director de planta', departmentId: 'direccion', level: 5, role: 'executive' },
  { id: 'ops_manager', label: 'Gerente de operaciones', departmentId: 'direccion', level: 4, role: 'executive' },

  // Planeación
  { id: 'planning_analyst', label: 'Analista de planeación', departmentId: 'planeacion', level: 2, role: 'planner' },
  { id: 'master_planner', label: 'Planeador maestro (MPS/MRP)', departmentId: 'planeacion', level: 3, role: 'planner' },
  { id: 'planning_supervisor', label: 'Supervisor de planeación', departmentId: 'planeacion', level: 3, role: 'planner' },
  { id: 'planning_manager', label: 'Gerente de planeación', departmentId: 'planeacion', level: 4, role: 'planner' },

  // Materiales y Almacén
  { id: 'warehouse_operator', label: 'Operador de almacén', departmentId: 'materiales', level: 1, role: 'warehouse_operator' },
  { id: 'materialist', label: 'Materialista / Surtidor', departmentId: 'materiales', level: 1, role: 'warehouse_operator' },
  { id: 'warehouse_lead', label: 'Líder de almacén', departmentId: 'materiales', level: 2, role: 'warehouse_operator' },
  { id: 'inventory_supervisor', label: 'Supervisor de inventarios', departmentId: 'materiales', level: 3, role: 'warehouse_operator' },
  { id: 'materials_manager', label: 'Gerente de materiales', departmentId: 'materiales', level: 4, role: 'warehouse_operator' },

  // Producción
  { id: 'line_operator', label: 'Operador de línea', departmentId: 'produccion', level: 1, role: 'production_supervisor' },
  { id: 'production_lead', label: 'Líder de producción', departmentId: 'produccion', level: 2, role: 'production_supervisor' },
  { id: 'production_supervisor', label: 'Supervisor de producción', departmentId: 'produccion', level: 3, role: 'production_supervisor' },
  { id: 'production_manager', label: 'Gerente de producción', departmentId: 'produccion', level: 4, role: 'production_supervisor' },

  // Calidad
  { id: 'quality_inspector', label: 'Inspector de calidad', departmentId: 'calidad', level: 1, role: 'quality_engineer' },
  { id: 'quality_engineer', label: 'Ingeniero de calidad', departmentId: 'calidad', level: 3, role: 'quality_engineer' },
  { id: 'quality_manager', label: 'Gerente de calidad', departmentId: 'calidad', level: 4, role: 'quality_engineer' },

  // Ingeniería
  { id: 'process_engineer', label: 'Ingeniero de proceso', departmentId: 'ingenieria', level: 3, role: 'engineering' },
  { id: 'npi_engineer', label: 'Ingeniero NPI', departmentId: 'ingenieria', level: 3, role: 'engineering' },
  { id: 'engineering_manager', label: 'Gerente de ingeniería', departmentId: 'ingenieria', level: 4, role: 'engineering' },

  // Finanzas
  { id: 'cost_analyst', label: 'Analista de costos', departmentId: 'finanzas', level: 2, role: 'finance' },
  { id: 'finance_manager', label: 'Gerente de finanzas', departmentId: 'finanzas', level: 4, role: 'finance' },

  // Coming soon (selectable once their area ships)
  { id: 'buyer', label: 'Comprador', departmentId: 'compras', level: 2, role: 'buyer' },
  { id: 'logistics_coordinator', label: 'Coordinador de logística', departmentId: 'logistica', level: 2, role: 'warehouse_operator' },
  { id: 'maintenance_tech', label: 'Técnico de mantenimiento', departmentId: 'mantenimiento', level: 1, role: 'production_supervisor' },
  { id: 'hr_analyst', label: 'Analista de RH', departmentId: 'personas', level: 2, role: 'hr' },
];

const POS_BY_ID = new Map(POSITIONS.map((p) => [p.id, p]));
const DEPT_BY_ID = new Map(DEPARTMENTS.map((d) => [d.id, d]));

export function getPosition(id?: string | null): Position | undefined {
  return id ? POS_BY_ID.get(id) : undefined;
}

export function roleForPosition(id?: string | null): RoleId {
  return getPosition(id)?.role ?? 'warehouse_operator';
}

/** Human label like "Gerente de producción · Producción" for display. */
export function positionLabel(id?: string | null): string | null {
  const p = getPosition(id);
  if (!p) return null;
  const dept = DEPT_BY_ID.get(p.departmentId);
  return dept ? `${p.label} · ${dept.label}` : p.label;
}

/** Positions grouped by department, for the registration picker. */
export function positionsByDepartment(): { department: Department; positions: Position[] }[] {
  return DEPARTMENTS.map((department) => ({
    department,
    positions: POSITIONS.filter((p) => p.departmentId === department.id).sort((a, b) => a.level - b.level),
  })).filter((g) => g.positions.length > 0);
}

export const SELECTABLE_POSITION_IDS = new Set(
  POSITIONS.filter((p) => !DEPT_BY_ID.get(p.departmentId)?.comingSoon).map((p) => p.id),
);
