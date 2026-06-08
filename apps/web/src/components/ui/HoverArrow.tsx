import { ArrowUpRight } from 'lucide-react';
import { ICON_STROKE } from '@/lib/design/domains';

/**
 * Flecha estándar del sistema: `ArrowUpRight` que aparece al hacer hover sobre
 * el contenedor (debe tener la clase `group`). Un solo estilo de flecha en toda
 * la app — no mezclar chevrons/símbolos distintos para "ir a".
 */
export function HoverArrow({ className = '' }: { className?: string }) {
  return (
    <ArrowUpRight
      strokeWidth={ICON_STROKE}
      className={`h-4 w-4 text-gray-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100 ${className}`}
    />
  );
}
