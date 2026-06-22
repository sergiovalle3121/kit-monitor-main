'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, Lock, Truck, Plus, X, CheckCircle2, ShieldCheck, ShieldAlert,
  AlertTriangle, ChevronRight, FileWarning, ArrowRight,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/contexts/ToastContext';
import {
  Toolbar, KpiRow, DataTable, FilterBar, ExportButton, EmptyState,
  type StatCardProps, type FilterDef, type FilterValues, type ExportColumn,
} from '@/components/workspace';
import {
  supApi, supInput, QUAL_META, RISK_META, TYPE_LABEL, SCAR_STATUS_META, SCAR_SEV_META,
  scoreColor, otdColor, ppmColor,
  type Supplier, type SupplierKpis, type ScarRow,
} from '@/lib/suppliers';

const BLUE = '#3b82f6';
const QUALS = ['APPROVED', 'CONDITIONAL', 'PENDING', 'DISQUALIFIED'];
const TYPES = ['COMPONENT', 'CONTRACT', 'SERVICE', 'DISTRIBUTOR', 'RAW_MATERIAL'];
const RISKS = ['LOW', 'MEDIUM', 'HIGH'];

/** Un proveedor está "en riesgo" si su riesgo compuesto es alto o su OTD cae <90%. */
function isAtRisk(s: Supplier): boolean {
  return s.riskLevel === 'HIGH' || (s.otdPct != null && s.otdPct < 90);
}

function QualPill({ status }: { status?: string }) {
  const m = QUAL_META[status || 'PENDING'] ?? QUAL_META.PENDING;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium" style={{ background: `${m.color}1f`, color: m.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

const COLUMNS: ColumnDef<Supplier, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Proveedor',
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 dark:bg-white/10">{row.original.code}</span>
        <span className="truncate font-medium">{row.original.name}</span>
        {row.original.singleSource && (
          <span title="Sole-source — punto único de falla" className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-500">
            <AlertTriangle className="h-2.5 w-2.5" /> sole-source
          </span>
        )}
      </div>
    ),
    meta: { filterable: true, filterPlaceholder: 'Nombre o código…' },
  },
  {
    accessorKey: 'type',
    header: 'Tipo',
    cell: ({ getValue }) => <span className="text-gray-600 dark:text-gray-300">{TYPE_LABEL[(getValue() as string) || 'COMPONENT'] ?? (getValue() as string)}</span>,
  },
  {
    accessorKey: 'commodity',
    header: 'Commodity',
    cell: ({ getValue }) => <span className="text-gray-600 dark:text-gray-300">{(getValue() as string) || '—'}</span>,
    meta: { filterable: true, filterPlaceholder: 'Commodity…' },
  },
  {
    id: 'country',
    accessorFn: (s) => `${s.country ?? ''} ${s.region ?? ''}`.trim(),
    header: 'Origen',
    cell: ({ row }) => (
      <span className="text-gray-500 dark:text-gray-400">
        {row.original.country || '—'}{row.original.region ? ` · ${row.original.region}` : ''}
      </span>
    ),
  },
  {
    id: 'qualification',
    accessorFn: (s) => s.qualificationStatus || 'PENDING',
    header: 'Calificación',
    cell: ({ row }) => <QualPill status={row.original.qualificationStatus} />,
  },
  {
    id: 'otd',
    accessorFn: (s) => s.otdPct ?? -1,
    header: 'OTD',
    cell: ({ row }) => <span className="tabular-nums font-medium" style={{ color: otdColor(row.original.otdPct) }}>{row.original.otdPct != null ? `${row.original.otdPct}%` : '—'}</span>,
    meta: { align: 'right' },
  },
  {
    id: 'ppm',
    accessorFn: (s) => s.ppm ?? -1,
    header: 'PPM',
    cell: ({ row }) => <span className="tabular-nums" style={{ color: ppmColor(row.original.ppm) }}>{row.original.ppm != null ? row.original.ppm : '—'}</span>,
    meta: { align: 'right' },
  },
  {
    id: 'quality',
    accessorFn: (s) => s.qualityScore ?? 0,
    header: 'Calidad',
    cell: ({ row }) => <span className="tabular-nums" style={{ color: scoreColor(row.original.qualityScore ?? 0) }}>{Math.round(row.original.qualityScore ?? 0)}%</span>,
    meta: { align: 'right' },
  },
  {
    id: 'lead',
    accessorFn: (s) => s.leadTimeDays ?? Number.MAX_SAFE_INTEGER,
    header: 'Lead time',
    cell: ({ row }) => <span className="tabular-nums text-gray-500 dark:text-gray-400">{row.original.leadTimeDays != null ? `${row.original.leadTimeDays}d` : '—'}</span>,
    meta: { align: 'right' },
  },
  {
    id: 'risk',
    accessorFn: (s) => s.riskLevel || 'LOW',
    header: 'Riesgo',
    cell: ({ row }) => {
      const m = RISK_META[row.original.riskLevel || 'LOW'] ?? RISK_META.LOW;
      return <span className="inline-flex items-center gap-1 text-[12px] font-medium" style={{ color: m.color }}><ShieldCheck className="h-3.5 w-3.5" />{m.label}</span>;
    },
  },
];

