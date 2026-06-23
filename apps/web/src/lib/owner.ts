/**
 * Espejo en el frontend de `apps/api/src/modules/auth/rbac.ts` (ownerEmails /
 * isOwnerEmail). El dueño SIEMPRE es admin y lo derivamos del EMAIL, no del rol
 * almacenado: así un JWT viejo, un reseed o una migración no pueden dejar al
 * owner en "solo lectura". Estos built-in siempre se respetan; el env
 * NEXT_PUBLIC_OWNER_EMAILS (coma-separado) solo AGREGA más owners, nunca los
 * reemplaza, para que un owner no pueda quedar fuera por accidente.
 */
const DEFAULT_OWNER_EMAILS = [
  'sergiovallezarate@gmail.com',
  'imagenpaovalle@gmail.com',
];

export function ownerEmails(): string[] {
  const fromEnv = (process.env.NEXT_PUBLIC_OWNER_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...DEFAULT_OWNER_EMAILS, ...fromEnv]));
}

export function isOwnerEmail(email?: string | null): boolean {
  return !!email && ownerEmails().includes(email.trim().toLowerCase());
}

/** ¿Es admin para efectos de UI? Admin (case-insensitive) u owner (por email). */
export function isAdminAccess(role?: string | null, email?: string | null): boolean {
  return (role || '').toLowerCase() === 'admin' || isOwnerEmail(email);
}

/**
 * ¿Ve TODAS las áreas del hub? Admin (case-insensitive), dirección u owner.
 * Centralizado para que el gate del hub sea trivialmente correcto y resistente
 * a desajustes de casing del rol.
 */
export function seesAllAreas(role?: string | null, email?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return r === 'admin' || r === 'executive' || isOwnerEmail(email);
}
