'use client';

import { X } from 'lucide-react';
import clsx from 'clsx';

export interface DateRange {
  from?: string;
  to?: string;
}

/** Valor de un filtro: texto/select (string), pills (string[]) o rango de fechas. */
export type FilterValue = string | string[] | DateRange | undefined;
export type FilterValues = Record<string, FilterValue>;

export type FilterDef =
  | { key: string; type: 'text'; label: string; placeholder?: string }
  | { key: string; type: 'select'; label: string; options: { value: string; label: string }[] }
  | { key: string; type: 'daterange'; label: string }
  | { key: string; type: 'pill'; label: string; options: { value: string; label: string; color?: string }[] };

const CTRL =
  'h-9 rounded-xl border border-black/10 bg-black/[0.03] px-3 text-sm text-black outline-none transition-colors focus:border-indigo-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-white';

function hasValue(v: FilterValue): boolean {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return Boolean(v.from || v.to);
}

/**
 * Barra de filtros tipados, totalmente controlada: recibe los `defs`, el objeto
 * de `value` y un `onChange`. No conoce ningún módulo en concreto — la página
 * decide cómo aplicar los filtros a sus datos.
 */
export function FilterBar({
  defs,
  value,
  onChange,
  className = '',
}: {
  defs: FilterDef[];
  value: FilterValues;
  onChange: (next: FilterValues) => void;
  className?: string;
}) {
  const set = (key: string, v: FilterValue) => onChange({ ...value, [key]: v });
  const anyActive = defs.some((d) => hasValue(value[d.key]));

  return (
    <div className={clsx('flex flex-wrap items-center gap-2', className)}>
      {defs.map((def) => {
        if (def.type === 'text') {
          const v = (value[def.key] as string) ?? '';
          return (
            <input
              key={def.key}
              value={v}
              onChange={(e) => set(def.key, e.target.value)}
              placeholder={def.placeholder ?? def.label}
              aria-label={def.label}
              className={clsx(CTRL, 'w-44')}
            />
          );
        }

        if (def.type === 'select') {
          const v = (value[def.key] as string) ?? '';
          return (
            <select
              key={def.key}
              value={v}
              onChange={(e) => set(def.key, e.target.value || undefined)}
              aria-label={def.label}
              className={clsx(CTRL, 'pr-8')}
            >
              <option value="">{def.label}: todos</option>
              {def.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          );
        }

        if (def.type === 'daterange') {
          const v = (value[def.key] as DateRange) ?? {};
          return (
            <div key={def.key} className="flex items-center gap-1.5">
              <span className="text-[12px] text-gray-500 dark:text-gray-400">{def.label}</span>
              <input
                type="date"
                value={v.from ?? ''}
                onChange={(e) => set(def.key, { ...v, from: e.target.value || undefined })}
                aria-label={`${def.label} desde`}
                className={clsx(CTRL, 'w-[9.5rem]')}
              />
              <span className="text-gray-500 dark:text-gray-400">–</span>
              <input
                type="date"
                value={v.to ?? ''}
                onChange={(e) => set(def.key, { ...v, to: e.target.value || undefined })}
                aria-label={`${def.label} hasta`}
                className={clsx(CTRL, 'w-[9.5rem]')}
              />
            </div>
          );
        }

        // pill (multi-select)
        const selected = (value[def.key] as string[]) ?? [];
        const toggle = (val: string) =>
          set(
            def.key,
            selected.includes(val) ? selected.filter((s) => s !== val) : [...selected, val],
          );
        return (
          <div key={def.key} className="flex flex-wrap items-center gap-1">
            {def.options.map((o) => {
              const on = selected.includes(o.value);
              const color = o.color ?? '#6366f1';
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggle(o.value)}
                  aria-pressed={on}
                  className={clsx(
                    'h-9 rounded-xl px-3 text-[13px] font-medium transition-colors',
                    !on && 'text-gray-500 hover:bg-black/5 dark:text-gray-400 dark:hover:bg-white/10',
                  )}
                  style={on ? { background: `${color}22`, color } : undefined}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        );
      })}

      {anyActive && (
        <button
          type="button"
          onClick={() => onChange({})}
          className="inline-flex h-9 items-center gap-1 rounded-xl px-2.5 text-[13px] text-gray-500 transition-colors hover:bg-black/5 dark:text-gray-400 dark:hover:bg-white/10"
        >
          <X className="h-3.5 w-3.5" /> Limpiar
        </button>
      )}
    </div>
  );
}
