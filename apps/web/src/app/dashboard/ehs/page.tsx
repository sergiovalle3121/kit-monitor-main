'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
  Plus,
  Lock,
  Loader2,
  CheckCircle2,
  HeartPulse,
  Search,
  AlertTriangle,
  ClipboardCheck,
  Activity,
  Sprout,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';
import {
  Toolbar,
  KpiRow,
  DataTable,
  FilterBar,
  ExportButton,
  DetailDrawer,
  EmptyState,
  type StatCardProps,
  type FilterDef,
  type FilterValues,
  type ExportColumn,
} from '@/components/workspace';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const ROSE = '#ff4d8d';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const ORANGE = '#f97316';
const VIOLET = '#7c3aed';
const GRAY = '#6b7280';
const RED = '#ef4444';

type Status = 'REPORTED' | 'INVESTIGATING' | 'ACTION_PENDING' | 'CLOSED' | 'CANCELLED';
type IType = 'NEAR_MISS' | 'FIRST_AID' | 'RECORDABLE' | 'LOST_TIME' | 'ENVIRONMENTAL' | 'PROPERTY_DAMAGE';
type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface Incident {
  id: string;
  folio: string | null;
  title: string;
  type: IType;
  severity: Severity;
  status: Status;
  area?: string | null;
  location?: string | null;
  lostDays: number;
  rootCause?: string | null;
  correctiveAction?: string | null;
  capaOwner?: string | null;
  capaDueDate?: string | null;
  occurredAt?: string | null;
  created_at?: string | null;
}

interface Kpis {
  total: number;
  open: number;
  recordableCount: number;
  lostTimeCount: number;
  nearMissCount: number;
  totalLostDays: number;
  daysSinceLastRecordable: number | null;
  capaOpen: number;
  capaOverdue: number;
  capaDueSoon: number;
}

const STATUS_META: Record<Status, { label: string; color: string }> = {
  REPORTED: { label: 'Reportado', color: GRAY },
  INVESTIGATING: { label: 'Investigando', color: VIOLET },
  ACTION_PENDING: { label: 'Acción pendiente', color: AMBER },
  CLOSED: { label: 'Cerrado', color: GREEN },
  CANCELLED: { label: 'Cancelado', color: RED },
};

const TYPE_LABEL: Record<IType, string> = {
  NEAR_MISS: 'Casi-accidente',
  FIRST_AID: 'Primeros auxilios',
  RECORDABLE: 'Registrable',
  LOST_TIME: 'Tiempo perdido',
  ENVIRONMENTAL: 'Ambiental',
  PROPERTY_DAMAGE: 'Daño material',
};

const SEV_COLOR: Record<Severity, string> = { LOW: GRAY, MEDIUM: AMBER, HIGH: ORANGE, CRITICAL: RED };
const SEV_LABEL: Record<Severity, string> = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica' };
const SEV_RANK: Record<Severity, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
const STATUS_ORDER: Status[] = ['REPORTED', 'INVESTIGATING', 'ACTION_PENDING', 'CLOSED', 'CANCELLED'];

const ehsInput =
  'w-full rounded-xl px-3 py-2.5 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 outline-none focus:border-[#ff4d8d] transition-colors';
const FIELD_LABEL = 'mb-1 block text-[12px] font-medium text-gray-500 dark:text-gray-400';

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}
function isoDay(iso?: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}
/** Días hasta la fecha de compromiso de la CAPA (negativo = vencida). */
function capaDaysLeft(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((t - Date.now()) / 86_400_000);
}
function isOpenStatus(s: Status): boolean {
  return s !== 'CLOSED' && s !== 'CANCELLED';
}

function StatusPill({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium" style={{ background: `${m.color}1f`, color: m.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

function SeverityPill({ severity }: { severity: Severity }) {
  const c = SEV_COLOR[severity];
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ background: `${c}1f`, color: c }}>
      {SEV_LABEL[severity]}
    </span>
  );
}