const FILTER_DEFS: FilterDef[] = [
  { key: 'qualification', type: 'pill', label: 'Calificación', options: QUALS.map((q) => ({ value: q, label: QUAL_META[q].label, color: QUAL_META[q].color })) },
  { key: 'type', type: 'select', label: 'Tipo', options: TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] })) },
  { key: 'risk', type: 'select', label: 'Riesgo', options: RISKS.map((r) => ({ value: r, label: RISK_META[r].label })) },
  { key: 'flags', type: 'pill', label: 'Señales', options: [
    { value: 'atrisk', label: 'En riesgo', color: '#ef4444' },
    { value: 'sole', label: 'Sole-source', color: '#f59e0b' },
  ] },
];

const EXPORT_COLUMNS: ExportColumn<Supplier>[] = [
  { key: 'code', header: 'Código' },
  { key: 'name', header: 'Proveedor' },
  { key: 'legalName', header: 'Razón social' },
  { key: 'type', header: 'Tipo', value: (s) => TYPE_LABEL[s.type || 'COMPONENT'] ?? s.type ?? '' },
  { key: 'commodity', header: 'Commodity' },
  { key: 'country', header: 'País' },
  { key: 'region', header: 'Región' },
  { key: 'qualificationStatus', header: 'Calificación', value: (s) => QUAL_META[s.qualificationStatus || 'PENDING']?.label ?? '' },
  { key: 'status', header: 'Estatus' },
  { key: 'otdPct', header: 'OTD %', value: (s) => s.otdPct ?? '' },
  { key: 'ppm', header: 'PPM', value: (s) => s.ppm ?? '' },
  { key: 'qualityScore', header: 'Calidad %', value: (s) => Math.round(s.qualityScore ?? 0) },
  { key: 'responsivenessScore', header: 'Respuesta', value: (s) => s.responsivenessScore ?? '' },
  { key: 'riskLevel', header: 'Riesgo', value: (s) => RISK_META[s.riskLevel || 'LOW']?.label ?? '' },
  { key: 'singleSource', header: 'Sole-source', value: (s) => (s.singleSource ? 'Sí' : 'No') },
  { key: 'leadTimeDays', header: 'Lead time (d)', value: (s) => s.leadTimeDays ?? '' },
  { key: 'paymentTerms', header: 'Términos' },
  { key: 'incoterm', header: 'Incoterm' },
  { key: 'ownerEmail', header: 'SQE / comprador' },
];

