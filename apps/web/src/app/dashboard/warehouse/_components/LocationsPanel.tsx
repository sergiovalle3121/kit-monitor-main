'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  FileWarning,
  Layers3,
  Loader2,
  MapPin,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldAlert,
  Warehouse,
} from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import {
  Toolbar,
  KpiRow,
  FilterBar,
  ExportButton,
  EmptyState,
  type ExportColumn,
  type FilterDef,
  type FilterValues,
  type StatCardProps,
} from '@/components/workspace';
import {
  BLUE,
  GREEN,
  RED,
  AMBER,
  GRAY,
  fmtQty,
  HOLD_STATUS_META,
  LOCATION_SIGNAL_META,
  type WarehouseLocation,
} from './shared';
import { glass } from '@/lib/glass';

const SIGNAL_ORDER: Record<WarehouseLocation['signal'], number> = {
  blocked: 0,
  busy: 1,
  available: 2,
  empty: 3,
};

const EXPORT_COLUMNS: ExportColumn<WarehouseLocation>[] = [
  { key: 'warehouseName', header: 'Almacen' },
  { key: 'warehouseCode', header: 'Codigo', value: (row) => row.warehouseCode ?? '' },
  { key: 'location', header: 'Locacion' },
  { key: 'signal', header: 'Senal', value: (row) => LOCATION_SIGNAL_META[row.signal]?.label ?? row.signal },
  { key: 'programIds', header: 'Programas', value: (row) => row.programIds.join(' | ') },
  { key: 'partCount', header: 'Partes' },
  { key: 'lotCount', header: 'Lotes' },
  { key: 'onHand', header: 'On hand' },
  { key: 'allocated', header: 'Asignado' },
  { key: 'available', header: 'Disponible' },
  { key: 'inTransit', header: 'En transito' },
  { key: 'qualityBlockQty', header: 'Bloqueo calidad' },
  { key: 'openOutboundPulls', header: 'Pulls salida' },
  { key: 'openInboundPulls', header: 'Pulls entrada' },
  { key: 'outboundQty', header: 'Qty salida' },
  { key: 'inboundQty', header: 'Qty entrada' },
];

