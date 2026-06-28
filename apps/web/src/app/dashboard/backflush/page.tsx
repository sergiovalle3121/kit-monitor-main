'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Loader2, Lock, PackageMinus, ArrowRight, CheckCircle2, AlertTriangle, Boxes, X,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface Material { id: string; partNumber: string; description: string; }
interface RoutingLite { id: string; revision: string; material?: Material | null; operationCount: number; }
interface OpMaterial { id: string; materialId: string; qtyPerUnit: number; uom: string; material?: Material | null; }
interface Operation { id: string; sequence: number; name: string; workCenter?: string | null; materials: OpMaterial[]; }
interface RoutingDetail { id: string; revision: string; material?: Material | null; operations: Operation[]; }
interface BackflushLine { materialId: string; partNumber: string; description: string; qtyPerUnit: number; uom: string; consumeQty: number; }
interface Preview { routing: { id: string; partNumber: string; revision: string }; operation: { id: string; sequence: number; name: string; workCenter: string | null }; units: number; lines: BackflushLine[]; total: number; }
interface Report { units: number; operation: { id: string; sequence: number; name: string }; consumed: { partNumber: string; qty: number; uom: string }[]; errors: { partNumber: string; message: string }[]; }

const field =
  'w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-lg py-2 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30';

export default function BackflushPage() {
  const toast = useToast();
  const { data: routings, isLoading, forbidden } = useApi<RoutingLite[]>('/routing');

  const [routingId, setRoutingId] = useState('');
  const [operationId, setOperationId] = useState('');
  const [units, setUnits] = useState('1');
  const [warehouseId, setWarehouseId] = useState('');
  const [location, setLocation] = useState('');
  const [workOrder, setWorkOrder] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const { data: detail } = useApi<RoutingDetail>(routingId ? `/routing/${routingId}` : null);

  const routingList = useMemo(() => (Array.isArray(routings) ? routings : []), [routings]);
  const operations = useMemo(() => (detail?.operations ?? []), [detail]);

  // Reset downstream selections in the handlers (avoids cascading-render effects).
  function pickRouting(v: string) { setRoutingId(v); setOperationId(''); setPreview(null); setReport(null); }
  function pickOperation(v: string) { setOperationId(v); setPreview(null); setReport(null); }
  function changeUnits(v: string) { setUnits(v); setPreview(null); setReport(null); }

  async function runPreview() {
    if (!routingId || !operationId) { toast.error('Elige ruteo y operación.', 'Backflush'); return; }
    setBusy('preview');
    try {
      const res = await apiFetch(`${API_BASE}/routing-backflush/preview`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routingId, operationId, units: Number(units) || 0 }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d) { toast.error(d?.message || 'No se pudo previsualizar.', 'Backflush'); return; }
      setPreview(d); setReport(null);
    } catch { toast.error('Error de red.', 'Backflush'); } finally { setBusy(null); }
  }

  async function commit() {
    if (!warehouseId.trim()) { toast.error('Indica el almacén origen.', 'Backflush'); return; }
    setBusy('commit');
    try {
      const res = await apiFetch(`${API_BASE}/routing-backflush/commit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routingId, operationId, units: Number(units) || 0,
          warehouseId: warehouseId.trim(), location: location.trim() || undefined, workOrder: workOrder.trim() || undefined,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d) { toast.error(d?.message || 'No se pudo consumir.', 'Backflush'); return; }
      setReport(d);
      if (d.errors.length === 0) toast.success(`Backflush: ${d.consumed.length} materiales consumidos.`, 'Backflush');
      else toast.info(`Backflush parcial: ${d.consumed.length} ok, ${d.errors.length} con error.`, 'Backflush');
    } catch { toast.error('Error de red.', 'Backflush'); } finally { setBusy(null); }
  }

  if (forbidden) {
    return <div className="min-h-screen grid place-items-center text-foreground"><div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}><Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" /><h2 className="text-lg font-semibold">Sin acceso</h2></div></div>;
  }

  return (
    <div className="min-h-screen text-foreground font-sans pb-28">
      <main className="max-w-3xl mx-auto px-6 pt-10">
        <PageHeader domain="production" title="Backflush por Ruteo" icon={PackageMinus}
          subtitle="Confirma unidades en una operación y consume del inventario los materiales asignados a esa operación (rt_operation_material × unidades)." />

        {!isLoading && routingList.length === 0 && (
          <div className={`${glass} rounded-2xl p-4 mb-6 text-sm text-amber-600 dark:text-amber-400`}>
            No hay ruteos. Crea uno en{' '}
            <Link href="/dashboard/routing" className="underline font-medium">Ruteo de Manufactura</Link>{' '}
            y asígnale materiales por operación.
          </div>
        )}

        {/* Selection */}
        <div className={`${glass} rounded-2xl p-5 mb-4`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="block md:col-span-2">
              <span className="block text-[11px] font-medium text-gray-500 mb-1">Ruteo / ensamble</span>
              <select className={field} value={routingId} onChange={(e) => pickRouting(e.target.value)}>
                <option value="">Elegir ruteo…</option>
                {routingList.map((r) => <option key={r.id} value={r.id}>{r.material?.partNumber} · {r.material?.description} (rev {r.revision})</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-[11px] font-medium text-gray-500 mb-1">Unidades producidas</span>
              <input className={field} type="number" min="0" value={units} onChange={(e) => changeUnits(e.target.value)} />
            </label>
            <label className="block md:col-span-3">
              <span className="block text-[11px] font-medium text-gray-500 mb-1">Operación</span>
              <select className={field} value={operationId} onChange={(e) => pickOperation(e.target.value)} disabled={!routingId}>
                <option value="">{routingId ? 'Elegir operación…' : 'Primero elige un ruteo'}</option>
                {operations.map((o) => <option key={o.id} value={o.id}>{o.sequence} · {o.name}{o.workCenter ? ` (${o.workCenter})` : ''} — {o.materials.length} mat.</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={runPreview} disabled={busy === 'preview' || !operationId} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white dark:text-black bg-black dark:bg-white disabled:opacity-50">
              {busy === 'preview' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />} Previsualizar consumo
            </button>
          </div>
        </div>

        {/* Preview */}
        {preview && (
          <div className={`${glass} rounded-2xl overflow-hidden mb-4`}>
            <div className="px-4 py-2 text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100 dark:border-white/10 flex justify-between">
              <span>Consumo · op {preview.operation.sequence} {preview.operation.name} × {preview.units} u</span>
              <span>{preview.lines.length} materiales</span>
            </div>
            {preview.lines.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">Esta operación no tiene materiales asignados. Asígnalos en el ruteo.</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-white/10">
                {preview.lines.map((l) => (
                  <div key={l.materialId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <Boxes className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="font-mono text-xs text-gray-500 shrink-0">{l.partNumber}</span>
                    <span className="truncate flex-1">{l.description}</span>
                    <span className="text-xs text-gray-400">{l.qtyPerUnit}/u</span>
                    <span className="tabular-nums font-semibold w-24 text-right">{l.consumeQty} {l.uom}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Commit */}
        {preview && preview.lines.length > 0 && (
          <div className={`${glass} rounded-2xl p-5`}>
            <h3 className="font-semibold text-sm mb-3">Confirmar consumo a inventario</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="block">
                <span className="block text-[11px] font-medium text-gray-500 mb-1">Almacén origen *</span>
                <input className={field} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} placeholder="WH-01" />
              </label>
              <label className="block">
                <span className="block text-[11px] font-medium text-gray-500 mb-1">Ubicación</span>
                <input className={field} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="BULK" />
              </label>
              <label className="block">
                <span className="block text-[11px] font-medium text-gray-500 mb-1">Orden de trabajo (ref)</span>
                <input className={field} value={workOrder} onChange={(e) => setWorkOrder(e.target.value)} placeholder="WO-…" />
              </label>
            </div>
            <div className="mt-2 text-[11px] text-gray-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Descuenta stock <b>available</b> del almacén indicado. Las partes sin stock o sin alta en el master de inventario se reportan por línea (no se descuentan).
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={commit} disabled={busy === 'commit'} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white dark:text-black bg-orange-500 disabled:opacity-60">
                {busy === 'commit' ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageMinus className="w-4 h-4" />} Consumir {preview.lines.length} materiales
              </button>
            </div>
          </div>
        )}

        {/* Report */}
        {report && (
          <div className={`${glass} rounded-2xl p-5 mt-4`}>
            <div className="flex items-center gap-2 mb-3">
              {report.errors.length === 0 ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertTriangle className="w-5 h-5 text-amber-500" />}
              <h3 className="font-semibold">Resultado del backflush</h3>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <Kpi label="Unidades" value={report.units} color="#5b5bd6" />
              <Kpi label="Consumidos" value={report.consumed.length} color="#10b981" />
              <Kpi label="Errores" value={report.errors.length} color="#f43f5e" />
            </div>
            {report.consumed.length > 0 && (
              <div className="text-sm space-y-1 mb-3">
                {report.consumed.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> <span className="font-mono text-xs">{c.partNumber}</span> −{c.qty} {c.uom}
                  </div>
                ))}
              </div>
            )}
            {report.errors.length > 0 && (
              <div className="text-sm space-y-1">
                {report.errors.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-rose-500">
                    <X className="w-3.5 h-3.5 shrink-0 mt-0.5" /> <span className="font-mono text-xs shrink-0">{e.partNumber}</span> <span>{e.message}</span>
                  </div>
                ))}
              </div>
            )}
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
