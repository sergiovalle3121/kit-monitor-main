"use client";

import React, { useMemo, useState } from "react";
import { Loader2, Lock, Inbox, PackagePlus, X, CheckCircle2, ShieldQuestion } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/hooks/useAuth";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");
const ACCENT = "#0a84ff"; // dominio "staging/almacén" — entrada de material

interface Warehouse { id: string; code?: string; name?: string }
interface Supplier { id: number | string; code: string; name?: string; status?: string }

interface Receipt {
  id: number | string;
  receiptNumber: string;
  supplierCode?: string | null;
  partNumber: string;
  lotNumber?: string | null;
  serialNumber?: string | null;
  quantity: number;
  warehouseId?: string | null;
  location?: string | null;
  poNumber?: string | null;
  receivedBy?: string | null;
  createdAt?: string | null;
}

function timeAgo(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return d.toLocaleDateString();
}

export default function ReceivingPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, isLoading, forbidden, mutate } = useApi<Receipt[]>("/receiving/events");
  const { data: whData } = useApi<Warehouse[]>("/enterprise/warehouses");
  const { data: supData } = useApi<Supplier[]>("/suppliers");

  const receipts = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const warehouses = useMemo(() => (Array.isArray(whData) ? whData : []), [whData]);
  const suppliers = useMemo(() => (Array.isArray(supData) ? supData : []), [supData]);

  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    partNumber: "",
    quantity: 0,
    warehouseId: "",
    location: "DOCK",
    supplierCode: "",
    lotNumber: "",
    poNumber: "",
  });

  // Default al primer almacén cuando llega la lista (si el usuario no eligió).
  const warehouseId = form.warehouseId || warehouses[0]?.id || "";

  async function submit() {
    if (form.partNumber.trim().length < 1) {
      toast.error("Indica el número de parte.", "Recibo");
      return;
    }
    if (!(form.quantity > 0)) {
      toast.error("La cantidad debe ser mayor a 0.", "Recibo");
      return;
    }
    if (!warehouseId) {
      toast.error("Indica el almacén de recepción.", "Recibo");
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/receiving/receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partNumber: form.partNumber.trim(),
          quantity: Number(form.quantity),
          warehouseId,
          location: form.location.trim() || "DOCK",
          // supplierCode es NOT NULL en la entidad → nunca lo mandamos vacío.
          supplierCode: form.supplierCode.trim() || "N/A",
          lotNumber: form.lotNumber.trim() || undefined,
          poNumber: form.poNumber.trim() || undefined,
          receivedBy: user?.email || "operador",
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || "No se pudo registrar el recibo.", "Recibo");
        return;
      }
      const saved = await res.json().catch(() => null);
      toast.success(`Recibo ${saved?.receiptNumber || ""} registrado → inventario (IQC pendiente).`, "Recibo");
      setShowForm(false);
      setForm({ partNumber: "", quantity: 0, warehouseId: form.warehouseId, location: "DOCK", supplierCode: "", lotNumber: "", poNumber: "" });
      mutate();
    } catch {
      toast.error("Error de red.", "Recibo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <main className="max-w-4xl mx-auto px-6 pt-10">
        <PageHeader
          domain="staging"
          title="Recibo de material"
          subtitle="Entrada a inventario — cada recibo crea un movimiento RECEIVE (IQC pendiente)"
          icon={PackagePlus}
          right={
            <button
              onClick={() => setShowForm((s) => !s)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white"
              style={{ background: ACCENT }}
            >
              <PackagePlus className="w-4 h-4" /> Nuevo recibo
            </button>
          }
        />

        {/* Nota del flujo: qué hace este recibo */}
        <div className={`${glass} rounded-2xl p-4 mb-5 flex items-start gap-3`}>
          <ShieldQuestion className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: ACCENT }} />
          <p className="text-[12px] text-gray-500 dark:text-gray-400">
            Registrar un recibo suma la cantidad al <strong>inventario</strong> del almacén destino y
            la deja en estado <strong>IQC pendiente</strong> hasta su liberación de calidad. El
            movimiento aparece en <strong>Inventario → Movimientos</strong> como <strong>Recibo</strong>.
          </p>
        </div>

        {showForm && (
          <div className={`${glass} rounded-2xl p-5 mb-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Nuevo recibo</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Número de parte *</span>
                <input value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} placeholder="RES-0402-10K" className="rc-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Cantidad *</span>
                <input type="number" min={0} step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} className="rc-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Almacén destino *</span>
                {warehouses.length > 0 ? (
                  <select value={warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} className="rc-input">
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code ? `${w.code} · ` : ""}{w.name || w.id}</option>)}
                  </select>
                ) : (
                  <input value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} placeholder="ID del almacén" className="rc-input" />
                )}
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Ubicación</span>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="DOCK" className="rc-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Proveedor</span>
                {suppliers.length > 0 ? (
                  <select value={form.supplierCode} onChange={(e) => setForm({ ...form, supplierCode: e.target.value })} className="rc-input">
                    <option value="">(sin proveedor)</option>
                    {suppliers.map((s) => <option key={s.id} value={s.code}>{s.code}{s.name ? ` · ${s.name}` : ""}</option>)}
                  </select>
                ) : (
                  <input value={form.supplierCode} onChange={(e) => setForm({ ...form, supplierCode: e.target.value })} placeholder="SUP-001" className="rc-input" />
                )}
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Orden de compra (PO)</span>
                <input value={form.poNumber} onChange={(e) => setForm({ ...form, poNumber: e.target.value })} placeholder="PO-2026-…" className="rc-input" />
              </label>
              <label className="block md:col-span-2">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Lote</span>
                <input value={form.lotNumber} onChange={(e) => setForm({ ...form, lotNumber: e.target.value })} placeholder="LOT-…" className="rc-input" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
              <button onClick={submit} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: ACCENT }}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Registrar recibo
              </button>
            </div>
          </div>
        )}

        {/* Lista de recibos recientes */}
        {forbidden ? (
          <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso al backend" body="Necesitas permiso de materiales para registrar y ver recibos." />
        ) : isLoading ? (
          <div className="flex justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : receipts.length === 0 ? (
          <Empty icon={<Inbox className="w-6 h-6" />} title="Sin recibos todavía" body="Registra el primer recibo para sumar material al inventario y verlo en el ledger de movimientos." />
        ) : (
          <div className={`${glass} rounded-2xl p-2`}>
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {receipts.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{r.receiptNumber}</span>
                      <span className="font-mono font-semibold text-sm truncate">{r.partNumber}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">
                      {r.supplierCode ? `${r.supplierCode} · ` : ""}{r.warehouseId || "—"}{r.location ? ` / ${r.location}` : ""}
                      {r.lotNumber ? ` · Lote ${r.lotNumber}` : ""}{r.poNumber ? ` · ${r.poNumber}` : ""}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold tabular-nums" style={{ color: ACCENT }}>+{r.quantity}</p>
                    <p className="text-[10px] text-gray-400">{timeAgo(r.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <style jsx global>{`
        .rc-input {
          width: 100%;
          border-radius: 0.75rem;
          padding: 0.55rem 0.75rem;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.08);
          outline: none;
          font-size: 0.875rem;
        }
        .rc-input:focus { border-color: ${ACCENT}; }
        :global(.dark) .rc-input {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}

function Empty({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-6">
      <div className="p-4 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-400 mb-4">{icon}</div>
      <h3 className="font-bold text-lg mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{body}</p>
    </div>
  );
}
