'use client';

import React, { useMemo, useState } from 'react';
import {
  Loader2,
  Lock,
  Search,
  Inbox,
  History,
  User,
  Clock,
  ServerCog,
  RefreshCw,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { EventTimeline } from './EventTimeline';
import { type LedgerEvent, formatDateTime } from './types';

const ACCENT = '#7c5cff';

/** Tipos de entidad sugeridos (espejo de los nombres canónicos del backend). */
const SUGGESTED_TYPES = ['WORK_ORDER', 'NCR', 'SERIAL', 'KIT', 'SHIPMENT', 'SUPPLIER', 'PLAN', 'BOM_ITEM'];

export interface EntityQuery {
  type: string;
  id: string;
}

/** Resuelve la ruta del backend para una consulta de entidad (o null si falta id). */
function pathFor(q: EntityQuery | null): string | null {
  if (!q || !q.id.trim()) return null;
  const id = encodeURIComponent(q.id.trim());
  // Las WO se etiquetan en context.workOrder → endpoint dedicado del backend.
  if (q.type.toUpperCase() === 'WORK_ORDER') return `/ledger/work-order/${id}`;
  const type = encodeURIComponent(q.type.trim().toUpperCase());
  return `/ledger/reference/${type}/${id}`;
}

/**
 * Historial por entidad: "¿qué le pasó a esta WO / serial / NCR?". Corre contra
 * los endpoints reales del Event Ledger (reference/:tipo/:id y work-order/:wo),
 * así que funciona hoy. Es la mitad del visor que hace la app sentirse auditable:
 * dado cualquier objeto del piso, su línea de vida completa e inmutable.
 *
 * Es controlado por la página (props query/onQuery) para que el timeline global
 * pueda saltar directo al historial de la entidad de un evento.
 */
export function EntityHistoryView({
  query,
  onQuery,
}: {
  query: EntityQuery | null;
  onQuery: (q: EntityQuery | null) => void;
}) {
  const [type, setType] = useState(query?.type ?? 'WORK_ORDER');
  const [id, setId] = useState(query?.id ?? '');

  // Cuando llega una consulta externa (clic en una referencia del timeline),
  // sembramos los campos del formulario para que reflejen lo que se está viendo.
  // Patrón recomendado por React: ajustar estado durante el render comparando
  // contra la consulta previa, en vez de un efecto que dispara renders en cascada.
  const [syncedQuery, setSyncedQuery] = useState(query);
  if (query && query !== syncedQuery) {
    setSyncedQuery(query);
    setType(query.type);
    setId(query.id);
  }

  const path = pathFor(query);
  const { data, isLoading, forbidden, error, mutate } = useApi<LedgerEvent[]>(path);
  const events = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  function submit() {
    if (!id.trim()) return;
    onQuery({ type: type.trim().toUpperCase() || 'WORK_ORDER', id: id.trim() });
  }

  // Resumen de la línea de vida (el backend devuelve orden descendente).
  const summary = useMemo(() => {
    if (events.length === 0) return null;
    const actors = new Set<string>();
    for (const e of events) actors.add(e.actorName || e.actorId || 'sistema');
    return {
      count: events.length,
      actors: actors.size,
      last: events[0]?.timestamp,
      first: events[events.length - 1]?.timestamp,
    };
  }, [events]);

  return (
    <div>
      {/* Buscador de entidad */}
      <div className={`${glass} rounded-2xl p-4 mb-6`}>
        <div className="flex items-end gap-2 flex-wrap">
          <label className="block">
            <span className="block text-[11px] font-medium text-gray-500 mb-1">Tipo de entidad</span>
            <input
              list="al-entity-types"
              value={type}
              onChange={(e) => setType(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              placeholder="WORK_ORDER"
              className="al-input font-mono w-44"
            />
            <datalist id="al-entity-types">
              {SUGGESTED_TYPES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>
          <label className="block flex-1 min-w-[200px]">
            <span className="block text-[11px] font-medium text-gray-500 mb-1">Identificador</span>
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              placeholder="WO-10042 · NCR-2025-0007 · SN-AB12…"
              className="al-input font-mono w-full"
            />
          </label>
          <button
            onClick={submit}
            disabled={!id.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            <Search className="h-4 w-4" /> Ver historial
          </button>
        </div>

        {/* Atajos de tipos comunes */}
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-gray-500 dark:text-gray-400">Atajos:</span>
          {SUGGESTED_TYPES.slice(0, 6).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`text-[11px] font-mono px-2 py-0.5 rounded-md transition-colors ${
                type.toUpperCase() === t
                  ? 'text-white'
                  : 'bg-black/5 dark:bg-white/10 text-gray-500 hover:text-foreground'
              }`}
              style={type.toUpperCase() === t ? { background: ACCENT } : undefined}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Resultado */}
      {!path ? (
        <Notice
          icon={<History className="h-8 w-8 text-gray-500 dark:text-gray-400" />}
          title="Rastrea una entidad"
          body="Escribe el tipo y el identificador (una WO, un NCR, un serial…) para ver su línea de vida completa en la bitácora."
        />
      ) : forbidden ? (
        <Notice
          icon={<Lock className="h-8 w-8 text-gray-500 dark:text-gray-400" />}
          title="Sin acceso"
          body="Inicia sesión para consultar el historial de la bitácora."
        />
      ) : error ? (
        <Notice
          icon={<ServerCog className="h-8 w-8 text-gray-500 dark:text-gray-400" />}
          title="No se pudo cargar el historial"
          body="Hubo un problema al leer la bitácora. Reintenta en un momento."
          action={
            <button
              onClick={() => mutate()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white"
              style={{ background: ACCENT }}
            >
              <RefreshCw className="h-4 w-4" /> Reintentar
            </button>
          }
        />
      ) : isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-500 dark:text-gray-400" />
        </div>
      ) : events.length === 0 ? (
        <Notice
          icon={<Inbox className="h-8 w-8 text-gray-500 dark:text-gray-400" />}
          title="Sin eventos"
          body={
            <>
              No hay eventos en la bitácora para{' '}
              <span className="font-mono text-gray-500">
                {query?.type}:{query?.id}
              </span>
              . Verifica el tipo y el identificador.
            </>
          }
        />
      ) : (
        <>
          {/* Cabecera de la entidad */}
          <div className={`${glass} rounded-2xl p-4 mb-5`}>
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: `${ACCENT}1f`, color: ACCENT }}
              >
                <History className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <div className="font-semibold font-mono truncate">
                  {query?.type}:{query?.id}
                </div>
                <div className="text-[12px] text-gray-500 dark:text-gray-400 flex items-center gap-3 flex-wrap mt-0.5">
                  <span>
                    {summary?.count} evento{summary?.count === 1 ? '' : 's'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3 w-3" /> {summary?.actors} actor{summary?.actors === 1 ? '' : 'es'}
                  </span>
                  {summary?.first && (
                    <span className="inline-flex items-center gap-1" title={`Primer evento: ${formatDateTime(summary.first)}`}>
                      <Clock className="h-3 w-3" /> desde {formatDateTime(summary.first)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* En el historial la referencia ES el contexto, así que se oculta el chip. */}
          <EventTimeline events={events} showReference={false} />
        </>
      )}
    </div>
  );
}

function Notice({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className={`${glass} rounded-3xl p-12 text-center max-w-xl mx-auto`}>
      <div className="mx-auto mb-3 flex justify-center">{icon}</div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
