'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft, ChevronDown, ChevronRight, Loader2, Lock, Plus, Trash2, Check, X,
  Workflow, Clock, MapPin, Pencil, Save, Package2,
} from 'lucide-react';
import { IconTile } from '@/components/ui/IconTile';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

type RoutingStatus = 'DRAFT' | 'ACTIVE' | 'OBSOLETE';
interface Material { id: string; partNumber: string; description: string; itemType: string; baseUom: string; }
interface OpMaterial { id: string; materialId: string; qtyPerUnit: number; uom: string; bomLineId?: string | null; material?: Material | null; }
interface Operation {
  id: string; sequence: number; name: string; workCenter?: string | null;
  setupTimeMin: number; runTimePerUnitMin: number; description?: string | null;
  visualAidRef?: string | null; materials: OpMaterial[];
}
interface RoutingDetail {
  id: string; materialId: string; revision: string; status: RoutingStatus; name?: string | null;
  material?: Material | null;
  totals: { totalSetupMin: number; totalRunPerUnitMin: number; totalForQtyMin: number; operations: number };
  operations: Operation[];
}

const STATUS_META: Record<RoutingStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Borrador', color: '#9ca3af' },
  ACTIVE: { label: 'Activo', color: '#10b981' },
  OBSOLETE: { label: 'Obsoleto', color: '#f43f5e' },
};
const NEXT_STATES: Record<RoutingStatus, RoutingStatus[]> = {
  DRAFT: ['ACTIVE', 'OBSOLETE'], ACTIVE: ['OBSOLETE'], OBSOLETE: ['ACTIVE'],
};

const field =
  'w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-lg py-2 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';

