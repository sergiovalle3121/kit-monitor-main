"use client";

import { useMemo, useState } from "react";
import { Search, Check } from "lucide-react";
import { glass } from "@/lib/glass";

export interface PickerItem {
  value: string;
  label: string;
  sub?: string;
}

/**
 * Selector buscable (sólo pantalla — `.axos-no-print`). Filtra una lista ya
 * cargada por el cliente; al elegir, fija el valor. Sin dependencias externas
 * para no inflar el carril. Se usa para escoger WO / embarque a documentar.
 */
export function Picker({
  items,
  value,
  onChange,
  placeholder = "Buscar…",
  emptyText = "Sin coincidencias.",
  maxVisible = 8,
}: {
  items: PickerItem[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  maxVisible?: number;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (it) =>
        it.label.toLowerCase().includes(needle) ||
        (it.sub ?? "").toLowerCase().includes(needle) ||
        it.value.toLowerCase().includes(needle),
    );
  }, [items, q]);

  return (
    <div className="axos-no-print">
      <div className={`${glass} mb-2 flex items-center gap-2 rounded-xl px-3 py-2`}>
        <Search className="h-4 w-4 shrink-0 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>
      <div
        className={`${glass} divide-y divide-black/5 overflow-y-auto rounded-xl dark:divide-white/5`}
        style={{ maxHeight: `${maxVisible * 3.25}rem` }}
      >
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-center text-[13px] text-gray-400">{emptyText}</div>
        ) : (
          filtered.map((it) => {
            const active = it.value === value;
            return (
              <button
                key={it.value}
                onClick={() => onChange(it.value)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-black/5 dark:hover:bg-white/5 ${
                  active ? "bg-black/5 dark:bg-white/10" : ""
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">{it.label}</span>
                  {it.sub && <span className="block truncate text-[11px] text-gray-400">{it.sub}</span>}
                </span>
                {active && <Check className="h-4 w-4 shrink-0 text-emerald-500" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