/** Indicador visible de CAPA por vencer / vencida en la tabla (alerta in-situ). */
function CapaBadge({ inc }: { inc: Incident }) {
  if (!isOpenStatus(inc.status) || !inc.capaDueDate) return <span className="text-gray-500 dark:text-gray-400">—</span>;
  const dl = capaDaysLeft(inc.capaDueDate);
  if (dl === null) return <span className="text-gray-500 dark:text-gray-400">—</span>;
  if (dl < 0) {
    return (
      <span className="inline-flex items-center gap-1 font-medium tabular-nums" style={{ color: RED }}>
        <AlertTriangle className="h-3.5 w-3.5" /> Vencida
      </span>
    );
  }
  const color = dl <= 7 ? AMBER : GRAY;
  return (
    <span className="tabular-nums" style={{ color, fontWeight: dl <= 7 ? 600 : 400 }} title={`Vence el ${fmtDate(inc.capaDueDate)}`}>
      {dl}d
    </span>
  );
}

const COLUMNS: ColumnDef<Incident, unknown>[] = [
  {
    accessorKey: 'title',
    header: 'Incidente',
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-2">
        {row.original.folio && (
          <span className="shrink-0 rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 dark:bg-white/10">{row.original.folio}</span>
        )}
        <span className="truncate font-medium">{row.original.title}</span>
      </div>
    ),
    meta: { filterable: true, filterPlaceholder: 'Título o folio…' },
  },
  {
    accessorKey: 'type',
    header: 'Tipo',
    cell: ({ getValue }) => <span className="text-gray-600 dark:text-gray-300">{TYPE_LABEL[getValue() as IType]}</span>,
  },
  {
    id: 'severity',
    accessorFn: (i) => SEV_RANK[i.severity],
    header: 'Severidad',
    cell: ({ row }) => <SeverityPill severity={row.original.severity} />,
  },
  {
    id: 'status',
    accessorFn: (i) => STATUS_ORDER.indexOf(i.status),
    header: 'Estado',
    cell: ({ row }) => <StatusPill status={row.original.status} />,
  },
  {
    accessorKey: 'area',
    header: 'Área',
    cell: ({ row }) => (
      <span className="text-gray-600 dark:text-gray-300">
        {row.original.area || '—'}
        {row.original.location ? <span className="text-gray-500 dark:text-gray-400"> · {row.original.location}</span> : null}
      </span>
    ),
    meta: { filterable: true, filterPlaceholder: 'Área…' },
  },
  {
    id: 'lostDays',
    accessorFn: (i) => i.lostDays ?? 0,
    header: 'Días perd.',
    cell: ({ row }) => {
      const d = row.original.lostDays ?? 0;
      return <span className="tabular-nums" style={{ color: d > 0 ? RED : GRAY }}>{d || '—'}</span>;
    },
    meta: { align: 'right' },
  },
  {
    id: 'capa',
    accessorFn: (i) => (isOpenStatus(i.status) ? capaDaysLeft(i.capaDueDate) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER),
    header: 'CAPA',
    cell: ({ row }) => <CapaBadge inc={row.original} />,
    meta: { align: 'right' },
  },
  {
    id: 'occurredAt',
    accessorFn: (i) => isoDay(i.occurredAt ?? i.created_at),
    header: 'Ocurrió',
    cell: ({ row }) => <span className="text-gray-500 dark:text-gray-400">{fmtDate(row.original.occurredAt ?? row.original.created_at)}</span>,
  },
];

const FILTER_DEFS: FilterDef[] = [
  { key: 'type', type: 'select', label: 'Tipo', options: (Object.keys(TYPE_LABEL) as IType[]).map((t) => ({ value: t, label: TYPE_LABEL[t] })) },
  { key: 'severity', type: 'select', label: 'Severidad', options: (Object.keys(SEV_LABEL) as Severity[]).map((s) => ({ value: s, label: SEV_LABEL[s] })) },
  { key: 'status', type: 'pill', label: 'Estado', options: STATUS_ORDER.map((s) => ({ value: s, label: STATUS_META[s].label, color: STATUS_META[s].color })) },
];

