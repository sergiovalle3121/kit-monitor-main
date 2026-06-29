'use client';

import type { LucideIcon } from 'lucide-react';
import { Check } from 'lucide-react';
import { glass } from '@/lib/glass';
import { ICON_STROKE } from '@/lib/design/domains';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
}

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  /** Qué hace este módulo / por qué importa (1–2 frases). */
  description: string;
  /** Acción principal (p.ej. "Nuevo contrato"). */
  primaryAction?: EmptyStateAction;
  /** Acción secundaria opcional (p.ej. "Cargar ejemplo"). */
  secondaryAction?: EmptyStateAction;
  /** 2–3 viñetas de para-qué-sirve, para que NO se sienta hueco. */
  hint?: string[];
  /** Color de acento (hex). Por defecto índigo de marca. */
  accent?: string;
  className?: string;
}

/**
 * Estado vacío que INVITA en vez de vaciar: ícono, una explicación de para qué
 * sirve el módulo, una acción primaria clara y viñetas de valor. Reemplaza todos
 * los "Sin X registrados" planos por una primera pantalla con intención.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  hint,
  accent = '#6366f1',
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`${glass} rounded-3xl p-10 text-center md:p-12 ${className}`}>
      <span
        aria-hidden
        className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl"
        style={{ background: `${accent}14`, color: accent }}
      >
        <Icon className="h-7 w-7" strokeWidth={ICON_STROKE} />
      </span>

      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground dark:text-muted-foreground">{description}</p>

      {hint && hint.length > 0 && (
        <ul className="mx-auto mt-5 max-w-sm space-y-1.5 text-left">
          {hint.map((h) => (
            <li key={h} className="flex items-start gap-2 text-[13px] text-muted-foreground dark:text-muted-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} strokeWidth={2.25} />
              <span>{h}</span>
            </li>
          ))}
        </ul>
      )}

      {(primaryAction || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
              style={{ background: accent }}
            >
              {primaryAction.icon && <primaryAction.icon className="h-4 w-4" />}
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10"
            >
              {secondaryAction.icon && <secondaryAction.icon className="h-4 w-4" />}
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
