/**
 * Frontend mirror of the backend RBAC catalog
 * (`apps/api/src/modules/auth/rbac.ts`), enriched with Spanish UI metadata.
 *
 * WHY mirror instead of fetch: the canonical truth for what a `User.role` string
 * grants lives in the backend `ROLE_PERMISSIONS` map — that's what the API uses to
 * stamp `permissions` into the JWT (`permissionsFor(role)`), and what the guards
 * enforce as `resource:action`. There is no read endpoint that exposes THAT map
 * (the `/api/roles` endpoints are the separate DB-backed RBAC and require
 * `auth:write`), so we mirror it here the same way `@/lib/owner` mirrors the
 * backend `ownerEmails`. This module is the single source of truth shared by the
 * Usuarios page (role assignment) and the Matriz de permisos page (read-only),
 * so the two never drift.
 *
 * If you change the backend matrix, change it here too (and vice-versa). The
 * `rbac.spec.ts` on the backend guards the server side; this file is UI-only.
 */

export type AppRole =
  | 'admin'
  | 'executive'
  | 'plant_manager'
  | 'planner'
  | 'warehouse_operator'
  | 'materialist'
  | 'production_supervisor'
  | 'operator'
  | 'quality_engineer'
  | 'mrb_member'
  | 'engineering'
  | 'industrial_engineer'
  | 'cycle_count_analyst'
  | 'maintenance_tech'
  | 'buyer'
  | 'finance'
  | 'hr';

const READ_ALL = [
  'production:read',
  'materials:read',
  'finance:read',
  'sales:read',
  'quality:read',
  'inventory:read',
  'planning:read',
  'engineering:read',
  'reports:read',
];

/** Verbatim mirror of backend ROLE_PERMISSIONS. Keep in sync. */
export const ROLE_PERMISSIONS: Record<AppRole, string[]> = {
  admin: [], // role 'Admin' bypasses the guard; effective = ALL_PERMISSIONS
  executive: READ_ALL,
  plant_manager: [
    ...READ_ALL,
    'planning:write',
    'planning:publish',
    'production:write',
    'production:authorize',
    'quality:write',
    'quality:hold',
    'quality:disposition',
    'materials:write',
    'materials:stage',
    'inventory:write',
    'inventory:reconcile',
    'maintenance:write',
  ],
  planner: [
    'planning:read',
    'planning:write',
    'planning:publish',
    'production:read',
    'materials:read',
    'inventory:read',
    'sales:read',
    'reports:read',
  ],
  warehouse_operator: [
    'materials:read',
    'materials:write',
    'materials:request',
    'materials:authorize',
    'materials:stage',
    'inventory:read',
    'inventory:write',
    'production:read',
  ],
  materialist: [
    'materials:read',
    'materials:stage',
    'materials:request',
    'inventory:read',
  ],
  production_supervisor: [
    'production:read',
    'production:write',
    'production:execute',
    'production:authorize',
    'materials:read',
    'materials:request',
    'quality:read',
    'quality:report',
    'engineering:read',
  ],
  operator: [
    'production:read',
    'production:execute',
    'quality:report',
    'materials:read',
  ],
  quality_engineer: [
    'quality:read',
    'quality:write',
    'quality:hold',
    'quality:report',
    'quality:disposition',
    'production:read',
    'materials:read',
  ],
  mrb_member: [
    'quality:disposition',
    'quality:read',
    'engineering:read',
    'materials:read',
  ],
  engineering: [
    'engineering:read',
    'engineering:write',
    'production:read',
    'materials:read',
  ],
  industrial_engineer: [
    'engineering:read',
    'engineering:write',
    'production:read',
    'materials:read',
  ],
  cycle_count_analyst: ['inventory:read', 'inventory:reconcile', 'reports:read'],
  maintenance_tech: ['maintenance:read', 'maintenance:write', 'production:read'],
  buyer: ['materials:read', 'materials:write', 'finance:read', 'inventory:read'],
  finance: [
    'finance:read',
    'finance:write',
    'sales:read',
    'sales:write',
    'reports:read',
  ],
  hr: ['reports:read'],
};

