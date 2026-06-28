'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import {
  Plus, Loader2, Lock, Search, X, CheckCircle2, Workflow, Inbox,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { IconTile } from '@/components/ui/IconTile';
import { HoverArrow } from '@/components/ui/HoverArrow';
import { glass } from '@/lib/glass';
import { containerRM, itemRM, hoverRM, pressRM } from '@/lib/motion';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

type RoutingStatus = 'DRAFT' | 'ACTIVE' | 'OBSOLETE';
interface Material { id: string; partNumber: string; description: string; itemType: string; }
interface Routing {
  id: string; materialId: string; revision: string; status: RoutingStatus;
  name?: string | null; material?: Material | null; operationCount: number;
}

const STATUS_META: Record<RoutingStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Borrador', color: '#9ca3af' },
  ACTIVE: { label: 'Activo', color: '#10b981' },
  OBSOLETE: { label: 'Obsoleto', color: '#f43f5e' },
};

const field =
  'w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all';

export default function RoutingListPage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const toast = useToast();

  const { data, isLoading, forbidden, mutate } = useApi<Routing[]>('/routing');
  const { data: materials } = useApi<Material[]>('/material-master');

  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ materialId: '', revision: '1.0', name: '' });

  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const mats = useMemo(() => (Array.isArray(materials) ? materials : []), [materials]);
  const options = useMemo(
    () => [...mats].sort((a, b) => {
      const aw = a.itemType === 'MANUFACTURED' || a.itemType === 'PHANTOM' ? 0 : 1;
      const bw = b.itemType === 'MANUFACTURED' || b.itemType === 'PHANTOM' ? 0 : 1;
      return aw - bw || a.partNumber.localeCompare(b.partNumber);
    }),
    [mats],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      `${r.material?.partNumber ?? ''} ${r.material?.description ?? ''} ${r.name ?? ''}`
        .toLowerCase().includes(q),
    );
  }, [list, query]);

  async function createRouting() {
    if (!form.materialId) { toast.error('Elige el material/ensamble.', 'Ruteo'); return; }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/routing`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialId: form.materialId, revision: form.revision.trim() || '1.0', name: form.name.trim() || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d?.message || 'No se pudo crear el ruteo.', 'Ruteo'); return; }
      toast.success('Ruteo creado.', 'Ruteo');
      setShowForm(false); setForm({ materialId: '', revision: '1.0', name: '' });
      mutate(); router.push(`/dashboard/routing/${d.id}`);
    } catch { toast.error('Error de red.', 'Ruteo'); } finally { setBusy(false); }
  }

  if (forbidden) {
    return <div className="min-h-screen grid place-items-center text-foreground"><div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}><Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" /><h2 className="text-lg font-semibold">Sin acceso</h2></div></div>;
  }

  return (
    <div className="min-h-screen text-foreground font-sans pb-28">
      <main className="max-w-5xl mx-auto px-6 pt-10">
        <PageHeader
          domain="engineering"
          title="Ruteo de Manufactura"
          subtitle="Cómo se construye cada ensamble: operaciones ordenadas, centro de trabajo, tiempos estándar y consumo por operación."
          icon={Workflow}
          right={
            <button onClick={() => setShowForm((s) => !s)} className="inline-flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold px-4 py-2.5 rounded-full hover:scale-[1.02] active:scale-95 transition-transform">
              <Plus className="w-4 h-4" /> Nuevo ruteo
            </button>
          }
        />

        {mats.length === 0 && (
          <div className={`${glass} rounded-2xl p-4 mb-6 text-sm text-amber-600 dark:text-amber-400`}>
            Aún no hay materiales. Crea partes en el{' '}
            <Link href="/dashboard/materials" className="underline font-medium">Maestro de Materiales</Link>{' '}
            antes de definir un ruteo.
          </div>
        )}

        <AnimatePresence>
          {showForm && (
            <motion.div initial={reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={reduce ? undefined : { opacity: 0, height: 0 }} className={`${glass} rounded-2xl p-5 mb-6 overflow-hidden`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Nuevo ruteo</h3>
                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <label className="block md:col-span-2">
                  <span className="block text-[12px] font-medium text-gray-500 mb-1">Material / ensamble *</span>
                  <select className={field} value={form.materialId} onChange={(e) => setForm({ ...form, materialId: e.target.value })}>
                    <option value="">Elegir del maestro…</option>
                    {options.map((m) => <option key={m.id} value={m.id}>{m.partNumber} · {m.description}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-[12px] font-medium text-gray-500 mb-1">Revisión</span>
                  <input className={field} value={form.revision} onChange={(e) => setForm({ ...form, revision: e.target.value })} placeholder="1.0" />
                </label>
                <label className="block">
                  <span className="block text-[12px] font-medium text-gray-500 mb-1">Nombre (opcional)</span>
                  <input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ruteo estándar" />
                </label>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
                <button onClick={createRouting} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white dark:text-black bg-black dark:bg-white disabled:opacity-60">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Crear ruteo
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {list.length > 0 && (
          <div className={`${glass} flex items-center gap-2 px-3 py-2 rounded-2xl mb-5`}>
            <Search className="w-4 h-4 text-gray-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por parte, descripción o nombre…" className="bg-transparent outline-none text-sm w-full" />
            {query && <button onClick={() => setQuery('')} className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-3.5 h-3.5" /></button>}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : list.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold">Aún no hay ruteos</h3>
            <p className="text-sm text-gray-400 mt-1 mb-4">Crea el ruteo de un ensamble y define sus operaciones.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={`${glass} rounded-3xl p-10 text-center text-sm text-gray-400`}>Sin resultados.</div>
        ) : (
          <motion.div variants={containerRM(reduce)} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((r) => {
              const meta = STATUS_META[r.status];
              return (
                <motion.button key={r.id} variants={itemRM(reduce)} whileHover={hoverRM(reduce)} whileTap={pressRM(reduce)} onClick={() => router.push(`/dashboard/routing/${r.id}`)} className={`${glass} group rounded-2xl p-4 text-left flex items-center gap-3`}>
                  <IconTile domain="engineering" size={44} icon={Workflow} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-mono text-gray-500">{r.material?.partNumber ?? '—'}</span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: meta.color, background: `${meta.color}1a` }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />{meta.label}
                      </span>
                    </div>
                    <div className="font-semibold truncate">{r.name || r.material?.description || 'Ruteo'}</div>
                    <div className="text-xs text-gray-400 truncate">rev {r.revision} · {r.operationCount} operaciones</div>
                  </div>
                  <HoverArrow />
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </main>
    </div>
  );
}
