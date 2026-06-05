import { Role } from '@/config/domains';
import { DOMAINS } from '@/config/domains';

export function useVisibleDomains(role: Role) {
  if (role === 'admin') {
    return DOMAINS;
  }
  
  return DOMAINS.filter(domain => domain.roles.includes(role));
}