export const APP_ROLES: AppRole[] = Object.keys(ROLE_PERMISSIONS) as AppRole[];

/**
 * Every distinct permission the platform knows about — union of all non-admin
 * grants plus the admin-only auth/settings perms. The `admin` role resolves to
 * THIS full set (mirror of backend `ALL_PERMISSIONS`).
 */
export const ALL_PERMISSIONS: string[] = Array.from(
  new Set<string>([
    ...Object.entries(ROLE_PERMISSIONS).flatMap(([role, perms]) =>
      role === 'admin' ? [] : perms,
    ),
    'auth:read',
    'auth:write',
    'settings:read',
    'settings:write',
  ]),
);

export function isAppRole(role?: string | null): role is AppRole {
  return !!role && (APP_ROLES as string[]).includes((role || '').toLowerCase());
}

/** Effective permissions a role grants. Admin/Master → the full set. */
export function permissionsForRole(role?: string | null): string[] {
  const r = (role || '').toLowerCase();
  if (r === 'admin') return [...ALL_PERMISSIONS];
  return ROLE_PERMISSIONS[r as AppRole] ?? [];
}

export function roleHasPermission(role: string, perm: string): boolean {
  const r = (role || '').toLowerCase();
  if (r === 'admin') return ALL_PERMISSIONS.includes(perm);
  return (ROLE_PERMISSIONS[r as AppRole] ?? []).includes(perm);
}

// ── UI metadata ──────────────────────────────────────────────────────────────

/** Tailwind tone tokens (literal strings so JIT keeps them). */
export const TONES: Record<
  string,
  { chip: string; text: string; dot: string; soft: string }
