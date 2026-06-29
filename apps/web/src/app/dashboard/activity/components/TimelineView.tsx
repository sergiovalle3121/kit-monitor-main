'use client';

import React, { useMemo, useState } from 'react';
import {
  Loader2,
  Inbox,
  Lock,
  Search,
  Filter,
  RefreshCw,
  ServerCog,
  X,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi, ApiError } from '@/hooks/useApi';
import { EventTimeline } from './EventTimeline';
import {
  type LedgerEvent,
  type EventDomain,
  DOMAIN_ORDER,
  domainMeta,
  searchableText,
} from './types';

const ACCENT = '#7c5cff';

/** Cuántos eventos pide el feed global. El backend puede ignorar el parámetro. */
const FEED_LIMIT = 200;

type Preset = 'today' | '7d' | '30d' | 'all';

/**
 * Feed global del Event Ledger: timeline de todos los eventos del piso con
 * filtros por dominio, entidad y fecha + búsqueda libre. El filtrado es
 * client-side sobre la lista cargada, de modo que funciona contra cualquier
 * endpoint de listado (incluso uno que no filtre todavía) y responde al instante
 * sin re-fetch por cada tecla.
 *
 * Consume `GET /ledger` (forma REST natural), que ya expone el listado reciente
 * de la bitácora. Si por alguna razón no respondiera (404), el componente lo dice
 * con claridad en vez de fingir datos; el historial por entidad corre contra la
 * misma bitácora real.
 */
