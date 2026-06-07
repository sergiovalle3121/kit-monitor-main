/**
 * Tokens de color del sistema "vivo y cristalino" de Axos.
 *
 * - `brand`: un acento de marca índigo/violeta. No satura el contenido; vive en
 *   el fondo ambiental, los focos de teclado, los halos de las superficies glass
 *   y los detalles. El minimalismo se mantiene.
 * - `domainColors`: un color por dominio funcional, ALINEADO con las áreas del hub
 *   (mismo criterio de color que `AREAS`). Se mapea aparte a propósito: no toca
 *   domains.ts, ni la lógica de RBAC, ni las rutas — sólo provee tokens de UI
 *   reutilizables para no repetir literales de color por toda la app.
 *
 * Todo en HEX + clases Tailwind para que cualquier vista consuma el mismo color.
 */

export const brand = {
  accent: '#6366f1', // indigo-500 — acento de marca
  accentStrong: '#4f46e5', // indigo-600
  accentSoft: '#a5b4fc', // indigo-300
  violet: '#7c3aed', // violet-600
  /** Halo/sombra difusa tintada con el acento (nunca negro duro). */
  glow: 'rgba(99, 102, 241, 0.18)',
} as const;

export type DomainKey =
  | 'planning'
  | 'warehouse'
  | 'inventory'
  | 'production'
  | 'operator'
  | 'quality'
  | 'engineering'
  | 'finance'
  | 'control'
  | 'erp'
  | 'office';

export interface DomainColor {
  /** Color base del dominio (para números, iconos, acentos puntuales). */
  hex: string;
  /** Clase de texto Tailwind. */
  text: string;
  /** Clase de fondo suave (claro/oscuro). */
  tint: string;
  /** Clase de ring para foco/selección. */
  ring: string;
}

export const domainColors: Record<DomainKey, DomainColor> = {
  planning: { hex: '#8b5cf6', text: 'text-violet-500', tint: 'bg-violet-50 dark:bg-violet-500/10', ring: 'ring-violet-400/40' },
  warehouse: { hex: '#3b82f6', text: 'text-blue-500', tint: 'bg-blue-50 dark:bg-blue-500/10', ring: 'ring-blue-400/40' },
  inventory: { hex: '#0ea5e9', text: 'text-sky-500', tint: 'bg-sky-50 dark:bg-sky-500/10', ring: 'ring-sky-400/40' },
  production: { hex: '#f59e0b', text: 'text-amber-500', tint: 'bg-amber-50 dark:bg-amber-500/10', ring: 'ring-amber-400/40' },
  operator: { hex: '#f97316', text: 'text-orange-500', tint: 'bg-orange-50 dark:bg-orange-500/10', ring: 'ring-orange-400/40' },
  quality: { hex: '#10b981', text: 'text-emerald-500', tint: 'bg-emerald-50 dark:bg-emerald-500/10', ring: 'ring-emerald-400/40' },
  engineering: { hex: '#6366f1', text: 'text-indigo-500', tint: 'bg-indigo-50 dark:bg-indigo-500/10', ring: 'ring-indigo-400/40' },
  finance: { hex: '#22c55e', text: 'text-green-500', tint: 'bg-green-50 dark:bg-green-500/10', ring: 'ring-green-400/40' },
  control: { hex: '#06b6d4', text: 'text-cyan-500', tint: 'bg-cyan-50 dark:bg-cyan-500/10', ring: 'ring-cyan-400/40' },
  erp: { hex: '#8b5cf6', text: 'text-violet-500', tint: 'bg-violet-50 dark:bg-violet-500/10', ring: 'ring-violet-400/40' },
  office: { hex: '#6b7280', text: 'text-gray-500', tint: 'bg-gray-100 dark:bg-white/10', ring: 'ring-gray-400/40' },
};

/** Color de dominio con fallback seguro al acento de marca. */
export function domainColor(key: DomainKey | string | undefined): DomainColor {
  return (key && (domainColors as Record<string, DomainColor>)[key]) || {
    hex: brand.accent,
    text: 'text-indigo-500',
    tint: 'bg-indigo-50 dark:bg-indigo-500/10',
    ring: 'ring-indigo-400/40',
  };
}
