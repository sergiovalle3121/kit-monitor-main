'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ClipboardList, Plus, Upload, ChevronDown, ChevronRight, CheckCircle2, XCircle,
  Play, Loader2, AlertTriangle, Clock, Flame, Inbox, ArrowRight, HandMetal, X, RefreshCw, Boxes,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';
import { useDashboardSession } from '@/hooks/useDashboardSession';
import {
  Toolbar, KpiRow, FilterBar, ExportButton, EmptyState,
  type StatCardProps, type FilterDef, type FilterValues, type ExportColumn,
} from '@/components/workspace';
import {
  API_BASE, BLUE, TEAL, AMBER, GREEN, GRAY, RED, inputCls,
  type Pull, TYPE_META, STATUS_META, TYPES, STATUSES,
  computeAgingMinutes, isSlaBreached, pullSemaphore, SEMAPHORE_COLOR, effectiveSla,
  formatAging, fmtQty, fmtTime, isOpen,
} from './shared';
import CsvImportPanel from './CsvImportPanel';

const PULL_SORT: Record<string, number> = { in_progress: 0, pending: 1, completed: 2, cancelled: 3 };

interface PullForm {
  project: string; partNumber: string; quantity: string; fromWarehouseId: string;
  toLocation: string; requestor: string; slaMinutes: string; urgent: boolean; referenceId: string;
}
const EMPTY_FORM: PullForm = {
  project: '', partNumber: '', quantity: '', fromWarehouseId: '', toLocation: '',
  requestor: '', slaMinutes: '120', urgent: false, referenceId: '',
};

