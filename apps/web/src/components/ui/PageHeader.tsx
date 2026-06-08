import type { LucideIcon } from 'lucide-react';
import { IconTile } from '@/components/ui/IconTile';
import type { DomainKey } from '@/lib/design/domains';

/**
 * Encabezado de página por dominio: la misma loseta (IconTile) con el color de
 * firma del departamento + título, para que cada página de área se sienta parte
 * del mismo sistema que el hub (no "blanca y plana"). El ícono por defecto es el
 * del dominio; se puede sobreescribir con otro de lucide.
 */
export function PageHeader({
  domain,
  title,
  subtitle,
  icon,
  className = '',
}: {
  domain: DomainKey;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <header className={`mb-8 flex items-center gap-4 ${className}`}>
      <IconTile domain={domain} size={52} icon={icon} />
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        )}
      </div>
    </header>
  );
}
