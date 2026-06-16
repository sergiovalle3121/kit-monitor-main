/**
 * Server-side RBAC matrix.
 *
 * Roles mirror the frontend job catalog (src/config/positions.ts). Permissions
 * use the same `resource:action` strings that the controllers already enforce
 * via @RequirePermissions + PermissionsGuard. The `admin` role maps to the
 * literal 'Admin' the guard bypasses on.
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

export const ROLE_PERMISSIONS: Record<AppRole, string[]> = {
  admin: [], // role 'Admin' bypasses the guard; explicit perms not needed
  executive: READ_ALL,
  // Plant manager / ops manager — broad read + the operational authorizations
  // needed to run a plant (publish plans, authorize WOs, dispositions).
  plant_manager: [
    ...READ_ALL,
    'planning:write',
    'planning:publish',
    'production:write',
    'production:authorize',
    'production:report',
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
    'production:report',
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
  // Materialist / line-feeder: stages kits to stations & raises replenishment.
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
    'production:report',
    'materials:read',
    'materials:request',
    'quality:read',
    'quality:report',
    'engineering:read',
  ],
  // Line operator: executes the published WO at their station, reports defects.
  operator: [
    'production:read',
    'production:execute',
    'production:report',
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
    'production:report',
    'materials:read',
  ],
  // MRB member: dispositions material-review-board cases (no edit of root quality).
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
  // Industrial engineer: lays out lines (routing, station layout, balance).
  industrial_engineer: [
    'engineering:read',
    'engineering:write',
    'production:read',
    'materials:read',
  ],
  // Cycle-count analyst: reconciles inventory variances from backflush vs count.
  cycle_count_analyst: [
    'inventory:read',
    'inventory:reconcile',
    'reports:read',
  ],
  // Maintenance technician: works machine andons / maintenance orders.
  maintenance_tech: [
    'maintenance:read',
    'maintenance:write',
    'production:read',
  ],
  buyer: [
    'materials:read',
    'materials:write',
    'finance:read',
    'inventory:read',
  ],
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
 * Every distinct permission the platform knows about. Built from the union of all
 * role grants plus the admin-only resources (auth / settings). The `admin` role
 * resolves to THIS full set so its JWT carries every permission — the backend
 * guard bypasses Admin anyway, but the FRONTEND gates the UI on the permissions
 * array, so without this the owner/Admin would be locked out of gated actions.
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
  return !!role && (APP_ROLES as string[]).includes(role);
}

/** Value stored in User.role. Admin must be exactly 'Admin' for the guard bypass. */
export function roleColumnFor(role: AppRole): string {
  return role === 'admin' ? 'Admin' : role;
}

export function permissionsFor(role: AppRole): string[] {
  // Admin/owner gets the full permission set (carried in the JWT) so the frontend
  // never gates them out. Backend authorization additionally bypasses on 'Admin'.
  if (role === 'admin') return [...ALL_PERMISSIONS];
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * App owner email(s) that should always be full Admin. Configurable via the
 * OWNER_EMAILS env var (comma-separated); falls back to the project owner so
 * the owner account is never locked into read-only by accident.
 */
export function ownerEmails(): string[] {
  const fromEnv = (process.env.OWNER_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : ['sergiovallezarate@gmail.com'];
}

export function isOwnerEmail(email?: string | null): boolean {
  return !!email && ownerEmails().includes(email.trim().toLowerCase());
}
