import { Role, DOMAINS } from '@/config/domains';

/**
 * Domains that have a real, working page today. Anything not listed here is
 * hidden from the grid until it's built — the app only surfaces what works.
 * Add an id here when its /dashboard/<id> route ships.
 */
const IMPLEMENTED = new Set<string>([
  'mission-control',
  'planning',
  'inventory',
  'engineering',
  'production',
  'quality',
  'finance',
]);

export function useVisibleDomains(role: Role) {
  // admin and executive see every implemented area; everyone else only theirs.
  const seesAll = role === 'admin' || role === 'executive';
  const byRole = seesAll ? DOMAINS : DOMAINS.filter((d) => d.roles.includes(role));
  return byRole.filter((d) => IMPLEMENTED.has(d.id));
}
