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
  const byRole = role === 'admin' ? DOMAINS : DOMAINS.filter((d) => d.roles.includes(role));
  return byRole.filter((d) => IMPLEMENTED.has(d.id));
}
