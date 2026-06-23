'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  ReadinessReport,
} from './_lib/npi';
import { ProjectStatusPill, ReadinessPill } from './_lib/pills';

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
).replace(/\/$/, '');

const field =
  'w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all';

export default function NpiPage() {
  const router = useRouter();
  const toast = useToast();
  const { canWrite } = usePermissions();

  const { data, isLoading, forbidden, mutate } =
    useApi<NpiProject[]>('/npi/projects');

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
  const kpis = useMemo(() => {
    const by = { OPEN: 0, ON_HOLD: 0, RELEASED: 0, CANCELLED: 0 };
    for (const p of list) by[p.status] = (by[p.status] ?? 0) + 1;
    return { total: list.length, ...by };
  }, [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) =>
      `${p.modelNumber} ${p.customer ?? ''} ${p.programId ?? ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [list, query]);

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
      toast.success(`Proyecto NPI ${d.modelNumber} listo.`, 'NPI');
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
      <div className="min-h-screen grid place-items-center text-black dark:text-white">
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
    <div className="min-h-screen text-black dark:text-white font-sans pb-28">
      <main className="max-w-5xl mx-auto px-6 pt-10">
        <PageHeader
          domain="engineering"
          title="NPI · Gates"
          subtitle="Orquesta la introducción por fases (QUOTE→MP) y mira la readiness agregada. Advisory: informa, no bloquea."
          icon={Rocket}
          right={
            canWrite && (
              <button
                onClick={() => setShowForm((s) => !s)}
                className="inline-flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold px-4 py-2.5 rounded-full hover:scale-[1.02] active:scale-95 transition-transform"
              >
                <Plus className="w-4 h-4" /> Nuevo proyecto
              </button>
            )
          }
        />

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Kpi label="Proyectos" value={kpis.total} color="#5b5bd6" />
          <Kpi label="Abiertos" value={kpis.OPEN} color="#3b82f6" />
          <Kpi label="En espera" value={kpis.ON_HOLD} color="#f59e0b" />
          <Kpi label="Liberados" value={kpis.RELEASED} color="#10b981" />
        </div>

        {/* Readiness lookup */}
        <ReadinessLookup />

        {/* Create form */}
        {showForm && (
          <div className={`${glass} rounded-2xl p-5 mb-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Nuevo proyecto NPI</h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
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
                Crear proyecto
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
            <h3 className="font-semibold">Aún no hay proyectos NPI</h3>
            <p className="text-sm text-gray-400 mt-1 mb-4">
              Crea un proyecto para orquestar la introducción de un modelo por
              gates.
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
              <button
                key={p.id}
                onClick={() => router.push(`/dashboard/npi/${p.id}`)}
                className={`${glass} group rounded-2xl p-4 text-left flex items-center gap-3`}
              >
                <IconTile domain="engineering" size={44} icon={Rocket} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-mono text-gray-500">
                      {p.modelNumber}
                    </span>
                    <ProjectStatusPill status={p.status} />
                  </div>
                  <div className="font-semibold truncate">
                    {p.customer || 'Sin cliente'} · rev {p.revision}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    Fase {PHASE_LABEL[p.currentPhase] ?? p.currentPhase}
                  </div>
                </div>
              </button>
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
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">
        {label}
      </div>
      <div
        className="text-2xl font-semibold mt-1 tabular-nums"
        style={{ color }}
      >
        {value}
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
            <ReadinessPill
              status={report.gateReady ? 'READY' : 'NOT_READY'}
            />
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
