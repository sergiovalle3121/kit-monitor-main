'use client';

import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { isOwnerEmail } from '@/lib/owner';

/**
 * ¿Esta entrada de permiso concede ESCRITURA? Acepta comodines ('*', '*:*'),
 * cualquier ':write' y cualquier ':*' (p. ej. 'office:*'). Los permisos de solo
 * lectura ('*:read', 'x:read') nunca conceden escritura.
 */
function isWritePermission(p: string): boolean {
  const perm = (p || '').trim().toLowerCase();
  if (!perm) return false;
  return (
    perm === '*' ||
    perm === '*:*' ||
    perm.endsWith(':*') ||
    perm.endsWith(':write')
  );
}

/**
 * Cálculo puro de «puede escribir» a partir de los datos de auth. Extraído como
 * función para poder razonarlo/probarlo sin React.
 *
 * WRITE se concede si CUALQUIERA:
 *  - es admin (rol 'Admin'/'admin' case-insensitive — vía AuthContext.isAdmin), o
 *  - es el owner del proyecto (por email, isOwnerEmail), o
 *  - tiene un permiso comodín/escritura ('*', '*:*', ':*' o ':write').
 *
 * Un viewer/executive con solo '*:read' (o 'x:read') queda en SOLO LECTURA.
 */
export function computeCanWrite(opts: {
  isAdmin: boolean;
  permissions: string[];
  email?: string | null;
}): boolean {
  if (opts.isAdmin) return true;
  if (isOwnerEmail(opts.email)) return true;
  return (opts.permissions ?? []).some(isWritePermission);
}

export interface PermissionFlags {
  /** Admin por rol (case-insensitive) u owner del proyecto por email. */
  isAdmin: boolean;
  /** Puede editar/crear/borrar (admin, owner o permiso de escritura/comodín). */
  canWrite: boolean;
}

/**
 * Fuente única de verdad para los gates de escritura de la UI.
 *
 * Reemplaza las copias dispersas de
 *   `roles.includes('Admin') || permissions.some((p) => p.endsWith(':write'))`
 * que dejaban al Master/owner en SOLO LECTURA cuando (a) el rol llegaba en
 * minúscula ('admin', así `includes('Admin')` fallaba) o (b) el rol admin
 * llegaba con permisos VACÍOS (RBAC `ROLE_PERMISSIONS.admin = []`), con lo que
 * ambas ramas fallaban a la vez. Aquí derivamos el admin de forma robusta
 * (case-insensitive vía contexto + owner por email) para que el dueño nunca
 * quede bloqueado, sin abrir escritura a viewer/executive (solo `*:read`).
 */
export function usePermissions(): PermissionFlags {
  const { isAdmin, permissions, user } = useAuth();
  const email = user?.email ?? null;

  return useMemo<PermissionFlags>(
    () => ({
      isAdmin: isAdmin || isOwnerEmail(email),
      canWrite: computeCanWrite({ isAdmin, permissions, email }),
    }),
    [isAdmin, permissions, email],
  );
}
