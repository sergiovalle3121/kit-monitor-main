import type { LucideIcon } from 'lucide-react';
import { DOMAINS, domainTile, ICON_STROKE, type DomainKey } from '@/lib/design/domains';

/**
 * Loseta de ícono estilo Apple: squircle con gradiente del dominio, sombra de
 * color suave y brillo interior; ícono blanco con grosor único. Es el corazón
 * del lenguaje visual — NUNCA pintar íconos sobre gris plano otra vez.
 *
 * Tamaños de referencia: 34 (notificación), 46 (KPI), 52 (área destacada).
 */
export function IconTile({
  domain,
  size = 46,
  icon,
  className = '',
}: {
  domain: DomainKey;
  size?: number;
  /** Override del ícono (misma familia lucide); por defecto el del dominio. */
  icon?: LucideIcon;
  className?: string;
}) {
  const Icon = icon ?? DOMAINS[domain].icon;
  const radius = Math.round(size * 0.32); // proporción Apple ~30%
  const iconSize = Math.round(size * 0.5);
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size, borderRadius: radius, ...domainTile(domain) }}
    >
      <Icon
        style={{ width: iconSize, height: iconSize }}
        strokeWidth={ICON_STROKE}
        className="text-white"
      />
    </span>
  );
}
