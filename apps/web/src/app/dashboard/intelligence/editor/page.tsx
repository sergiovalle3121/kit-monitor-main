'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Gauge,
  Boxes,
  GitFork,
  Plus,
  Pencil,
  Loader2,
  Save,
  X,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { isAdminAccess } from '@/lib/owner';
import { useToast } from '@/contexts/ToastContext';

const DOMAINS = [
  'MATERIALS',
  'PRODUCTION',
  'QUALITY',
  'FINANCE',
  'SALES',
  'PLANNING',
  'SHIPPING',
  'ENGINEERING',
  'SYSTEM',
];

interface MetricDef {
  key: string;
  name: string;
  unit: string | null;
  domain: string | null;
  grain: string | null;
  formula: string | null;
  direction: string | null;
  version: number;
}
interface ObjectDef {
  key: string;
  name: string;
  description: string | null;
  domain: string | null;
  sourceEntity: string | null;
  primaryKey: string | null;
  properties: { name: string; type: string }[] | null;
}
interface LinkDef {
  key: string;
  fromObject: string;
  toObject: string;
  cardinality: string | null;
  verb: string | null;
  description: string | null;
}

const CARDINALITIES = [
  'one_to_one',
  'one_to_many',
  'many_to_one',
  'many_to_many',
];

type Panel =
  | { kind: 'metric'; isNew: boolean }
  | { kind: 'object'; isNew: boolean }
  | { kind: 'link'; isNew: boolean }
  | null;

const input =
  'w-full rounded-lg border border-black/10 bg-white/60 px-3 py-2 text-sm outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5';

