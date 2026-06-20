'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, ChevronDown, Loader2, Lock, Plus, Trash2, Check, X,
  Network, ListTree, Layers, Factory, AlertTriangle, Pencil, Save,
} from 'lucide-react';
import { IconTile } from '@/components/ui/IconTile';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

type NodeStatus = 'DRAFT' | 'ACTIVE' | 'OBSOLETE';
type ItemCategory = 'STANDARD' | 'PHANTOM' | 'NON_STOCK' | 'REFERENCE';

interface Material { id: string; partNumber: string; description: string; itemType: string; baseUom: string; }
interface BomLineRow {
  id: string; materialId: string; findNumber: string; quantity: number; uom: string;
  refDes?: string | null; itemCategory: ItemCategory; scrapPct: number; phantom: boolean;
  alternateGroup?: string | null; notes?: string | null; material?: Material | null;
}
interface BomNodeDetail {
  id: string; materialId: string; revision: string; status: NodeStatus;
  baseQuantity: number; baseUom: string; notes?: string | null;
  material?: Material | null; lines: BomLineRow[];
}
interface BomNodeLite { id: string; materialId: string; }
interface ExplodedNode {
  materialId: string; partNumber: string; description: string; itemType: string; makeBuy: string;
  uom: string; findNumber: string | null; refDes: string | null; level: number;
  perParentQty: number; extendedQty: number; unitCost: number; extendedCost: number;
  isAssembly: boolean; phantom: boolean; cyclic?: boolean; children: ExplodedNode[];
}
interface ExplodeResult {
  tree: ExplodedNode[];
  flat: { materialId: string; partNumber: string; description: string; uom: string; totalQty: number; unitCost: number; extendedCost: number }[];
  totalCost: number; maxDepth: number; cycles: string[];
  root: { materialId: string; partNumber: string; description: string; revision: string; qty: number };
}

const STATUS_META: Record<NodeStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Borrador', color: '#9ca3af' },
  ACTIVE: { label: 'Activo', color: '#10b981' },
  OBSOLETE: { label: 'Obsoleto', color: '#f43f5e' },
};
const NEXT_STATES: Record<NodeStatus, NodeStatus[]> = {
  DRAFT: ['ACTIVE', 'OBSOLETE'], ACTIVE: ['OBSOLETE'], OBSOLETE: ['ACTIVE'],
};
const ITEM_CATEGORIES: ItemCategory[] = ['STANDARD', 'PHANTOM', 'NON_STOCK', 'REFERENCE'];

const field =
  'w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-lg py-2 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30';
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 });