export default function SuppliersPage() {
  const router = useRouter();
  const { data, isLoading, forbidden, mutate } = useApi<Supplier[]>('/suppliers');
  const { data: kpis } = useApi<SupplierKpis>('/suppliers/kpis');
  const { data: scars } = useApi<ScarRow[]>('/suppliers/scars');
  const all = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<FilterValues>({});
  const [exportRows, setExportRows] = useState<Supplier[]>([]);
  const [showNew, setShowNew] = useState(false);

  // FilterBar (calificación / tipo / riesgo / señales) en cliente; la búsqueda
  // global y los filtros por columna los aplica la DataTable encima.
  const filtered = useMemo(() => {
    const quals = (filters.qualification as string[] | undefined) ?? [];
    const type = filters.type as string | undefined;
    const risk = filters.risk as string | undefined;
    const flags = (filters.flags as string[] | undefined) ?? [];
    return all.filter((s) => {
      if (quals.length && !quals.includes(s.qualificationStatus || 'PENDING')) return false;
      if (type && (s.type || 'COMPONENT') !== type) return false;
      if (risk && (s.riskLevel || 'LOW') !== risk) return false;
      if (flags.includes('atrisk') && !isAtRisk(s)) return false;
      if (flags.includes('sole') && !s.singleSource) return false;
      return true;
    });
  }, [all, filters]);

  const openScars = useMemo(
    () => (Array.isArray(scars) ? scars.filter((s) => (SCAR_STATUS_META[s.status]?.open ?? true)) : []),
    [scars],
  );

  if (forbidden) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-black dark:text-white">
        <div className={`${glass} max-w-sm rounded-3xl p-10 text-center`}>
          <Lock className="mx-auto mb-3 h-8 w-8 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="mt-1 text-sm text-gray-400">Inicia sesión para ver la lista de proveedores.</p>
        </div>
      </div>
    );
  }

  const atRiskN = kpis?.atRisk ?? all.filter(isAtRisk).length;
  const kpiItems: StatCardProps[] = [
    { label: 'Proveedores', value: kpis?.total ?? all.length, sublabel: `${kpis?.approved ?? 0} aprobados`, color: BLUE, icon: Truck },
    { label: 'OTD prom.', value: kpis?.avgOtd != null ? `${kpis.avgOtd}%` : '—', color: otdColor(kpis?.avgOtd), icon: CheckCircle2 },
    { label: 'PPM prom.', value: kpis?.avgPpm != null ? String(kpis.avgPpm) : '—', color: ppmColor(kpis?.avgPpm), icon: ShieldCheck },
    { label: 'En riesgo', value: atRiskN, sublabel: `${kpis?.singleSource ?? 0} sole-source`, color: atRiskN ? '#ef4444' : '#10b981', icon: ShieldAlert },
    { label: 'Certs por vencer', value: kpis?.expiringCerts ?? 0, color: (kpis?.expiringCerts ?? 0) ? '#f59e0b' : '#10b981', icon: AlertTriangle },
    { label: 'SCARs abiertas', value: kpis?.openScars ?? openScars.length, color: (kpis?.openScars ?? openScars.length) ? '#f59e0b' : '#10b981', icon: FileWarning },
  ];

  const flagsActive = (filters.flags as string[] | undefined) ?? [];

  return (
    <div className="mx-auto max-w-6xl px-6 pb-24 text-black md:px-8 dark:text-white">
      <Toolbar
        domain="logistics"
        icon={Truck}
        title="Proveedores · AVL"
        subtitle="Lista de proveedores aprobados, scorecard de calidad/OTD y riesgo de suministro"
        actions={
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ background: BLUE }}
          >
            <Plus className="h-4 w-4" /> Nuevo proveedor
          </button>
        }
      >
        <FilterBar defs={FILTER_DEFS} value={filters} onChange={setFilters} />
        <div className="ml-auto">
          <ExportButton<Supplier> rows={exportRows} columns={EXPORT_COLUMNS} filename="proveedores-avl" />
        </div>
      </Toolbar>

      <div className="mb-5">
        <KpiRow items={kpiItems} columns={6} />
      </div>

      {/* Alerta accionable: proveedores en riesgo → filtra la tabla */}
      {atRiskN > 0 && !flagsActive.includes('atrisk') && (
        <button
          type="button"
          onClick={() => setFilters({ ...filters, flags: Array.from(new Set([...flagsActive, 'atrisk'])) })}
          className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-left transition-colors hover:bg-red-500/[0.1]"
        >
          <ShieldAlert className="h-5 w-5 shrink-0 text-red-500" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-red-600 dark:text-red-300">{atRiskN} proveedor{atRiskN === 1 ? '' : 'es'} en riesgo</div>
            <div className="text-[12px] text-red-500/80">Riesgo alto u OTD por debajo de 90%. Revisa scorecard y plan de contención.</div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-red-600 dark:text-red-300">Ver en riesgo <ArrowRight className="h-3.5 w-3.5" /></span>
        </button>
      )}

      <DataTable<Supplier>
        data={filtered}
        columns={COLUMNS}
        getRowId={(s) => String(s.id)}
        isLoading={isLoading}
        searchable
        searchPlaceholder="Buscar código, nombre, commodity o país…"
        globalFilter={query}
        onGlobalFilterChange={setQuery}
        onFilteredRowsChange={setExportRows}
        onRowClick={(s) => router.push(`/dashboard/suppliers/${s.id}`)}
        pageSize={12}
        emptyState={
          <EmptyState
            icon={Truck}
            accent={BLUE}
            title="Construye tu Lista de Proveedores Aprobados (AVL)"
            description="El AVL es la columna vertebral de la cadena de suministro EMS: qué proveedores están aprobados, para qué partes y con qué desempeño de calidad y entrega."
            hint={[
              'Califica proveedores (aprobado / condicional) y vigila los sole-source.',
              'Sigue el scorecard: OTD, PPM y respuesta a SCAR de un vistazo.',
              'Anticipa el riesgo: certificaciones por vencer y proveedores en riesgo.',
            ]}
            primaryAction={{ label: 'Nuevo proveedor', icon: Plus, onClick: () => setShowNew(true) }}
          />
        }
      />

      {/* SCARs abiertas — respuesta a NCR del proveedor (surface /suppliers/scars) */}
      {openScars.length > 0 && (
        <ScarsPanel scars={openScars} onOpen={(sid) => router.push(`/dashboard/suppliers/${sid}`)} />
      )}

      {showNew && <NewSupplierModal onClose={() => setShowNew(false)} onCreated={(s) => { setShowNew(false); mutate(); router.push(`/dashboard/suppliers/${s.id}`); }} />}
    </div>
  );
}

