'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft, Loader2, Lock, Save, CheckCircle2, Archive, RotateCcw, Boxes,
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
      </main>
    </div>
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