export function TimelineView({
  onPickReference,
}: {
  onPickReference?: (referenceType: string, referenceId: string) => void;
}) {
  const { data, isLoading, forbidden, error, mutate } = useApi<LedgerEvent[]>(
    `/ledger?limit=${FEED_LIMIT}`,
    { shouldRetryOnError: false, refreshInterval: 30000 },
  );

  const [domains, setDomains] = useState<Set<EventDomain>>(new Set());
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [preset, setPreset] = useState<Preset>('all');
  const [q, setQ] = useState('');

  const all = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  // Tipos de entidad presentes en los datos → opciones del filtro.
  const entityTypes = useMemo(() => {
    const set = new Set<string>();
    for (const e of all) if (e.referenceType) set.add(e.referenceType);
    return [...set].sort();
  }, [all]);

  const filtered = useMemo(() => {
    const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTs = to ? new Date(`${to}T23:59:59`).getTime() : null;
    const needle = q.trim().toLowerCase();
    return all.filter((e) => {
      if (domains.size > 0 && !domains.has(e.domain as EventDomain)) return false;
      if (entityType && e.referenceType !== entityType) return false;
      const ts = new Date(e.timestamp).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts > toTs) return false;
      if (needle && !searchableText(e).includes(needle)) return false;
      return true;
    });
  }, [all, domains, entityType, from, to, q]);

  const kpis = useMemo(() => {
    const dom = new Set<string>();
    const entities = new Set<string>();
    const actors = new Set<string>();
    for (const e of filtered) {
      dom.add(e.domain);
      if (e.referenceType) entities.add(`${e.referenceType}:${e.referenceId ?? ''}`);
      actors.add(e.actorName || e.actorId || 'sistema');
    }
    return { total: filtered.length, domains: dom.size, entities: entities.size, actors: actors.size };
  }, [filtered]);

  function applyPreset(p: Preset) {
    setPreset(p);
    const now = new Date();
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (p === 'all') {
      setFrom('');
      setTo('');
    } else if (p === 'today') {
      setFrom(iso(now));
      setTo(iso(now));
    } else {
      const days = p === '7d' ? 7 : 30;
      const start = new Date(now);
      start.setDate(start.getDate() - days);
      setFrom(iso(start));
      setTo(iso(now));
    }
  }

  function toggleDomain(d: EventDomain) {
    setDomains((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  const hasActiveFilters = domains.size > 0 || !!entityType || !!from || !!to || !!q;
  function clearFilters() {
    setDomains(new Set());
    setEntityType('');
    setFrom('');
    setTo('');
    setPreset('all');
    setQ('');
  }

  // ── Estados sin datos ──────────────────────────────────────────────────────
  if (forbidden) {
    return (
      <Notice
        icon={<Lock className="h-8 w-8 text-gray-400" />}
        title="Sin acceso"
        body="Inicia sesión para ver la bitácora de eventos del piso."
      />
    );
  }

  // El endpoint de listado global aún no existe (404) → mensaje honesto + atajo.
  const pendingBackend = error instanceof ApiError && error.status === 404;
  if (pendingBackend) {
    return (
      <Notice
        icon={<ServerCog className="h-8 w-8 text-gray-400" />}
        title="Feed global pendiente de backend"
        body={
          <>
            El timeline global necesita el endpoint de listado <code className="font-mono text-[12px]">GET /ledger</code>,
            que aún no está expuesto. El <strong>Historial por entidad</strong> ya consulta la bitácora real
            (<code className="font-mono text-[12px]">/ledger/reference/:tipo/:id</code> y{' '}
            <code className="font-mono text-[12px]">/ledger/work-order/:wo</code>) — úsalo mientras tanto. En cuanto
            el listado exista, este feed se enciende solo.
          </>
        }
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
    );
  }

  if (error) {
    return (
      <Notice
        icon={<ServerCog className="h-8 w-8 text-gray-400" />}
        title="No se pudo cargar el feed"
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
    );
  }

  return (
    <div>
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi label="Eventos" value={kpis.total} color={ACCENT} />
        <Kpi label="Dominios" value={kpis.domains} color="#5b5bd6" />
        <Kpi label="Entidades" value={kpis.entities} color="#16a394" />
        <Kpi label="Actores" value={kpis.actors} color="#0a84ff" />
      </div>

      {/* Filtros */}
      <div className={`${glass} rounded-2xl p-4 mb-6 space-y-3`}>
        {/* Dominios */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-gray-400" />
          {DOMAIN_ORDER.map((d) => {
            const m = domainMeta(d);
            const active = domains.has(d);
            return (
              <button
                key={d}
                onClick={() => toggleDomain(d)}
                className="text-[12px] font-medium px-2.5 py-1 rounded-lg transition-colors"
                style={
                  active
                    ? { background: m.color, color: '#fff' }
                    : { background: `${m.color}1a`, color: m.color }
                }
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Entidad + fechas + búsqueda */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="al-input w-auto"
            aria-label="Tipo de entidad"
          >
            <option value="">Todas las entidades</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <div className={`${glass} inline-flex items-center gap-1 p-1 rounded-xl`}>
            {(['today', '7d', '30d', 'all'] as Preset[]).map((p) => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-colors ${
                  preset === p
                    ? 'bg-white text-black shadow-sm dark:bg-white/15 dark:text-white'
                    : 'text-gray-500 hover:text-foreground'
                }`}
              >
                {p === 'today' ? 'Hoy' : p === '7d' ? '7 días' : p === '30d' ? '30 días' : 'Todo'}
              </button>
            ))}
          </div>

          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPreset('all');
            }}
            className="al-input w-auto"
            aria-label="Desde"
          />
          <span className="text-gray-400 text-sm">→</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPreset('all');
            }}
            className="al-input w-auto"
            aria-label="Hasta"
          />

          <div className={`${glass} flex items-center gap-2 px-3 py-1.5 rounded-xl flex-1 min-w-[180px]`}>
            <Search className="h-4 w-4 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar acción, WO, serial, actor…"
              className="bg-transparent outline-none text-sm w-full"
            />
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[12px] font-medium text-gray-500 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5" /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <Notice
          icon={<Inbox className="h-8 w-8 text-gray-400" />}
          title={all.length === 0 ? 'Bitácora vacía' : 'Sin coincidencias'}
          body={
            all.length === 0
              ? 'Aún no hay eventos registrados en la bitácora del piso.'
              : 'Ningún evento coincide con los filtros activos.'
          }
          action={
            hasActiveFilters && all.length > 0 ? (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white"
                style={{ background: ACCENT }}
              >
                <X className="h-4 w-4" /> Limpiar filtros
              </button>
            ) : undefined
          }
        />
      ) : (
        <EventTimeline events={filtered} onPickReference={onPickReference} />
      )}
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-2xl font-semibold mt-1" style={{ color }}>
        {value}
      </div>
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
      <p className="text-sm text-gray-400 mt-1 leading-relaxed">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
