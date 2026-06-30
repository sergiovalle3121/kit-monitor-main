'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Hash,
  Plus,
  Lock,
  Loader2,
  Inbox,
  X,
  Pencil,
  CheckCircle2,
  CircleSlash,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const GREEN = '#10b981';
const AMBER = '#f59e0b';
const VIOLET = '#7c3aed';

type ResetPolicy = 'NEVER' | 'YEARLY' | 'MONTHLY';

interface DocumentSequence {
  id: string;
  docType: string;
  name: string;
  prefix: string;
  pattern: string;
  padding: number;
  nextValue: number;
  totalIssued: number;
  resetPolicy: ResetPolicy;
  periodKey: string | null;
  active: boolean;
  description?: string | null;
}

interface Kpis {
  totalTypes: number;
  activeTypes: number;
  totalIssued: number;
  issuedThisPeriod: number;
  mostActive: { docType: string; name: string; totalIssued: number } | null;
}

const RESET_LABELS: Record<ResetPolicy, string> = {
  NEVER: 'Nunca',
  YEARLY: 'Anual',
  MONTHLY: 'Mensual',
};

// Mirror of the backend formatter so we can preview the next folio live,
// without an extra request per row.
function pad(value: number, width: number): string {
  const s = Math.trunc(Math.abs(value)).toString();
  const w = Math.max(1, width || 1);
  return s.length >= w ? s : '0'.repeat(w - s.length) + s;
}
function formatNext(seq: Pick<DocumentSequence, 'pattern' | 'prefix' | 'nextValue' | 'padding'>): string {
  const d = new Date();
  const yyyy = pad(d.getFullYear(), 4);
  const tokens: Record<string, string> = {
    PREFIX: seq.prefix ?? '',
    YYYY: yyyy,
    YY: yyyy.slice(-2),
    MM: pad(d.getMonth() + 1, 2),
    DD: pad(d.getDate(), 2),
    SEQ: pad(seq.nextValue, seq.padding),
  };
  return (seq.pattern || '').replace(/\{(\w+)\}/g, (m, k) => (k in tokens ? tokens[k] : m));
}

interface FormState {
  docType: string;
  name: string;
  prefix: string;
  pattern: string;
  padding: number;
  resetPolicy: ResetPolicy;
  nextValue: number;
  active: boolean;
  description: string;
}

const BLANK_FORM: FormState = {
  docType: '',
  name: '',
  prefix: '',
  pattern: '{PREFIX}-{YYYY}-{SEQ}',
  padding: 6,
  resetPolicy: 'YEARLY',
  nextValue: 1,
  active: true,
  description: '',
};