export default function PullMonitor() {
  const { data, isLoading, mutate } = useApi<Pull[]>('/warehouse/pulls');
  const { session } = useDashboardSession();
  const toast = useToast();
  const actor = session?.name || session?.email || 'Almacén';

  const all = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const [filters, setFilters] = useState<FilterValues>({ status: ['pending', 'in_progress'] });
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PullForm>(EMPTY_FORM);
  const [onlyMine, setOnlyMine] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importWh, setImportWh] = useState('');
  const [showCsv, setShowCsv] = useState(false);

  // Reloj para aging en vivo (recalcula cada 30 s sin pegarle al backend).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Decora con aging vivo (el del servidor es una foto al momento del fetch).
  const decorated = useMemo(() => {
    return all.map((p) => {
      const aging = computeAgingMinutes(p, now);
      return { ...p, _aging: aging, _breached: isSlaBreached(aging, p.slaMinutes), _sem: pullSemaphore(aging, p.slaMinutes) };
    });
  }, [all, now]);

  const warehouseOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of all) if (p.fromWarehouseId) map.set(p.fromWarehouseId, p.warehouseName || p.fromWarehouseId);
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [all]);

  const projectOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of all) if (p.project) set.add(p.project);
    return Array.from(set).sort();
  }, [all]);

  const filtered = useMemo(() => {
    const types = (filters.type as string[] | undefined) ?? [];
    const statuses = (filters.status as string[] | undefined) ?? [];
    const whs = (filters.warehouse as string[] | undefined) ?? [];
    const projects = (filters.project as string[] | undefined) ?? [];
    const flags = (filters.flags as string[] | undefined) ?? [];
    const needle = query.trim().toLowerCase();
    return decorated.filter((p) => {
      if (types.length && !types.includes(p.type as string)) return false;
      if (statuses.length && !statuses.includes(p.status as string)) return false;
      if (whs.length && !whs.includes(p.fromWarehouseId || '')) return false;
      if (projects.length && !projects.includes(p.project || '')) return false;
      if (flags.includes('urgent') && !p.urgent) return false;
      if (flags.includes('breached') && !p._breached) return false;
      if (onlyMine && (p.assignedTo || '') !== actor) return false;
      if (needle) {
        const hay = `${p.taskNumber} ${p.partNumber} ${p.project ?? ''} ${p.requestor ?? ''} ${p.assignedTo ?? ''} ${p.referenceId ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [decorated, filters, query, onlyMine, actor]);

  // Agrupa por almacén; dentro de cada grupo, prioriza por estado y luego por aging desc.
  const groups = useMemo(() => {
    const byWh = new Map<string, { name: string; rows: typeof filtered }>();
    for (const p of filtered) {
      const key = p.fromWarehouseId || '—';
      if (!byWh.has(key)) byWh.set(key, { name: p.warehouseName || key, rows: [] });
      byWh.get(key)!.rows.push(p);
    }
    for (const g of byWh.values()) {
      g.rows.sort((a, b) => {
        const r = (PULL_SORT[a.status as string] ?? 9) - (PULL_SORT[b.status as string] ?? 9);
        if (r !== 0) return r;
        return b._aging - a._aging;
      });
    }
    return Array.from(byWh.entries())
      .map(([id, g]) => ({ id, ...g }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  // KPIs (sobre el universo decorado, no filtrado).
  const openPulls = decorated.filter(isOpen);
  const breached = openPulls.filter((p) => p._breached).length;
  const urgentOpen = openPulls.filter((p) => p.urgent).length;
  const avgAging = openPulls.length ? Math.round(openPulls.reduce((a, p) => a + p._aging, 0) / openPulls.length) : 0;
  const highTouches = openPulls.filter((p) => (p.touches ?? 0) >= 3).length;
  const flagsActive = (filters.flags as string[] | undefined) ?? [];

  async function act(p: Pull, action: 'start' | 'deliver' | 'cancel') {
    setBusy(`${p.id}-${action}`);
    try {
      let body: Record<string, unknown> = { actor };
      if (action === 'cancel') {
        const reason = window.prompt('Motivo de cancelación (opcional):', '');
        if (reason === null) { setBusy(null); return; }
        body = { actor, reason };
      }
      const res = await apiFetch(`${API_BASE}/warehouse/tasks/${p.id}/${action}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo actualizar el pull.', 'Pull Monitor');
        return;
      }
      const msg = action === 'start' ? `Pull tomado por ${actor}.` : action === 'deliver' ? 'Pull entregado.' : 'Pull cancelado.';
      toast.success(msg, 'Pull Monitor');
      mutate();
    } catch {
      toast.error('Error de red.', 'Pull Monitor');
    } finally { setBusy(null); }
  }

  async function createPull() {
    if (form.partNumber.trim().length < 1) { toast.error('Indica la parte a surtir.', 'Pull Monitor'); return; }
    if (!form.fromWarehouseId.trim()) { toast.error('Indica el almacén origen.', 'Pull Monitor'); return; }
    setBusy('new');
    try {
      const res = await apiFetch(`${API_BASE}/warehouse/pulls`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: form.project || undefined,
          partNumber: form.partNumber,
          quantity: Number(form.quantity) || 0,
          fromWarehouseId: form.fromWarehouseId,
          toLocation: form.toLocation || undefined,
          requestor: form.requestor || undefined,
          slaMinutes: form.slaMinutes ? Number(form.slaMinutes) : undefined,
          urgent: form.urgent,
          referenceId: form.referenceId || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo crear el pull.', 'Pull Monitor');
        return;
      }
      toast.success('Pull creado — en la cola del almacén.', 'Pull Monitor');
      setShowForm(false);
      setForm(EMPTY_FORM);
      mutate();
    } catch {
      toast.error('Error de red.', 'Pull Monitor');
    } finally { setBusy(null); }
  }

  // Importa los llamados de resurtido (e-kanban) de material-staging como pulls.
  async function importReplenish() {
    if (!importWh.trim()) { toast.error('Indica el almacén origen para importar.', 'Pull Monitor'); return; }
    setBusy('import');
    try {
      const res = await apiFetch(`${API_BASE}/warehouse/pulls/import-replenish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceWarehouseId: importWh }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo importar los resurtidos.', 'Pull Monitor');
        return;
      }
      const r = await res.json().catch(() => ({ imported: 0, skipped: 0, total: 0 }));
      toast.success(`Resurtidos: ${r.imported} importado(s), ${r.skipped} ya existían.`, 'Pull Monitor');
      setShowImport(false);
      mutate();
    } catch {
      toast.error('Error de red.', 'Pull Monitor');
    } finally { setBusy(null); }
  }

  const kpiItems: StatCardProps[] = [
    { label: 'Pulls abiertos', value: openPulls.length, color: openPulls.length ? BLUE : GREEN, icon: Inbox },
    { label: 'SLA en rojo', value: breached, color: breached ? RED : GREEN, icon: AlertTriangle },
    { label: 'Aging promedio', value: formatAging(avgAging), color: avgAging > 120 ? RED : avgAging > 90 ? AMBER : TEAL, icon: Clock },
    { label: 'Urgentes', value: urgentOpen, color: urgentOpen ? AMBER : GRAY, icon: Flame },
    { label: 'Touches ≥3', value: highTouches, color: highTouches ? AMBER : GRAY, icon: RefreshCw },
  ];

  const FILTER_DEFS: FilterDef[] = [
    { key: 'status', type: 'pill', label: 'Estado', options: STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label, color: STATUS_META[s].color })) },
    { key: 'type', type: 'pill', label: 'Tipo', options: TYPES.map((t) => ({ value: t, label: TYPE_META[t].label, color: TYPE_META[t].color })) },
    ...(warehouseOptions.length > 1 ? [{ key: 'warehouse', type: 'pill' as const, label: 'Almacén', options: warehouseOptions.map((w) => ({ value: w.id, label: w.name.replace(/^.*—\s*/, '') })) }] : []),
    ...(projectOptions.length ? [{ key: 'project', type: 'pill' as const, label: 'Proyecto', options: projectOptions.map((p) => ({ value: p, label: p })) }] : []),
    { key: 'flags', type: 'pill', label: 'Señales', options: [{ value: 'urgent', label: 'Urgente', color: AMBER }, { value: 'breached', label: 'SLA roto', color: RED }] },
  ];

  const EXPORT_COLUMNS: ExportColumn<Pull & { _aging?: number; _breached?: boolean }>[] = [
    { key: 'taskNumber', header: 'Folio' },
    { key: 'project', header: 'Proyecto' },
    { key: 'partNumber', header: 'Parte' },
    { key: 'quantity', header: 'Cantidad', value: (p) => p.quantity ?? '' },
    { key: 'warehouse', header: 'Almacén', value: (p) => p.warehouseName || p.fromWarehouseId || '' },
    { key: 'toLocation', header: 'Destino', value: (p) => p.toLocation || p.toWarehouseId || '' },
    { key: 'requestor', header: 'Requisitor' },
    { key: 'assignedTo', header: 'Responsable' },
    { key: 'aging', header: 'Aging (min)', value: (p) => p._aging ?? p.agingMinutes ?? '' },
    { key: 'sla', header: 'SLA (min)', value: (p) => effectiveSla(p.slaMinutes) },
    { key: 'breached', header: 'SLA roto', value: (p) => (p._breached ? 'SÍ' : 'no') },
    { key: 'touches', header: 'Touches', value: (p) => p.touches ?? 0 },
    { key: 'urgent', header: 'Urgente', value: (p) => (p.urgent ? 'SÍ' : 'no') },
    { key: 'status', header: 'Estado', value: (p) => STATUS_META[p.status as string]?.label ?? String(p.status) },
    { key: 'createdAt', header: 'Creado', value: (p) => (p.createdAt ? p.createdAt.slice(0, 16).replace('T', ' ') : '') },
    { key: 'deliveredAt', header: 'Entregado', value: (p) => (p.deliveredAt ? p.deliveredAt.slice(0, 16).replace('T', ' ') : '') },
  ];

  return (
    <div>
      <Toolbar
        domain="warehouse"
        icon={ClipboardList}
        title="Pull Monitor · surtido por almacén"
        subtitle="Pedidos de material del piso al almacén — prioriza por aging y SLA, entrega o cancela"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Importación de pull-list por archivo CSV (un conector SAP futuro usaría este mismo flujo). */}
            <button
              type="button"
              onClick={() => setShowCsv((s) => !s)}
              title="Cargar una pull-list por archivo CSV — un conector SAP futuro alimentaría este mismo flujo."
              className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
            >
              <Upload className="h-4 w-4" /> Cargar pull-list (CSV)
            </button>
            {/* Puente real kit→pull: importa los llamados de resurtido (e-kanban) del piso. */}
            <button
              type="button"
              onClick={() => setShowImport((s) => !s)}
              title="Importa los llamados de resurtido (e-kanban) generados por el surtido de kits como pulls del monitor."
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors"
              style={{ background: `${TEAL}1f`, color: TEAL }}
            >
              <Boxes className="h-4 w-4" /> Importar resurtidos
            </button>
            <button
              type="button"
              onClick={() => setShowForm((s) => !s)}
              className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
              style={{ background: BLUE }}
            >
              <Plus className="h-4 w-4" /> Crear pull
            </button>
          </div>
        }
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar folio, parte, proyecto, requisitor…"
          className="w-full max-w-xs rounded-xl bg-black/[0.03] px-3 py-2 text-sm outline-none focus:bg-black/[0.05] dark:bg-white/[0.06] dark:focus:bg-white/[0.1]"
        />
        <FilterBar defs={FILTER_DEFS} value={filters} onChange={setFilters} />
        <button
          type="button"
          onClick={() => setOnlyMine((m) => !m)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors"
          style={onlyMine ? { background: `${BLUE}1f`, color: BLUE } : { color: GRAY }}
        >
          <HandMetal className="h-3.5 w-3.5" /> Mis tareas
        </button>
        <div className="ml-auto">
          <ExportButton<Pull & { _aging?: number; _breached?: boolean }> rows={filtered} columns={EXPORT_COLUMNS} filename="pull-monitor" />
        </div>
      </Toolbar>

      <div className="mb-5">
        <KpiRow items={kpiItems} columns={5} />
      </div>

      {/* Indicadores visibles de alerta (los avisos al buzón quedan como follow-up). */}
      {breached > 0 && !flagsActive.includes('breached') && (
        <button
          type="button"
          onClick={() => setFilters({ ...filters, status: ['pending', 'in_progress'], flags: Array.from(new Set([...flagsActive, 'breached'])) })}
          className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-red-500/25 bg-red-500/[0.07] px-4 py-3 text-left transition-colors hover:bg-red-500/[0.12]"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-red-700 dark:text-red-300">{breached} pull{breached === 1 ? '' : 's'} con SLA roto</div>
            <div className="text-[12px] text-red-600/80">El aging superó el SLA — atiéndelos primero para no frenar la línea.</div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-red-700 dark:text-red-300">Ver <ArrowRight className="h-3.5 w-3.5" /></span>
        </button>
      )}
      {urgentOpen > 0 && !flagsActive.includes('urgent') && (
        <button
          type="button"
          onClick={() => setFilters({ ...filters, status: ['pending', 'in_progress'], flags: Array.from(new Set([...flagsActive, 'urgent'])) })}
          className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-left transition-colors hover:bg-amber-500/[0.12]"
        >
          <Flame className="h-5 w-5 shrink-0 text-amber-500" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-amber-700 dark:text-amber-300">{urgentOpen} pull{urgentOpen === 1 ? '' : 's'} urgente{urgentOpen === 1 ? '' : 's'}</div>
            <div className="text-[12px] text-amber-600/80">Material crítico para producción — al frente de la cola.</div>
          </div>
        </button>
      )}

      {/* Crear pull */}
      {showForm && (
        <div className={`${glass} mb-5 rounded-2xl p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Crear pull · pedido de material</h3>
            <button aria-label="Cerrar" onClick={() => setShowForm(false)} className="rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-gray-500">Parte *</span>
              <input value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} placeholder="IC-MCU-32B" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-gray-500">Cantidad</span>
              <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="50" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-gray-500">Almacén origen *</span>
              <input list="wh-options" value={form.fromWarehouseId} onChange={(e) => setForm({ ...form, fromWarehouseId: e.target.value })} placeholder="AX-WH-NORTE-RM" className={inputCls} />
              <datalist id="wh-options">
                {warehouseOptions.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </datalist>
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-gray-500">Proyecto</span>
              <input list="proj-options" value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} placeholder="AX-MOBILITY" className={inputCls} />
              <datalist id="proj-options">{projectOptions.map((p) => <option key={p} value={p} />)}</datalist>
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-gray-500">Destino (ubicación)</span>
              <input value={form.toLocation} onChange={(e) => setForm({ ...form, toLocation: e.target.value })} placeholder="L1-POU" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-gray-500">Requisitor</span>
              <input value={form.requestor} onChange={(e) => setForm({ ...form, requestor: e.target.value })} placeholder="Líder L1" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-gray-500">Referencia (WO/orden)</span>
              <input value={form.referenceId} onChange={(e) => setForm({ ...form, referenceId: e.target.value })} placeholder="AX-WO-0001" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-gray-500">SLA (min)</span>
              <input type="number" value={form.slaMinutes} onChange={(e) => setForm({ ...form, slaMinutes: e.target.value })} placeholder="120" className={inputCls} />
            </label>
            <label className="flex items-end gap-2 pb-2">
              <input type="checkbox" checked={form.urgent} onChange={(e) => setForm({ ...form, urgent: e.target.checked })} className="h-4 w-4 rounded" />
              <span className="text-sm font-medium">Urgente</span>
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-xl px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
            <button onClick={createPull} disabled={busy === 'new'} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: BLUE }}>
              {busy === 'new' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Crear pull
            </button>
          </div>
        </div>
      )}

      {/* Cargar pull-list por archivo CSV */}
      {showCsv && <CsvImportPanel onClose={() => setShowCsv(false)} onImported={mutate} />}

      {/* Importar resurtidos (e-kanban) desde material-staging */}
      {showImport && (
        <div className={`${glass} mb-5 rounded-2xl p-5`}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Importar resurtidos del piso (e-kanban)</h3>
              <p className="text-[12px] text-gray-500 dark:text-gray-400">Trae los llamados de resurtido abiertos (generados por el surtido de kits) como pulls. Elige de qué almacén se surten.</p>
            </div>
            <button aria-label="Cerrar" onClick={() => setShowImport(false)} className="rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-gray-500">Almacén origen *</span>
              <input list="wh-options-import" value={importWh} onChange={(e) => setImportWh(e.target.value)} placeholder="AX-WH-NORTE-RM" className={`${inputCls} sm:w-72`} />
              <datalist id="wh-options-import">{warehouseOptions.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</datalist>
            </label>
            <button onClick={importReplenish} disabled={busy === 'import'} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60" style={{ background: TEAL }}>
              {busy === 'import' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Boxes className="h-4 w-4" />} Importar
            </button>
          </div>
        </div>
      )}

      {/* Tablero agrupado por almacén */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-500 dark:text-gray-400" /></div>
      ) : all.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          accent={BLUE}
          title="Aún no hay pulls"
          description="Un PULL es un pedido de material del piso al almacén: el almacenista lo ve en su cola priorizada por aging/SLA, lo surte y lo Entrega (o Cancela). Crea el primero para arrancar el monitor."
          hint={[
            'Cada pull lleva proyecto, almacén origen, destino, requisitor y SLA.',
            'El aging avanza en vivo; se pone en rojo cuando supera el SLA.',
            'Importar pull-lists desde SAP llegará en una fase futura (interfaz preparada).',
          ]}
          primaryAction={{ label: 'Crear el primer pedido', onClick: () => setShowForm(true), icon: Plus }}
        />
      ) : groups.length === 0 ? (
        <div className={`${glass} rounded-3xl p-12 text-center`}>
          <Inbox className="mx-auto mb-3 h-8 w-8 text-gray-500 dark:text-gray-400" />
          <h3 className="font-semibold">Sin pulls con esos filtros</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Ajusta el estado, el almacén o limpia la búsqueda.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const isCol = collapsed[g.id];
            const openCount = g.rows.filter(isOpen).length;
            const breachCount = g.rows.filter((r) => isOpen(r) && r._breached).length;
            return (
              <div key={g.id} className={`${glass} overflow-hidden rounded-2xl`}>
                <button
                  type="button"
                  aria-expanded={!isCol}
                  onClick={() => setCollapsed((c) => ({ ...c, [g.id]: !c[g.id] }))}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                >
                  {isCol ? <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />}
                  <span className="font-semibold">{g.name}</span>
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[12px] font-medium text-blue-600 dark:text-blue-300">Por recolectar ({openCount})</span>
                  {breachCount > 0 && (
                    <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[12px] font-medium text-red-600 dark:text-red-300">{breachCount} SLA roto</span>
                  )}
                  <span className="ml-auto text-[12px] text-gray-500 dark:text-gray-400">{g.rows.length} total</span>
                </button>
                {!isCol && (
                  <div className="divide-y divide-black/5 dark:divide-white/5">
                    {g.rows.map((p) => <PullRow key={String(p.id)} p={p} busy={busy} onAct={act} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PullRow({
  p, busy, onAct,
}: {
  p: Pull & { _aging: number; _breached: boolean; _sem: 'green' | 'amber' | 'red' };
  busy: string | null;
  onAct: (p: Pull, a: 'start' | 'deliver' | 'cancel') => void;
}) {
  const closed = p.status === 'completed' || p.status === 'cancelled';
  const semColor = SEMAPHORE_COLOR[p._sem];
  const statusMeta = STATUS_META[p.status as string] ?? { label: p.status, color: GRAY };
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: closed ? GRAY : semColor }} title={`Semáforo ${p._sem}`} />
      <div className="min-w-[180px] flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 dark:bg-white/10">{p.taskNumber}</span>
          <span className="truncate font-mono font-medium">{p.partNumber}</span>
          {p.urgent && <Flame className="h-3.5 w-3.5 text-amber-500" />}
        </div>
        <div className="mt-0.5 truncate text-[12px] text-gray-500 dark:text-gray-400">
          {p.project ? <span className="font-medium text-gray-500 dark:text-gray-400">{p.project}</span> : null}
          {p.referenceId ? ` · ${p.referenceId}` : ''}
          {p.requestor ? ` · pide: ${p.requestor}` : ''}
        </div>
      </div>
      <div className="hidden min-w-[110px] sm:block">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Destino</div>
        <div className="truncate">{p.toLocation || p.toWarehouseId || '—'}</div>
      </div>
      <div className="min-w-[64px] text-right">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Cant.</div>
        <div className="tabular-nums font-medium">{fmtQty(p.quantity)}</div>
      </div>
      <div className="min-w-[80px]">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Aging</div>
        <div className="font-semibold tabular-nums" style={{ color: closed ? GRAY : semColor }}>
          {formatAging(p._aging)}{p._breached && !closed ? ' ⚠' : ''}
        </div>
      </div>
      <div className="hidden min-w-[56px] text-center md:block">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Touch</div>
        <div className={`tabular-nums font-medium ${(p.touches ?? 0) >= 3 ? 'text-amber-500' : ''}`}>{p.touches ?? 0}</div>
      </div>
      <div className="hidden min-w-[120px] lg:block">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Responsable</div>
        <div className="truncate text-gray-500 dark:text-gray-400">{p.assignedTo || <span className="text-gray-300">sin tomar</span>}</div>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium" style={{ background: `${statusMeta.color}1f`, color: statusMeta.color }}>
        {statusMeta.label}
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        {!closed && (
          <>
            {p.status === 'pending' && (
              <button type="button" disabled={busy !== null} onClick={() => onAct(p, 'start')} title="Tomar" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium disabled:opacity-50" style={{ background: `${BLUE}1f`, color: BLUE }}>
                {busy === `${p.id}-start` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Tomar
              </button>
            )}
            <button type="button" disabled={busy !== null} onClick={() => onAct(p, 'deliver')} title="Entregar" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium disabled:opacity-50" style={{ background: `${GREEN}1f`, color: GREEN }}>
              {busy === `${p.id}-deliver` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Entregar
            </button>
            <button type="button" aria-label="Cancelar pull" disabled={busy !== null} onClick={() => onAct(p, 'cancel')} title="Cancelar" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium disabled:opacity-50" style={{ background: `${RED}1f`, color: RED }}>
              {busy === `${p.id}-cancel` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
            </button>
          </>
        )}
        {closed && (
          <span className="text-[12px] text-gray-500 dark:text-gray-400">{fmtTime(p.deliveredAt || p.canceledAt)}</span>
        )}
      </div>
    </div>
  );
}
