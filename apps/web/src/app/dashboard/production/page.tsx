'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Lock, Factory, Activity, AlertTriangle, PackageX, Radio, CheckCircle2,
  ArrowRight, Gauge, Clock, ClipboardList,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import {
  Toolbar, KpiRow, DataTable, FilterBar, ExportButton, EmptyState,
  DetailDrawer, DrawerSection, DrawerField,
  type StatCardProps, type FilterDef, type FilterValues, type ExportColumn,
} from '@/components/workspace';

const ORANGE = '#ff7a45';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const VIOLET = '#7c3aed';
const GRAY = '#6b7280';
const RED = '#ef4444';

interface Plan {
  id: number; workOrder: string; model: string; line?: number; quantity: number;
  shift?: string; status: string; kitStatus?: string | null;
}

/** Runtime en vivo por línea (production-runtime /lines), unido por workOrder. */
interface LineView {
  kitId: number; line: number | string; model: string; workOrder: string;
  targetQty: number; completedQty: number; status: string; hasIncident: boolean;
  startedAt: string | null; completedAt: string | null; lowStockCount: number;
}

/** WO del plan enriquecida con su runtime en piso. */
interface Row extends Plan {
  rt?: LineView;
  target: number;
  done: number;
  pct: number;
  hasIncident: boolean;
  lowStockCount: number;
}

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Por publicar', color: AMBER },
  published: { label: 'Publicado', color: VIOLET },
  released: { label: 'Liberado', color: VIOLET },
  active: { label: 'En producción', color: GREEN },
  completed: { label: 'Completado', color: GRAY },
  cancelled: { label: 'Cancelado', color: RED },
};
const STATUS_ORDER = ['active', 'published', 'released', 'pending', 'completed', 'cancelled'];

function fmtTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function StatusPill({ status }: { status: string }) {
  const m = STATUS[status] ?? STATUS.pending;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium" style={{ background: `${m.color}1f`, color: m.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

function ProgressCell({ row }: { row: Row }) {
  if (!row.rt) return <span className="text-gray-500 dark:text-gray-400">—</span>;
  const color = row.pct >= 100 ? GREEN : row.hasIncident ? RED : ORANGE;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: color }} />
      </div>
      <span className="w-9 text-right text-[12px] font-medium tabular-nums" style={{ color }}>{row.pct}%</span>
    </div>
  );
}

const COLUMNS: ColumnDef<Row, unknown>[] = [
  {
    id: 'wo',
    accessorFn: (r) => `${r.workOrder} ${r.model}`,
    header: 'Orden',
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 dark:bg-white/10">WO {row.original.workOrder}</span>
        <span className="truncate font-medium">{row.original.model}</span>
        {row.original.hasIncident && <span title="Incidencia" className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-500"><AlertTriangle className="h-2.5 w-2.5" />andon</span>}
        {row.original.lowStockCount > 0 && <span title="Bajo stock" className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600"><PackageX className="h-2.5 w-2.5" />{row.original.lowStockCount}</span>}
      </div>
    ),
    meta: { filterable: true, filterPlaceholder: 'WO o modelo…' },
  },
  {
    id: 'line',
    accessorFn: (r) => (r.line != null ? `Línea ${r.line}` : '—'),
    header: 'Línea',
    cell: ({ row }) => <span className="text-gray-600 dark:text-gray-300">{row.original.line != null ? `Línea ${row.original.line}` : '—'}</span>,
  },
  {
    id: 'shift',
    accessorFn: (r) => r.shift ?? '',
    header: 'Turno',
    cell: ({ getValue }) => <span className="text-gray-500 dark:text-gray-400">{(getValue() as string) || '—'}</span>,
  },
  {
    id: 'status',
    accessorFn: (r) => STATUS[r.status]?.label ?? r.status,
    header: 'Estado',
    cell: ({ row }) => <StatusPill status={row.original.status} />,
  },
  {
    id: 'qty',
    accessorFn: (r) => r.done,
    header: 'Avance',
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.original.rt ? <>{row.original.done}<span className="text-gray-500 dark:text-gray-400">/{row.original.target}</span></> : <span className="text-gray-500 dark:text-gray-400">0/{row.original.quantity}</span>}
      </span>
    ),
    meta: { align: 'right' },
  },
  {
    id: 'progress',
    accessorFn: (r) => r.pct,
    header: 'Progreso',
    cell: ({ row }) => <ProgressCell row={row.original} />,
  },
];

const EXPORT_COLUMNS: ExportColumn<Row>[] = [
  { key: 'workOrder', header: 'WO' },
  { key: 'model', header: 'Modelo' },
  { key: 'line', header: 'Línea', value: (r) => r.line ?? '' },
  { key: 'shift', header: 'Turno' },
  { key: 'status', header: 'Estado', value: (r) => STATUS[r.status]?.label ?? r.status },
  { key: 'quantity', header: 'Cantidad plan' },
  { key: 'done', header: 'Completado' },
  { key: 'target', header: 'Meta runtime' },
  { key: 'pct', header: 'Progreso %' },
  { key: 'hasIncident', header: 'Incidencia', value: (r) => (r.hasIncident ? 'Sí' : 'No') },
  { key: 'lowStockCount', header: 'Bajo stock' },
  { key: 'kitStatus', header: 'Kit' },
];

