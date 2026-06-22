'use client';

import React, { useMemo, useState } from 'react';
import {
  Lock, ClipboardList, Loader2, Play, CheckCircle2, ArrowRight, MapPin,
  Hash, Inbox, HandMetal,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';
import { useDashboardSession } from '@/hooks/useDashboardSession';
import {
  Toolbar, KpiRow, DataTable, FilterBar, ExportButton, EmptyState,
  DetailDrawer, DrawerSection, DrawerField,
  type StatCardProps, type FilterDef, type FilterValues, type ExportColumn,
} from '@/components/workspace';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const BLUE = '#0a84ff';
const TEAL = '#16a394';
const VIOLET = '#7c5cff';
const AMBER = '#f59e0b';
const GREEN = '#10b981';
const GRAY = '#6b7280';
const RED = '#ef4444';

type TaskType = 'put_away' | 'transfer' | 'pick' | 'confirm';
type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

interface WarehouseTask {
  id: number | string;
  taskNumber: string;
  type: TaskType | string;
  status: TaskStatus | string;
  partNumber: string;
  quantity?: number;
  lotNumber?: string | null;
  fromWarehouseId?: string | null;
  toWarehouseId?: string | null;
  fromLocation?: string | null;
  toLocation?: string | null;
  assignedTo?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  createdAt?: string | null;
}

const TYPE_META: Record<string, { label: string; color: string }> = {
  put_away: { label: 'Acomodo', color: BLUE },
  transfer: { label: 'Traslado', color: VIOLET },
  pick: { label: 'Surtido', color: TEAL },
  confirm: { label: 'Confirmar', color: AMBER },
};
const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: AMBER },
  in_progress: { label: 'En proceso', color: BLUE },
  completed: { label: 'Completada', color: GRAY },
  cancelled: { label: 'Cancelada', color: RED },
};
const TYPES: TaskType[] = ['put_away', 'transfer', 'pick', 'confirm'];
const STATUSES: TaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];

function fmtQty(n?: number): string {
  const v = n ?? 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}
function routeOf(t: WarehouseTask): string {
  return [t.fromLocation || t.fromWarehouseId, t.toLocation || t.toWarehouseId].filter(Boolean).join(' → ');
}
function fmtTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function TypePill({ type }: { type: string }) {
  const m = TYPE_META[type] ?? { label: type, color: GRAY };
  return <span className="inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${m.color}1f`, color: m.color }}>{m.label}</span>;
}
function StatusPill({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, color: GRAY };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium" style={{ background: `${m.color}1f`, color: m.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />{m.label}
    </span>
  );
}

const COLUMNS: ColumnDef<WarehouseTask, unknown>[] = [
  {
    id: 'type',
    accessorFn: (t) => TYPE_META[t.type as string]?.label ?? t.type,
    header: 'Tipo',
    cell: ({ row }) => <TypePill type={row.original.type as string} />,
    size: 110,
  },
  {
    accessorKey: 'partNumber',
    header: 'Parte',
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 dark:bg-white/10">{row.original.taskNumber}</span>
        <span className="truncate font-mono font-medium">{row.original.partNumber}</span>
      </div>
    ),
    meta: { filterable: true, filterPlaceholder: 'Parte o folio…' },
  },
  {
    id: 'qty',
    accessorFn: (t) => t.quantity ?? 0,
    header: 'Cant.',
    cell: ({ row }) => <span className="tabular-nums font-medium">{fmtQty(row.original.quantity)}</span>,
    meta: { align: 'right' },
  },
  {
    id: 'route',
    accessorFn: (t) => routeOf(t),
    header: 'Ruta',
    cell: ({ row }) => <span className="truncate text-gray-500 dark:text-gray-400">{routeOf(row.original) || '—'}</span>,
  },
  {
    id: 'assigned',
    accessorFn: (t) => t.assignedTo ?? '',
    header: 'Responsable',
    cell: ({ getValue }) => <span className="text-gray-500 dark:text-gray-400">{(getValue() as string) || <span className="text-gray-300">sin tomar</span>}</span>,
  },
  {
    id: 'status',
    accessorFn: (t) => STATUS_META[t.status as string]?.label ?? t.status,
    header: 'Estado',
    cell: ({ row }) => <StatusPill status={row.original.status as string} />,
  },
];

