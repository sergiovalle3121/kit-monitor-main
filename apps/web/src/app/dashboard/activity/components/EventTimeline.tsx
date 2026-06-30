'use client';

import React, { useMemo } from 'react';
import { EventCard } from './EventCard';
import { type LedgerEvent, dayKey, formatDayLabel } from './types';

/**
 * Renderiza una lista de eventos como timeline agrupado por día (más reciente
 * primero), con un encabezado por día y un riel vertical que hila los eventos.
 * No hace fetch ni filtra: recibe los eventos ya resueltos, así sirve igual al
 * feed global y al historial por entidad.
 */
export function EventTimeline({
  events,
  showReference = true,
  onPickReference,
}: {
  events: LedgerEvent[];
  showReference?: boolean;
  onPickReference?: (referenceType: string, referenceId: string) => void;
}) {
  const groups = useMemo(() => groupByDay(events), [events]);

  return (
    <div className="space-y-7">
      {groups.map((group) => (
        <section key={group.key}>
          <div className="sticky top-2 z-10 mb-3 flex items-center gap-2">
            <span className="text-[11px] font-semibold tracking-wide text-gray-500 first-letter:uppercase">
              {group.label}
            </span>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              · {group.events.length} evento{group.events.length === 1 ? '' : 's'}
            </span>
            <span className="h-px flex-1 bg-black/5 dark:bg-white/10" />
          </div>

          {/* Riel vertical: el borde izquierdo hila los nodos del día. */}
          <div className="relative space-y-3 pl-4 before:content-[''] before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-px before:bg-black/5 dark:before:bg-white/10">
            {group.events.map((e) => (
              <div key={e.id} className="relative">
                <span className="absolute -left-4 top-4 h-2.5 w-2.5 rounded-full bg-white dark:bg-gray-900 ring-2 ring-black/10 dark:ring-white/15" />
                <EventCard event={e} showReference={showReference} onPickReference={onPickReference} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

interface DayGroup {
  key: string;
  label: string;
  events: LedgerEvent[];
}

function groupByDay(events: LedgerEvent[]): DayGroup[] {
  // Orden global descendente por timestamp; luego se agrupa preservando el orden.
  const sorted = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  const map = new Map<string, DayGroup>();
  for (const e of sorted) {
    const key = dayKey(e.timestamp);
    let group = map.get(key);
    if (!group) {
      group = { key, label: formatDayLabel(e.timestamp), events: [] };
      map.set(key, group);
    }
    group.events.push(e);
  }
  return [...map.values()];
}
