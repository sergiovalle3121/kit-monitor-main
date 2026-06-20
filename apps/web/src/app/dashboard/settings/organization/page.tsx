'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Building2, Briefcase, Users, Plus, Trash2, Loader2, X, AlertCircle, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useConfirm } from '@/components/ui/ConfirmDialog';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface Building { id: string; code: string; name: string; status?: string }
interface Customer { id: string; code: string; name: string; industry?: string | null }
interface Program { id: string; code: string; name: string; customer?: { name?: string } | null; dedicatedBuilding?: { id?: string } | null }

async function post(path: string, body: unknown) {
  const res = await apiFetch(`${API_BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || 'Error');
  return data;
}
async function del(path: string) {
  const res = await apiFetch(`${API_BASE}${path}`, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || 'Error');
  return data;
}

export default function OrganizationPage() {
  const buildings = useApi<Building[]>('/enterprise/buildings');
  const customers = useApi<Customer[]>('/enterprise/customers');
  const programs = useApi<Program[]>('/enterprise/programs');
  const [err, setErr] = useState<string | null>(null);

  const flash = (m: string) => { setErr(m); setTimeout(() => setErr(null), 3500); };

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4 rounded-none border-x-0 border-t-0 flex items-center justify-between`}>
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-black dark:hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" /> Dashboard
        </Link>
        <span className="text-sm font-semibold">Organización</span>
      </div>

      <main className="max-w-4xl mx-auto px-6 pt-10 space-y-10">
        <header className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-pink-50 dark:bg-pink-500/10"><Building2 className="w-7 h-7 text-pink-500" strokeWidth={1.5} /></div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Organización</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Edificios, clientes y proyectos. Tú los creas y borras; todos los ven al elegir su área.</p>
          </div>
        </header>

        <AnimatePresence>
          {err && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex gap-2 items-center p-3 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" /> {err}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edificios */}
        <Section
          icon={<Building2 className="w-5 h-5 text-blue-500" />}
          title="Edificios / Plantas"
          items={buildings.data ?? []}
          loading={buildings.isLoading}
          empty="Aún no hay edificios. Crea el primero."
          fields={[{ key: 'code', label: 'Código', placeholder: 'B1' }, { key: 'name', label: 'Nombre', placeholder: 'Nombre del edificio' }]}
          onCreate={async (v) => { await post('/enterprise/buildings', v); buildings.mutate(); }}
          onDelete={async (id) => { await del(`/enterprise/buildings/${id}`); buildings.mutate(); }}
          onError={flash}
          render={(b: Building) => ({ title: b.name, sub: b.code })}
        />

        {/* Clientes */}
        <Section
          icon={<Users className="w-5 h-5 text-emerald-500" />}
          title="Clientes"
          items={customers.data ?? []}
          loading={customers.isLoading}
          empty="Aún no hay clientes. Agrega a quién le manufacturas."
          fields={[{ key: 'code', label: 'Código', placeholder: 'CL-01' }, { key: 'name', label: 'Nombre', placeholder: 'Cliente 1' }, { key: 'industry', label: 'Industria (opcional)', placeholder: 'Electrónica' }]}
          onCreate={async (v) => { await post('/enterprise/customers', v); customers.mutate(); }}
          onDelete={async (id) => { await del(`/enterprise/customers/${id}`); customers.mutate(); }}
          onError={flash}
          render={(c: Customer) => ({ title: c.name, sub: c.industry ? `${c.code} · ${c.industry}` : c.code })}
        />

        {/* Proyectos */}
        <Section
          icon={<Briefcase className="w-5 h-5 text-violet-500" />}
          title="Proyectos"
          items={programs.data ?? []}
          loading={programs.isLoading}
          empty="Aún no hay proyectos. Crea uno y ligálo a un cliente."
          fields={[
            { key: 'code', label: 'Código', placeholder: 'PRJ-01' },
            { key: 'name', label: 'Nombre', placeholder: 'Proyecto 1' },
            { key: 'customerId', label: 'Cliente', type: 'select', options: (customers.data ?? []).map((c) => ({ value: c.id, label: c.name })) },
          ]}
          onCreate={async (v) => {
            if (!v.customerId) throw new Error('Selecciona un cliente.');
            await post('/enterprise/programs', v); programs.mutate();
          }}
          onDelete={async (id) => { await del(`/enterprise/programs/${id}`); programs.mutate(); }}
          onError={flash}
          render={(p: Program) => ({ title: p.name, sub: p.customer?.name ? `${p.code} · ${p.customer.name}` : p.code })}
        />

        {/* Zona de mantenimiento */}
        <DangerZone onError={flash} />
      </main>
    </div>
  );
}

