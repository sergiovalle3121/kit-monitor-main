import type { ReactNode } from 'react';
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
  right,
  className = '',
}: {
  domain: DomainKey;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Contenido a la derecha (acciones, estado en vivo, enlaces rápidos). */
  right?: ReactNode;
  className?: string;
}) {
  return (
    // Responsive: en móvil apila el título y las acciones (las acciones envuelven)
    // para que NUNCA se salgan del viewport; en sm+ vuelve a una sola fila con las
    // acciones a la derecha. Es un primitivo compartido → arregla el overflow de
    // encabezados en muchas páginas a la vez.
    <header className={`mb-8 flex flex-col gap-4 sm:flex-row sm:items-center ${className}`}>
      <div className="flex min-w-0 items-center gap-4">
        <IconTile domain={domain} size={52} icon={icon} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
          )}
        </div>
      </div>
      {right && (
        <div className="flex flex-wrap items-center gap-3 sm:ml-auto sm:shrink-0">
          {right}
        </div>
      )}
    </header>
  );
}