export default function RoutingEditorPage() {
  const params = useParams();
  const id = String((params as Record<string, string>)?.id || '');
  const toast = useToast();

  const { data: routing, isLoading, forbidden, mutate } = useApi<RoutingDetail>(id ? `/routing/${id}` : null);
  const { data: materials } = useApi<Material[]>('/material-master');

  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', sequence: '', workCenter: '', setupTimeMin: '0', runTimePerUnitMin: '0', description: '', visualAidRef: '' });

  const mats = useMemo(() => (Array.isArray(materials) ? materials : []), [materials]);

  async function transition(to: RoutingStatus) {
    setBusy(`t-${to}`);
    try {
      const res = await apiFetch(`${API_BASE}/routing/${id}/transition`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: to }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d?.message || 'Transición inválida.', 'Ruteo'); return; }
      toast.success(`Ruteo → ${STATUS_META[to].label}.`, 'Ruteo'); mutate();
    } catch { toast.error('Error de red.', 'Ruteo'); } finally { setBusy(null); }
  }

  async function addOperation() {
    if (!form.name.trim()) { toast.error('La operación necesita un nombre.', 'Ruteo'); return; }
    setBusy('add');
    try {
      const res = await apiFetch(`${API_BASE}/routing/${id}/operations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          sequence: form.sequence ? Number(form.sequence) : undefined,
          workCenter: form.workCenter.trim() || undefined,
          setupTimeMin: Number(form.setupTimeMin) || 0,
          runTimePerUnitMin: Number(form.runTimePerUnitMin) || 0,
          description: form.description.trim() || undefined,
          visualAidRef: form.visualAidRef.trim() || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d?.message || 'No se pudo agregar.', 'Ruteo'); return; }
      toast.success('Operación agregada.', 'Ruteo');
      setForm({ name: '', sequence: '', workCenter: '', setupTimeMin: '0', runTimePerUnitMin: '0', description: '', visualAidRef: '' });
      setAdding(false); mutate();
    } catch { toast.error('Error de red.', 'Ruteo'); } finally { setBusy(null); }
  }

  if (forbidden) {
    return <div className="min-h-screen grid place-items-center text-foreground"><div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}><Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" /><h2 className="text-lg font-semibold">Sin acceso</h2></div></div>;
  }
  if (isLoading || !routing) {
    return <div className="min-h-screen flex justify-center pt-32"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  const meta = STATUS_META[routing.status];

  return (
    <div className="min-h-screen text-foreground font-sans pb-28">
      <main className="max-w-4xl mx-auto px-6 pt-8">
        <Link href="/dashboard/routing" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-black dark:hover:text-white mb-6">
          <ChevronLeft className="w-4 h-4" /> Ruteo de Manufactura
        </Link>

        <div className="flex items-start gap-4 mb-6">
          <IconTile domain="engineering" size={52} icon={Workflow} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-mono text-gray-500">{routing.material?.partNumber ?? '—'}</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: meta.color, background: `${meta.color}1a` }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />{meta.label}
              </span>
              <span className="text-[11px] text-gray-400">rev {routing.revision}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight truncate">{routing.name || routing.material?.description || 'Ruteo'}</h1>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            {NEXT_STATES[routing.status].map((to) => (
              <button key={to} onClick={() => transition(to)} disabled={!!busy} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full border border-gray-200 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50">
                {busy === `t-${to}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {routing.status === 'OBSOLETE' && to === 'ACTIVE' ? 'Reactivar' : STATUS_META[to].label}
              </button>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Kpi label="Operaciones" value={routing.totals.operations} color="#5b5bd6" />
          <Kpi label="Setup total (min)" value={routing.totals.totalSetupMin} color="#f59e0b" />
          <Kpi label="Run / unidad (min)" value={routing.totals.totalRunPerUnitMin} color="#10b981" />
        </div>

        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Operaciones</h2>
          <button onClick={() => setAdding((s) => !s)} className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full bg-black dark:bg-white text-white dark:text-black">
            <Plus className="w-4 h-4" /> Agregar operación
          </button>
        </div>

        {adding && (
          <div className={`${glass} rounded-2xl p-4 mb-4`}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <label className="block col-span-2"><span className="block text-[11px] font-medium text-gray-500 mb-1">Nombre *</span><input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="SMT / AOI / Ensamble…" /></label>
              <label className="block"><span className="block text-[11px] font-medium text-gray-500 mb-1">Secuencia</span><input className={field} type="number" value={form.sequence} onChange={(e) => setForm({ ...form, sequence: e.target.value })} placeholder="auto" /></label>
              <label className="block"><span className="block text-[11px] font-medium text-gray-500 mb-1">Centro de trabajo</span><input className={field} value={form.workCenter} onChange={(e) => setForm({ ...form, workCenter: e.target.value })} placeholder="Línea SMT 1" /></label>
              <label className="block"><span className="block text-[11px] font-medium text-gray-500 mb-1">Setup (min)</span><input className={field} type="number" step="any" value={form.setupTimeMin} onChange={(e) => setForm({ ...form, setupTimeMin: e.target.value })} /></label>
              <label className="block"><span className="block text-[11px] font-medium text-gray-500 mb-1">Run/unidad (min)</span><input className={field} type="number" step="any" value={form.runTimePerUnitMin} onChange={(e) => setForm({ ...form, runTimePerUnitMin: e.target.value })} /></label>
              <label className="block col-span-2"><span className="block text-[11px] font-medium text-gray-500 mb-1">Visual aid / instrucción</span><input className={field} value={form.visualAidRef} onChange={(e) => setForm({ ...form, visualAidRef: e.target.value })} placeholder="ref" /></label>
              <label className="block col-span-2 md:col-span-4"><span className="block text-[11px] font-medium text-gray-500 mb-1">Descripción</span><textarea className={field} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setAdding(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
              <button onClick={addOperation} disabled={busy === 'add'} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white dark:text-black bg-black dark:bg-white disabled:opacity-60">
                {busy === 'add' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Agregar
              </button>
            </div>
          </div>
        )}

        {routing.operations.length === 0 ? (
          <div className={`${glass} rounded-2xl p-8 text-center text-sm text-gray-400`}>
            <Workflow className="w-7 h-7 mx-auto mb-2 text-gray-300" />
            Sin operaciones. Define la secuencia de manufactura del ensamble.
          </div>
        ) : (
          <div className="space-y-3">
            {routing.operations.map((op) => (
              <OperationCard key={op.id} routingId={id} op={op} materials={mats} onChange={mutate} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums" style={{ color }}>{value}</div>
    </div>
  );
}

function OperationCard({ routingId, op, materials, onChange }: { routingId: string; op: Operation; materials: Material[]; onChange: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: op.name, sequence: String(op.sequence), workCenter: op.workCenter ?? '',
    setupTimeMin: String(op.setupTimeMin), runTimePerUnitMin: String(op.runTimePerUnitMin),
    description: op.description ?? '', visualAidRef: op.visualAidRef ?? '',
  });
  const [matForm, setMatForm] = useState({ materialId: '', qtyPerUnit: '1' });

  const options = useMemo(() => materials, [materials]);

  async function save() {
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/routing/${routingId}/operations/${op.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: f.name.trim(), sequence: Number(f.sequence) || op.sequence, workCenter: f.workCenter.trim(),
          setupTimeMin: Number(f.setupTimeMin) || 0, runTimePerUnitMin: Number(f.runTimePerUnitMin) || 0,
          description: f.description.trim(), visualAidRef: f.visualAidRef.trim(),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d?.message || 'No se pudo guardar.', 'Ruteo'); return; }
      toast.success('Operación actualizada.', 'Ruteo'); setEditing(false); onChange();
    } catch { toast.error('Error de red.', 'Ruteo'); } finally { setBusy(false); }
  }

  async function removeOp() {
    try {
      const res = await apiFetch(`${API_BASE}/routing/${routingId}/operations/${op.id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('No se pudo eliminar.', 'Ruteo'); return; }
      onChange();
    } catch { toast.error('Error de red.', 'Ruteo'); }
  }

  async function addMaterial() {
    if (!matForm.materialId) { toast.error('Elige un material del maestro.', 'Ruteo'); return; }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/routing/${routingId}/operations/${op.id}/materials`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialId: matForm.materialId, qtyPerUnit: Number(matForm.qtyPerUnit) || 1 }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d?.message || 'No se pudo agregar.', 'Ruteo'); return; }
      setMatForm({ materialId: '', qtyPerUnit: '1' }); onChange();
    } catch { toast.error('Error de red.', 'Ruteo'); } finally { setBusy(false); }
  }

  async function removeMaterial(matId: string) {
    try {
      const res = await apiFetch(`${API_BASE}/routing/${routingId}/operations/${op.id}/materials/${matId}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('No se pudo quitar.', 'Ruteo'); return; }
      onChange();
    } catch { toast.error('Error de red.', 'Ruteo'); }
  }

  if (editing) {
    return (
      <div className={`${glass} rounded-2xl p-4 ring-1 ring-primary/30`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <label className="block col-span-2"><span className="block text-[11px] text-gray-500 mb-1">Nombre</span><input className={field} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="block"><span className="block text-[11px] text-gray-500 mb-1">Secuencia</span><input className={field} type="number" value={f.sequence} onChange={(e) => setF({ ...f, sequence: e.target.value })} /></label>
          <label className="block"><span className="block text-[11px] text-gray-500 mb-1">Centro</span><input className={field} value={f.workCenter} onChange={(e) => setF({ ...f, workCenter: e.target.value })} /></label>
          <label className="block"><span className="block text-[11px] text-gray-500 mb-1">Setup (min)</span><input className={field} type="number" step="any" value={f.setupTimeMin} onChange={(e) => setF({ ...f, setupTimeMin: e.target.value })} /></label>
          <label className="block"><span className="block text-[11px] text-gray-500 mb-1">Run/u (min)</span><input className={field} type="number" step="any" value={f.runTimePerUnitMin} onChange={(e) => setF({ ...f, runTimePerUnitMin: e.target.value })} /></label>
          <label className="block col-span-2"><span className="block text-[11px] text-gray-500 mb-1">Visual aid</span><input className={field} value={f.visualAidRef} onChange={(e) => setF({ ...f, visualAidRef: e.target.value })} /></label>
          <label className="block col-span-2 md:col-span-4"><span className="block text-[11px] text-gray-500 mb-1">Descripción</span><textarea className={field} rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold text-white dark:text-black bg-black dark:bg-white disabled:opacity-60">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${glass} rounded-2xl overflow-hidden`}>
      <div className="flex items-center gap-3 p-4">
        <button onClick={() => setOpen((s) => !s)} className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10">
          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </button>
        <span className="font-mono text-sm text-primary font-semibold w-10">{op.sequence}</span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{op.name}</div>
          <div className="text-xs text-gray-400 flex items-center gap-3 flex-wrap">
            {op.workCenter && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{op.workCenter}</span>}
            <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />setup {op.setupTimeMin}m · run {op.runTimePerUnitMin}m/u</span>
            {op.materials.length > 0 && <span className="inline-flex items-center gap-1"><Package2 className="w-3 h-3" />{op.materials.length} mat.</span>}
          </div>
        </div>
        <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10"><Pencil className="w-4 h-4" /></button>
        <button onClick={removeOp} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-white/10 pt-3">
          {op.description && <p className="text-sm text-gray-500 mb-3">{op.description}</p>}
          {op.visualAidRef && <p className="text-xs text-gray-400 mb-3">Visual aid: {op.visualAidRef}</p>}

          <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-2">Materiales consumidos (backflush)</div>
          {op.materials.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {op.materials.map((m) => (
                <div key={m.id} className="flex items-center gap-2 text-sm">
                  <Package2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="font-mono text-xs text-gray-500">{m.material?.partNumber ?? m.materialId}</span>
                  <span className="truncate flex-1">{m.material?.description ?? ''}</span>
                  <span className="tabular-nums text-gray-500">{m.qtyPerUnit} {m.uom}/u</span>
                  <button onClick={() => removeMaterial(m.id)} className="p-1 rounded text-gray-400 hover:text-rose-500 hover:bg-rose-500/10"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <select className={field} value={matForm.materialId} onChange={(e) => setMatForm({ ...matForm, materialId: e.target.value })}>
              <option value="">Agregar material del maestro…</option>
              {options.map((m) => <option key={m.id} value={m.id}>{m.partNumber} · {m.description}</option>)}
            </select>
            <input className={`${field} sm:w-28`} type="number" step="any" value={matForm.qtyPerUnit} onChange={(e) => setMatForm({ ...matForm, qtyPerUnit: e.target.value })} placeholder="Cant./u" />
            <button onClick={addMaterial} disabled={busy} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white dark:text-black bg-black dark:bg-white disabled:opacity-60 shrink-0">
              <Plus className="w-4 h-4" /> Asignar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