export default function LocationsPanel() {
  const { data, isLoading, mutate } = useApi<WarehouseLocation[]>('/warehouse/locations');
  const all = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const [filters, setFilters] = useState<FilterValues>({});
  const [query, setQuery] = useState('');

  const warehouseOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of all) map.set(row.warehouseId, row.warehouseName || row.warehouseId);
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [all]);

  const programOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of all) for (const program of row.programIds) set.add(program);
    return Array.from(set).sort();
  }, [all]);

  const filtered = useMemo(() => {
    const signals = (filters.signal as string[] | undefined) ?? [];
    const warehouses = (filters.warehouse as string[] | undefined) ?? [];
    const holds = (filters.hold as string[] | undefined) ?? [];
    const programs = (filters.program as string[] | undefined) ?? [];
    const needle = query.trim().toLowerCase();

    return all
      .filter((row) => {
        if (signals.length && !signals.includes(row.signal)) return false;
        if (warehouses.length && !warehouses.includes(row.warehouseId)) return false;
        if (holds.length && !row.statuses.some((s) => holds.includes(s.status))) return false;
        if (programs.length && !row.programIds.some((p) => programs.includes(p))) return false;
        if (needle) {
          const parts = row.topParts.map((p) => p.partNumber).join(' ');
          const hay = `${row.warehouseName} ${row.warehouseCode ?? ''} ${row.location} ${row.programIds.join(' ')} ${parts}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const bySignal = SIGNAL_ORDER[a.signal] - SIGNAL_ORDER[b.signal];
        if (bySignal !== 0) return bySignal;
        const byFlow = b.openOutboundPulls + b.openInboundPulls - (a.openOutboundPulls + a.openInboundPulls);
        if (byFlow !== 0) return byFlow;
        const byWarehouse = a.warehouseName.localeCompare(b.warehouseName);
        return byWarehouse !== 0 ? byWarehouse : a.location.localeCompare(b.location);
      });
  }, [all, filters, query]);

  const totals = useMemo(() => {
    const blocked = all.filter((row) => row.signal === 'blocked').length;
    const busy = all.filter((row) => row.signal === 'busy').length;
    const availableQty = all.reduce((sum, row) => sum + row.available, 0);
    const blockedQty = all.reduce((sum, row) => sum + row.qualityBlockQty, 0);
    const openMoves = all.reduce((sum, row) => sum + row.openOutboundPulls + row.openInboundPulls, 0);
    return { blocked, busy, availableQty, blockedQty, openMoves };
  }, [all]);

  const kpiItems: StatCardProps[] = [
    { label: 'Locaciones', value: all.length, color: all.length ? BLUE : GRAY, icon: MapPin },
    { label: 'Bloqueadas', value: totals.blocked, color: totals.blocked ? RED : GREEN, icon: ShieldAlert },
    { label: 'Con flujo abierto', value: totals.busy, color: totals.busy ? AMBER : GRAY, icon: RefreshCw },
    { label: 'Disponible', value: fmtQty(totals.availableQty), color: totals.availableQty > 0 ? GREEN : GRAY, icon: PackageCheck },
    { label: 'Qty bloqueada', value: fmtQty(totals.blockedQty), color: totals.blockedQty ? RED : GRAY, icon: FileWarning },
  ];

  const filterDefs: FilterDef[] = [
    {
      key: 'signal',
      type: 'pill',
      label: 'Senal',
      options: Object.entries(LOCATION_SIGNAL_META).map(([value, meta]) => ({ value, label: meta.label, color: meta.color })),
    },
    ...(warehouseOptions.length > 1
      ? [
          {
            key: 'warehouse',
            type: 'pill' as const,
            label: 'Almacen',
            options: warehouseOptions.map((w) => ({ value: w.id, label: w.name })),
          },
        ]
      : []),
    ...(programOptions.length
      ? [
          {
            key: 'program',
            type: 'pill' as const,
            label: 'Programa',
            options: programOptions.map((program) => ({ value: program, label: program })),
          },
        ]
      : []),
    {
      key: 'hold',
      type: 'pill',
      label: 'Estado',
      options: Object.entries(HOLD_STATUS_META).map(([value, meta]) => ({ value, label: meta.label, color: meta.color })),
    },
  ];

  return (
    <div>
      <Toolbar
        domain="warehouse"
        icon={Layers3}
        title="Locaciones de almacen"
        subtitle="Stock por ubicacion, holds de calidad y pulls abiertos sin crear un sistema paralelo"
        actions={
          <button
            type="button"
            onClick={() => mutate()}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" /> Actualizar
          </button>
        }
      >
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar locacion, parte, programa..."
            className="w-full rounded-xl bg-black/[0.03] py-2 pl-8 pr-3 text-sm outline-none focus:bg-black/[0.05] dark:bg-white/[0.06] dark:focus:bg-white/[0.1]"
          />
        </div>
        <FilterBar defs={filterDefs} value={filters} onChange={setFilters} />
        <div className="ml-auto">
          <ExportButton rows={filtered} columns={EXPORT_COLUMNS} filename="warehouse-locations" />
        </div>
      </Toolbar>

      <div className="mb-5">
        <KpiRow items={kpiItems} columns={5} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : all.length === 0 ? (
        <EmptyState
          icon={Warehouse}
          accent={BLUE}
          title="Sin locaciones visibles"
          description="No hay posiciones de inventario ni pulls abiertos para tu alcance actual."
          hint={[
            'Las locaciones aparecen cuando existen posiciones en inventario o pulls abiertos.',
            'La vista respeta tenant y alcance por edificio desde los endpoints existentes.',
          ]}
        />
      ) : filtered.length === 0 ? (
        <div className={`${glass} rounded-3xl p-12 text-center`}>
          <MapPin className="mx-auto mb-3 h-8 w-8 text-gray-400" />
          <h3 className="font-semibold">Sin locaciones con esos filtros</h3>
          <p className="mt-1 text-sm text-gray-400">Ajusta senal, almacen, programa o busqueda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filtered.map((row) => (
            <LocationCard key={`${row.warehouseId}:${row.location}`} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function LocationCard({ row }: { row: WarehouseLocation }) {
  const signal = LOCATION_SIGNAL_META[row.signal];
  const statusChips = row.statuses.slice(0, 4);
  const flowOpen = row.openOutboundPulls + row.openInboundPulls;

  return (
    <article className={`${glass} overflow-hidden rounded-2xl`}>
      <div className="flex flex-wrap items-start gap-3 border-b border-black/5 px-4 py-3 dark:border-white/10">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${signal.color}1f`, color: signal.color }}>
          <MapPin className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold">{row.location}</h3>
            <span className="rounded-full px-2 py-0.5 text-[12px] font-medium" style={{ background: `${signal.color}1f`, color: signal.color }}>
              {signal.label}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[12px] text-gray-500 dark:text-gray-400">
            {row.warehouseName}
            {row.warehouseCode ? ` / ${row.warehouseCode}` : ''}
            {row.programIds.length ? ` / ${row.programIds.join(', ')}` : ''}
          </p>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wide text-gray-400">Disponible</div>
          <div className="font-mono text-lg font-semibold tabular-nums">{fmtQty(row.available)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-black/5 text-sm dark:bg-white/10 md:grid-cols-4">
        <Metric label="On hand" value={fmtQty(row.onHand)} />
        <Metric label="Asignado" value={fmtQty(row.allocated)} />
        <Metric label="Transito" value={fmtQty(row.inTransit)} />
        <Metric label="Bloqueo" value={fmtQty(row.qualityBlockQty)} tone={row.qualityBlockQty ? RED : GRAY} />
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          {statusChips.length ? (
            statusChips.map((status) => {
              const meta = HOLD_STATUS_META[status.status] ?? { label: status.status, color: GRAY };
              return (
                <span
                  key={status.status}
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium"
                  style={{ background: `${meta.color}1f`, color: meta.color }}
                >
                  {meta.label} <span className="font-mono">{fmtQty(status.onHand)}</span>
                </span>
              );
            })
          ) : (
            <span className="text-[12px] text-gray-400">Sin posiciones de inventario; solo flujo abierto.</span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <FlowPill icon={ArrowUpRight} label="Salida abierta" count={row.openOutboundPulls} qty={row.outboundQty} color={AMBER} />
          <FlowPill icon={ArrowDownLeft} label="Entrada abierta" count={row.openInboundPulls} qty={row.inboundQty} color={BLUE} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-[12px] uppercase tracking-wide text-gray-400">
            <span>Partes principales</span>
            <span>{row.partCount} parte{row.partCount === 1 ? '' : 's'} / {row.lotCount} lote{row.lotCount === 1 ? '' : 's'}</span>
          </div>
          {row.topParts.length ? (
            <div className="space-y-1.5">
              {row.topParts.map((part) => {
                const meta = HOLD_STATUS_META[part.holdStatus] ?? { label: part.holdStatus, color: GRAY };
                return (
                  <div key={`${part.partNumber}:${part.programId ?? ''}:${part.lotNumber ?? ''}:${part.holdStatus}`} className="flex items-center gap-2 rounded-xl bg-black/[0.025] px-3 py-2 dark:bg-white/[0.04]">
                    <Boxes className="h-4 w-4 shrink-0 text-gray-400" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-[13px] font-medium">{part.partNumber}</div>
                      <div className="truncate text-[11px] text-gray-400">
                        {part.programId || 'sin programa'}{part.lotNumber ? ` / lote ${part.lotNumber}` : ''}
                      </div>
                    </div>
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `${meta.color}1f`, color: meta.color }}>
                      {meta.label}
                    </span>
                    <span className="w-16 text-right font-mono text-[13px] tabular-nums">{fmtQty(part.onHand)}</span>
                  </div>
                );
              })}
            </div>
          ) : flowOpen ? (
            <div className="rounded-xl bg-black/[0.025] px-3 py-3 text-sm text-gray-500 dark:bg-white/[0.04] dark:text-gray-400">
              Hay pulls abiertos en esta ubicacion, pero no hay stock posicionado ahi.
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value, tone = GRAY }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-white/75 px-4 py-3 dark:bg-neutral-950/60">
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums" style={{ color: tone }}>
        {value}
      </div>
    </div>
  );
}

function FlowPill({
  icon: Icon,
  label,
  count,
  qty,
  color,
}: {
  icon: typeof ArrowUpRight;
  label: string;
  count: number;
  qty: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-black/5 px-3 py-2 dark:border-white/10">
      <Icon className="h-4 w-4 shrink-0" style={{ color }} />
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium">{label}</div>
        <div className="text-[11px] text-gray-400">{count} pull{count === 1 ? '' : 's'}</div>
      </div>
      <span className="font-mono text-sm font-semibold tabular-nums">{fmtQty(qty)}</span>
    </div>
  );
}