export default function BomEditorPage() {
  const params = useParams();
  const id = String((params as Record<string, string>)?.id || '');
  const toast = useToast();

  const { data: node, isLoading, forbidden, mutate } = useApi<BomNodeDetail>(id ? `/bom-tree/${id}` : null);
  const { data: materials } = useApi<Material[]>('/material-master');
  const { data: allNodes } = useApi<BomNodeLite[]>('/bom-tree');

  const [tab, setTab] = useState<'struct' | 'explode'>('struct');
  const [busy, setBusy] = useState<string | null>(null);

  const nodeByMaterial = useMemo(() => {
    const m = new Map<string, string>();
    (Array.isArray(allNodes) ? allNodes : []).forEach((n) => m.set(n.materialId, n.id));
    return m;
  }, [allNodes]);

  async function transition(to: NodeStatus) {
    setBusy(`t-${to}`);
    try {
      const res = await apiFetch(`${API_BASE}/bom-tree/${id}/transition`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: to }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d?.message || 'Transición inválida.', 'BOM'); return; }
      toast.success(`BOM → ${STATUS_META[to].label}.`, 'BOM'); mutate();
    } catch { toast.error('Error de red.', 'BOM'); } finally { setBusy(null); }
  }

  if (forbidden) {
    return <div className="min-h-screen grid place-items-center text-black dark:text-white"><div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}><Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" /><h2 className="text-lg font-semibold">Sin acceso</h2></div></div>;
  }
  if (isLoading || !node) {
    return <div className="min-h-screen flex justify-center pt-32"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  const meta = STATUS_META[node.status];

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-28">
      <main className="max-w-4xl mx-auto px-6 pt-8">
        <Link href="/dashboard/bom" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-black dark:hover:text-white mb-6">
          <ChevronLeft className="w-4 h-4" /> BOM Multinivel
        </Link>

        <div className="flex items-start gap-4 mb-6">
          <IconTile domain="engineering" size={52} icon={Network} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-mono text-gray-500">{node.material?.partNumber ?? '—'}</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: meta.color, background: `${meta.color}1a` }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />{meta.label}
              </span>
              <span className="text-[11px] text-gray-400">rev {node.revision} · base {node.baseQuantity} {node.baseUom}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight truncate">{node.material?.description ?? 'BOM'}</h1>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            {NEXT_STATES[node.status].map((to) => (
              <button key={to} onClick={() => transition(to)} disabled={!!busy} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full border border-gray-200 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50">
                {busy === `t-${to}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {node.status === 'OBSOLETE' && to === 'ACTIVE' ? 'Reactivar' : STATUS_META[to].label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-1 mb-6 border-b border-gray-100 dark:border-white/10">
          <TabBtn active={tab === 'struct'} onClick={() => setTab('struct')} icon={ListTree} label={`Estructura (${node.lines.length})`} />
          <TabBtn active={tab === 'explode'} onClick={() => setTab('explode')} icon={Layers} label="Explosión" />
        </div>

        {tab === 'struct' ? (
          <StructureTab node={node} materials={Array.isArray(materials) ? materials : []} nodeByMaterial={nodeByMaterial} onChange={mutate} />
        ) : (
          <ExplodeTab nodeId={id} baseQty={node.baseQuantity} />
        )}
      </main>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Network; label: string }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${active ? 'border-violet-500 text-black dark:text-white' : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

// ── Structure tab (editable single-level lines) ───────────────────────────────
function StructureTab({ node, materials, nodeByMaterial, onChange }: {
  node: BomNodeDetail; materials: Material[]; nodeByMaterial: Map<string, string>; onChange: () => void;
}) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ materialId: '', findNumber: '', quantity: '1', scrapPct: '0', itemCategory: 'STANDARD' as ItemCategory, refDes: '', phantom: false });

  const options = useMemo(() => materials.filter((m) => m.id !== node.materialId), [materials, node.materialId]);

  async function addLine() {
    if (!form.materialId) { toast.error('Elige un componente del maestro.', 'BOM'); return; }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/bom-tree/${node.id}/lines`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialId: form.materialId,
          findNumber: form.findNumber.trim() || undefined,
          quantity: Number(form.quantity) || 1,
          scrapPct: Number(form.scrapPct) || 0,
          itemCategory: form.itemCategory,
          refDes: form.refDes.trim() || undefined,
          phantom: form.phantom,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d?.message || 'No se pudo agregar.', 'BOM'); return; }
      toast.success('Componente agregado.', 'BOM');
      setForm({ materialId: '', findNumber: '', quantity: '1', scrapPct: '0', itemCategory: 'STANDARD', refDes: '', phantom: false });
      setAdding(false); onChange();
    } catch { toast.error('Error de red.', 'BOM'); } finally { setBusy(false); }
  }

  async function removeLine(lineId: string) {
    try {
      const res = await apiFetch(`${API_BASE}/bom-tree/${node.id}/lines/${lineId}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('No se pudo eliminar.', 'BOM'); return; }
      onChange();
    } catch { toast.error('Error de red.', 'BOM'); }
  }

  const sorted = useMemo(() => [...node.lines].sort((a, b) => a.findNumber.localeCompare(b.findNumber)), [node.lines]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setAdding((s) => !s)} className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full bg-black dark:bg-white text-white dark:text-black">
          <Plus className="w-4 h-4" /> Agregar componente
        </button>
      </div>

      {adding && (
        <div className={`${glass} rounded-2xl p-4`}>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
            <label className="block col-span-2 md:col-span-2">
              <span className="block text-[11px] font-medium text-gray-500 mb-1">Componente *</span>
              <select className={field} value={form.materialId} onChange={(e) => setForm({ ...form, materialId: e.target.value })}>
                <option value="">Del maestro…</option>
                {options.map((m) => <option key={m.id} value={m.id}>{m.partNumber} · {m.description}</option>)}
              </select>
            </label>
            <label className="block"><span className="block text-[11px] font-medium text-gray-500 mb-1">Pos.</span><input className={field} value={form.findNumber} onChange={(e) => setForm({ ...form, findNumber: e.target.value })} placeholder="auto" /></label>
            <label className="block"><span className="block text-[11px] font-medium text-gray-500 mb-1">Cant.</span><input className={field} type="number" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label>
            <label className="block"><span className="block text-[11px] font-medium text-gray-500 mb-1">Scrap %</span><input className={field} type="number" step="any" value={form.scrapPct} onChange={(e) => setForm({ ...form, scrapPct: e.target.value })} /></label>
            <label className="block"><span className="block text-[11px] font-medium text-gray-500 mb-1">Categoría</span>
              <select className={field} value={form.itemCategory} onChange={(e) => setForm({ ...form, itemCategory: e.target.value as ItemCategory })}>
                {ITEM_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="block col-span-2 md:col-span-3"><span className="block text-[11px] font-medium text-gray-500 mb-1">RefDes</span><input className={field} value={form.refDes} onChange={(e) => setForm({ ...form, refDes: e.target.value })} placeholder="R1, C1-C10" /></label>
            <label className="flex items-center gap-2 text-sm mt-5"><input type="checkbox" checked={form.phantom} onChange={(e) => setForm({ ...form, phantom: e.target.checked })} /> Phantom</label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
            <button onClick={addLine} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white dark:text-black bg-black dark:bg-white disabled:opacity-60">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Agregar
            </button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className={`${glass} rounded-2xl p-8 text-center text-sm text-gray-400`}>
          <ListTree className="w-7 h-7 mx-auto mb-2 text-gray-300" />
          BOM vacío. Agrega componentes eligiéndolos del maestro de materiales.
        </div>
      ) : (
        <div className={`${glass} rounded-2xl overflow-hidden`}>
          <div className="hidden md:grid grid-cols-[64px_1fr_80px_80px_72px_40px] gap-2 px-4 py-2 text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100 dark:border-white/10">
            <span>Pos.</span><span>Componente</span><span>Cant.</span><span>Scrap</span><span>Cat.</span><span></span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-white/10">
            {sorted.map((l) => {
              const subBomId = nodeByMaterial.get(l.materialId);
              const isAssembly = l.material?.itemType === 'MANUFACTURED' || l.material?.itemType === 'PHANTOM';
              return editId === l.id ? (
                <LineEditRow key={l.id} nodeId={node.id} line={l} onDone={() => { setEditId(null); onChange(); }} onCancel={() => setEditId(null)} />
              ) : (
                <div key={l.id} className="grid grid-cols-[64px_1fr_auto] md:grid-cols-[64px_1fr_80px_80px_72px_40px] gap-2 px-4 py-3 items-center">
                  <span className="font-mono text-xs text-gray-500">{l.findNumber}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-500">{l.material?.partNumber ?? l.materialId}</span>
                      {isAssembly && (
                        subBomId
                          ? <Link href={`/dashboard/bom/${subBomId}`} className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-500 hover:underline"><Factory className="w-3 h-3" /> sub-ensamble</Link>
                          : <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-500" title="Es ensamble pero aún no tiene BOM"><Factory className="w-3 h-3" /> sub (sin BOM)</span>
                      )}
                      {l.phantom && <span className="text-[10px] text-gray-400">phantom</span>}
                    </div>
                    <div className="truncate text-sm">{l.material?.description ?? '—'}</div>
                    {l.refDes && <div className="text-[11px] text-gray-400 truncate">{l.refDes}</div>}
                  </div>
                  <span className="text-sm tabular-nums md:text-left text-right">{l.quantity} <span className="text-gray-400 text-xs">{l.uom}</span></span>
                  <span className="hidden md:block text-sm tabular-nums text-gray-500">{l.scrapPct ? `${l.scrapPct}%` : '—'}</span>
                  <span className="hidden md:block text-[11px] text-gray-400">{l.itemCategory}</span>
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => setEditId(l.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-violet-500 hover:bg-violet-500/10"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => removeLine(l.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-500/10"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LineEditRow({ nodeId, line, onDone, onCancel }: { nodeId: string; line: BomLineRow; onDone: () => void; onCancel: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ findNumber: line.findNumber, quantity: String(line.quantity), scrapPct: String(line.scrapPct), refDes: line.refDes ?? '', phantom: line.phantom });
  async function save() {
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/bom-tree/${nodeId}/lines/${line.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ findNumber: f.findNumber.trim(), quantity: Number(f.quantity) || 0, scrapPct: Number(f.scrapPct) || 0, refDes: f.refDes.trim(), phantom: f.phantom }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || 'No se pudo guardar.', 'BOM'); return; }
      onDone();
    } catch { toast.error('Error de red.', 'BOM'); } finally { setBusy(false); }
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-[64px_1fr_80px_80px_120px] gap-2 px-4 py-3 items-center bg-violet-500/5">
      <input className={field} value={f.findNumber} onChange={(e) => setF({ ...f, findNumber: e.target.value })} />
      <input className={field} value={f.refDes} onChange={(e) => setF({ ...f, refDes: e.target.value })} placeholder="RefDes" />
      <input className={field} type="number" step="any" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} />
      <input className={field} type="number" step="any" value={f.scrapPct} onChange={(e) => setF({ ...f, scrapPct: e.target.value })} />
      <div className="flex items-center gap-1">
        <label className="flex items-center gap-1 text-xs mr-1"><input type="checkbox" checked={f.phantom} onChange={(e) => setF({ ...f, phantom: e.target.checked })} /> ph</label>
        <button onClick={save} disabled={busy} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}</button>
        <button onClick={onCancel} className="p-1.5 rounded-lg text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// ── Explode tab (multilevel tree) ─────────────────────────────────────────────
function ExplodeTab({ nodeId, baseQty }: { nodeId: string; baseQty: number }) {
  const [qty, setQty] = useState(String(baseQty || 1));
  const { data, isLoading } = useApi<ExplodeResult>(`/bom-tree/${nodeId}/explode?qty=${Number(qty) || 1}`);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) => setExpanded((s) => {
    const n = new Set(s);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (!data) return <div className={`${glass} rounded-2xl p-8 text-center text-sm text-gray-400`}>No se pudo explotar el BOM.</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          Construir
          <input className={`${field} w-24`} type="number" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
          unidades
        </label>
        <div className="ml-auto flex gap-3 text-sm">
          <span className="text-gray-400">Niveles: <b className="text-black dark:text-white">{data.maxDepth}</b></span>
          <span className="text-gray-400">Costo total: <b className="text-emerald-500">{money(data.totalCost)}</b></span>
        </div>
      </div>

      {data.cycles.length > 0 && (
        <div className={`${glass} rounded-xl p-3 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400`}>
          <AlertTriangle className="w-4 h-4 shrink-0" /> Ciclo detectado en el BOM (rama cortada): {data.cycles.join(', ')}
        </div>
      )}

      {data.tree.length === 0 ? (
        <div className={`${glass} rounded-2xl p-8 text-center text-sm text-gray-400`}>Este BOM no tiene componentes todavía.</div>
      ) : (
        <div className={`${glass} rounded-2xl p-3`}>
          {data.tree.map((n, i) => <TreeRow key={`${i}`} node={n} path={`${i}`} expanded={expanded} toggle={toggle} />)}
        </div>
      )}

      {/* Flat demand rollup */}
      {data.flat.length > 0 && (
        <div className={`${glass} rounded-2xl overflow-hidden`}>
          <div className="px-4 py-2 text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100 dark:border-white/10">Demanda neta (hojas compradas)</div>
          <div className="divide-y divide-gray-100 dark:divide-white/10">
            {data.flat.map((f) => (
              <div key={f.materialId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="font-mono text-xs text-gray-500 w-32 shrink-0 truncate">{f.partNumber}</span>
                <span className="truncate flex-1">{f.description}</span>
                <span className="tabular-nums">{f.totalQty} {f.uom}</span>
                <span className="tabular-nums text-gray-500 w-24 text-right">{money(f.extendedCost)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TreeRow({ node, path, expanded, toggle }: { node: ExplodedNode; path: string; expanded: Set<string>; toggle: (k: string) => void }) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(path) || node.level <= 1; // expand first level by default
  return (
    <div>
      <div className="flex items-center gap-2 py-1.5 rounded-lg hover:bg-black/[0.02] dark:hover:bg-white/[0.03]" style={{ paddingLeft: `${(node.level - 1) * 20}px` }}>
        {hasChildren ? (
          <button onClick={() => toggle(path)} className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10">
            {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          </button>
        ) : <span className="w-5 inline-block" />}
        {node.isAssembly ? <Factory className="w-3.5 h-3.5 text-violet-500 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-white/20 shrink-0" />}
        <span className="font-mono text-xs text-gray-500 shrink-0">{node.findNumber ?? ''}</span>
        <span className="font-mono text-xs text-gray-500 shrink-0">{node.partNumber}</span>
        <span className="truncate text-sm flex-1">{node.description}{node.cyclic && <span className="text-amber-500 text-xs ml-2">↻ ciclo</span>}</span>
        <span className="text-sm tabular-nums shrink-0">{node.extendedQty} <span className="text-gray-400 text-xs">{node.uom}</span></span>
        <span className="hidden sm:inline text-xs tabular-nums text-gray-400 w-20 text-right shrink-0">{money(node.extendedCost)}</span>
      </div>
      {hasChildren && isOpen && node.children.map((c, i) => (
        <TreeRow key={`${path}-${i}`} node={c} path={`${path}-${i}`} expanded={expanded} toggle={toggle} />
      ))}
    </div>
  );
}