const EXPORT_COLUMNS: ExportColumn<Incident>[] = [
  { key: 'folio', header: 'Folio' },
  { key: 'title', header: 'Incidente' },
  { key: 'type', header: 'Tipo', value: (i) => TYPE_LABEL[i.type] },
  { key: 'severity', header: 'Severidad', value: (i) => SEV_LABEL[i.severity] },
  { key: 'status', header: 'Estado', value: (i) => STATUS_META[i.status].label },
  { key: 'area', header: 'Área' },
  { key: 'location', header: 'Ubicación' },
  { key: 'lostDays', header: 'Días perdidos', value: (i) => i.lostDays ?? 0 },
  { key: 'rootCause', header: 'Causa raíz' },
  { key: 'correctiveAction', header: 'Acción correctiva (CAPA)' },
  { key: 'capaOwner', header: 'Responsable CAPA' },
  { key: 'capaDueDate', header: 'Compromiso CAPA', value: (i) => isoDay(i.capaDueDate) },
  { key: 'occurredAt', header: 'Ocurrió', value: (i) => isoDay(i.occurredAt ?? i.created_at) },
];

export default function EhsPage() {
  const router = useRouter();
  const { data, isLoading, forbidden, mutate } = useApi<Incident[]>('/ehs/incidents');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/ehs/kpis');
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<FilterValues>({});
  const [exportRows, setExportRows] = useState<Incident[]>([]);
  const [form, setForm] = useState({
    title: '',
    type: 'NEAR_MISS' as IType,
    severity: 'LOW' as Severity,
    area: '',
    location: '',
  });

  const all = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  // FilterBar (tipo / severidad / estado) en cliente; la búsqueda global y los
  // filtros por columna los aplica la DataTable encima.
  const filtered = useMemo(() => {
    const type = filters.type as string | undefined;
    const severity = filters.severity as string | undefined;
    const statuses = (filters.status as string[] | undefined) ?? [];
    return all.filter((i) => {
      if (type && i.type !== type) return false;
      if (severity && i.severity !== severity) return false;
      if (statuses.length && !statuses.includes(i.status)) return false;
      return true;
    });
  }, [all, filters]);

  function refresh() {
    mutate();
    mutateKpis();
  }

  async function report() {
    if (form.title.trim().length < 3) {
      toast.error('Describe el incidente (mín. 3 caracteres).', 'EHS');
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/ehs/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo reportar.', 'EHS');
        return;
      }
      toast.success('Incidente reportado.', 'EHS');
      setShowForm(false);
      setForm({ title: '', type: 'NEAR_MISS', severity: 'LOW', area: '', location: '' });
      refresh();
    } catch {
      toast.error('Error de red.', 'EHS');
    } finally {
      setBusy(false);
    }
  }

  if (forbidden) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-foreground">
        <div className={`${glass} max-w-sm rounded-3xl p-10 text-center`}>
          <Lock className="mx-auto mb-3 h-8 w-8 text-gray-500 dark:text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Inicia sesión para ver EHS.</p>
        </div>
      </div>
    );
  }

  const daysSafe = kpis?.daysSinceLastRecordable;
  const daysSafeColor = daysSafe === null || daysSafe === undefined ? GREEN : daysSafe > 30 ? GREEN : daysSafe > 7 ? AMBER : RED;
  const capaOverdue = kpis?.capaOverdue ?? 0;
  const capaDueSoon = kpis?.capaDueSoon ?? 0;

  const kpiItems: StatCardProps[] = [
    {
      label: 'Días sin registrable',
      value: daysSafe === null || daysSafe === undefined ? '—' : daysSafe,
      sublabel: daysSafe === null || daysSafe === undefined ? 'sin registrables' : 'desde el último',
      color: daysSafeColor,
      icon: HeartPulse,
    },
    { label: 'Abiertos', value: kpis?.open ?? 0, sublabel: `${kpis?.total ?? 0} en total`, color: (kpis?.open ?? 0) > 0 ? AMBER : GREEN, icon: Activity },
    { label: 'Registrables', value: kpis?.recordableCount ?? 0, sublabel: `${kpis?.lostTimeCount ?? 0} con tiempo perdido`, color: (kpis?.recordableCount ?? 0) > 0 ? RED : GREEN, icon: AlertTriangle },
    { label: 'Días perdidos', value: `${kpis?.totalLostDays ?? 0} d`, color: (kpis?.totalLostDays ?? 0) > 0 ? ORANGE : GREEN, icon: HeartPulse },
    { label: 'Casi-accidentes', value: kpis?.nearMissCount ?? 0, sublabel: 'reportados', color: VIOLET, icon: ShieldAlert },
    {
      label: 'CAPAs vencidas',
      value: capaOverdue,
      sublabel: capaDueSoon > 0 ? `${capaDueSoon} por vencer (7d)` : 'acciones correctivas',
      color: capaOverdue > 0 ? RED : capaDueSoon > 0 ? AMBER : GREEN,
      icon: ClipboardCheck,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 pb-24 text-foreground md:px-8">
      <Toolbar
        domain="people"
        icon={ShieldAlert}
        title="EHS · Seguridad y Medio Ambiente"
        subtitle="Repositorio de incidentes, investigación de causa raíz y acciones correctivas (CAPA)"
        actions={
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ background: ROSE }}
          >
            <Plus className="h-4 w-4" /> Reportar
          </button>
        }
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar incidentes…"
            aria-label="Buscar incidentes"
            className="h-9 w-56 rounded-xl border border-black/10 bg-black/[0.03] pl-8 pr-3 text-sm outline-none transition-colors focus:border-[#ff4d8d] dark:border-white/10 dark:bg-white/[0.04]"
          />
        </div>
        <FilterBar defs={FILTER_DEFS} value={filters} onChange={setFilters} />
        <div className="ml-auto">
          <ExportButton<Incident> rows={exportRows} columns={EXPORT_COLUMNS} filename="incidentes-ehs" />
        </div>
      </Toolbar>

      <div className="mb-6">
        <KpiRow items={kpiItems} columns={6} />
      </div>

      <DataTable<Incident>
        data={filtered}
        columns={COLUMNS}
        getRowId={(i) => i.id}
        isLoading={isLoading}
        searchable={false}
        globalFilter={query}
        onGlobalFilterChange={setQuery}
        onFilteredRowsChange={setExportRows}
        onRowClick={(i) => router.push(`/dashboard/ehs/${i.id}`)}
        pageSize={10}
        emptyState={
          <EmptyState
            icon={ShieldAlert}
            accent={ROSE}
            title="Aún no hay incidentes registrados"
            description="EHS es la bitácora de seguridad de la planta: aquí se reportan casi-accidentes y lesiones, se investiga la causa raíz y se da seguimiento a las acciones correctivas hasta cerrarlas."
            hint={[
              'Reporta en segundos: qué pasó, tipo, severidad y dónde — sin fricción para el operador.',
              'Investiga con método: causa raíz y CAPA con responsable y fecha de compromiso.',
              'Vigila los indicadores: días sin registrable, registrables OSHA y CAPAs por vencer.',
            ]}
            primaryAction={{ label: 'Reportar incidente', icon: Plus, onClick: () => setShowForm(true) }}
          />
        }
      />

      {/* Alta rápida de incidente — en drawer (sin fricción para el reportante) */}
      <DetailDrawer
        open={showForm}
        onClose={() => setShowForm(false)}
        icon={ShieldAlert}
        accent={ROSE}
        title="Reportar incidente"
        subtitle="Se asigna folio INC- automáticamente"
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl px-4 py-2 text-sm font-medium text-gray-600 hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={report}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              style={{ background: ROSE }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Reportar
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <label className="block">
            <span className={FIELD_LABEL}>¿Qué pasó?</span>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Casi-caída por derrame de aceite en pasillo B" className={ehsInput} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className={FIELD_LABEL}>Tipo</span>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as IType })} className={ehsInput}>
                {(Object.keys(TYPE_LABEL) as IType[]).map((t) => (
                  <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={FIELD_LABEL}>Severidad</span>
              <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as Severity })} className={ehsInput}>
                {(Object.keys(SEV_LABEL) as Severity[]).map((s) => (
                  <option key={s} value={s}>{SEV_LABEL[s]}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className={FIELD_LABEL}>Área</span>
              <input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="SMT" className={ehsInput} />
            </label>
            <label className="block">
              <span className={FIELD_LABEL}>Ubicación</span>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Pasillo B" className={ehsInput} />
            </label>
          </div>
          <p className="flex items-start gap-2 text-[12px] text-gray-500 dark:text-gray-400">
            <Sprout className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: GREEN }} />
            La investigación (causa raíz y CAPA) se hace al abrir el incidente. Reportar toma segundos.
          </p>
        </div>
      </DetailDrawer>
    </div>
  );
}