> = {
  purple: { chip: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500', soft: 'bg-purple-500/10' },
  blue: { chip: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500', soft: 'bg-blue-500/10' },
  indigo: { chip: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500', soft: 'bg-indigo-500/10' },
  sky: { chip: 'bg-sky-50 dark:bg-sky-500/10', text: 'text-sky-700 dark:text-sky-300', dot: 'bg-sky-500', soft: 'bg-sky-500/10' },
  teal: { chip: 'bg-teal-50 dark:bg-teal-500/10', text: 'text-teal-700 dark:text-teal-300', dot: 'bg-teal-500', soft: 'bg-teal-500/10' },
  cyan: { chip: 'bg-cyan-50 dark:bg-cyan-500/10', text: 'text-cyan-700 dark:text-cyan-300', dot: 'bg-cyan-500', soft: 'bg-cyan-500/10' },
  rose: { chip: 'bg-rose-50 dark:bg-rose-500/10', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500', soft: 'bg-rose-500/10' },
  violet: { chip: 'bg-violet-50 dark:bg-violet-500/10', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500', soft: 'bg-violet-500/10' },
  orange: { chip: 'bg-orange-50 dark:bg-orange-500/10', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500', soft: 'bg-orange-500/10' },
  amber: { chip: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500', soft: 'bg-amber-500/10' },
  emerald: { chip: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500', soft: 'bg-emerald-500/10' },
  pink: { chip: 'bg-pink-50 dark:bg-pink-500/10', text: 'text-pink-700 dark:text-pink-300', dot: 'bg-pink-500', soft: 'bg-pink-500/10' },
  slate: { chip: 'bg-slate-100 dark:bg-white/10', text: 'text-slate-700 dark:text-slate-300', dot: 'bg-slate-400', soft: 'bg-slate-500/10' },
  gray: { chip: 'bg-gray-100 dark:bg-white/10', text: 'text-gray-700 dark:text-gray-300', dot: 'bg-gray-400', soft: 'bg-gray-500/10' },
};

export interface RoleMeta {
  value: AppRole;
  label: string;
  short: string;
  description: string;
  group: string;
  tone: keyof typeof TONES;
}

/** Order preserved from ROLE_PERMISSIONS (admin first). */
export const ROLE_META: RoleMeta[] = [
  { value: 'admin', label: 'Administrador (acceso total)', short: 'Admin', group: 'Administración', tone: 'purple', description: 'Acceso total. Omite el guard de permisos: puede ver y hacer todo en la plataforma.' },
  { value: 'executive', label: 'Dirección / Ejecutivo', short: 'Dirección', group: 'Dirección', tone: 'amber', description: 'Vista ejecutiva de toda la planta. Solo lectura en cada dominio.' },
  { value: 'plant_manager', label: 'Gerente de planta', short: 'Gerente', group: 'Dirección', tone: 'blue', description: 'Opera la planta: publica planes, autoriza producción y dispone calidad.' },
  { value: 'planner', label: 'Planeación', short: 'Planeación', group: 'Planeación', tone: 'sky', description: 'Demanda, plan maestro (MPS/MRP) y publicación de planes.' },
  { value: 'warehouse_operator', label: 'Almacén', short: 'Almacén', group: 'Materiales', tone: 'teal', description: 'Recibo, inventario y surtido de materiales.' },
  { value: 'materialist', label: 'Materialista / Surtidor', short: 'Materialista', group: 'Materiales', tone: 'teal', description: 'Surte kits a la estación y levanta solicitudes de reabasto.' },
  { value: 'production_supervisor', label: 'Supervisor de producción', short: 'Supervisor', group: 'Producción', tone: 'indigo', description: 'Ejecuta y autoriza en piso; reporta calidad de línea.' },
  { value: 'operator', label: 'Operador de línea', short: 'Operador', group: 'Producción', tone: 'indigo', description: 'Ejecuta la orden de trabajo publicada y reporta defectos.' },
  { value: 'quality_engineer', label: 'Ingeniero de calidad', short: 'Calidad', group: 'Calidad', tone: 'rose', description: 'Inspección, retención (hold), disposición y CAPA.' },
  { value: 'mrb_member', label: 'Miembro MRB', short: 'MRB', group: 'Calidad', tone: 'rose', description: 'Dispone casos del Material Review Board (sin editar calidad raíz).' },
  { value: 'engineering', label: 'Ingeniería', short: 'Ingeniería', group: 'Ingeniería', tone: 'violet', description: 'NPI, BOM y proceso.' },
  { value: 'industrial_engineer', label: 'Ingeniero industrial', short: 'Ing. industrial', group: 'Ingeniería', tone: 'violet', description: 'Diseña líneas: ruteo, layout de estación y balanceo.' },
  { value: 'cycle_count_analyst', label: 'Analista de conteos', short: 'Conteos', group: 'Materiales', tone: 'cyan', description: 'Concilia varianzas de inventario (backflush vs conteo).' },
  { value: 'maintenance_tech', label: 'Mantenimiento', short: 'Mantenimiento', group: 'Mantenimiento', tone: 'orange', description: 'Atiende andones de máquina y órdenes de mantenimiento.' },
  { value: 'buyer', label: 'Compras', short: 'Compras', group: 'Compras', tone: 'cyan', description: 'Sourcing, órdenes de compra y proveedores.' },
  { value: 'finance', label: 'Finanzas', short: 'Finanzas', group: 'Finanzas', tone: 'emerald', description: 'Costos, P&L y ventas.' },
  { value: 'hr', label: 'Recursos Humanos', short: 'RH', group: 'Personas', tone: 'pink', description: 'Plantilla y reportes de personas.' },
];

const ROLE_META_BY_VALUE = new Map(ROLE_META.map((r) => [r.value, r]));

export function roleMeta(role?: string | null): RoleMeta | undefined {
  return ROLE_META_BY_VALUE.get((role || '').toLowerCase() as AppRole);
}

/** Human label for a stored role string (falls back to the raw value). */
export function roleLabel(role?: string | null): string {
  return roleMeta(role)?.label || role || '—';
}

/** {value,label} pairs for <select> menus (used by the Usuarios page). */
export const ROLE_OPTIONS = ROLE_META.map((r) => ({ value: r.value, label: r.label }));

// ── Resource / action metadata (matrix columns) ──────────────────────────────

export const RESOURCE_META: Record<string, { label: string; tone: keyof typeof TONES; description: string }> = {
  production: { label: 'Producción', tone: 'indigo', description: 'Piso, líneas y ejecución de órdenes de trabajo.' },
  planning: { label: 'Planeación', tone: 'sky', description: 'Plan maestro, MRP y publicación.' },
  materials: { label: 'Materiales', tone: 'teal', description: 'Solicitud, surtido y autorización de material.' },
  inventory: { label: 'Inventario', tone: 'cyan', description: 'Existencias, ajustes y conciliación.' },
  quality: { label: 'Calidad', tone: 'rose', description: 'Inspección, retención, reporte y disposición.' },
  engineering: { label: 'Ingeniería', tone: 'violet', description: 'NPI, BOM, ruteo y proceso.' },
  maintenance: { label: 'Mantenimiento', tone: 'orange', description: 'Activos, andones y órdenes de mantenimiento.' },
  sales: { label: 'Ventas', tone: 'amber', description: 'Pedidos y comercial.' },
  finance: { label: 'Finanzas', tone: 'emerald', description: 'Costos, P&L y facturación.' },
  reports: { label: 'Reportes', tone: 'slate', description: 'Tableros y analítica.' },
  auth: { label: 'Accesos y seguridad', tone: 'purple', description: 'Usuarios, roles y permisos.' },
  settings: { label: 'Configuración', tone: 'gray', description: 'Ajustes de la plataforma.' },
};

export const ACTION_LABELS: Record<string, string> = {
  read: 'Ver',
  write: 'Editar',
  execute: 'Ejecutar',
  authorize: 'Autorizar',
  request: 'Solicitar',
  stage: 'Surtir',
  publish: 'Publicar',
  hold: 'Retener',
  report: 'Reportar',
  disposition: 'Disponer',
  reconcile: 'Conciliar',
};

const RESOURCE_ORDER = [
  'production', 'planning', 'materials', 'inventory', 'quality', 'engineering',
  'maintenance', 'sales', 'finance', 'reports', 'auth', 'settings',
];
const ACTION_ORDER = [
  'read', 'write', 'execute', 'authorize', 'request', 'stage', 'publish',
  'hold', 'report', 'disposition', 'reconcile',
];

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] || action;
}

export interface PermissionGroup {
  resource: string;
  label: string;
  tone: keyof typeof TONES;
  description: string;
  perms: { id: string; action: string; actionLabel: string }[];
}

/** ALL_PERMISSIONS grouped by resource, in a stable display order — matrix cols. */
export const PERMISSION_GROUPS: PermissionGroup[] = (() => {
  const byResource = new Map<string, { id: string; action: string; actionLabel: string }[]>();
  for (const perm of ALL_PERMISSIONS) {
    const [resource, action] = perm.split(':');
    if (!byResource.has(resource)) byResource.set(resource, []);
    byResource.get(resource)!.push({ id: perm, action, actionLabel: actionLabel(action) });
  }
  const orderedResources = [
    ...RESOURCE_ORDER.filter((r) => byResource.has(r)),
    ...Array.from(byResource.keys()).filter((r) => !RESOURCE_ORDER.includes(r)),
  ];
  return orderedResources.map((resource) => {
    const meta = RESOURCE_META[resource] || { label: resource, tone: 'slate' as const, description: '' };
    const perms = byResource.get(resource)!.sort(
      (a, b) => ACTION_ORDER.indexOf(a.action) - ACTION_ORDER.indexOf(b.action),
    );
    return { resource, label: meta.label, tone: meta.tone, description: meta.description, perms };
  });
})();

export const TOTAL_PERMISSIONS = ALL_PERMISSIONS.length;
export const TOTAL_RESOURCES = PERMISSION_GROUPS.length;
