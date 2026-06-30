'use client';

import React, { useMemo, useState } from 'react';
import {
  Scale,
  Plus,
  Lock,
  Loader2,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Wallet,
  ArrowRight,
  CircleSlash,
  Building2,
  User,
  Repeat,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import {
  Toolbar,
  KpiRow,
  DataTable,
  FilterBar,
  ExportButton,
  DetailDrawer,
  DrawerSection,
  DrawerField,
  EmptyState,
  type StatCardProps,
  type FilterDef,
  type FilterValues,
  type DateRange,
  type ExportColumn,
} from '@/components/workspace';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const GREEN = '#10b981';
const AMBER = '#f59e0b';
const VIOLET = '#7c3aed';
const GRAY = '#6b7280';
const RED = '#ef4444';

type Status = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'CANCELLED';
type CType = 'CUSTOMER' | 'SUPPLIER' | 'NDA' | 'LEASE' | 'SERVICE' | 'OTHER';

interface Contract {
  id: string;
  folio: string | null;
  title: string;
  counterparty?: string | null;
  type: CType;
  status: Status;
  value: number;
  currency: string;
  ownerEmail?: string | null;
  autoRenew: boolean;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface Kpis {
  total: number;
  active: number;
  expiring30: number;
  expiring60: number;
  expiring90: number;
  expired: number;
  activeValue: number;
  currency: string;
}

const STATUS_META: Record<Status, { label: string; color: string }> = {
  DRAFT: { label: 'Borrador', color: GRAY },
  ACTIVE: { label: 'Activo', color: GREEN },
  EXPIRED: { label: 'Vencido', color: AMBER },
  TERMINATED: { label: 'Terminado', color: GRAY },
  CANCELLED: { label: 'Cancelado', color: RED },
};
const TYPE_LABEL: Record<CType, string> = {
  CUSTOMER: 'Cliente',
  SUPPLIER: 'Proveedor',
  NDA: 'NDA',
  LEASE: 'Arrendamiento',
  SERVICE: 'Servicios',
  OTHER: 'Otro',
};
// Misma máquina de estados que el backend (contract-state.ts). NO se altera.
const NEXT: Record<Status, Status[]> = {
  DRAFT: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['EXPIRED', 'TERMINATED'],
  EXPIRED: ['ACTIVE', 'TERMINATED'],
  TERMINATED: [],
  CANCELLED: [],
};
const ORDER: Status[] = ['ACTIVE', 'DRAFT', 'EXPIRED', 'TERMINATED', 'CANCELLED'];
const LIFECYCLE: Status[] = ['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED'];

function money(n: number, ccy: string): string {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: ccy || 'USD', maximumFractionDigits: 0 }).format(n || 0);
  } catch {
    return `${(n || 0).toLocaleString()} ${ccy}`;
  }
}
function daysLeft(end?: string | null): number | null {
  if (!end) return null;
  return Math.floor((new Date(end).getTime() - Date.now()) / 86_400_000);
}
function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
}
function isoDay(iso?: string | null): string {
  return iso ? iso.slice(0, 10) : '';
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

function DueBadge({ contract }: { contract: Contract }) {
  if (contract.status === 'TERMINATED' || contract.status === 'CANCELLED') {
    return <span className="text-gray-500 dark:text-gray-400">—</span>;
  }
  const dl = daysLeft(contract.endDate);
  if (dl === null) return <span className="text-gray-500 dark:text-gray-400">—</span>;
  if (dl < 0) {
    return <span className="font-medium tabular-nums" style={{ color: RED }}>Vencido</span>;
  }
  const color = dl < 30 ? AMBER : GRAY;
  return (
    <span className="tabular-nums" style={{ color, fontWeight: dl < 30 ? 600 : 400 }}>
      {dl}d
    </span>
  );
}

const COLUMNS: ColumnDef<Contract, unknown>[] = [
  {
    accessorKey: 'title',
    header: 'Título',
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-2">
        {row.original.folio && (
          <span className="shrink-0 rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 dark:bg-white/10">{row.original.folio}</span>
        )}
        <span className="truncate font-medium">{row.original.title}</span>
      </div>
    ),
    meta: { filterable: true, filterPlaceholder: 'Título…' },
  },
  {
    accessorKey: 'counterparty',
    header: 'Contraparte',
    cell: ({ getValue }) => <span className="text-gray-600 dark:text-gray-300">{(getValue() as string) || '—'}</span>,
    meta: { filterable: true, filterPlaceholder: 'Contraparte…' },
  },
  {
    accessorKey: 'type',
    header: 'Tipo',
    cell: ({ getValue }) => <span className="text-gray-600 dark:text-gray-300">{TYPE_LABEL[getValue() as CType]}</span>,
  },
  {
    id: 'value',
    accessorFn: (c) => c.value ?? 0,
    header: 'Valor',
    cell: ({ row }) => <span className="tabular-nums">{money(row.original.value, row.original.currency)}</span>,
    meta: { align: 'right' },
  },
  {
    id: 'startDate',
    accessorFn: (c) => isoDay(c.startDate),
    header: 'Inicio',
    cell: ({ row }) => <span className="text-gray-500 dark:text-gray-400">{fmtDate(row.original.startDate)}</span>,
  },
  {
    id: 'endDate',
    accessorFn: (c) => isoDay(c.endDate),
    header: 'Fin',
    cell: ({ row }) => <span className="text-gray-500 dark:text-gray-400">{fmtDate(row.original.endDate)}</span>,
  },
  {
    id: 'status',
    accessorFn: (c) => c.status,
    header: 'Estado',
    cell: ({ row }) => <StatusPill status={row.original.status} />,
  },
  {
    id: 'due',
    accessorFn: (c) => daysLeft(c.endDate) ?? Number.MAX_SAFE_INTEGER,
    header: 'Vence',
    cell: ({ row }) => <DueBadge contract={row.original} />,
    meta: { align: 'right' },
  },
];