export default function NumberingAdminPage() {
  const { data: sequences, isLoading, forbidden, mutate } = useApi<DocumentSequence[]>('/numbering/sequences');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/numbering/kpis');
  const toast = useToast();

  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [busy, setBusy] = useState(false);

  const list = Array.isArray(sequences) ? sequences : [];

  function refresh() {
    mutate();
    mutateKpis();
  }

  function openCreate() {
    setForm(BLANK_FORM);
    setEditId(null);
    setCreating(true);
  }

  function openEdit(seq: DocumentSequence) {
    setForm({
      docType: seq.docType,
      name: seq.name,
      prefix: seq.prefix,
      pattern: seq.pattern,
      padding: seq.padding,
      resetPolicy: seq.resetPolicy,
      nextValue: seq.nextValue,
      active: seq.active,
      description: seq.description ?? '',
    });
    setEditId(seq.id);
    setCreating(false);
  }

  function closeForm() {
    setCreating(false);
    setEditId(null);
  }

  async function submit() {
    if (creating && form.docType.trim().length < 2) {
      toast.error('Indica un tipo de documento (mín. 2 caracteres).', 'Numeración');
      return;
    }
    if (!form.pattern.includes('{SEQ}')) {
      toast.error('El patrón debe incluir el token {SEQ}.', 'Numeración');
      return;
    }
    setBusy(true);
    try {
      const url = creating
        ? `${API_BASE}/numbering/sequences`
        : `${API_BASE}/numbering/sequences/${editId}`;
      const method = creating ? 'POST' : 'PATCH';
      const body = creating
        ? {
            docType: form.docType,
            name: form.name,
            prefix: form.prefix,
            pattern: form.pattern,
            padding: form.padding,
            resetPolicy: form.resetPolicy,
            startAt: form.nextValue,
            description: form.description,
          }
        : {
            name: form.name,
            prefix: form.prefix,
            pattern: form.pattern,
            padding: form.padding,
            resetPolicy: form.resetPolicy,
            nextValue: form.nextValue,
            active: form.active,
            description: form.description,
          };
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.message || 'No se pudo guardar la secuencia.', 'Numeración');
        return;
      }
      toast.success(creating ? 'Secuencia creada.' : 'Secuencia actualizada.', 'Numeración');
      closeForm();
      refresh();
    } catch {
      toast.error('Error de red al guardar.', 'Numeración');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(seq: DocumentSequence) {
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/numbering/sequences/${seq.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !seq.active }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.message || 'No se pudo actualizar.', 'Numeración');
        return;
      }
      refresh();
    } catch {
      toast.error('Error de red.', 'Numeración');
    } finally {
      setBusy(false);
    }
  }

  // ── States ────────────────────────────────────────────────────────────────
  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-foreground">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-400 mt-1">
            Necesitas iniciar sesión para ver la numeración de folios.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-foreground">
      {/* Header */}
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" aria-label="Volver al inicio" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgba(124,58,237,0.12)' }}>
            <Hash className="w-5 h-5" style={{ color: VIOLET }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Numeración de folios</h1>
            <p className="text-[12px] text-gray-400 leading-tight">
              Secuencias centrales por tipo de documento (WO, PO, NCR…)
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: VIOLET }}
          >
            <Plus className="w-4 h-4" /> Nueva secuencia
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-8 pb-24">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Kpi label="Tipos de documento" value={kpis?.totalTypes ?? list.length} sub={`${kpis?.activeTypes ?? 0} activos`} color={VIOLET} />
          <Kpi label="Folios emitidos (total)" value={kpis?.totalIssued ?? 0} color={GREEN} />
          <Kpi label="Emitidos en periodo" value={kpis?.issuedThisPeriod ?? 0} color={AMBER} />
          <Kpi
            label="Más usado"
            value={kpis?.mostActive?.totalIssued ?? 0}
            sub={kpis?.mostActive?.name ?? '—'}
            color="#6b7280"
          />
        </div>

        {/* Create / edit form */}
        {(creating || editId) && (
          <div className={`${glass} rounded-2xl p-5 mb-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{creating ? 'Nueva secuencia' : 'Editar secuencia'}</h3>
              <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Tipo de documento (clave)">
                <input
                  value={form.docType}
                  disabled={!creating}
                  onChange={(e) => setForm({ ...form, docType: e.target.value.toUpperCase() })}
                  placeholder="PURCHASE_ORDER"
                  className="axos-input disabled:opacity-60"
                />
              </Field>
              <Field label="Nombre">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Orden de Compra" className="axos-input" />
              </Field>
              <Field label="Prefijo">
                <input value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value })} placeholder="PO" className="axos-input" />
              </Field>
              <Field label="Patrón (tokens: {PREFIX} {YYYY} {YY} {MM} {DD} {SEQ})">
                <input value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} className="axos-input font-mono text-sm" />
              </Field>
              <Field label="Relleno de ceros (SEQ)">
                <input type="number" min={1} max={12} value={form.padding} onChange={(e) => setForm({ ...form, padding: Number(e.target.value) })} className="axos-input" />
              </Field>
              <Field label="Reinicio">
                <select value={form.resetPolicy} onChange={(e) => setForm({ ...form, resetPolicy: e.target.value as ResetPolicy })} className="axos-input">
                  <option value="NEVER">Nunca</option>
                  <option value="YEARLY">Anual</option>
                  <option value="MONTHLY">Mensual</option>
                </select>
              </Field>
              <Field label={creating ? 'Iniciar contador en' : 'Siguiente valor'}>
                <input type="number" min={1} value={form.nextValue} onChange={(e) => setForm({ ...form, nextValue: Number(e.target.value) })} className="axos-input" />
              </Field>
              {!creating && (
                <Field label="Estado">
                  <label className="inline-flex items-center gap-2 text-sm cursor-pointer mt-2">
                    <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                    Activa
                  </label>
                </Field>
              )}
            </div>

            <div className="mt-4 flex items-center gap-3 text-sm">
              <span className="text-gray-400">Vista previa:</span>
              <code className="px-2 py-1 rounded-lg bg-black/5 dark:bg-white/10 font-mono">{formatNext(form)}</code>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={closeForm} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">
                Cancelar
              </button>
              <button onClick={submit} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: VIOLET }}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {creating ? 'Crear' : 'Guardar'}
              </button>
            </div>
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
            <h3 className="font-semibold">Aún no hay secuencias</h3>
            <p className="text-sm text-gray-400 mt-1">
              Las secuencias se crean automáticamente al emitir el primer folio de cada tipo, o créalas aquí.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((seq) => (
              <div key={seq.id} className={`${glass} rounded-2xl p-4 flex items-center gap-4`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{seq.name || seq.docType}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{seq.docType}</span>
                    {!seq.active && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded text-gray-500" style={{ background: 'rgba(107,114,128,0.12)' }}>
                        <CircleSlash className="w-3 h-3" /> inactiva
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[12px] text-gray-400 flex-wrap">
                    <code className="font-mono text-gray-600 dark:text-gray-300">{formatNext(seq)}</code>
                    <span>•</span>
                    <span>siguiente #{seq.nextValue}</span>
                    <span>•</span>
                    <span>{seq.totalIssued} emitidos</span>
                    <span>•</span>
                    <span>reinicio {RESET_LABELS[seq.resetPolicy]}</span>
                  </div>
                </div>
                <button
                  onClick={() => toggleActive(seq)}
                  disabled={busy}
                  title={seq.active ? 'Desactivar' : 'Activar'}
                  className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
                >
                  {seq.active ? <CheckCircle2 className="w-4 h-4" style={{ color: GREEN }} /> : <CircleSlash className="w-4 h-4 text-gray-400" />}
                </button>
                <button onClick={() => openEdit(seq)} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10" title="Editar">
                  <Pencil className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      <style jsx global>{`
        .axos-input {
          width: 100%;
          border-radius: 0.75rem;
          padding: 0.55rem 0.75rem;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.08);
          outline: none;
          font-size: 0.875rem;
        }
        .axos-input:focus {
          border-color: #7c3aed;
        }
        :global(.dark) .axos-input {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-2xl font-semibold mt-1" style={{ color }}>{value}</div>
      {sub && <div className="text-[12px] text-gray-400 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
