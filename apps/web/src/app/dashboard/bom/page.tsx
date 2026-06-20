'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import {
  Plus, Loader2, Lock, Search, X, CheckCircle2, Network, Inbox, GitBranch,
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

type NodeStatus = 'DRAFT' | 'ACTIVE' | 'OBSOLETE';

interface Material {
  id: string;
  partNumber: string;
  description: string;
  itemType: string;
  baseUom: string;
}

interface BomNode {
  id: string;
  materialId: string;
  revision: string;
  status: NodeStatus;
  baseQuantity: number;
  baseUom: string;
  material?: Material | null;
  lineCount: number;
}

interface WhereUsed {
  bomNodeId: string;
  parentMaterialId: string;
  parentPartNumber: string;
  parentDescription: string;
  findNumber: string;
  quantity: number;
  uom: string;
  level: number;
}

const STATUS_META: Record<NodeStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Borrador', color: '#9ca3af' },
  ACTIVE: { label: 'Activo', color: '#10b981' },
  OBSOLETE: { label: 'Obsoleto', color: '#f43f5e' },
};

const field =
  'w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all';

export default function BomListPage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const toast = useToast();

  const { data, isLoading, forbidden, mutate } = useApi<BomNode[]>('/bom-tree');
  const { data: materials } = useApi<Material[]>('/material-master');

  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ materialId: '', revision: '1.0', baseQuantity: '1' });

  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const mats = useMemo(() => (Array.isArray(materials) ? materials : []), [materials]);
  // Assemblies first (make/phantom) for the create picker, then everything.
  const assemblyOptions = useMemo(
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
    return list.filter((n) =>
      `${n.material?.partNumber ?? ''} ${n.material?.description ?? ''} ${n.revision}`
        .toLowerCase().includes(q),
    );
  }, [list, query]);

  async function createBom() {
    if (!form.materialId) { toast.error('Elige el material/ensamble.', 'BOM'); return; }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/bom-tree`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialId: form.materialId,
          revision: form.revision.trim() || '1.0',
          baseQuantity: Number(form.baseQuantity) || 1,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d?.message || 'No se pudo crear el BOM.', 'BOM'); return; }
      toast.success('BOM creado.', 'BOM');
      setShowForm(false);
      setForm({ materialId: '', revision: '1.0', baseQuantity: '1' });
      mutate();
      router.push(`/dashboard/bom/${d.id}`);
    } catch {
      toast.error('Error de red al crear el BOM.', 'BOM');
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
          <p className="text-sm text-gray-400 mt-1">Inicia sesión para ver los BOMs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-28">
      <main className="max-w-5xl mx-auto px-6 pt-10">
        <PageHeader
          domain="engineering"
          title="BOM Multinivel"
          subtitle="Estructuras de producto reales (N niveles). Cada componente se elige del maestro de materiales — sin texto libre."
          icon={Network}
          right={
            <button
              onClick={() => setShowForm((s) => !s)}
              className="inline-flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold px-4 py-2.5 rounded-full hover:scale-[1.02] active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4" /> Nuevo BOM
            </button>
          }
        />

        {mats.length === 0 && (
          <div className={`${glass} rounded-2xl p-4 mb-6 text-sm text-amber-600 dark:text-amber-400`}>
            Aún no hay materiales. Crea partes en el{' '}
            <Link href="/dashboard/materials" className="underline font-medium">Maestro de Materiales</Link>{' '}
            antes de armar un BOM.
          </div>
        )}

        {/* Create form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={reduce ? undefined : { opacity: 0, height: 0 }}
              className={`${glass} rounded-2xl p-5 mb-6 overflow-hidden`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Nuevo BOM</h3>
                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <label className="block md:col-span-2">
                  <span className="block text-[12px] font-medium text-gray-500 mb-1">Material / ensamble *</span>
                  <select className={field} value={form.materialId} onChange={(e) => setForm({ ...form, materialId: e.target.value })}>
                    <option value="">Elegir del maestro…</option>
                    {assemblyOptions.map((m) => (
                      <option key={m.id} value={m.id}>{m.partNumber} · {m.description}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-[12px] font-medium text-gray-500 mb-1">Revisión</span>
                  <input className={field} value={form.revision} onChange={(e) => setForm({ ...form, revision: e.target.value })} placeholder="1.0" />
                </label>
                <label className="block">
                  <span className="block text-[12px] font-medium text-gray-500 mb-1">Cantidad base</span>
                  <input className={field} type="number" step="any" value={form.baseQuantity} onChange={(e) => setForm({ ...form, baseQuantity: e.target.value })} />
                </label>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
                <button onClick={createBom} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white dark:text-black bg-black dark:bg-white disabled:opacity-60">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Crear BOM
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Where-used tool */}
        <WhereUsedTool materials={assemblyOptions} />

        {/* Search */}
        {list.length > 0 && (
          <div className={`${glass} flex items-center gap-2 px-3 py-2 rounded-2xl mb-5`}>
            <Search className="w-4 h-4 text-gray-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por parte, descripción o revisión…" className="bg-transparent outline-none text-sm w-full" />
            {query && <button onClick={() => setQuery('')} className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-3.5 h-3.5" /></button>}
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : list.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold">Aún no hay BOMs</h3>
            <p className="text-sm text-gray-400 mt-1 mb-4">Crea el BOM de un ensamble y agrega componentes del maestro.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={`${glass} rounded-3xl p-10 text-center text-sm text-gray-400`}>Sin resultados.</div>
        ) : (
          <motion.div variants={containerRM(reduce)} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((n) => {
              const meta = STATUS_META[n.status];
              return (
                <motion.button
                  key={n.id}
                  variants={itemRM(reduce)}
                  whileHover={hoverRM(reduce)}
                  whileTap={pressRM(reduce)}
                  onClick={() => router.push(`/dashboard/bom/${n.id}`)}
                  className={`${glass} group rounded-2xl p-4 text-left flex items-center gap-3`}
                >
                  <IconTile domain="engineering" size={44} icon={Network} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-mono text-gray-500">{n.material?.partNumber ?? '—'}</span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: meta.color, background: `${meta.color}1a` }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />{meta.label}
                      </span>
                    </div>
                    <div className="font-semibold truncate">{n.material?.description ?? 'Material'}</div>
                    <div className="text-xs text-gray-400 truncate">rev {n.revision} · {n.lineCount} líneas · base {n.baseQuantity} {n.baseUom}</div>
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

function WhereUsedTool({ materials }: { materials: Material[] }) {
  const [materialId, setMaterialId] = useState('');
  const { data, isLoading } = useApi<WhereUsed[]>(materialId ? `/bom-tree/where-used/${materialId}` : null);
  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  return (
    <div className={`${glass} rounded-2xl p-4 mb-6`}>
      <div className="flex items-center gap-2 mb-3">
        <GitBranch className="w-4 h-4 text-violet-500" />
        <h3 className="font-semibold text-sm">¿Dónde se usa un material?</h3>
      </div>
      <select className={field} value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
        <option value="">Elegir material…</option>
        {materials.map((m) => <option key={m.id} value={m.id}>{m.partNumber} · {m.description}</option>)}
      </select>
      {materialId && (
        isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-400 mt-3">No aparece en ningún BOM todavía.</p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {rows.map((r, i) => (
              <div key={`${r.bomNodeId}-${i}`} className="flex items-center gap-2 text-sm" style={{ paddingLeft: `${(r.level - 1) * 16}px` }}>
                <span className="text-[10px] font-mono text-gray-400">N{r.level}</span>
                <span className="font-mono text-xs text-gray-500">{r.parentPartNumber}</span>
                <span className="truncate text-gray-600 dark:text-gray-300">{r.parentDescription}</span>
                <span className="text-xs text-gray-400 ml-auto shrink-0">{r.quantity} {r.uom} · pos {r.findNumber}</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