export default function SemanticEditorPage() {
  const toast = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [metrics, setMetrics] = useState<MetricDef[]>([]);
  const [objects, setObjects] = useState<ObjectDef[]>([]);
  const [links, setLinks] = useState<LinkDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);
  const [saving, setSaving] = useState(false);
  // A single flat form record covers both kinds.
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => setIsAdmin(isAdminAccess(d?.session?.role, d?.session?.email)))
      .catch(() => setIsAdmin(false));
  }, []);

  async function loadCatalog() {
    const r = await fetch('/api/semantic/catalog', { cache: 'no-store' });
    if (r.ok) {
      const d = await r.json();
      setMetrics(d.metrics ?? []);
      setObjects(d.objects ?? []);
      setLinks(d.links ?? []);
    }
    setLoading(false);
  }
  useEffect(() => {
    loadCatalog();
  }, []);

  function openMetric(m?: MetricDef) {
    setForm({
      key: m?.key ?? '',
      name: m?.name ?? '',
      unit: m?.unit ?? '',
      domain: m?.domain ?? '',
      grain: m?.grain ?? '',
      formula: m?.formula ?? '',
      direction: m?.direction ?? '',
    });
    setPanel({ kind: 'metric', isNew: !m });
  }
  function openObject(o?: ObjectDef) {
    setForm({
      key: o?.key ?? '',
      name: o?.name ?? '',
      domain: o?.domain ?? '',
      sourceEntity: o?.sourceEntity ?? '',
      primaryKey: o?.primaryKey ?? '',
      description: o?.description ?? '',
      props: (o?.properties ?? []).map((p) => p.name).join(', '),
    });
    setPanel({ kind: 'object', isNew: !o });
  }
  function openLink(l?: LinkDef) {
    setForm({
      key: l?.key ?? '',
      fromObject: l?.fromObject ?? (objects[0]?.key ?? ''),
      toObject: l?.toObject ?? (objects[1]?.key ?? objects[0]?.key ?? ''),
      cardinality: l?.cardinality ?? 'one_to_many',
      verb: l?.verb ?? '',
      description: l?.description ?? '',
    });
    setPanel({ kind: 'link', isNew: !l });
  }

  async function save() {
    if (!panel) return;
    if (!form.key.trim()) {
      toast.error('La clave (key) es obligatoria.');
      return;
    }
    setSaving(true);
    try {
      let url = '';
      let body: Record<string, unknown> = {};
      if (panel.kind === 'metric') {
        url = '/api/semantic/metrics';
        body = {
          key: form.key.trim(),
          name: form.name || undefined,
          unit: form.unit || undefined,
          domain: form.domain || undefined,
          grain: form.grain || undefined,
          formula: form.formula || undefined,
          direction: form.direction || undefined,
        };
      } else if (panel.kind === 'object') {
        url = '/api/semantic/objects';
        body = {
          key: form.key.trim(),
          name: form.name || undefined,
          domain: form.domain || undefined,
          sourceEntity: form.sourceEntity || undefined,
          primaryKey: form.primaryKey || undefined,
          description: form.description || undefined,
          properties: (form.props || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .map((name) => ({ name, type: 'string' })),
        };
      } else {
        if (!form.fromObject || !form.toObject) {
          toast.error('Elige el objeto origen y destino.');
          setSaving(false);
          return;
        }
        url = '/api/semantic/links';
        body = {
          key: form.key.trim(),
          fromObject: form.fromObject,
          toObject: form.toObject,
          cardinality: form.cardinality || undefined,
          verb: form.verb || undefined,
          description: form.description || undefined,
        };
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo guardar.');
        return;
      }
      toast.success('Guardado.');
      setPanel(null);
      await loadCatalog();
    } catch {
      toast.error('Error de red.');
    } finally {
      setSaving(false);
    }
  }

  if (isAdmin === false) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-lg font-semibold">Acceso restringido</p>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          Solo un administrador puede editar el catálogo semántico.
        </p>
        <Link
          href="/dashboard/intelligence"
          className="mt-4 inline-block text-violet-600 underline"
        >
          Volver al Centro de Inteligencia
        </Link>
      </div>
    );
  }

  if (loading || isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <Link
        href="/dashboard/intelligence"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Centro de Inteligencia
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-semibold">Editor del catálogo semántico</h1>
        <p className="text-sm text-black/55 dark:text-white/55">
          Define métricas y objetos del negocio sin tocar código — CIDE y los
          tableros usan estas definiciones.
        </p>
      </div>

      {/* Edit panel */}
      {panel && (
        <div className={`${glass} mb-6 rounded-2xl p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {panel.isNew ? 'Nuevo' : 'Editar'}{' '}
              {panel.kind === 'metric'
                ? 'métrica'
                : panel.kind === 'object'
                  ? 'objeto'
                  : 'relación'}
            </h2>
            <button
              onClick={() => setPanel(null)}
              className="rounded-lg p-1.5 text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Clave (key)">
              <input
                className={input}
                value={form.key}
                disabled={!panel.isNew}
                placeholder="p. ej. scrap_rate"
                onChange={(e) => setForm({ ...form, key: e.target.value })}
              />
            </Field>
            {panel.kind !== 'link' && (
              <>
                <Field label="Nombre">
                  <input
                    className={input}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </Field>
                <Field label="Dominio">
                  <select
                    className={input}
                    value={form.domain}
                    onChange={(e) =>
                      setForm({ ...form, domain: e.target.value })
                    }
                  >
                    <option value="">—</option>
                    {DOMAINS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}

            {panel.kind === 'metric' ? (
              <>
                <Field label="Unidad">
                  <input
                    className={input}
                    value={form.unit}
                    placeholder="USD · % · count · units"
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  />
                </Field>
                <Field label="Grain (granularidad)">
                  <input
                    className={input}
                    value={form.grain}
                    placeholder="plant · line · work_order"
                    onChange={(e) => setForm({ ...form, grain: e.target.value })}
                  />
                </Field>
                <Field label="Dirección (mejor cuando…)">
                  <select
                    className={input}
                    value={form.direction}
                    onChange={(e) =>
                      setForm({ ...form, direction: e.target.value })
                    }
                  >
                    <option value="">—</option>
                    <option value="up">sube (up)</option>
                    <option value="down">baja (down)</option>
                  </select>
                </Field>
                <Field label="Fórmula / definición" full>
                  <textarea
                    className={`${input} min-h-16`}
                    value={form.formula}
                    onChange={(e) =>
                      setForm({ ...form, formula: e.target.value })
                    }
                  />
                </Field>
              </>
            ) : panel.kind === 'object' ? (
              <>
                <Field label="Fuente (sourceEntity)">
                  <input
                    className={input}
                    value={form.sourceEntity}
                    placeholder="p. ej. plans · ledger_events"
                    onChange={(e) =>
                      setForm({ ...form, sourceEntity: e.target.value })
                    }
                  />
                </Field>
                <Field label="Llave primaria">
                  <input
                    className={input}
                    value={form.primaryKey}
                    onChange={(e) =>
                      setForm({ ...form, primaryKey: e.target.value })
                    }
                  />
                </Field>
                <Field label="Propiedades (separadas por coma)" full>
                  <input
                    className={input}
                    value={form.props}
                    placeholder="workOrder, model, status"
                    onChange={(e) => setForm({ ...form, props: e.target.value })}
                  />
                </Field>
                <Field label="Descripción" full>
                  <textarea
                    className={`${input} min-h-16`}
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label="Objeto origen (from)">
                  <select
                    className={input}
                    value={form.fromObject}
                    onChange={(e) =>
                      setForm({ ...form, fromObject: e.target.value })
                    }
                  >
                    {objects.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Objeto destino (to)">
                  <select
                    className={input}
                    value={form.toObject}
                    onChange={(e) =>
                      setForm({ ...form, toObject: e.target.value })
                    }
                  >
                    {objects.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Cardinalidad">
                  <select
                    className={input}
                    value={form.cardinality}
                    onChange={(e) =>
                      setForm({ ...form, cardinality: e.target.value })
                    }
                  >
                    {CARDINALITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Verbo (relación)">
                  <input
                    className={input}
                    value={form.verb}
                    placeholder="consume · se surte de"
                    onChange={(e) => setForm({ ...form, verb: e.target.value })}
                  />
                </Field>
                <Field label="Descripción" full>
                  <textarea
                    className={`${input} min-h-16`}
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </Field>
              </>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar
            </button>
            <button
              onClick={() => setPanel(null)}
              className="rounded-lg border border-black/10 px-3 py-2 text-sm text-black/60 hover:bg-black/5 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/10"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Metrics */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Gauge className="h-4 w-4 text-violet-500" /> Métricas ({metrics.length})
          </h2>
          <button
            onClick={() => openMetric()}
            className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-700"
          >
            <Plus className="h-3 w-3" /> Añadir métrica
          </button>
        </div>
        <div className={`${glass} divide-y divide-black/5 rounded-2xl dark:divide-white/5`}>
          {metrics.map((m) => (
            <div key={m.key} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="font-medium">{m.name}</span>
              <span className="font-mono text-[10px] text-black/40 dark:text-white/40">
                {m.key} · {m.domain ?? '—'} · v{m.version}
              </span>
              <button
                onClick={() => openMetric(m)}
                className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-violet-600 hover:bg-violet-500/10 dark:text-violet-300"
              >
                <Pencil className="h-3 w-3" /> Editar
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Objects */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Boxes className="h-4 w-4 text-violet-500" /> Objetos ({objects.length})
          </h2>
          <button
            onClick={() => openObject()}
            className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-700"
          >
            <Plus className="h-3 w-3" /> Añadir objeto
          </button>
        </div>
        <div className={`${glass} divide-y divide-black/5 rounded-2xl dark:divide-white/5`}>
          {objects.map((o) => (
            <div key={o.key} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="font-medium">{o.name}</span>
              <span className="font-mono text-[10px] text-black/40 dark:text-white/40">
                {o.key} · {o.domain ?? '—'} · {o.sourceEntity ?? '—'}
              </span>
              <button
                onClick={() => openObject(o)}
                className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-violet-600 hover:bg-violet-500/10 dark:text-violet-300"
              >
                <Pencil className="h-3 w-3" /> Editar
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Links */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <GitFork className="h-4 w-4 text-violet-500" /> Relaciones (
            {links.length})
          </h2>
          <button
            onClick={() => openLink()}
            disabled={objects.length < 1}
            className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-40"
          >
            <Plus className="h-3 w-3" /> Añadir relación
          </button>
        </div>
        <div className={`${glass} divide-y divide-black/5 rounded-2xl dark:divide-white/5`}>
          {links.map((l) => (
            <div key={l.key} className="flex items-center gap-2 px-4 py-2.5 text-sm">
              <span className="font-medium">{l.fromObject}</span>
              <span className="text-violet-500">— {l.verb || 'relaciona'} →</span>
              <span className="font-medium">{l.toObject}</span>
              <span className="font-mono text-[10px] text-black/40 dark:text-white/40">
                {l.cardinality ?? ''}
              </span>
              <button
                onClick={() => openLink(l)}
                className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-violet-600 hover:bg-violet-500/10 dark:text-violet-300"
              >
                <Pencil className="h-3 w-3" /> Editar
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="mb-1 block text-xs text-black/55 dark:text-white/55">
        {label}
      </label>
      {children}
    </div>
  );
}
