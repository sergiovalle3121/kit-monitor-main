'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Hammer, Plus, Lock, Loader2, X, CheckCircle2, Gauge, Wrench,
  AlertTriangle, Layers, ArrowRight, ShieldCheck, PackageCheck,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';
import {
  Toolbar, KpiRow, DataTable, FilterBar, ExportButton, EmptyState,
  type StatCardProps, type FilterDef, type FilterValues, type ExportColumn,
} from '@/components/workspace';
import {
  type Tool, type ToolType, type ToolingKpis,
  TOOL_STATUS_META, TOOL_TYPE_LABEL, TOOL_STATUSES, TOOL_TYPES,
  lifeColor, pmProjection, PM_META, CALIBRATION_META, calibrationStatusOf, fmtDate,
} from '@/lib/tooling';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const INDIGO = '#5b63e0';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const BLUE = '#3b82f6';
const GRAY = '#6b7280';
const RED = '#ef4444';

const tlInput =
  'w-full rounded-xl px-3 py-2.5 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 outline-none focus:border-[#5b63e0] transition-colors';

function StatusPill({ status }: { status: Tool['status'] }) {
  const m = TOOL_STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium" style={{ background: `${m.color}1f`, color: m.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

function LifeCell({ tool }: { tool: Tool }) {
  const color = lifeColor(tool.lifePercent);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, tool.lifePercent)}%`, background: color }} />
      </div>
      <span className="w-10 text-right text-[12px] font-medium tabular-nums" style={{ color }}>{tool.lifePercent}%</span>
    </div>
  );
}

function calStatus(t: Tool) {
  return t.calibrationStatus ?? calibrationStatusOf(t.nextCalibrationDate);
}

function CalibrationCell({ tool }: { tool: Tool }) {
  const status = calStatus(tool);
  const m = CALIBRATION_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[12px] font-medium"
      style={{ color: m.color }}
      title={tool.nextCalibrationDate ? `Próxima: ${fmtDate(tool.nextCalibrationDate)}` : 'Sin calibración registrada'}
    >
      <ShieldCheck className="h-3.5 w-3.5" /> {m.label}
    </span>
  );
}

function LoanCell({ tool }: { tool: Tool }) {
  const c = tool.activeCheckout;
  if (!c) return <span className="text-gray-400">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px]" title={`Desde ${fmtDate(c.checkedOutAt)}`}>
      <PackageCheck className="h-3.5 w-3.5 text-blue-500" />
      <span className="font-medium text-blue-600 dark:text-blue-300">{c.workOrderFolio || c.workOrderModel || 'WO'}</span>
    </span>
  );
}

const COLUMNS: ColumnDef<Tool, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Herramental',
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-2">
        {row.original.folio && <span className="shrink-0 rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 dark:bg-white/10">{row.original.folio}</span>}
        <span className={`truncate font-medium ${row.original.status === 'RETIRED' ? 'opacity-60' : ''}`}>{row.original.name}</span>
        {row.original.nearEol && row.original.status !== 'RETIRED' && (
          <span title="Cerca de fin de vida" className="shrink-0 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-500">EOL</span>
        )}
      </div>
    ),
    meta: { filterable: true, filterPlaceholder: 'Nombre o folio…' },
  },
  {
    accessorKey: 'type',
    header: 'Tipo',
    cell: ({ getValue }) => <span className="text-gray-600 dark:text-gray-300">{TOOL_TYPE_LABEL[getValue() as ToolType]}</span>,
  },
  {
    id: 'status',
    accessorFn: (t) => TOOL_STATUS_META[t.status].label,
    header: 'Estado',
    cell: ({ row }) => <StatusPill status={row.original.status} />,
  },
  {
    id: 'life',
    accessorFn: (t) => t.lifePercent,
    header: 'Vida',
    cell: ({ row }) => <LifeCell tool={row.original} />,
  },
  {
    id: 'shots',
    accessorFn: (t) => t.shotsUsed,
    header: 'Disparos',
    cell: ({ row }) => (
      <span className="tabular-nums text-gray-500 dark:text-gray-400">
        {row.original.shotsUsed.toLocaleString()} / {row.original.lifeShots.toLocaleString()}
      </span>
    ),
    meta: { align: 'right' },
  },
  {
    id: 'remaining',
    accessorFn: (t) => t.remainingShots,
    header: 'Restantes',
    cell: ({ row }) => <span className="tabular-nums" style={{ color: lifeColor(row.original.lifePercent) }}>{row.original.remainingShots.toLocaleString()}</span>,
    meta: { align: 'right' },
  },
  {
    id: 'pm',
    accessorFn: (t) => pmProjection(t.shotsUsed, t.lifeShots).state,
    header: 'PM (proy.)',
    cell: ({ row }) => {
      if (row.original.status === 'RETIRED') return <span className="text-gray-400">—</span>;
      const m = PM_META[pmProjection(row.original.shotsUsed, row.original.lifeShots).state];
      return <span className="inline-flex items-center gap-1 text-[12px] font-medium" style={{ color: m.color }}><Wrench className="h-3.5 w-3.5" />{m.label}</span>;
    },
  },
  {
    id: 'calibration',
    accessorFn: (t) => CALIBRATION_META[calStatus(t)].label,
    header: 'Calibración',
    cell: ({ row }) => <CalibrationCell tool={row.original} />,
  },
  {
    id: 'loan',
    accessorFn: (t) => t.activeCheckout?.workOrderFolio ?? '',
    header: 'Prestado a',
    cell: ({ row }) => <LoanCell tool={row.original} />,
  },
  {
    id: 'cavities',
    accessorFn: (t) => t.cavities,
    header: 'Cav.',
    cell: ({ row }) => <span className="tabular-nums text-gray-500 dark:text-gray-400">{row.original.cavities}</span>,
    meta: { align: 'right' },
  },
  {
    accessorKey: 'location',
    header: 'Ubicación',
    cell: ({ getValue }) => <span className="text-gray-500 dark:text-gray-400">{(getValue() as string) || '—'}</span>,
    meta: { filterable: true, filterPlaceholder: 'Ubicación…' },
  },
];

const FILTER_DEFS: FilterDef[] = [
  { key: 'type', type: 'select', label: 'Tipo', options: TOOL_TYPES.map((t) => ({ value: t, label: TOOL_TYPE_LABEL[t] })) },
  { key: 'status', type: 'pill', label: 'Estado', options: TOOL_STATUSES.map((s) => ({ value: s, label: TOOL_STATUS_META[s].label, color: TOOL_STATUS_META[s].color })) },
  { key: 'flags', type: 'pill', label: 'Señales', options: [
    { value: 'eol', label: 'Cerca de EOL', color: RED },
    { value: 'pm', label: 'PM vencido', color: AMBER },
    { value: 'cal', label: 'Calibración vencida', color: RED },
    { value: 'loan', label: 'Prestados', color: '#3b82f6' },
  ] },
];

const EXPORT_COLUMNS: ExportColumn<Tool>[] = [
  { key: 'folio', header: 'Folio' },
  { key: 'name', header: 'Herramental' },
  { key: 'type', header: 'Tipo', value: (t) => TOOL_TYPE_LABEL[t.type] },
  { key: 'status', header: 'Estado', value: (t) => TOOL_STATUS_META[t.status].label },
  { key: 'cavities', header: 'Cavidades' },
  { key: 'lifeShots', header: 'Vida (disparos)' },
  { key: 'shotsUsed', header: 'Disparos usados' },
  { key: 'remainingShots', header: 'Disparos restantes' },
  { key: 'lifePercent', header: 'Vida consumida %' },
  { key: 'nearEol', header: 'Cerca de EOL', value: (t) => (t.nearEol ? 'Sí' : 'No') },
  { key: 'pm', header: 'PM (proyección)', value: (t) => PM_META[pmProjection(t.shotsUsed, t.lifeShots).state].label },
  { key: 'calibration', header: 'Calibración', value: (t) => CALIBRATION_META[calStatus(t)].label },
  { key: 'nextCalibrationDate', header: 'Próxima calibración', value: (t) => fmtDate(t.nextCalibrationDate) },
  { key: 'loan', header: 'Prestado a (WO)', value: (t) => t.activeCheckout?.workOrderFolio || t.activeCheckout?.workOrderModel || '' },
  { key: 'location', header: 'Ubicación' },
];

export default function ToolingPage() {
  const { data, isLoading, forbidden, mutate } = useApi<Tool[]>('/tooling');
  const { data: kpis, mutate: mutateKpis } = useApi<ToolingKpis>('/tooling/kpis');
  const toast = useToast();
  const router = useRouter();

  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState<FilterValues>({});
  const [query, setQuery] = useState('');
  const [exportRows, setExportRows] = useState<Tool[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'MOLD' as ToolType, cavities: 1, lifeShots: 1000000, location: '' });

  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const filtered = useMemo(() => {
    const type = filters.type as string | undefined;
    const statuses = (filters.status as string[] | undefined) ?? [];
    const flags = (filters.flags as string[] | undefined) ?? [];
    return list.filter((t) => {
      if (type && t.type !== type) return false;
      if (statuses.length && !statuses.includes(t.status)) return false;
      if (flags.includes('eol') && !(t.nearEol && t.status !== 'RETIRED')) return false;
      if (flags.includes('pm') && !(t.status !== 'RETIRED' && pmProjection(t.shotsUsed, t.lifeShots).state === 'overdue')) return false;
      if (flags.includes('cal') && !(t.status !== 'RETIRED' && calStatus(t) === 'OVERDUE')) return false;
      if (flags.includes('loan') && !t.activeCheckout) return false;
      return true;
    });
  }, [list, filters]);

  function refresh() { mutate(); mutateKpis(); }

  async function createTool() {
    if (form.name.trim().length < 2 || form.lifeShots <= 0) {
      toast.error('Nombre y vida en disparos son obligatorios.', 'Tooling');
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/tooling`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, location: form.location || undefined }),
      });
      if (!res.ok) { toast.error('No se pudo crear.', 'Tooling'); return; }
      toast.success('Herramental dado de alta.', 'Tooling');
      setShowForm(false);
      setForm({ name: '', type: 'MOLD', cavities: 1, lifeShots: 1000000, location: '' });
      refresh();
    } catch {
      toast.error('Error de red.', 'Tooling');
    } finally { setBusy(false); }
  }

  if (forbidden) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-foreground">
        <div className={`${glass} max-w-sm rounded-3xl p-10 text-center`}>
          <Lock className="mx-auto mb-3 h-8 w-8 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="mt-1 text-sm text-gray-400">Inicia sesión para ver herramentales.</p>
        </div>
      </div>
    );
  }

  const nearEol = kpis?.nearEol ?? list.filter((t) => t.nearEol && t.status !== 'RETIRED').length;
  const calOverdue = kpis?.calibrationOverdue ?? list.filter((t) => t.status !== 'RETIRED' && calStatus(t) === 'OVERDUE').length;
  const onLoan = kpis?.onLoan ?? list.filter((t) => !!t.activeCheckout).length;
  const flagsActive = (filters.flags as string[] | undefined) ?? [];
  const kpiItems: StatCardProps[] = [
    { label: 'Total', value: kpis?.total ?? list.length, color: INDIGO, icon: Layers },
    { label: 'Prestados', value: onLoan, color: onLoan > 0 ? BLUE : GREEN, icon: PackageCheck },
    { label: 'Vida consumida', value: kpis?.avgLifeConsumedPct == null ? '—' : `${kpis.avgLifeConsumedPct}%`, color: kpis?.avgLifeConsumedPct == null ? GRAY : lifeColor(kpis.avgLifeConsumedPct), icon: Gauge },
    { label: 'Próximos a EOL', value: nearEol, color: nearEol > 0 ? RED : GREEN, icon: AlertTriangle },
    { label: 'Calibración vencida', value: calOverdue, color: calOverdue > 0 ? RED : GREEN, icon: ShieldCheck },
    { label: 'En mantenimiento', value: kpis?.inMaintenance ?? 0, color: (kpis?.inMaintenance ?? 0) > 0 ? AMBER : GREEN, icon: Wrench },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 pb-24 text-black md:px-8 dark:text-white">
      <Toolbar
        domain="engineering"
        icon={Hammer}
        title="Tooling · Herramentales"
        subtitle="Moldes, fixtures y galgas — vida en disparos, semáforo y mantenimiento"
        actions={
          <button type="button" onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90" style={{ background: INDIGO }}>
            <Plus className="h-4 w-4" /> Alta herramental
          </button>
        }
      >
        <FilterBar defs={FILTER_DEFS} value={filters} onChange={setFilters} />
        <div className="ml-auto">
          <ExportButton<Tool> rows={exportRows} columns={EXPORT_COLUMNS} filename="tooling-herramentales" />
        </div>
      </Toolbar>

      <div className="mb-5">
        <KpiRow items={kpiItems} columns={6} />
      </div>

      {/* Alerta accionable: herramentales cerca de fin de vida → filtra la tabla */}
      {nearEol > 0 && !flagsActive.includes('eol') && (
        <button
          type="button"
          onClick={() => setFilters({ ...filters, flags: Array.from(new Set([...flagsActive, 'eol'])) })}
          className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-left transition-colors hover:bg-red-500/[0.1]"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-red-600 dark:text-red-300">{nearEol} herramental{nearEol === 1 ? '' : 'es'} cerca de fin de vida</div>
            <div className="text-[12px] text-red-500/80">Por encima del 80% de su vida nominal — planifica refacción o reemplazo.</div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-red-600 dark:text-red-300">Ver EOL <ArrowRight className="h-3.5 w-3.5" /></span>
        </button>
      )}

      <DataTable<Tool>
        data={filtered}
        columns={COLUMNS}
        getRowId={(t) => t.id}
        isLoading={isLoading}
        searchable
        searchPlaceholder="Buscar herramental, folio o ubicación…"
        globalFilter={query}
        onGlobalFilterChange={setQuery}
        onFilteredRowsChange={setExportRows}
        onRowClick={(t) => router.push(`/dashboard/tooling/${t.id}`)}
        pageSize={12}
        emptyState={
          <EmptyState
            icon={Hammer}
            accent={INDIGO}
            title="Da de alta el crib de herramentales"
            description="Controla moldes, fixtures, stencils y galgas como activos: vida en disparos, préstamo a órdenes de trabajo, calibración IATF y alertas antes de que un herramental falle."
            hint={[
              'Sigue la vida en disparos con semáforo verde / ámbar / rojo y alerta de fin de vida (EOL).',
              'Presta a una WO (check-out) y recíbela (check-in): sabes dónde está cada molde y a qué orden.',
              'Mantén la calibración vigente para auditoría IATF — semáforo de vencimiento.',
            ]}
            primaryAction={{ label: 'Alta herramental', icon: Plus, onClick: () => setShowForm(true) }}
          />
        }
      />

      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className={`${glass} w-full max-w-2xl rounded-3xl p-6`} onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Alta de herramental</h3>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="mb-1 block text-[12px] font-medium text-gray-500">Nombre</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Molde carcasa frontal" className={tlInput} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-gray-500">Tipo</span>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ToolType })} className={tlInput}>
                  {TOOL_TYPES.map((t) => <option key={t} value={t}>{TOOL_TYPE_LABEL[t]}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-gray-500">Cavidades</span>
                <input type="number" min={1} value={form.cavities} onChange={(e) => setForm({ ...form, cavities: Number(e.target.value) })} className={tlInput} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-gray-500">Vida (disparos)</span>
                <input type="number" min={1} value={form.lifeShots} onChange={(e) => setForm({ ...form, lifeShots: Number(e.target.value) })} className={tlInput} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-gray-500">Ubicación</span>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Tooling crib A" className={tlInput} />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="rounded-xl px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
              <button onClick={createTool} disabled={busy} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: INDIGO }}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