const FILTER_DEFS: FilterDef[] = [
  { key: 'type', type: 'select', label: 'Tipo', options: (Object.keys(TYPE_LABEL) as CType[]).map((t) => ({ value: t, label: TYPE_LABEL[t] })) },
  { key: 'status', type: 'pill', label: 'Estado', options: ORDER.map((s) => ({ value: s, label: STATUS_META[s].label, color: STATUS_META[s].color })) },
  { key: 'end', type: 'daterange', label: 'Vence' },
];

const EXPORT_COLUMNS: ExportColumn<Contract>[] = [
  { key: 'folio', header: 'Folio' },
  { key: 'title', header: 'Título' },
  { key: 'counterparty', header: 'Contraparte' },
  { key: 'type', header: 'Tipo', value: (c) => TYPE_LABEL[c.type] },
  { key: 'status', header: 'Estado', value: (c) => STATUS_META[c.status].label },
  { key: 'value', header: 'Valor', value: (c) => c.value ?? 0 },
  { key: 'currency', header: 'Moneda' },
  { key: 'startDate', header: 'Inicio', value: (c) => isoDay(c.startDate) },
  { key: 'endDate', header: 'Fin', value: (c) => isoDay(c.endDate) },
  { key: 'due', header: 'Días para vencer', value: (c) => daysLeft(c.endDate) ?? '' },
  { key: 'ownerEmail', header: 'Responsable' },
  { key: 'autoRenew', header: 'Auto-renueva', value: (c) => (c.autoRenew ? 'Sí' : 'No') },
];

const INPUT =
  'w-full rounded-xl border border-black/10 bg-black/[0.03] px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary dark:border-white/10 dark:bg-white/[0.04]';
const FIELD_LABEL = 'mb-1 block text-[12px] font-medium text-gray-500 dark:text-gray-400';

