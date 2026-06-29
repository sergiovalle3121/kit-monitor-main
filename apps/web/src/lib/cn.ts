import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * `cn(...)` — une clases condicionales (clsx) y resuelve conflictos de Tailwind
 * (tailwind-merge), de modo que una clase pasada por props gana siempre a la
 * base del componente (`cn('px-4', className)` ⇒ un `px-6` externo manda).
 *
 * Es el helper estándar de los primitivos de `components/ui`. Ambas dependencias
 * (`clsx`, `tailwind-merge`) ya estaban en el árbol; aquí sólo se centraliza el
 * patrón para no repetirlo en cada componente.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
