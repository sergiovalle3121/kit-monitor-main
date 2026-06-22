'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { glass } from '@/lib/glass';
import { IconTile } from '@/components/ui/IconTile';
import { ICON_STROKE, type DomainKey } from '@/lib/design/domains';

export interface StatCardProps {
  /** Etiqueta corta en mayúsculas (p.ej. "Contratos activos"). */
  label: string;
  /** Valor principal: número o cadena ya formateada (moneda, %, etc.). */
  value: ReactNode;
  /** Texto secundario debajo del valor (contexto: "3 en 30d"). */
  sublabel?: ReactNode;
  /** Color de acento del valor (hex / color CSS). Por defecto hereda el texto. */
  color?: string;
  /** Ícono lucide arriba a la derecha. */
  icon?: LucideIcon;
  /** Si se pasa, el ícono usa la loseta de marca del dominio (IconTile). */
  domain?: DomainKey;
  /** Convierte toda la tarjeta en un enlace. */
  href?: string;
  className?: string;
}

/**
 * Tarjeta de KPI única para todo el "Workspace Industrial": reemplaza las
 * tarjetas hechas a mano que el hub y las páginas repetían. Mantiene el lenguaje
 * visual (glass, loseta de dominio, tipografía tabular) en un solo lugar.
 */
export function StatCard({
  label,
  value,
  sublabel,
  color,
  icon: Icon,
  domain,
  href,
  className = '',
}: StatCardProps) {
  const body = (
    <div className={`${glass} group h-full rounded-2xl p-4 ${href ? 'transition-transform hover:-translate-y-0.5' : ''} ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {label}
        </div>
        {Icon ? (
          domain ? (
            <IconTile domain={domain} size={34} icon={Icon} />
          ) : (
            <span
              aria-hidden
              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl"
              style={{ background: color ? `${color}1f` : 'rgba(99,102,241,0.12)', color: color ?? '#6366f1' }}
            >
              <Icon className="h-4 w-4" strokeWidth={ICON_STROKE} />
            </span>
          )
        ) : null}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </div>
      {sublabel != null && (
        <div className="mt-0.5 text-[12px] text-gray-400">{sublabel}</div>
      )}
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