export default function LegalPage() {
  const { data, isLoading, forbidden, mutate } = useApi<Contract[]>('/legal/contracts');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/legal/kpis');
  const toast = useToast();
  const confirm = useConfirm();

  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<FilterValues>({});
  const [exportRows, setExportRows] = useState<Contract[]>([]);
  const [form, setForm] = useState({
    title: '',
    counterparty: '',
    type: 'CUSTOMER' as CType,
    value: 0,
    currency: 'USD',
    startDate: '',
    endDate: '',
  });

  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const selected = useMemo(() => list.find((c) => c.id === selectedId) ?? null, [list, selectedId]);

  // FilterBar (tipo / estado / rango de vencimiento) aplicado en el cliente; la
  // búsqueda global y los filtros por columna los aplica la DataTable encima.
  const filtered = useMemo(() => {
    const type = filters.type as string | undefined;
    const statuses = (filters.status as string[] | undefined) ?? [];
    const range = filters.end as DateRange | undefined;
    return list.filter((c) => {
      if (type && c.type !== type) return false;
      if (statuses.length && !statuses.includes(c.status)) return false;
      if (range && (range.from || range.to)) {
        const d = isoDay(c.endDate);
        if (!d) return false;
        if (range.from && d < range.from) return false;
        if (range.to && d > range.to) return false;
      }
      return true;
    });
  }, [list, filters]);

  function refresh() {
    mutate();
    mutateKpis();
  }

  async function createContract() {
    if (form.title.trim().length < 3) {
      toast.error('El título debe tener al menos 3 caracteres.', 'Legal');
      return;
    }
    setBusy('new');
    try {
      const res = await apiFetch(`${API_BASE}/legal/contracts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, startDate: form.startDate || undefined, endDate: form.endDate || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo crear.', 'Legal');
        return;
      }
      toast.success('Contrato creado.', 'Legal');
      setShowForm(false);
      setForm({ title: '', counterparty: '', type: 'CUSTOMER', value: 0, currency: 'USD', startDate: '', endDate: '' });
      refresh();
    } catch {
      toast.error('Error de red.', 'Legal');
    } finally {
      setBusy(null);
    }
  }

  async function transition(c: Contract, status: Status) {
    const body: Record<string, unknown> = { status };
    if (status === 'ACTIVE' && c.status === 'EXPIRED') {
      const nd = window.prompt('Nueva fecha de fin (renovación, YYYY-MM-DD):', isoDay(c.endDate));
      if (nd === null) return;
      if (nd) body.endDate = nd;
    } else {
      const terminal = status === 'CANCELLED' || status === 'TERMINATED';
      const ok = await confirm({
        title: `Mover a ${STATUS_META[status].label}`,
        message: `¿Cambiar el contrato “${c.title}” al estado ${STATUS_META[status].label}?`,
        confirmLabel: STATUS_META[status].label,
        tone: terminal ? 'danger' : 'default',
      });
      if (!ok) return;
    }
    setBusy(c.id);
    try {
      const res = await apiFetch(`${API_BASE}/legal/contracts/${c.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo actualizar.', 'Legal');
        return;
      }
      toast.success(`→ ${STATUS_META[status].label}`, 'Legal');
      refresh();
    } catch {
      toast.error('Error de red.', 'Legal');
    } finally {
      setBusy(null);
    }
  }

  if (forbidden) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-foreground">
        <div className={`${glass} max-w-sm rounded-3xl p-10 text-center`}>
          <Lock className="mx-auto mb-3 h-8 w-8 text-gray-500 dark:text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Inicia sesión para ver contratos.</p>
        </div>
      </div>
    );
  }

  const expiringTotal = (kpis?.expiring30 ?? 0) + (kpis?.expiring60 ?? 0) + (kpis?.expiring90 ?? 0);
  const kpiItems: StatCardProps[] = [
    { label: 'Contratos activos', value: kpis?.active ?? 0, color: GREEN, icon: CheckCircle2 },
    { label: 'Por vencer (90d)', value: expiringTotal, sublabel: `${kpis?.expiring30 ?? 0} en 30d`, color: expiringTotal > 0 ? AMBER : GREEN, icon: AlertTriangle },
    { label: 'Vencidos', value: kpis?.expired ?? 0, color: (kpis?.expired ?? 0) > 0 ? RED : GREEN, icon: Clock },
    { label: 'Valor activo', value: money(kpis?.activeValue ?? 0, kpis?.currency ?? 'USD'), color: VIOLET, icon: Wallet },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 pb-24 text-foreground md:px-8">
      <Toolbar
        domain="office"
        icon={Scale}
        title="Legal · Contratos"
        subtitle="Repositorio de contratos y alertas de vencimiento"
        actions={
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ background: VIOLET }}
          >
            <Plus className="h-4 w-4" /> Nuevo contrato
          </button>
        }
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar contratos…"
            aria-label="Buscar contratos"
            className="h-9 w-56 rounded-xl border border-black/10 bg-black/[0.03] pl-8 pr-3 text-sm outline-none transition-colors focus:border-primary dark:border-white/10 dark:bg-white/[0.04]"
          />
        </div>
        <FilterBar defs={FILTER_DEFS} value={filters} onChange={setFilters} />
        <div className="ml-auto">
          <ExportButton<Contract> rows={exportRows} columns={EXPORT_COLUMNS} filename="contratos-legal" />
        </div>
      </Toolbar>

      <div className="mb-6">
        <KpiRow items={kpiItems} columns={4} />
      </div>

      <DataTable<Contract>
        data={filtered}
        columns={COLUMNS}
        getRowId={(c) => c.id}
        isLoading={isLoading}
        searchable={false}
        globalFilter={query}
        onGlobalFilterChange={setQuery}
        onFilteredRowsChange={setExportRows}
        onRowClick={(c) => setSelectedId(c.id)}
        pageSize={10}
        emptyState={
          <EmptyState
            icon={Scale}
            accent={VIOLET}
            title="Sin contratos todavía"
            description="Repositorio de contratos y alertas de vencimiento: centraliza acuerdos con clientes, proveedores, NDAs y arrendamientos, y vigila sus fechas de fin."
            hint={[
              'Controla el portafolio: valor activo, por vencer y vencidos de un vistazo.',
              'Anticipa renovaciones con alertas a 30 / 60 / 90 días.',
              'Gobierna el ciclo de vida: borrador → activo → vencido → renovación o término.',
            ]}
            primaryAction={{ label: 'Nuevo contrato', icon: Plus, onClick: () => setShowForm(true) }}
          />
        }
      />

      {/* Detalle del contrato */}
      <DetailDrawer
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        icon={Scale}
        accent={VIOLET}
        title={selected?.title ?? 'Contrato'}
        subtitle={selected?.folio ?? undefined}
        actions={
          selected &&
          (NEXT[selected.status].length > 0 ? (
            NEXT[selected.status].map((to) => {
              const terminal = to === 'CANCELLED' || to === 'TERMINATED';
              return (
                <button
                  key={to}
                  type="button"
                  disabled={busy === selected.id}
                  onClick={() => transition(selected, to)}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: `${STATUS_META[to].color}1f`, color: STATUS_META[to].color }}
                >
                  {busy === selected.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : terminal ? (
                    <CircleSlash className="h-4 w-4" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {STATUS_META[to].label}
                </button>
              );
            })
          ) : (
            <span className="text-[13px] text-gray-500 dark:text-gray-400">Estado terminal — sin transiciones.</span>
          ))
        }
      >
        {selected && (
          <>
            <DrawerSection title="Detalle">
              <DrawerField label="Estado">
                <StatusPill status={selected.status} />
              </DrawerField>
              <DrawerField label="Tipo">{TYPE_LABEL[selected.type]}</DrawerField>
              <DrawerField label="Contraparte">{selected.counterparty || '—'}</DrawerField>
              <DrawerField label="Valor">{money(selected.value, selected.currency)}</DrawerField>
              <DrawerField label="Inicio">{fmtDate(selected.startDate)}</DrawerField>
              <DrawerField label="Fin">{fmtDate(selected.endDate)}</DrawerField>
              <DrawerField label="Vence">
                <DueBadge contract={selected} />
              </DrawerField>
              <DrawerField label="Auto-renueva">
                <span className="inline-flex items-center gap-1.5">
                  <Repeat className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                  {selected.autoRenew ? 'Sí' : 'No'}
                </span>
              </DrawerField>
              {selected.notes && <DrawerField label="Notas">{selected.notes}</DrawerField>}
            </DrawerSection>

            <DrawerSection title="Ciclo de vida">
              <StatusTimeline contract={selected} />
            </DrawerSection>

            <DetailDrawerRelated contract={selected} />
          </>
        )}
      </DetailDrawer>

      {/* Alta de contrato — en drawer, no inline */}
      <DetailDrawer
        open={showForm}
        onClose={() => setShowForm(false)}
        icon={Plus}
        accent={VIOLET}
        title="Nuevo contrato"
        subtitle="Se asigna folio CON- automáticamente"
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
              onClick={createContract}
              disabled={busy === 'new'}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              style={{ background: VIOLET }}
            >
              {busy === 'new' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Crear
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <label className="block">
            <span className={FIELD_LABEL}>Título</span>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Acuerdo de suministro EMS — Cliente A" className={INPUT} />
          </label>
          <label className="block">
            <span className={FIELD_LABEL}>Contraparte</span>
            <input value={form.counterparty} onChange={(e) => setForm({ ...form, counterparty: e.target.value })} placeholder="Cliente A" className={INPUT} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className={FIELD_LABEL}>Tipo</span>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CType })} className={INPUT}>
                {(Object.keys(TYPE_LABEL) as CType[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={FIELD_LABEL}>Valor</span>
              <input type="number" min={0} value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} className={INPUT} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className={FIELD_LABEL}>Moneda</span>
              <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })} className={INPUT} />
            </label>
            <label className="block">
              <span className={FIELD_LABEL}>Inicio</span>
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={INPUT} />
            </label>
          </div>
          <label className="block">
            <span className={FIELD_LABEL}>Fin (vencimiento)</span>
            <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={INPUT} />
          </label>
        </div>
      </DetailDrawer>
    </div>
  );
}

