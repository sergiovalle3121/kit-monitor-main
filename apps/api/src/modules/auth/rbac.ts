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
  | 'planner'
  | 'warehouse_operator'
  | 'production_supervisor'
  | 'quality_engineer'
  | 'engineering'
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
  planner: [
    'planning:read',
    'planning:write',
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
    'inventory:read',
    'inventory:write',
    'production:read',
  ],
  production_supervisor: [
    'production:read',
    'production:write',
    'materials:read',
    'materials:request',
    'quality:read',
    'engineering:read',
  ],
  quality_engineer: [
    'quality:read',
    'quality:write',
    'production:read',
    'materials:read',
  ],
  engineering: [
    'engineering:read',
    'engineering:write',
    'production:read',
    'materials:read',
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

export function isAppRole(role?: string | null): role is AppRole {
  return !!role && (APP_ROLES as string[]).includes(role);
}

/** Value stored in User.role. Admin must be exactly 'Admin' for the guard bypass. */
export function roleColumnFor(role: AppRole): string {
  return role === 'admin' ? 'Admin' : role;
}

export function permissionsFor(role: AppRole): string[] {
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