function DangerZone({ onError }: { onError: (m: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function run() {
    setBusy(true);
    try {
      await post('/governance/reset-operational', {});
      setDone(true);
      setConfirming(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
        <AlertTriangle className="w-5 h-5 text-amber-500" /> Mantenimiento
      </h2>
      <div className={`${glass} rounded-2xl p-5`}>
        <p className="text-sm font-semibold">Vaciar datos de operación</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xl leading-relaxed">
          Borra planes, BOM, materiales, kits, órdenes en ejecución, solicitudes,
          envíos, NCR y costos que hayan quedado de pruebas o importaciones. No toca
          usuarios, tu organización (edificios / clientes / proyectos) ni la
          configuración. Úsalo para arrancar la operación en limpio.
        </p>
        {done ? (
          <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-600">
            <CheckCircle2 className="w-4 h-4" /> Listo. La operación quedó vacía.
          </p>
        ) : confirming ? (
          <div className="mt-4 flex items-center gap-2">
            <button onClick={run} disabled={busy} className="flex items-center gap-2 bg-red-500 text-white text-sm font-semibold px-4 py-2 rounded-full hover:bg-red-600 active:scale-95 transition-all disabled:opacity-60">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Sí, vaciar todo
            </button>
            <button onClick={() => setConfirming(false)} disabled={busy} className="text-sm font-medium px-4 py-2 rounded-full border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition">
              Cancelar
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} className="mt-4 flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full border border-red-200 dark:border-red-500/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition">
            <Trash2 className="w-4 h-4" /> Vaciar datos de operación
          </button>
        )}
      </div>
    </section>
  );
}

interface Field { key: string; label: string; placeholder?: string; type?: 'text' | 'select'; options?: { value: string; label: string }[] }

function Section<T extends { id: string }>({
  icon, title, items, loading, empty, fields, onCreate, onDelete, onError, render,
}: {
  icon: React.ReactNode; title: string; items: T[]; loading: boolean; empty: string;
  fields: Field[];
  onCreate: (v: Record<string, string>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onError: (m: string) => void;
  render: (item: T) => { title: string; sub: string };
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const confirm = useConfirm();

  const field = 'w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 transition-all';

  async function submit() {
    setBusy(true);
    try { await onCreate(form); setForm({}); setAdding(false); }
    catch (e) { onError(e instanceof Error ? e.message : 'Error'); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!(await confirm({ message: '¿Eliminar este registro? Esta acción no se puede deshacer.', tone: 'danger', confirmLabel: 'Eliminar' }))) return;
    setDelId(id);
    try { await onDelete(id); }
    catch (e) { onError(e instanceof Error ? e.message : 'Error'); }
    finally { setDelId(null); }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">{icon}{title}</h2>
        <button onClick={() => setAdding((v) => !v)} className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full bg-black dark:bg-white text-white dark:text-black hover:scale-[1.03] active:scale-95 transition-transform">
          {adding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {adding ? 'Cancelar' : 'Agregar'}
        </button>
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className={`${glass} rounded-2xl p-4 mb-3 overflow-hidden`}>
            <div className="grid sm:grid-cols-3 gap-3">
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="text-xs text-gray-500 ml-1">{f.label}</label>
                  {f.type === 'select' ? (
                    <select className={field} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                      <option value="">Selecciona…</option>
                      {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input className={field} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-3">
              <button onClick={submit} disabled={busy} className="flex items-center gap-2 bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-full hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-60">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Crear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`${glass} rounded-2xl p-2`}>
        {loading ? (
          <div className="p-6 flex justify-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : items.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">{empty}</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {items.map((item) => {
              const r = render(item);
              return (
                <div key={item.id} className="flex items-center justify-between px-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{r.title}</p>
                    <p className="text-[11px] text-gray-400 font-mono">{r.sub}</p>
                  </div>
                  <button onClick={() => remove(item.id)} disabled={delId === item.id} className="p-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50">
                    {delId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