function StatusTimeline({ contract }: { contract: Contract }) {
  if (contract.status === 'CANCELLED') {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium" style={{ background: `${GRAY}1f`, color: GRAY }}>Borrador</span>
        <span className="text-gray-300 dark:text-gray-600">→</span>
        <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium" style={{ background: `${RED}1f`, color: RED }}>
          <CircleSlash className="h-3 w-3" /> Cancelado
        </span>
      </div>
    );
  }
  const idx = LIFECYCLE.indexOf(contract.status);
  return (
    <div className="flex items-center">
      {LIFECYCLE.map((s, i) => {
        const done = i <= idx;
        const color = STATUS_META[s].color;
        return (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center gap-1">
              <span
                className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold"
                style={done ? { background: color, color: '#fff' } : { background: 'rgba(120,120,120,0.15)', color: GRAY }}
              >
                {i + 1}
              </span>
              <span className="text-[10px]" style={{ color: done ? color : GRAY }}>{STATUS_META[s].label}</span>
            </div>
            {i < LIFECYCLE.length - 1 && (
              <span className="mx-1 mb-4 h-0.5 flex-1" style={{ background: i < idx ? STATUS_META[LIFECYCLE[i + 1]].color : 'rgba(120,120,120,0.2)' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function DetailDrawerRelated({ contract }: { contract: Contract }) {
  return (
    <DrawerSection title="Relacionados">
      <div className="space-y-2">
        <div className={`${glass} flex items-center gap-3 rounded-xl p-3`}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/5 text-gray-500 dark:bg-white/10">
            <Building2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Contraparte</div>
            <div className="truncate text-sm font-medium">{contract.counterparty || '—'}</div>
          </div>
        </div>
        <div className={`${glass} flex items-center gap-3 rounded-xl p-3`}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/5 text-gray-500 dark:bg-white/10">
            <User className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Responsable</div>
            <div className="truncate text-sm font-medium">{contract.ownerEmail || '—'}</div>
          </div>
        </div>
      </div>
    </DrawerSection>
  );
}
