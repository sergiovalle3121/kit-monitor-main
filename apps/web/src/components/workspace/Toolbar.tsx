'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import type { DomainKey } from '@/lib/design/domains';

/**
 * Cabecera de herramienta del Workspace Industrial: título + subtítulo (vía
 * PageHeader, para que cada página conserve el color/loseta de su dominio),
 * acciones primarias a la derecha (p.ej. "Nuevo") y un slot inferior para la
 * barra de controles (FilterBar / búsqueda / Export).
 */
export function Toolbar({
  domain,
  title,
  subtitle,
  icon,
  actions,
  right,
  children,
  className = '',
}: {
  domain: DomainKey;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Acciones primarias a la derecha del encabezado (p.ej. botón "Nuevo"). */
  actions?: ReactNode;
  /** Contenido extra a la derecha del encabezado (estado en vivo, enlaces). */
  right?: ReactNode;
  /** Barra de controles bajo el título (FilterBar, búsqueda, Export). */
  children?: ReactNode;
  className?: string;
}) {
  const headerRight = right || actions ? (
    <>
      {right}
      {actions}
    </>
  ) : undefined;

  return (
    <div className={className}>
      <PageHeader
        domain={domain}
        title={title}
        subtitle={subtitle}
        icon={icon}
        right={headerRight}
        className={children ? '!mb-4' : ''}
      />
      {children && (
        <div className="mb-6 flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  );
}
