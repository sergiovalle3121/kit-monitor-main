'use client';

// Contenido del embarque (Fase #1) — líneas (parte/cant/lote/UoM) ligadas
// opcionalmente a una Orden de Venta. Al embarcar (READY→SHIPPED) el backend hace
// la salida de mercancía de PT (best-effort); aquí se ve el estado `inventoryPosted`.
// Lee GET /outbound/shipments/:id/lines; alta POST, baja DELETE.
import React, { useMemo, useState } from 'react';
import { Boxes, Check, ListChecks, Loader2, Plus, Trash2, X } from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const BLUE = '#3b82f6';
const GREEN = '#10b981';
const GRAY = '#6b7280';

interface Line {
  id: string;
  partNumber: string;
  description: string | null;
  quantity: number;
  quantityShipped: number;
  uom: string;
  lotNumber: string | null;
  salesOrder: string | null;
  salesOrderLine: string | null;
  unitPrice: number | null;
  currency: string | null;
  inventoryPosted: boolean;
}

export function Content({
  shipment,
  onClose,
}: {
  shipment: { id: string; folio: string | null; title: string };
  onClose: () => void;
}) {
  const toast = useToast();
  const { data, isLoading, mutate } = useApi<Line[]>(`/outbound/shipments/${shipment.id}/lines`);
  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ partNumber: '', quantity: '', uom: 'EA', lotNumber: '', salesOrder: '', unitPrice: '' });

  const totals = useMemo(() => {
    const pieces = rows.reduce((a, r) => a + (Number(r.quantity) || 0), 0);
    const posted = rows.filter((r) => r.inventoryPosted).length;
    return { lines: rows.length, pieces, posted };
  }, [rows]);

  async function addLine() {
    const partNumber = form.partNumber.trim();
    const quantity = Number(form.quantity);
    if (!partNumber || !(quantity > 0)) {
      toast.error('Indica parte y cantidad (> 0).', 'Contenido');
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/outbound/shipments/${shipment.id}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partNumber,
          quantity,
          uom: form.uom.trim() || 'EA',
          lotNumber: form.lotNumber.trim() || undefined,
          salesOrder: form.salesOrder.trim() || undefined,
          unitPrice: form.unitPrice ? Number(form.unitPrice) : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo agregar.', 'Contenido');
        return;
      }
      setForm({ partNumber: '', quantity: '', uom: form.uom, lotNumber: '', salesOrder: '', unitPrice: '' });
      mutate();
    } catch {
      toast.error('Error de red.', 'Contenido');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      const res = await apiFetch(`${API_BASE}/outbound/lines/${id}`, { method: 'DELETE' });
      if (res.ok) mutate();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-black/40" onClick={onClose}>
      <div className={`${glass} h-full w-full max-w-md overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 px-5 py-4 flex items-center gap-3 backdrop-blur" style={{ background: 'rgba(0,0,0,0.02)' }}>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: `${BLUE}1f` }}>
            <ListChecks className="w-5 h-5" style={{ color: BLUE }} />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold leading-tight truncate">Contenido del embarque</h2>
            <p className="text-[12px] text-gray-400 leading-tight truncate">
              {shipment.folio ? `${shipment.folio} · ` : ''}{shipment.title}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-4">
          {/* Alta de línea */}
          <div className={`${glass} rounded-xl p-3 mb-4`}>
            <div className="grid grid-cols-2 gap-2">
              <input value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} placeholder="Parte (PT)" className="ct-input col-span-2" />
              <input value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} type="number" min={0} placeholder="Cantidad" className="ct-input" />
              <input value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })} placeholder="UoM" className="ct-input" />
              <input value={form.lotNumber} onChange={(e) => setForm({ ...form, lotNumber: e.target.value })} placeholder="Lote (opcional)" className="ct-input" />
              <input value={form.salesOrder} onChange={(e) => setForm({ ...form, salesOrder: e.target.value })} placeholder="Orden de venta (opcional)" className="ct-input" />
              <input value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} type="number" min={0} step="0.01" placeholder="Precio unit. (opcional)" className="ct-input" />
            </div>
            <button onClick={addLine} disabled={busy} className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60" style={{ background: BLUE }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Agregar línea
            </button>
          </div>

          {rows.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap text-[11px] text-gray-500 dark:text-gray-400 mb-2">
              <span>{totals.lines} líneas</span><span className="text-gray-300 dark:text-gray-600">·</span>
              <span>{totals.pieces} pzs</span><span className="text-gray-300 dark:text-gray-600">·</span>
              <span>{totals.posted}/{totals.lines} con PT emitido</span>
            </div>
          )}

          {/* Lista */}
          {isLoading && !data ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12">
              <Boxes className="w-8 h-8 mx-auto mb-3 text-gray-400" />
              <p className="text-sm font-medium">Sin contenido</p>
              <p className="text-[13px] text-gray-400 mt-1 max-w-xs mx-auto">Agrega las líneas de producto terminado que lleva este embarque. Al embarcar se descuenta del inventario de PT.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((l) => (
                <div key={l.id} className={`${glass} rounded-xl p-3 flex items-center gap-3`}>
                  <span className="w-7 h-7 rounded-lg grid place-items-center flex-shrink-0" style={{ background: l.inventoryPosted ? `${GREEN}1f` : `${GRAY}1f`, color: l.inventoryPosted ? GREEN : GRAY }}>
                    {l.inventoryPosted ? <Check className="w-4 h-4" /> : <Boxes className="w-4 h-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium truncate">{l.partNumber} <span className="text-gray-400 font-normal">×{l.quantity} {l.uom}</span></div>
                    <div className="text-[11px] text-gray-400 truncate">
                      {[l.lotNumber && `Lote ${l.lotNumber}`, l.salesOrder && `OV ${l.salesOrder}`, l.unitPrice != null && `${l.unitPrice} ${l.currency ?? ''}`.trim(), l.inventoryPosted ? 'PT emitido' : 'pendiente de emitir'].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {!l.inventoryPosted && (
                    <button onClick={() => remove(l.id)} title="Eliminar línea" className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-500/10">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <style jsx global>{`
          .ct-input { width: 100%; border-radius: .6rem; padding: .5rem .65rem; background: rgba(0,0,0,.03); border: 1px solid rgba(0,0,0,.08); outline: none; font-size: .8rem; color: inherit; }
          .ct-input:focus { border-color: ${BLUE}; }
          :global(.dark) .ct-input { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.1); }
        `}</style>
      </div>
    </div>
  );
}
