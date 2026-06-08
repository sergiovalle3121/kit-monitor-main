'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft, Loader2, Lock, Save, CheckCircle2, Archive, RotateCcw, Boxes,
  Layers, Plus, Trash2, Pencil, Check, X, ShieldCheck, Inbox, Megaphone, ArrowRight,
} from 'lucide-react';
import { IconTile } from '@/components/ui/IconTile';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

type Status = 'DRAFT' | 'ACTIVE' | 'OBSOLETE';

interface ProductModel {
  id: string;
  modelNumber: string;
  name: string;
  customer?: string | null;
  revision: string;
  status: Status;
  description?: string | null;
  programId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  activatedAt?: string | null;
  obsoletedAt?: string | null;
}

const STATUS_META: Record<Status, { label: string; color: string }> = {
  DRAFT: { label: 'Borrador', color: '#9ca3af' },
  ACTIVE: { label: 'Activo', color: '#10b981' },
  OBSOLETE: { label: 'Obsoleto', color: '#f43f5e' },
};

const field =
  'w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all';

export default function ModelDetailPage() {
  const params = useParams();
  const id = String((params as Record<string, string>)?.id || '');
  const toast = useToast();

  const { data: model, isLoading, forbidden, mutate } = useApi<ProductModel>(
    id ? `/product-models/${id}` : null,
  );

  const [busy, setBusy] = useState<string | null>(null);

  async function transition(action: 'activate' | 'obsolete') {
    setBusy(action);
    try {
      const res = await apiFetch(`${API_BASE}/product-models/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.message || 'No se pudo actualizar el estado.', 'Modelo');
        return;
      }
      toast.success(`Modelo ${action === 'activate' ? 'activado' : 'marcado obsoleto'}.`, 'Modelo');
      mutate();
    } catch {
      toast.error('Error de red.', 'Modelo');
    } finally {
      setBusy(null);
    }
  }

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-black dark:text-white">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
        </div>
      </div>
    );
  }

  if (isLoading || !model) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const meta = STATUS_META[model.status];
  // Allowed actions mirror the backend state machine.
  const canActivate = model.status === 'DRAFT' || model.status === 'OBSOLETE';
  const canObsolete = model.status === 'DRAFT' || model.status === 'ACTIVE';

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-28">
      <main className="max-w-4xl mx-auto px-6 pt-8">
        <Link href="/dashboard/models" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-black dark:hover:text-white mb-5">
          <ChevronLeft className="w-4 h-4" /> Modelos
        </Link>

        {/* Header */}
        <header className="mb-8 flex items-center gap-4">
          <IconTile domain="engineering" size={52} icon={Boxes} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-mono text-gray-500">{model.modelNumber}</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: meta.color, background: `${meta.color}1a` }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} /> {meta.label}
              </span>
            </div>
            <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">{model.name}</h1>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {canActivate && (
              <button onClick={() => transition('activate')} disabled={!!busy} className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-full text-white disabled:opacity-60" style={{ background: '#10b981' }}>
                {busy === 'activate' ? <Loader2 className="w-4 h-4 animate-spin" /> : model.status === 'OBSOLETE' ? <RotateCcw className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                {model.status === 'OBSOLETE' ? 'Reactivar' : 'Activar'}
              </button>
            )}
            {canObsolete && (
              <button onClick={() => transition('obsolete')} disabled={!!busy} className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-60">
                {busy === 'obsolete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />} Obsoleto
              </button>
            )}
          </div>
        </header>

        {/* Edit form — keyed so it re-initializes from the loaded model. */}
        <ModelEditCard key={model.id} model={model} onSaved={mutate} />

        {/* BOM — reuses the `bom` module against this model's number. */}
        <BomSection modelNumber={model.modelNumber} productName={model.name} />

        {/* Planes — siguiente eslabón del flujo (Modelo → BOM → Plan). */}
        <PlansSection modelNumber={model.modelNumber} />
      </main>
    </div>
  );
}

/* ──────────────────────────── Planes del modelo ──────────────────────────── */

interface PlanLite { id: number | string; workOrder: string; model?: string; quantity?: number; status: string; line?: number | string | null }

const PLAN_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Por publicar', color: '#f59e0b' },
  published: { label: 'Publicado', color: '#7c3aed' },
  released: { label: 'Liberado', color: '#7c3aed' },
  active: { label: 'En producción', color: '#10b981' },
  completed: { label: 'Completado', color: '#6b7280' },
  cancelled: { label: 'Cancelado', color: '#ef4444' },
};

function PlansSection({ modelNumber }: { modelNumber: string }) {
  // Reutiliza /plans con filtro de modelo; además filtra en cliente por si el
  // backend ignora el parámetro (cinturón y tirantes — cero cambios de backend).
  const { data, isLoading } = useApi<PlanLite[]>(`/plans?model=${encodeURIComponent(modelNumber)}`);
  // Filtro estricto en cliente: si el backend ignora el parámetro y devuelve
  // todos los planes, solo mostramos los de este modelo (sin sobre-incluir).
  const plans = (Array.isArray(data) ? data : []).filter((p) => p.model === modelNumber);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <Megaphone className="w-4 h-4" /> Planes de este modelo
        </h2>
        <Link href="/dashboard/planning" className="inline-flex items-center gap-1 text-xs font-medium text-violet-500 hover:text-violet-700">
          Publicar plan <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-10 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : plans.length === 0 ? (
        <div className={`${glass} rounded-2xl p-6 text-center`}>
          <Inbox className="w-6 h-6 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-400">Sin planes para este modelo. Publícalo en <Link href="/dashboard/planning" className="underline">Planeación</Link> para surtir y producir.</p>
        </div>
      ) : (
        <div className={`${glass} rounded-2xl p-2`}>
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {plans.map((p) => {
              const meta = PLAN_STATUS[p.status] ?? { label: p.status, color: '#6b7280' };
              return (
                <Link key={p.id} href="/dashboard/production" className="flex items-center justify-between px-3 py-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">WO {p.workOrder}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: `${meta.color}1f`, color: meta.color }}>{meta.label}</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{p.quantity ?? 0} u{p.line ? ` · Línea ${p.line}` : ''}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function ModelEditCard({ model, onSaved }: { model: ProductModel; onSaved: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    name: model.name ?? '',
    customer: model.customer ?? '',
    revision: model.revision ?? '1.0',
    description: model.description ?? '',
    notes: String((model.metadata as Record<string, unknown>)?.notes ?? ''),
  }));

  async function save() {
    if (form.name.trim().length < 2) {
      toast.error('El nombre debe tener al menos 2 caracteres.', 'Modelo');
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch(`${API_BASE}/product-models/${model.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          customer: form.customer.trim(),
          revision: form.revision.trim() || '1.0',
          description: form.description.trim(),
          metadata: form.notes.trim()
            ? { ...(model.metadata ?? {}), notes: form.notes.trim() }
            : (model.metadata ?? {}),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.message || 'No se pudo guardar.', 'Modelo');
        return;
      }
      toast.success('Cambios guardados.', 'Modelo');
      onSaved();
    } catch {
      toast.error('Error de red.', 'Modelo');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`${glass} rounded-2xl p-5 mb-6`}>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">Datos del modelo</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block md:col-span-2">
          <span className="block text-[12px] font-medium text-gray-500 mb-1">Nombre *</span>
          <input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="block">
          <span className="block text-[12px] font-medium text-gray-500 mb-1">Cliente</span>
          <input className={field} value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} placeholder="—" />
        </label>
        <label className="block">
          <span className="block text-[12px] font-medium text-gray-500 mb-1">Revisión</span>
          <input className={field} value={form.revision} onChange={(e) => setForm({ ...form, revision: e.target.value })} />
        </label>
        <label className="block md:col-span-2">
          <span className="block text-[12px] font-medium text-gray-500 mb-1">Notas</span>
          <input className={field} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Programa, contacto, comentarios" />
        </label>
        <label className="block md:col-span-2">
          <span className="block text-[12px] font-medium text-gray-500 mb-1">Descripción</span>
          <textarea className={field} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
      </div>
      <div className="mt-5 flex justify-end">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white dark:text-black bg-black dark:bg-white disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar cambios
        </button>
      </div>
    </section>
  );
}

