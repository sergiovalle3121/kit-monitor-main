'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Plus,
  Loader2,
  Lock,
  Search,
  X,
  CheckCircle2,
  Rocket,
  Inbox,
  Gauge,
  ArrowRight,
  Boxes,
  CircleDot,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { IconTile } from '@/components/ui/IconTile';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';
import { usePermissions } from '@/hooks/usePermissions';
import {
  NpiProject,
  PHASE_LABEL,
  PROJECT_STATUS_META,
  ReadinessReport,
} from './_lib/npi';
import { phaseRailCounts } from './_lib/launch';
import { ProjectStatusPill, ReadinessPill } from './_lib/pills';

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
).replace(/\/$/, '');

const field =
  'w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all';

/** Minimal shape we need from the product-model master to cross-link launches. */
interface ModelLite {
  id: string;
  modelNumber: string;
  name: string;
  customer?: string | null;
  revision: string;
}

export default function NpiPage() {
  const router = useRouter();
  const toast = useToast();
  const { canWrite } = usePermissions();

  const { data, isLoading, forbidden, mutate } = useApi<NpiProject[]>(
    '/npi/projects?withReadiness=true',
  );
  // Read-only join against the product master so launch cards can deep-link to
  // the canonical model (no backend change — purely a client-side lookup).
  const { data: modelsData } = useApi<ModelLite[]>('/product-models');

  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    modelNumber: '',
    revision: '1.0',
    customer: '',
    programId: '',
    notes: '',
  });

  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const models = useMemo(
    () => (Array.isArray(modelsData) ? modelsData : []),
    [modelsData],
  );
  const modelByNumber = useMemo(() => {
    const m = new Map<string, ModelLite>();
    for (const mod of models) m.set(mod.modelNumber, mod);
    return m;
  }, [models]);

  const kpis = useMemo(() => {
    const by = { OPEN: 0, ON_HOLD: 0, RELEASED: 0, CANCELLED: 0 };
    let atRisk = 0;
    let ready = 0;
    for (const p of list) {
      by[p.status] = (by[p.status] ?? 0) + 1;
      if (p.status !== 'RELEASED' && p.status !== 'CANCELLED') {
        if ((p.summary?.openHighRisks ?? 0) > 0) atRisk += 1;
        if (p.summary?.gateReady) ready += 1;
      }
    }
    return { total: list.length, ...by, atRisk, ready };
  }, [list]);

  const rail = useMemo(() => phaseRailCounts(list), [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) =>
      `${p.modelNumber} ${p.customer ?? ''} ${p.programId ?? ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [list, query]);

  /** Prefill the new-launch form from an existing model in the master. */
  function pickModel(modelNumber: string) {
    const mod = modelByNumber.get(modelNumber);
    if (!mod) return;
    setForm((f) => ({
      ...f,
      modelNumber: mod.modelNumber,
      revision: mod.revision || f.revision,
      customer: mod.customer || f.customer,
    }));
  }

  async function createProject() {
    if (form.modelNumber.trim().length < 1) {
      toast.error('El número de modelo es obligatorio.', 'NPI');
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/npi/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelNumber: form.modelNumber.trim(),
          revision: form.revision.trim() || '1.0',
          customer: form.customer.trim() || undefined,
          programId: form.programId.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.message || 'No se pudo crear el proyecto.', 'NPI');
        return;
      }
      toast.success(`Launch ${d.modelNumber} listo.`, 'NPI');
      setShowForm(false);
      setForm({
        modelNumber: '',
        revision: '1.0',
        customer: '',
        programId: '',
        notes: '',
      });
      mutate();
      if (d.id) router.push(`/dashboard/npi/${d.id}`);
    } catch {
      toast.error('Error de red al crear el proyecto.', 'NPI');
    } finally {
      setBusy(false);
    }
  }

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-foreground">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-400 mt-1">
            Necesitas permiso de ingeniería para ver el NPI.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-foreground font-sans pb-28">
      <main className="max-w-7xl mx-auto px-6 pt-10">
        <PageHeader
          domain="engineering"
          title="NPI Launch Center"
          subtitle="Orquesta modelos, revisiones, readiness, gates y liberación a manufactura. Una consola, no un checklist."
          icon={Rocket}
          right={
            canWrite && (
              <button
                onClick={() => setShowForm((s) => !s)}
                className="inline-flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold px-4 py-2.5 rounded-full hover:scale-[1.02] active:scale-95 transition-transform"
              >
                <Plus className="w-4 h-4" /> Nuevo launch
              </button>
            )
          }
        />

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <Kpi label="Launches" value={kpis.total} color="#5b5bd6" icon={Rocket} />
          <Kpi label="Abiertos" value={kpis.OPEN} color="#3b82f6" icon={CircleDot} />
          <Kpi label="En riesgo" value={kpis.atRisk} color="#f43f5e" icon={ShieldAlert} />
          <Kpi label="Listos" value={kpis.ready} color="#10b981" icon={ShieldCheck} />
          <Kpi label="Liberados" value={kpis.RELEASED} color="#16a34a" icon={CheckCircle2} />
        </div>

        {/* Phase rail */}
        <PhaseRail rail={rail} />

        {/* Readiness lookup */}
        <ReadinessLookup />

        {/* Create form */}
        {showForm && (
          <div className={`${glass} rounded-2xl p-5 mb-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Nuevo launch NPI</h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Start from an existing model in the master (optional). */}
            {models.length > 0 && (
              <label className="block mb-4">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">
                  Empezar desde un modelo del maestro (opcional)
                </span>
                <select
                  className={field}
                  value={modelByNumber.has(form.modelNumber) ? form.modelNumber : ''}
                  onChange={(e) => pickModel(e.target.value)}
                >
                  <option value="">— Captura manual —</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.modelNumber}>
                      {m.modelNumber} · {m.name}
                      {m.customer ? ` · ${m.customer}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">
                  Número de modelo *
                </span>
                <input
                  className={field}
                  value={form.modelNumber}
                  onChange={(e) =>
                    setForm({ ...form, modelNumber: e.target.value })
                  }
                  placeholder="MDL-00001"
                />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">
                  Revisión
                </span>
                <input
                  className={field}
                  value={form.revision}
                  onChange={(e) =>
                    setForm({ ...form, revision: e.target.value })
                  }
                  placeholder="1.0"
                />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">
                  Cliente
                </span>
                <input
                  className={field}
                  value={form.customer}
                  onChange={(e) =>
                    setForm({ ...form, customer: e.target.value })
                  }
                  placeholder="ACME Robotics"
                />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">
                  Programa
                </span>
                <input
                  className={field}
                  value={form.programId}
                  onChange={(e) =>
                    setForm({ ...form, programId: e.target.value })
                  }
                  placeholder="Opcional"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">
                  Notas
                </span>
                <input
                  className={field}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Contexto, contacto, comentarios"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                onClick={createProject}
                disabled={busy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white dark:text-black bg-black dark:bg-white disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}{' '}
                Crear launch
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        {list.length > 0 && (
          <div
            className={`${glass} flex items-center gap-2 px-3 py-2 rounded-2xl mb-5`}
          >
            <Search className="w-4 h-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por modelo, cliente o programa…"
              className="bg-transparent outline-none text-sm w-full"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : list.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold">Aún no hay launches</h3>
            <p className="text-sm text-gray-400 mt-1 mb-4">
              Crea un launch para orquestar la introducción de un modelo: BOM,
              routing, calidad, gates y liberación a producción.
            </p>
            {canWrite && (
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold px-4 py-2.5 rounded-full"
              >
                <Plus className="w-4 h-4" /> Crear el primero
              </button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div
            className={`${glass} rounded-3xl p-10 text-center text-sm text-gray-400`}
          >
            Sin resultados para “{query}”.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((p) => (
              <LaunchCard
                key={p.id}
                project={p}
                model={modelByNumber.get(p.modelNumber) ?? null}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Kpi({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  color: string;
  icon: LucideIcon;
}) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="flex items-center justify-between">
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl"
          style={{ background: `${color}1a`, color }}
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
      </div>
      <div
        className="text-3xl font-semibold mt-3 tabular-nums leading-none"
        style={{ color }}
      >
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-gray-400 mt-1.5">
        {label}
      </div>
    </div>
  );
}

const ACCENT = '#5b5bd6';

/** Pipeline rail: QUOTE → … → MP as a connected, color-accented funnel. */
function PhaseRail({ rail }: { rail: { phase: string; count: number }[] }) {
  const total = rail.reduce((s, r) => s + r.count, 0);
  return (
    <div className={`${glass} rounded-2xl p-5 mb-6`}>
      <div className="flex items-center justify-between mb-4">
        <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
          Pipeline de lanzamiento
        </div>
        <div className="text-[11px] text-gray-400">
          {total} en vuelo · QUOTE → MP
        </div>
      </div>
      <div className="flex items-stretch gap-2 overflow-x-auto">
        {rail.map((r, i) => {
          const active = r.count > 0;
          return (
            <React.Fragment key={r.phase}>
              <div
                className="flex-1 min-w-[5.25rem] rounded-2xl px-3 py-3 text-center border transition-colors"
                style={{
                  background: active ? `${ACCENT}14` : 'transparent',
                  borderColor: active ? `${ACCENT}40` : 'transparent',
                }}
              >
                <div
                  className="text-[26px] font-bold tabular-nums leading-none"
                  style={{ color: active ? ACCENT : undefined }}
                >
                  {r.count}
                </div>
                <div className="text-[12px] font-semibold mt-2">{r.phase}</div>
                <div className="text-[10px] text-gray-400 truncate">
                  {PHASE_LABEL[r.phase as keyof typeof PHASE_LABEL] ?? r.phase}
                </div>
              </div>
              {i < rail.length - 1 && (
                <div className="self-center shrink-0 text-gray-300 dark:text-gray-600">
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

/** A small labeled progress bar (filled/total) with a color. */
function MiniBar({
  filled,
  total,
  color,
}: {
  filled: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

/** A rich launch card: status accent, readiness, gate progress and risk signal. */
function LaunchCard({
  project: p,
  model,
}: {
  project: NpiProject;
  model: ModelLite | null;
}) {
  const s = p.summary;
  const accent = PROJECT_STATUS_META[p.status]?.color ?? '#9ca3af';
  const released = p.status === 'RELEASED';
  const readyColor = s?.gateReady ? '#10b981' : '#f59e0b';
  const highRisks = s?.openHighRisks ?? 0;

  return (
    <div
      className={`${glass} group relative overflow-hidden rounded-2xl p-4 pl-5 flex flex-col gap-3 transition-transform hover:-translate-y-0.5`}
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-1.5"
        style={{ background: accent }}
      />
      <Link
        href={`/dashboard/npi/${p.id}`}
        className="flex items-start gap-3 text-left"
      >
        <IconTile domain="engineering" size={44} icon={Rocket} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-mono text-gray-500">
              {p.modelNumber}
            </span>
            <ProjectStatusPill status={p.status} />
            {highRisks > 0 && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ color: '#f43f5e', background: '#f43f5e1a' }}
              >
                <ShieldAlert className="w-3 h-3" /> {highRisks}
              </span>
            )}
          </div>
          <div className="font-semibold truncate mt-0.5">
            {model?.name || p.customer || 'Sin cliente'}
          </div>
          <div className="text-xs text-gray-400 truncate">
            rev {p.revision}
            {p.customer ? ` · ${p.customer}` : ''}
            {p.programId ? ` · ${p.programId}` : ''}
          </div>
        </div>
      </Link>

      {/* Signal row: phase chip + readiness + gate progress */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="text-[11px] font-medium px-2 py-0.5 rounded-full"
          style={{ background: `${ACCENT}14`, color: ACCENT }}
        >
          {PHASE_LABEL[p.currentPhase] ?? p.currentPhase}
        </span>
        {s && (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
            style={{ color: readyColor, background: `${readyColor}1a` }}
          >
            {s.gateReady ? (
              <ShieldCheck className="w-3 h-3" />
            ) : (
              <ShieldAlert className="w-3 h-3" />
            )}
            {released ? 'Liberado' : s.gateReady ? 'Listo' : 'No listo'}
          </span>
        )}
      </div>

      {s && s.criteriaTotal > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
              <span>Readiness</span>
              <span className="tabular-nums">
                {s.readyCount}/{s.criteriaTotal}
              </span>
            </div>
            <MiniBar
              filled={s.readyCount}
              total={s.criteriaTotal}
              color={readyColor}
            />
          </div>
          <div>
            <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
              <span>Gates</span>
              <span className="tabular-nums">
                {s.gatesCleared}/{s.gatesTotal}
              </span>
            </div>
            <MiniBar
              filled={s.gatesCleared}
              total={s.gatesTotal}
              color={ACCENT}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-black/5 dark:border-white/5 pt-2.5">
        <Link
          href={`/dashboard/npi/${p.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-300 hover:underline"
        >
          Abrir launch <ArrowRight className="w-3 h-3" />
        </Link>
        {model && (
          <Link
            href={`/dashboard/models/${model.id}`}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-foreground"
          >
            <Boxes className="w-3.5 h-3.5" /> Ver modelo
          </Link>
        )}
      </div>
    </div>
  );
}

/** Ad-hoc readiness check for any model+revision via GET /npi/readiness. */
function ReadinessLookup() {
  const [model, setModel] = useState('');
  const [revision, setRevision] = useState('1.0');
  const [report, setReport] = useState<ReadinessReport | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    if (!model.trim()) return;
    setBusy(true);
    setReport(null);
    try {
      const res = await apiFetch(
        `${API_BASE}/npi/readiness?model=${encodeURIComponent(
          model.trim(),
        )}&revision=${encodeURIComponent(revision.trim() || '1.0')}`,
      );
      if (res.ok) setReport(await res.json());
    } catch {
      /* best-effort */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${glass} rounded-2xl p-4 mb-6`}>
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="w-4 h-4 text-violet-500" />
        <h3 className="font-semibold text-sm">Consulta de readiness</h3>
        <span className="text-[11px] text-gray-400">
          Go / no-go en vivo para cualquier modelo+revisión
        </span>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="block text-[11px] text-gray-500 mb-1">Modelo</span>
          <input
            className={`${field} !py-2 w-44`}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="MDL-00001"
          />
        </label>
        <label className="block">
          <span className="block text-[11px] text-gray-500 mb-1">Revisión</span>
          <input
            className={`${field} !py-2 w-24`}
            value={revision}
            onChange={(e) => setRevision(e.target.value)}
          />
        </label>
        <button
          onClick={check}
          disabled={busy || !model.trim()}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
          style={{ background: '#5b5bd6' }}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Evaluar
        </button>
      </div>
      {report && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <ReadinessPill status={report.gateReady ? 'READY' : 'NOT_READY'} />
            <span className="text-xs text-gray-400">
              {report.readyCount} listo · {report.notReadyCount} no listo ·{' '}
              {report.unknownCount} desconocido
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {report.criteria.map((c) => (
              <div
                key={c.key}
                className="flex items-start gap-2 text-xs py-1"
                title={c.detail}
              >
                <ReadinessPill status={c.status} />
                <span className="font-medium">{c.label}</span>
                <span className="text-gray-400 truncate">{c.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
