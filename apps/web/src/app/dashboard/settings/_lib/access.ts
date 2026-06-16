/**
 * Who is "untouchable" in the Usuarios admin UI.
 *
 * The platform seeds super-admins that must never be demoted or deactivated from
 * the UI (it would lock the boss out / brick access):
 *   - The product OWNER, derived from EMAIL via `@/lib/owner` (mirror of the
 *     backend `ownerEmails`). The owner is ALWAYS Admin regardless of stored role.
 *   - The seeded "Master admin" (`MASTER_ADMIN_EMAIL` on the backend). That env
 *     isn't exposed to the browser, so we also accept an optional
 *     `NEXT_PUBLIC_MASTER_ADMIN_EMAIL`, plus a name/username/email == "master"
 *     heuristic as a safety net.
 *   - YOURSELF — an admin should not be able to demote or deactivate the account
 *     they're currently signed in with (classic self-lockout footgun).
 *
 * This is UI-only defense-in-depth; the backend remains the real authority.
 */
import { isOwnerEmail } from '@/lib/owner';

export interface ProtectableUser {
  email?: string;
  username?: string | null;
  name?: string | null;
}

export type ProtectionReason = 'owner' | 'master' | 'self';

export interface Protection {
  /** True when the row must not be degraded/deactivated/deleted from the UI. */
  locked: boolean;
  reason: ProtectionReason | null;
  /** Short badge label, e.g. "Dueño · Master". */
  label: string;
  /** Tooltip explaining why the controls are disabled. */
  note: string;
}

function masterAdminEmails(): string[] {
  return (process.env.NEXT_PUBLIC_MASTER_ADMIN_EMAIL || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function looksLikeMaster(u: ProtectableUser): boolean {
  const email = (u.email || '').trim().toLowerCase();
  if (email && masterAdminEmails().includes(email)) return true;
  const local = email.split('@')[0];
  const name = (u.name || '').trim().toLowerCase();
  const username = (u.username || '').trim().toLowerCase();
  return name === 'master' || username === 'master' || local === 'master';
}

/**
 * Resolve the protection state for a user row. `currentEmail` is the signed-in
 * admin's email (from AuthContext) so we can guard self-lockout.
 */
export function protectionFor(u: ProtectableUser, currentEmail?: string | null): Protection {
  const email = (u.email || '').trim().toLowerCase();

  if (isOwnerEmail(email)) {
    return {
      locked: true,
      reason: 'owner',
      label: 'Dueño · Master',
      note: 'Cuenta dueña de la plataforma. Siempre es Admin y no puede degradarse, desactivarse ni eliminarse desde la UI.',
    };
  }
  if (looksLikeMaster(u)) {
    return {
      locked: true,
      reason: 'master',
      label: 'Master admin',
      note: 'Cuenta Master sembrada por el sistema. Protegida: no puede degradarse, desactivarse ni eliminarse desde la UI.',
    };
  }
  if (email && currentEmail && email === currentEmail.trim().toLowerCase()) {
    return {
      locked: true,
      reason: 'self',
      label: 'Tu cuenta',
      note: 'Es la cuenta con la que iniciaste sesión. Para evitar bloquearte a ti mismo, no puedes cambiar tu propio rol ni desactivarte aquí.',
    };
  }
  return { locked: false, reason: null, label: '', note: '' };
}

export function isProtectedUser(u: ProtectableUser, currentEmail?: string | null): boolean {
  return protectionFor(u, currentEmail).locked;
}