export default function ProductionPage() {
  const { data, isLoading, forbidden } = useApi<Plan[]>('/plans');
  // Runtime en vivo (meta vs real, incidencias, bajo stock). Best-effort.
  const { data: runtimeData } = useApi<LineView[]>('/production-runtime/lines', { refreshInterval: 10000 });

  const [filters, setFilters] = useState<FilterValues>({});
  const [query, setQuery] = useState('');
  const [exportRows, setExportRows] = useState<Row[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const plans = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const lines = useMemo(() => (Array.isArray(runtimeData) ? runtimeData : []), [runtimeData]);
  const runtimeByWo = useMemo(() => {
    const m = new Map<string, LineView>();
    for (const l of lines) if (l.workOrder) m.set(l.workOrder, l);
    return m;
  }, [lines]);

  const rows = useMemo<Row[]>(() => plans.map((p) => {
    const rt = runtimeByWo.get(p.workOrder);
    const target = rt?.targetQty ?? p.quantity;
    const done = rt?.completedQty ?? 0;
    const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
    return { ...p, rt, target, done, pct, hasIncident: rt?.hasIncident ?? false, lowStockCount: rt?.lowStockCount ?? 0 };
  }), [plans, runtimeByWo]);

  const lineOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of plans) if (p.line != null) set.add(String(p.line));
    return Array.from(set).sort((a, b) => Number(a) - Number(b)).map((l) => ({ value: l, label: `Línea ${l}` }));
  }, [plans]);

  const filtered = useMemo(() => {
    const statuses = (filters.status as string[] | undefined) ?? [];
    const line = filters.line as string | undefined;
    const flags = (filters.flags as string[] | undefined) ?? [];
    return rows.filter((r) => {
      if (statuses.length && !statuses.includes(r.status)) return false;
      if (line && String(r.line ?? '') !== line) return false;
      if (flags.includes('incident') && !r.hasIncident) return false;
      if (flags.includes('lowstock') && r.lowStockCount === 0) return false;
      return true;
    });
  }, [rows, filters]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  const FILTER_DEFS: FilterDef[] = [
    { key: 'status', type: 'pill', label: 'Estado', options: STATUS_ORDER.map((s) => ({ value: s, label: STATUS[s].label, color: STATUS[s].color })) },
    ...(lineOptions.length ? [{ key: 'line', type: 'select' as const, label: 'Línea', options: lineOptions }] : []),
    { key: 'flags', type: 'pill', label: 'Señales', options: [
      { value: 'incident', label: 'Con incidencia', color: RED },
      { value: 'lowstock', label: 'Bajo stock', color: AMBER },
    ] },
  ];

  const inProd = lines.filter((l) => l.status === 'in_progress' || l.status === 'active').length;
  const withIncident = rows.filter((r) => r.hasIncident).length;
  const lowStock = rows.filter((r) => r.lowStockCount > 0).length;
  const onFloor = lines.reduce((acc, l) => acc + (l.completedQty || 0), 0);
  const scheduled = rows.filter((r) => ['published', 'released', 'pending'].includes(r.status)).length;
  const completed = rows.filter((r) => r.status === 'completed').length;
  const flagsActive = (filters.flags as string[] | undefined) ?? [];

  if (forbidden) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-foreground">
        <div className={`${glass} max-w-sm rounded-3xl p-10 text-center`}>
          <Lock className="mx-auto mb-3 h-8 w-8 text-gray-500 dark:text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Inicia sesión para ver el piso de producción.</p>
        </div>
      </div>
    );
  }

  const kpiItems: StatCardProps[] = [
    { label: 'En producción', value: inProd, color: GREEN, icon: Activity },
    { label: 'Piezas en piso', value: onFloor.toLocaleString(), sublabel: 'completadas (acum.)', color: ORANGE, icon: Gauge },
    { label: 'Con incidencia', value: withIncident, color: withIncident ? RED : GREEN, icon: AlertTriangle },
    { label: 'Bajo stock', value: lowStock, color: lowStock ? AMBER : GREEN, icon: PackageX },
    { label: 'Programadas', value: scheduled, color: VIOLET, icon: ClipboardList },
    { label: 'Completadas', value: completed, color: GRAY, icon: CheckCircle2 },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 pb-24 text-foreground md:px-8">
      <Toolbar
        domain="production"
        icon={Factory}
        title="Producción · Piso"
        subtitle="Órdenes de trabajo y su avance en piso, en vivo"
        actions={
          <Link href="/dashboard/live" className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90" style={{ background: '#c2410c' }}>
            <Radio className="h-4 w-4" /> Monitor en vivo
          </Link>
        }
      >
        <FilterBar defs={FILTER_DEFS} value={filters} onChange={setFilters} />
        <div className="ml-auto">
          <ExportButton<Row> rows={exportRows} columns={EXPORT_COLUMNS} filename="produccion-piso" />
        </div>
      </Toolbar>

      <div className="mb-5">
        <KpiRow items={kpiItems} columns={6} />
      </div>

      {/* Alerta accionable: WOs con incidencia (andon) → filtra la tabla */}
      {withIncident > 0 && !flagsActive.includes('incident') && (
        <button
          type="button"
          onClick={() => setFilters({ ...filters, flags: Array.from(new Set([...flagsActive, 'incident'])) })}
          className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-left transition-colors hover:bg-red-500/[0.1]"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-red-600 dark:text-red-300">{withIncident} orden{withIncident === 1 ? '' : 'es'} con incidencia (andon)</div>
            <div className="text-[12px] text-red-500/80">Hay paros activos en piso — revisa y escala.</div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-red-600 dark:text-red-300">Ver incidencias <ArrowRight className="h-3.5 w-3.5" /></span>
        </button>
      )}

      <DataTable<Row>
        data={filtered}
        columns={COLUMNS}
        getRowId={(r) => String(r.id)}
        isLoading={isLoading}
        searchable
        searchPlaceholder="Buscar WO o modelo…"
        globalFilter={query}
        onGlobalFilterChange={setQuery}
        onFilteredRowsChange={setExportRows}
        onRowClick={(r) => setSelectedId(r.id)}
        pageSize={12}
        emptyState={
          <EmptyState
            icon={Factory}
            accent={ORANGE}
            title="El piso está listo para producir"
            description="Vista operativa del piso: cada orden de trabajo publicada por planeación aparece aquí con su avance en vivo, incidencias (andon) y faltantes de material."
            hint={[
              'Sigue el avance meta vs. real por orden y por línea, en vivo.',
              'Detecta paros (andon) y bajo stock antes de que frenen la línea.',
              'Filtra por estado, línea o señal y exporta el estado del piso.',
            ]}
            primaryAction={{ label: 'Abrir monitor en vivo', icon: Radio, onClick: () => { window.location.href = '/dashboard/live'; } }}
          />
        }
      />

      <DetailDrawer
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        icon={Factory}
        accent={ORANGE}
        title={selected ? selected.model : 'Orden'}
        subtitle={selected ? `WO ${selected.workOrder}` : undefined}
        actions={
          <Link href="/dashboard/live" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium" style={{ background: `${ORANGE}1f`, color: ORANGE }}>
            <Radio className="h-4 w-4" /> Ver en monitor
          </Link>
        }
      >
        {selected && (
          <>
            <DrawerSection title="Avance">
              {selected.rt ? (
                <>
                  <div className="mb-3 flex items-end justify-between gap-4">
                    <div>
                      <div className="text-3xl font-semibold tabular-nums" style={{ color: selected.pct >= 100 ? GREEN : selected.hasIncident ? RED : ORANGE }}>{selected.pct}%</div>
                      <div className="text-[12px] text-gray-500 dark:text-gray-400">avance en piso</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-semibold tabular-nums">{selected.done}<span className="text-sm text-gray-500 dark:text-gray-400">/{selected.target}</span></div>
                      <div className="text-[12px] text-gray-500 dark:text-gray-400">unidades</div>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                    <div className="h-full rounded-full" style={{ width: `${selected.pct}%`, background: selected.pct >= 100 ? GREEN : selected.hasIncident ? RED : ORANGE }} />
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">Sin runtime en vivo — la orden aún no arranca en piso.</p>
              )}
            </DrawerSection>

            <DrawerSection title="Detalle">
              <DrawerField label="Estado"><StatusPill status={selected.status} /></DrawerField>
              <DrawerField label="Línea">{selected.line != null ? `Línea ${selected.line}` : '—'}</DrawerField>
              <DrawerField label="Turno">{selected.shift || '—'}</DrawerField>
              <DrawerField label="Cantidad plan">{selected.quantity}</DrawerField>
              <DrawerField label="Kit">{selected.kitStatus || '—'}</DrawerField>
              {selected.rt && (
                <>
                  <DrawerField label="Inicio"><span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />{fmtTime(selected.rt.startedAt)}</span></DrawerField>
                  <DrawerField label="Fin">{fmtTime(selected.rt.completedAt)}</DrawerField>
                </>
              )}
            </DrawerSection>

            {(selected.hasIncident || selected.lowStockCount > 0) && (
              <DrawerSection title="Señales">
                <div className="space-y-2">
                  {selected.hasIncident && (
                    <div className="flex items-center gap-2 rounded-xl bg-red-500/[0.08] px-3 py-2 text-[13px] text-red-600 dark:text-red-300">
                      <AlertTriangle className="h-4 w-4" /> Incidencia activa (andon) en la línea.
                    </div>
                  )}
                  {selected.lowStockCount > 0 && (
                    <div className="flex items-center gap-2 rounded-xl bg-amber-500/[0.08] px-3 py-2 text-[13px] text-amber-600 dark:text-amber-300">
                      <PackageX className="h-4 w-4" /> {selected.lowStockCount} material(es) en bajo stock.
                    </div>
                  )}
                </div>
              </DrawerSection>
            )}
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