function ScarsPanel({ scars, onOpen }: { scars: ScarRow[]; onOpen: (supplierId: number) => void }) {
  const shown = scars.slice(0, 8);
  return (
    <section className="mt-8">
      <div className="mb-2 flex items-center gap-2">
        <FileWarning className="h-4 w-4 text-amber-500" />
        <h2 className="text-sm font-semibold">SCARs abiertas · respuesta a proveedor</h2>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-300">{scars.length}</span>
      </div>
      <div className={`${glass} divide-y divide-black/5 overflow-hidden rounded-2xl dark:divide-white/10`}>
        {shown.map((s) => {
          const st = SCAR_STATUS_META[s.status] ?? { label: s.status, color: '#6b7280' };
          const sev = SCAR_SEV_META[s.severity] ?? { label: s.severity, color: '#6b7280' };
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => s.supplier && onOpen(s.supplier.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.04]"
            >
              <span className="shrink-0 rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 dark:bg-white/10">{s.scarNumber}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{s.issueSummary || s.partNumber}</div>
                <div className="truncate text-[12px] text-gray-400">
                  {s.supplier?.name ?? 'Proveedor'} · parte {s.partNumber}{s.quantityAffected ? ` · ${s.quantityAffected} pzas` : ''}
                </div>
              </div>
              <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `${sev.color}1f`, color: sev.color }}>{sev.label}</span>
              <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `${st.color}1f`, color: st.color }}>{st.label}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function NewSupplierModal({ onClose, onCreated }: { onClose: () => void; onCreated: (s: Supplier) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ code: '', name: '', type: 'COMPONENT', commodity: '', country: '', region: 'NAM', qualificationStatus: 'PENDING', paymentTerms: 'NET30', incoterm: 'FCA', leadTimeDays: 30, ownerEmail: '' });
  async function submit() {
    if (!f.code.trim() || !f.name.trim()) { toast.error('Código y nombre requeridos.', 'Proveedores'); return; }
    setBusy(true);
    try {
      const s = await supApi.create({ ...f, leadTimeDays: Number(f.leadTimeDays) || undefined } as Partial<Supplier>);
      toast.success('Proveedor creado.', 'Proveedores'); onCreated(s);
    } catch { toast.error('No se pudo crear.', 'Proveedores'); } finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16 backdrop-blur-sm" onClick={onClose}>
      <div className={`${glass} w-full max-w-2xl rounded-3xl p-6`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between"><h3 className="text-lg font-semibold">Nuevo proveedor</h3><button onClick={onClose} className="rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/10"><X className="h-4 w-4" /></button></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <L label="Código"><input className={supInput} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="AX-SUP-ACME" /></L>
          <L label="Nombre"><input className={supInput} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></L>
          <L label="Tipo"><select className={supInput} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select></L>
          <L label="Commodity"><input className={supInput} value={f.commodity} onChange={(e) => setF({ ...f, commodity: e.target.value })} placeholder="Pasivos" /></L>
          <L label="País"><input className={supInput} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} /></L>
          <L label="Región"><select className={supInput} value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })}>{['NAM', 'LATAM', 'EMEA', 'APAC'].map((r) => <option key={r}>{r}</option>)}</select></L>
          <L label="Calificación"><select className={supInput} value={f.qualificationStatus} onChange={(e) => setF({ ...f, qualificationStatus: e.target.value })}>{QUALS.map((qz) => <option key={qz} value={qz}>{QUAL_META[qz].label}</option>)}</select></L>
          <L label="Lead time (días)"><input type="number" className={supInput} value={f.leadTimeDays} onChange={(e) => setF({ ...f, leadTimeDays: Number(e.target.value) })} /></L>
          <L label="Términos de pago"><input className={supInput} value={f.paymentTerms} onChange={(e) => setF({ ...f, paymentTerms: e.target.value })} /></L>
          <L label="SQE / comprador (email)"><input className={supInput} value={f.ownerEmail} onChange={(e) => setF({ ...f, ownerEmail: e.target.value })} /></L>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
          <button onClick={submit} disabled={busy} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: BLUE }}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Guardar</button>
        </div>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[12px] font-medium text-gray-500">{label}</span>{children}</label>;
}
