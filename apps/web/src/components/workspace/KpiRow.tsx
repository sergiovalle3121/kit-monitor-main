'use client';

import clsx from 'clsx';
import { StatCard, type StatCardProps } from './StatCard';

const COLS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-4',
  5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
};

/**
 * Fila de KPIs: extrae a un solo lugar el patrón de tarjetas de métrica que el
 * hub y las páginas repetían a mano. Recibe los datos y los pinta con StatCard.
 */
export function KpiRow({
  items,
  columns = 4,
  className = '',
}: {
  items: StatCardProps[];
  /** Número de columnas en pantalla ancha (2–6). */
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}) {
  return (
    <div className={clsx('grid gap-3', COLS[columns] ?? COLS[4], className)}>
      {items.map((it) => (
        <StatCard key={it.label} {...it} />
      ))}
    </div>
  );
}