const EXPORT_COLUMNS: ExportColumn<WarehouseTask>[] = [
  { key: 'taskNumber', header: 'Folio' },
  { key: 'type', header: 'Tipo', value: (t) => TYPE_META[t.type as string]?.label ?? String(t.type) },
  { key: 'partNumber', header: 'Parte' },
  { key: 'quantity', header: 'Cantidad', value: (t) => t.quantity ?? '' },
  { key: 'lotNumber', header: 'Lote' },
  { key: 'route', header: 'Ruta', value: (t) => routeOf(t) },
  { key: 'reference', header: 'Referencia', value: (t) => (t.referenceType ? `${t.referenceType} ${t.referenceId ?? ''}`.trim() : '') },
  { key: 'assignedTo', header: 'Responsable' },
  { key: 'status', header: 'Estado', value: (t) => STATUS_META[t.status as string]?.label ?? String(t.status) },
  { key: 'createdAt', header: 'Creada', value: (t) => (t.createdAt ? t.createdAt.slice(0, 10) : '') },
];

const STATUS_RANK: Record<string, number> = { in_progress: 0, pending: 1, completed: 2, cancelled: 3 };

export default function WarehousePage() {
  const { data, isLoading, forbidden, mutate } = useApi<WarehouseTask[]>('/warehouse/tasks');
  const { session } = useDashboardSession();
  const toast = useToast();
  const actor = session?.name || session?.email || 'Almacén';

  const all = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const [filters, setFilters] = useState<FilterValues>({ status: ['pending', 'in_progress'] });
  const [query, setQuery] = useState('');
  const [exportRows, setExportRows] = useState<WarehouseTask[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Cola priorizada: en proceso → pendientes (FIFO por antigüedad) → resto.
  const ordered = useMemo(() => {
    return [...all].sort((a, b) => {
      const r = (STATUS_RANK[a.status as string] ?? 9) - (STATUS_RANK[b.status as string] ?? 9);
      if (r !== 0) return r;
      return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
    });
  }, [all]);

  const filtered = useMemo(() => {
    const types = (filters.type as string[] | undefined) ?? [];
    const statuses = (filters.status as string[] | undefined) ?? [];
    const flags = (filters.flags as string[] | undefined) ?? [];
    return ordered.filter((t) => {
      if (types.length && !types.includes(t.type as string)) return false;
      if (statuses.length && !statuses.includes(t.status as string)) return false;
      if (flags.includes('unassigned') && !(t.status === 'pending' && !t.assignedTo)) return false;
      return true;
    });
  }, [ordered, filters]);

  const selected = useMemo(() => all.find((t) => String(t.id) === selectedId) ?? null, [all, selectedId]);

  const pending = all.filter((t) => t.status === 'pending').length;
  const inProgress = all.filter((t) => t.status === 'in_progress').length;
  const unassigned = all.filter((t) => t.status === 'pending' && !t.assignedTo).length;
  const completed = all.filter((t) => t.status === 'completed').length;
  const flagsActive = (filters.flags as string[] | undefined) ?? [];

  async function act(task: WarehouseTask, action: 'start' | 'complete'): Promise<boolean> {
    setBusy(`${task.id}-${action}`);
    try {
      const res = await apiFetch(`${API_BASE}/warehouse/tasks/${task.id}/${action}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo actualizar la tarea.', 'Almacén');
        return false;
      }
      toast.success(action === 'start' ? `Tarea tomada por ${actor}.` : 'Tarea completada — movimiento aplicado.', 'Almacén');
      mutate();
      return true;
    } catch {
      toast.error('Error de red.', 'Almacén');
      return false;
    } finally { setBusy(null); }
  }

  async function takeNext() {
    const next = ordered.find((t) => t.status === 'pending' && !t.assignedTo) ?? ordered.find((t) => t.status === 'pending');
    if (!next) { toast.info('No hay tareas pendientes por tomar.', 'Almacén'); return; }
    const ok = await act(next, 'start');
    if (ok) setSelectedId(String(next.id));
  }

  async function bulk(tasks: WarehouseTask[], action: 'start' | 'complete', reset: () => void) {
    const eligible = tasks.filter((t) => (action === 'start' ? t.status === 'pending' : t.status === 'in_progress'));
    if (eligible.length === 0) { toast.info(action === 'start' ? 'Ninguna seleccionada está pendiente.' : 'Ninguna seleccionada está en proceso.', 'Almacén'); return; }
    setBusy(`bulk-${action}`);
    let ok = 0;
    for (const t of eligible) {
      try {
        const res = await apiFetch(`${API_BASE}/warehouse/tasks/${t.id}/${action}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actor }),
        });
        if (res.ok) ok++;
      } catch { /* continúa con las demás */ }
    }
    setBusy(null);
    reset();
    mutate();
    toast.success(`${ok}/${eligible.length} tarea(s) ${action === 'start' ? 'tomadas' : 'completadas'}.`, 'Almacén');
  }

  if (forbidden) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-black dark:text-white">
        <div className={`${glass} max-w-sm rounded-3xl p-10 text-center`}>
          <Lock className="mx-auto mb-3 h-8 w-8 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="mt-1 text-sm text-gray-400">Necesitas permiso de materiales para ver las tareas de almacén.</p>
        </div>
      </div>
    );
  }

  const kpiItems: StatCardProps[] = [
    { label: 'Pendientes', value: pending, color: pending ? AMBER : GREEN, icon: Inbox },
    { label: 'En proceso', value: inProgress, color: BLUE, icon: Play },
    { label: 'Sin tomar', value: unassigned, color: unassigned ? RED : GREEN, icon: HandMetal },
    { label: 'Completadas', value: completed, color: GRAY, icon: CheckCircle2 },
    { label: 'Total', value: all.length, color: TEAL, icon: ClipboardList },
  ];

  const FILTER_DEFS: FilterDef[] = [
    { key: 'type', type: 'pill', label: 'Tipo', options: TYPES.map((t) => ({ value: t, label: TYPE_META[t].label, color: TYPE_META[t].color })) },
    { key: 'status', type: 'pill', label: 'Estado', options: STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label, color: STATUS_META[s].color })) },
    { key: 'flags', type: 'pill', label: 'Señales', options: [{ value: 'unassigned', label: 'Sin tomar', color: RED }] },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 pb-24 text-black md:px-8 dark:text-white">
      <Toolbar
        domain="warehouse"
        icon={ClipboardList}
        title="Tareas de almacén · WMS"
        subtitle="Cola de acomodo, traslado y surtido — tómalas y compléta­las en piso"
        actions={
          <button type="button" onClick={takeNext} disabled={pending === 0 || busy !== null} className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50" style={{ background: BLUE }}>
            <HandMetal className="h-4 w-4" /> Tomar siguiente
          </button>
        }
      >
        <FilterBar defs={FILTER_DEFS} value={filters} onChange={setFilters} />
        <div className="ml-auto">
          <ExportButton<WarehouseTask> rows={exportRows} columns={EXPORT_COLUMNS} filename="tareas-almacen" />
        </div>
      </Toolbar>

      <div className="mb-5">
        <KpiRow items={kpiItems} columns={5} />
      </div>

      {/* Alerta accionable: tareas sin tomar → filtra la cola */}
      {unassigned > 0 && !flagsActive.includes('unassigned') && (
        <button
          type="button"
          onClick={() => setFilters({ ...filters, status: [], flags: Array.from(new Set([...flagsActive, 'unassigned'])) })}
          className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-left transition-colors hover:bg-amber-500/[0.12]"
        >
          <HandMetal className="h-5 w-5 shrink-0 text-amber-500" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-amber-700 dark:text-amber-300">{unassigned} tarea{unassigned === 1 ? '' : 's'} sin tomar</div>
            <div className="text-[12px] text-amber-600/80">Asígnalas para que avancen — usa “Tomar siguiente” o ábrelas y dale Iniciar.</div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-amber-700 dark:text-amber-300">Ver cola <ArrowRight className="h-3.5 w-3.5" /></span>
        </button>
      )}

      <DataTable<WarehouseTask>
        data={filtered}
        columns={COLUMNS}
        getRowId={(t) => String(t.id)}
        isLoading={isLoading}
        searchable
        searchPlaceholder="Buscar folio, parte o responsable…"
        globalFilter={query}
        onGlobalFilterChange={setQuery}
        onFilteredRowsChange={setExportRows}
        onRowClick={(t) => setSelectedId(String(t.id))}
        enableSelection
        renderBulkActions={(sel, reset) => (
          <>
            <button type="button" disabled={busy !== null} onClick={() => bulk(sel, 'start', reset)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13px] font-medium disabled:opacity-50" style={{ background: `${BLUE}1f`, color: BLUE }}>
              <Play className="h-3.5 w-3.5" /> Iniciar
            </button>
            <button type="button" disabled={busy !== null} onClick={() => bulk(sel, 'complete', reset)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13px] font-medium disabled:opacity-50" style={{ background: `${GREEN}1f`, color: GREEN }}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Completar
            </button>
          </>
        )}
        pageSize={15}
        emptyState={
          <EmptyState
            icon={ClipboardList}
            accent={BLUE}
            title="La cola de almacén está limpia"
            description="Aquí aterrizan las tareas de acomodo (put-away), traslado y surtido (picking) que generan recibos, resurtidos y kitting. Tómalas y compléta­las para mover el inventario."
            hint={[
              'Toma la siguiente tarea de la cola priorizada (FIFO) con un clic.',
              'Completa el surtido/traslado y el inventario se mueve solo.',
              'Filtra por tipo o estado y exporta la carga de trabajo del turno.',
            ]}
          />
        }
      />

      <DetailDrawer
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        icon={ClipboardList}
        accent={BLUE}
        title={selected ? selected.partNumber : 'Tarea'}
        subtitle={selected ? `${TYPE_META[selected.type as string]?.label ?? selected.type} · ${selected.taskNumber}` : undefined}
        actions={
          selected && (
            selected.status === 'pending' ? (
              <button type="button" disabled={busy !== null} onClick={() => act(selected, 'start')} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: BLUE }}>
                {busy === `${selected.id}-start` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Iniciar / Tomar
              </button>
            ) : selected.status === 'in_progress' ? (
              <button type="button" disabled={busy !== null} onClick={() => act(selected, 'complete')} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: GREEN }}>
                {busy === `${selected.id}-complete` ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Completar
              </button>
            ) : (
              <span className="text-[13px] text-gray-400">Tarea {STATUS_META[selected.status as string]?.label.toLowerCase()} — sin acciones.</span>
            )
          )
        }
      >
        {selected && (
          <>
            <DrawerSection title="Tarea">
              <DrawerField label="Tipo"><TypePill type={selected.type as string} /></DrawerField>
              <DrawerField label="Estado"><StatusPill status={selected.status as string} /></DrawerField>
              <DrawerField label="Parte"><span className="font-mono">{selected.partNumber}</span></DrawerField>
              <DrawerField label="Cantidad">{fmtQty(selected.quantity)}</DrawerField>
              {selected.lotNumber && <DrawerField label="Lote"><span className="font-mono">{selected.lotNumber}</span></DrawerField>}
              <DrawerField label="Responsable">{selected.assignedTo || <span className="text-gray-400">sin tomar</span>}</DrawerField>
              <DrawerField label="Creada">{fmtTime(selected.createdAt)}</DrawerField>
            </DrawerSection>

            <DrawerSection title="Movimiento">
              <div className="space-y-2">
                <div className={`${glass} flex items-center gap-3 rounded-xl p-3`}>
                  <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-gray-400">Origen</div>
                    <div className="truncate text-sm font-medium">{selected.fromLocation || selected.fromWarehouseId || '—'}</div>
                  </div>
                  <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-gray-300" />
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-gray-400">Destino</div>
                    <div className="truncate text-sm font-medium">{selected.toLocation || selected.toWarehouseId || '—'}</div>
                  </div>
                </div>
                {selected.referenceType && (
                  <div className={`${glass} flex items-center gap-3 rounded-xl p-3`}>
                    <Hash className="h-4 w-4 shrink-0 text-gray-400" />
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-wide text-gray-400">Referencia</div>
                      <div className="truncate text-sm font-medium">{selected.referenceType} {selected.referenceId}</div>
                    </div>
                  </div>
                )}
              </div>
            </DrawerSection>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