/* ───────────────────────────── BOM ───────────────────────────── */

type BomStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'ACTIVE' | 'OBSOLETE';

interface BomComponent {
  id: number;
  componentNumber: string;
  description?: string | null;
  quantity: number;
  unit: string;
  usageFactor: number;
  standardCost: number;
  extendedCost: number;
}

interface BomHeader {
  id: number;
  model: string;
  productName?: string;
  revision: string;
  status: BomStatus;
  baseQuantity: number;
  baseUnit: string;
  estimatedCost: number;
  components: BomComponent[];
}

const BOM_STATUS_META: Record<BomStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Borrador', color: '#9ca3af' },
  PENDING_REVIEW: { label: 'En revisión', color: '#f59e0b' },
  APPROVED: { label: 'Aprobado', color: '#3b82f6' },
  ACTIVE: { label: 'Activo', color: '#10b981' },
  OBSOLETE: { label: 'Obsoleto', color: '#f43f5e' },
};

function money(n: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n || 0);
}

function BomSection({ modelNumber, productName }: { modelNumber: string; productName: string }) {
  const toast = useToast();
  const { data, isLoading, mutate } = useApi<BomHeader[]>(
    `/bom/headers?model=${encodeURIComponent(modelNumber)}`,
  );
  const bom = Array.isArray(data) && data.length > 0 ? data[0] : null;

  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ partNumber: '', quantity: '', unit: 'EA', description: '', standardCost: '' });
  const [showNewPart, setShowNewPart] = useState(false);

  async function createBom() {
    setBusy('create');
    try {
      const res = await apiFetch(`${API_BASE}/bom/headers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelNumber, productName, revision: '1.0' }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d?.message || 'No se pudo crear el BOM.', 'BOM'); return; }
      toast.success('BOM creado.', 'BOM');
      mutate();
    } catch { toast.error('Error de red.', 'BOM'); } finally { setBusy(null); }
  }

  async function addComponent() {
    if (!form.partNumber.trim() || !form.quantity) {
      toast.error('Número de parte y cantidad son obligatorios.', 'BOM');
      return;
    }
    if (!bom) return;
    const pn = form.partNumber.trim().toUpperCase();
    setBusy('add');
    try {
      // 1) Ensure the part exists in Material Master (idempotent; seeds desc/cost only if new).
      const mRes = await apiFetch(`${API_BASE}/inventory/master-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partNumber: pn,
          description: form.description.trim() || undefined,
          uom: form.unit.trim() || 'EA',
          standardCost: form.standardCost ? Number(form.standardCost) : undefined,
        }),
      });
      if (!mRes.ok) {
        const d = await mRes.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo registrar la parte en el maestro.', 'BOM');
        return;
      }
      // 2) Add it to the BOM.
      const cRes = await apiFetch(`${API_BASE}/bom/headers/${bom.id}/components`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ componentNumber: pn, quantity: Number(form.quantity), unit: form.unit.trim() || 'EA' }),
      });
      const cd = await cRes.json().catch(() => ({}));
      if (!cRes.ok) { toast.error(cd?.message || 'No se pudo agregar la parte.', 'BOM'); return; }
      toast.success(`Parte ${pn} agregada.`, 'BOM');
      setForm({ partNumber: '', quantity: '', unit: 'EA', description: '', standardCost: '' });
      setShowNewPart(false);
      mutate();
    } catch { toast.error('Error de red.', 'BOM'); } finally { setBusy(null); }
  }

  async function transition(action: 'approve' | 'activate') {
    if (!bom) return;
    setBusy(action);
    try {
      const res = await apiFetch(`${API_BASE}/bom/headers/${bom.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d?.message || 'No se pudo actualizar el BOM.', 'BOM'); return; }
      toast.success(action === 'approve' ? 'BOM aprobado.' : 'BOM activado.', 'BOM');
      mutate();
    } catch { toast.error('Error de red.', 'BOM'); } finally { setBusy(null); }
  }

  const meta = bom ? BOM_STATUS_META[bom.status] : null;
  const components = bom?.components ?? [];
  const editable = bom?.status === 'DRAFT';

  return (
    <section className={`${glass} rounded-2xl p-5 mb-6`}>
      <div className="flex items-center gap-2 mb-4">
        <Layers className="w-4 h-4 text-gray-400" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">BOM · Lista de materiales</h2>
        {meta && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: meta.color, background: `${meta.color}1a` }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} /> {meta.label}
          </span>
        )}
        {bom && <span className="ml-auto text-xs text-gray-400">rev {bom.revision} · {components.length} partes · {money(bom.estimatedCost)}</span>}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : !bom ? (
        <div className="text-center py-8">
          <Inbox className="w-7 h-7 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-400 mb-4">Este modelo aún no tiene BOM. Créalo para capturar sus partes.</p>
          <button onClick={createBom} disabled={busy === 'create'} className="inline-flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold px-4 py-2.5 rounded-full disabled:opacity-60">
            {busy === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Crear BOM
          </button>
        </div>
      ) : (
        <>
          {/* Components */}
          {components.length === 0 ? (
            <p className="text-sm text-gray-400 py-3">Sin partes todavía. Agrega la primera abajo.</p>
          ) : (
            <div className="space-y-1.5 mb-4">
              {components.map((c) => (
                <ComponentRow key={c.id} bomId={bom.id} c={c} editable={!!editable} onChanged={mutate} onError={(m) => toast.error(m, 'BOM')} onOk={(m) => toast.success(m, 'BOM')} />
              ))}
            </div>
          )}

          {/* Add component (only while DRAFT) */}
          {editable && (
            <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/10 p-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <input value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} placeholder="Número de parte" className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-lg py-2 px-2.5 text-sm flex-1 outline-none" />
                <input value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} type="number" min={0.0001} step="any" placeholder="Cant/u" className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-lg py-2 px-2.5 text-sm w-24 outline-none" />
                <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="EA" className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-lg py-2 px-2.5 text-sm w-16 outline-none" />
                <button onClick={addComponent} disabled={busy === 'add'} className="bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-60">
                  {busy === 'add' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Agregar'}
                </button>
              </div>
              <button onClick={() => setShowNewPart((v) => !v)} className="text-[12px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 mt-2">
                {showNewPart ? '− Ocultar datos de parte nueva' : '+ Si la parte es nueva, define descripción y costo'}
              </button>
              {showNewPart && (
                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                  <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción (solo si es nueva)" className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-lg py-2 px-2.5 text-sm flex-1 outline-none" />
                  <input value={form.standardCost} onChange={(e) => setForm({ ...form, standardCost: e.target.value })} type="number" min={0} step="any" placeholder="Costo std" className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-lg py-2 px-2.5 text-sm w-32 outline-none" />
                </div>
              )}
            </div>
          )}

          {/* Lifecycle actions */}
          <div className="flex items-center gap-2 mt-4 justify-end">
            {bom.status === 'DRAFT' && (
              <button onClick={() => transition('approve')} disabled={busy === 'approve' || components.length === 0} className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full text-white disabled:opacity-50" style={{ background: '#3b82f6' }}>
                {busy === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Aprobar BOM
              </button>
            )}
            {bom.status === 'APPROVED' && (
              <button onClick={() => transition('activate')} disabled={busy === 'activate'} className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full text-white disabled:opacity-60" style={{ background: '#10b981' }}>
                {busy === 'activate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Activar BOM
              </button>
            )}
            {bom.status === 'ACTIVE' && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> BOM activo — listo para planeación
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function ComponentRow({
  bomId, c, editable, onChanged, onError, onOk,
}: {
  bomId: number;
  c: BomComponent;
  editable: boolean;
  onChanged: () => void;
  onError: (m: string) => void;
  onOk: (m: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(String(c.quantity));
  const [busy, setBusy] = useState(false);

  async function saveQty() {
    const q = Number(qty);
    if (!q || q <= 0) { onError('Cantidad inválida.'); return; }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/bom/headers/${bomId}/components/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: q }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { onError(d?.message || 'No se pudo actualizar.'); return; }
      onOk('Cantidad actualizada.');
      setEditing(false);
      onChanged();
    } catch { onError('Error de red.'); } finally { setBusy(false); }
  }

  async function remove() {
    if (!window.confirm(`¿Quitar ${c.componentNumber} del BOM?`)) return;
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/bom/headers/${bomId}/components/${c.id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); onError(d?.message || 'No se pudo quitar.'); return; }
      onOk('Parte quitada.');
      onChanged();
    } catch { onError('Error de red.'); } finally { setBusy(false); }
  }

  return (
    <div className="group flex items-center gap-3 text-sm px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5">
      <span className="font-mono text-[13px]">{c.componentNumber}</span>
      <span className="text-gray-400 text-xs truncate flex-1">{c.description}</span>
      {editing ? (
        <span className="flex items-center gap-1">
          <input value={qty} onChange={(e) => setQty(e.target.value)} type="number" min={0.0001} step="any" className="w-20 bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-md py-1 px-2 text-sm outline-none" autoFocus />
          <span className="text-gray-400 text-xs">{c.unit}/u</span>
          <button onClick={saveQty} disabled={busy} className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10">{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}</button>
          <button onClick={() => { setEditing(false); setQty(String(c.quantity)); }} className="p-1 rounded text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"><X className="w-3.5 h-3.5" /></button>
        </span>
      ) : (
        <>
          <span className="font-semibold tabular-nums">{c.quantity} {c.unit}/u</span>
          <span className="text-gray-400 text-xs tabular-nums w-20 text-right">{money(c.extendedCost)}</span>
          {editable && (
            <span className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setEditing(true)} className="p-1 rounded text-gray-400 hover:text-blue-500"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={remove} disabled={busy} className="p-1 rounded text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
            </span>
          )}
        </>
      )}
    </div>
  );
}
