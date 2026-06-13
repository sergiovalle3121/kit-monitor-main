"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Loader2,
  Lock,
  Inbox,
  Plus,
  X,
  ShieldX,
  Gavel,
  ArrowRight,
  CheckCircle2,
  Move,
} from "lucide-react";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Empty, Field, Kpi, QInputStyle } from "../quality.ui";
import type {
  Disposition,
  DispositionStatus,
  DispositionType,
  QualityHold,
  QualityHoldLevel,
  QuarantineTransfer,
  QuarantineTransferStatus,
} from "../quality.types";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

const LEVELS: { value: QualityHoldLevel; label: string; hint: string }[] = [
  { value: "PART_NUMBER", label: "Número de parte", hint: "aplica a todo el NP (sin valor)" },
  { value: "LOT", label: "Lote", hint: "valor = número de lote" },
  { value: "SERIAL", label: "Serial", hint: "valor = número de serie" },
  { value: "WAREHOUSE", label: "Almacén", hint: "valor = WH-id" },
  { value: "BUILDING", label: "Edificio", hint: "valor = edificio" },
  { value: "PROGRAM", label: "Programa", hint: "valor = programa" },
  { value: "WORK_ORDER", label: "Orden de trabajo", hint: "valor = WO" },
];

const DTYPE: Record<DispositionType, { label: string; color: string }> = {
  release: { label: "Liberar", color: "#10b981" },
  use_as_is: { label: "Usar como está", color: "#f59e0b" },
  rework: { label: "Retrabajo", color: "#3b82f6" },
  scrap: { label: "Desecho", color: "#ef4444" },
  rtv: { label: "Devolver a proveedor", color: "#ef4444" },
};
const DSTATUS: Record<DispositionStatus, { label: string; color: string }> = {
  proposed: { label: "Propuesta", color: "#6b7280" },
  under_review: { label: "En revisión", color: "#f59e0b" },
  approved: { label: "Aprobada", color: "#3b82f6" },
  executed: { label: "Ejecutada", color: "#10b981" },
  closed: { label: "Cerrada", color: "#10b981" },
};
const TSTATUS: Record<QuarantineTransferStatus, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "#f59e0b" },
  completed: { label: "Completado", color: "#10b981" },
  cancelled: { label: "Cancelado", color: "#6b7280" },
};

export default function QualityHoldsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const email = user?.email || "QA";
  const { data: holdsData, isLoading: hLoading, forbidden, mutate: mutateHolds } = useApi<QualityHold[]>("/quality/holds/active");
  const { data: dispoData, mutate: mutateDispo } = useApi<Disposition[]>("/quality/dispositions");
  const { data: transferData, mutate: mutateTransfers } = useApi<QuarantineTransfer[]>("/quality/transfers");
  const holds = useMemo(() => (Array.isArray(holdsData) ? holdsData : []), [holdsData]);
  const dispos = useMemo(() => (Array.isArray(dispoData) ? dispoData : []), [dispoData]);
  const transfers = useMemo(() => (Array.isArray(transferData) ? transferData : []), [transferData]);

  const [busy, setBusy] = useState<string | null>(null);
  const [newHold, setNewHold] = useState(false);
  const [dispoFor, setDispoFor] = useState<{ hold?: QualityHold } | null>(null);
  const [transferFor, setTransferFor] = useState<QualityHold | null>(null);

  const openDispos = dispos.filter((d) => d.status !== "executed" && d.status !== "closed").length;

  async function releaseHold(h: QualityHold) {
    setBusy(`h${h.id}`);
    try {
      const res = await apiFetch(`${API_BASE}/quality/holds/${h.id}/release`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ releasedBy: email }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toastErr(d, res.status); return; }
      mutateHolds();
    } catch { /* network */ } finally { setBusy(null); }
  }

  function toastErr(d: { message?: string }, status: number) {
    toast.error(d?.message || (status === 403 ? "Necesitas permiso de calidad (QUALITY_APPROVE/WRITE)." : "No se pudo."), "Calidad");
  }

  async function dispoAction(d: Disposition, action: "approve" | "execute") {
    setBusy(`d${d.id}`);
    try {
      const res = await apiFetch(`${API_BASE}/quality/dispositions/${d.id}/${action}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actor: email }) });
      if (!res.ok) { const dd = await res.json().catch(() => ({})); toastErr(dd, res.status); return; }
      toast.success(action === "approve" ? "Disposición aprobada." : "Disposición ejecutada — inventario impactado.", "Calidad");
      mutateDispo(); mutateHolds();
    } catch { toast.error("Error de red.", "Calidad"); } finally { setBusy(null); }
  }

  async function completeTransfer(t: QuarantineTransfer) {
    setBusy(`t${t.id}`);
    try {
      const res = await apiFetch(`${API_BASE}/quality/transfers/${t.id}/complete`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actor: email }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toastErr(d, res.status); return; }
      toast.success("Traslado completado — material movido a cuarentena.", "Calidad");
      mutateTransfers();
    } catch { toast.error("Error de red.", "Calidad"); } finally { setBusy(null); }
  }

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <main className="max-w-5xl mx-auto px-6 pt-10">
        <Link href="/dashboard/quality" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 mb-4">
          <ChevronLeft className="w-4 h-4" /> Calidad · NCR
        </Link>
        <PageHeader
          domain="quality"
          title="Calidad · Holds de inventario"
          subtitle="Retención de material (NP/lote/almacén) y disposición a nivel inventario"
          right={
            !forbidden ? (
              <button onClick={() => setNewHold(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "#ef4444" }}>
                <Plus className="w-4 h-4" /> Nuevo hold
              </button>
            ) : undefined
          }
        />

        {forbidden ? (
          <div className={`${glass} rounded-3xl p-10 text-center max-w-sm mx-auto`}>
            <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <h2 className="text-lg font-semibold">Sin acceso</h2>
            <p className="text-sm text-gray-400 mt-1">Inicia sesión con permisos de calidad.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              <Kpi label="Holds activos" value={holds.length} color="#ef4444" />
              <Kpi label="Disposiciones abiertas" value={openDispos} color="#f59e0b" />
              <Kpi label="Disposiciones totales" value={dispos.length} color="#6b7280" />
            </div>

            {/* Holds activos */}
            <div className="flex items-center gap-2 mb-3"><ShieldX className="w-4 h-4" style={{ color: "#ef4444" }} /><h3 className="font-semibold">Holds activos</h3></div>
            {hLoading ? (
              <div className="flex justify-center py-10 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : holds.length === 0 ? (
              <Empty icon={<Inbox className="w-6 h-6" />} title="Sin holds activos" body="No hay material retenido a nivel inventario. Crea un hold para bloquear un NP/lote/almacén." cta={<button onClick={() => setNewHold(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "#ef4444" }}><Plus className="w-4 h-4" /> Nuevo hold</button>} />
            ) : (
              <div className="space-y-2 mb-8">
                {holds.map((h) => {
                  const lvl = LEVELS.find((l) => l.value === h.level);
                  return (
                    <div key={h.id} className={`${glass} rounded-2xl p-4`}>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono font-semibold">{h.partNumber}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-gray-500">{lvl?.label ?? h.level}{h.levelValue ? `: ${h.levelValue}` : ""}</span>
                      </div>
                      <p className="text-[13px] text-gray-500 dark:text-gray-400">{h.reason}{h.heldBy ? ` · ${h.heldBy}` : ""}{h.createdAt ? ` · ${new Date(h.createdAt).toLocaleDateString()}` : ""}</p>
                      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                        <button onClick={() => setDispoFor({ hold: h })} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium" style={{ background: "#7c3aed1f", color: "#7c3aed" }}><Gavel className="w-3 h-3" /> Proponer disposición</button>
                        <button onClick={() => setTransferFor(h)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium" style={{ background: "#3b82f61f", color: "#3b82f6" }}><Move className="w-3 h-3" /> Trasladar a cuarentena</button>
                        <button onClick={() => releaseHold(h)} disabled={busy === `h${h.id}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50" style={{ background: "#10b9811f", color: "#10b981" }}>{busy === `h${h.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Liberar</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Disposiciones */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2"><Gavel className="w-4 h-4 text-violet-500" /><h3 className="font-semibold">Disposiciones</h3></div>
              <button onClick={() => setDispoFor({})} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium" style={{ background: "#7c3aed1f", color: "#7c3aed" }}><Plus className="w-4 h-4" /> Proponer</button>
            </div>
            {dispos.length === 0 ? (
              <Empty icon={<Inbox className="w-6 h-6" />} title="Sin disposiciones" body="Propón una disposición (liberar/usar como está/retrabajo/scrap/RTV) para el material retenido. El flujo es proponer → aprobar → ejecutar (impacta inventario)." />
            ) : (
              <div className="space-y-2">
                {dispos.map((d) => {
                  const t = DTYPE[d.type] ?? { label: d.type, color: "#6b7280" };
                  const s = DSTATUS[d.status] ?? { label: d.status, color: "#6b7280" };
                  return (
                    <div key={d.id} className={`${glass} rounded-2xl p-4 flex items-center gap-3`}>
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: `${t.color}1f`, color: t.color }}>{t.label}</span>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: `${s.color}1f`, color: s.color }}>{s.label}</span>
                        </div>
                        <h4 className="font-semibold truncate"><span className="font-mono">{d.partNumber}</span> <span className="text-gray-400 font-normal text-[13px]">· {d.quantity} u · {d.warehouseId}/{d.location}</span></h4>
                        <p className="text-[12px] text-gray-400 truncate">{d.reason}{d.proposedBy ? ` · ${d.proposedBy}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {d.status === "proposed" && <button onClick={() => dispoAction(d, "approve")} disabled={busy === `d${d.id}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50" style={{ background: "#3b82f61f", color: "#3b82f6" }}>{busy === `d${d.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />} Aprobar</button>}
                        {d.status === "approved" && <button onClick={() => dispoAction(d, "execute")} disabled={busy === `d${d.id}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-white disabled:opacity-50" style={{ background: "#10b981" }}>{busy === `d${d.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />} Ejecutar</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Transfers de cuarentena */}
            {transfers.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-3 mt-8"><Move className="w-4 h-4 text-blue-500" /><h3 className="font-semibold">Traslados a cuarentena</h3></div>
                <div className="space-y-2">
                  {transfers.map((t) => {
                    const s = TSTATUS[t.status] ?? { label: t.status, color: "#6b7280" };
                    return (
                      <div key={t.id} className={`${glass} rounded-2xl p-4 flex items-center gap-3`}>
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="font-mono font-semibold">{t.partNumber}</span>
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: `${s.color}1f`, color: s.color }}>{s.label}</span>
                          </div>
                          <p className="text-[12px] text-gray-400 truncate">{t.quantity} u · {t.sourceWarehouseId}/{t.sourceLocation} → {t.destWarehouseId}/{t.destLocation}{t.requestedBy ? ` · ${t.requestedBy}` : ""}</p>
                        </div>
                        {t.status === "pending" && (
                          <button onClick={() => completeTransfer(t)} disabled={busy === `t${t.id}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-white disabled:opacity-50 shrink-0" style={{ background: "#3b82f6" }}>{busy === `t${t.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Completar</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {newHold && <NewHoldModal heldBy={email} onClose={() => setNewHold(false)} onSaved={() => { setNewHold(false); mutateHolds(); }} />}
      {dispoFor && <NewDispositionModal proposedBy={email} hold={dispoFor.hold} onClose={() => setDispoFor(null)} onSaved={() => { setDispoFor(null); mutateDispo(); }} />}
      {transferFor && <NewTransferModal requestedBy={email} hold={transferFor} onClose={() => setTransferFor(null)} onSaved={() => { setTransferFor(null); mutateTransfers(); }} />}
    </div>
  );
}

function NewHoldModal({ heldBy, onClose, onSaved }: { heldBy: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ partNumber: "", level: "PART_NUMBER" as QualityHoldLevel, levelValue: "", reason: "", notes: "" });
  const lvl = LEVELS.find((l) => l.value === form.level);

  async function submit() {
    if (!form.partNumber.trim()) { toast.error("El número de parte es obligatorio.", "Calidad"); return; }
    if (!form.reason.trim()) { toast.error("La razón del hold es obligatoria.", "Calidad"); return; }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        partNumber: form.partNumber.trim(),
        level: form.level,
        reason: form.reason.trim(),
        heldBy,
        ...(form.levelValue.trim() ? { levelValue: form.levelValue.trim() } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      };
      const res = await apiFetch(`${API_BASE}/quality/holds`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || (res.status === 403 ? "Necesitas permiso QUALITY_WRITE." : "No se pudo crear."), "Calidad"); return; }
      toast.success("Hold aplicado — material bloqueado.", "Calidad");
      onSaved();
    } catch { toast.error("Error de red.", "Calidad"); } finally { setBusy(false); }
  }

  return (
    <Modal title="Nuevo hold de inventario" icon={<ShieldX className="w-4 h-4" style={{ color: "#ef4444" }} />} accent="#ef4444" busy={busy} onClose={onClose} onSubmit={submit} submitLabel="Aplicar hold">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Número de parte *"><input value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} className="q-input" placeholder="PCB-2024-A" /></Field>
        <Field label="Nivel"><select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as QualityHoldLevel })} className="q-input">{LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select></Field>
        <Field label={`Valor del nivel${form.level === "PART_NUMBER" ? " (n/a)" : ""}`}><input value={form.levelValue} onChange={(e) => setForm({ ...form, levelValue: e.target.value })} className="q-input" placeholder={lvl?.hint} disabled={form.level === "PART_NUMBER"} /></Field>
        <Field label="Razón *"><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="q-input" placeholder="Sospecha de contaminación" /></Field>
        <Field label="Notas" full><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="q-input min-h-[52px] resize-y" /></Field>
      </div>
      <p className="text-[11px] text-gray-400 mt-3">El hold marca <span className="font-mono">holdStatus = hold</span> en las posiciones de inventario que coincidan con el nivel.</p>
    </Modal>
  );
}

function NewDispositionModal({ proposedBy, hold, onClose, onSaved }: { proposedBy: string; hold?: QualityHold; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    type: "release" as DispositionType,
    partNumber: hold?.partNumber ?? "",
    warehouseId: "",
    location: "BULK",
    quantity: "",
    reason: "",
    notes: "",
  });

  async function submit() {
    if (!form.partNumber.trim()) { toast.error("El número de parte es obligatorio.", "Disposición"); return; }
    if (!form.warehouseId.trim()) { toast.error("El almacén es obligatorio.", "Disposición"); return; }
    if (!form.reason.trim()) { toast.error("La razón es obligatoria.", "Disposición"); return; }
    const qty = Number(form.quantity) || 0;
    if (qty <= 0) { toast.error("Cantidad debe ser mayor a 0.", "Disposición"); return; }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        type: form.type,
        partNumber: form.partNumber.trim(),
        warehouseId: form.warehouseId.trim(),
        location: form.location.trim() || "BULK",
        quantity: qty,
        reason: form.reason.trim(),
        proposedBy,
        ...(hold ? { hold: { id: hold.id } } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      };
      const res = await apiFetch(`${API_BASE}/quality/dispositions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || (res.status === 403 ? "Necesitas permiso QUALITY_WRITE." : "No se pudo proponer."), "Disposición"); return; }
      toast.success("Disposición propuesta.", "Disposición");
      onSaved();
    } catch { toast.error("Error de red.", "Disposición"); } finally { setBusy(false); }
  }

  return (
    <Modal title={`Proponer disposición${hold ? ` · ${hold.partNumber}` : ""}`} icon={<Gavel className="w-4 h-4" style={{ color: "#7c3aed" }} />} accent="#7c3aed" busy={busy} onClose={onClose} onSubmit={submit} submitLabel="Proponer">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Tipo"><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as DispositionType })} className="q-input">{(Object.keys(DTYPE) as DispositionType[]).map((t) => <option key={t} value={t}>{DTYPE[t].label}</option>)}</select></Field>
        <Field label="Número de parte *"><input value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} className="q-input" /></Field>
        <Field label="Almacén *"><input value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} className="q-input" placeholder="WH-QC" /></Field>
        <Field label="Ubicación"><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="q-input" placeholder="BULK" /></Field>
        <Field label="Cantidad *"><input type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="q-input" /></Field>
        <Field label="Razón *"><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="q-input" /></Field>
        <Field label="Notas" full><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="q-input min-h-[52px] resize-y" /></Field>
      </div>
      <p className="text-[11px] text-gray-400 mt-3">Flujo: propuesta → aprobar → ejecutar. Al ejecutar, SCRAP/RTV decrementan stock y RELEASE/USE_AS_IS liberan; cierra NCR/hold ligados.</p>
    </Modal>
  );
}

function NewTransferModal({ requestedBy, hold, onClose, onSaved }: { requestedBy: string; hold: QualityHold; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ quantity: "", sourceWarehouseId: "", sourceLocation: "BULK", destWarehouseId: "WH-QUARANTINE", destLocation: "QUARANTINE-01" });

  async function submit() {
    if (!form.sourceWarehouseId.trim()) { toast.error("El almacén origen es obligatorio.", "Traslado"); return; }
    if (!form.destWarehouseId.trim()) { toast.error("El almacén destino es obligatorio.", "Traslado"); return; }
    const qty = Number(form.quantity) || 0;
    if (qty <= 0) { toast.error("Cantidad debe ser mayor a 0.", "Traslado"); return; }
    setBusy(true);
    try {
      const payload = {
        holdId: hold.id,
        quantity: qty,
        sourceWarehouseId: form.sourceWarehouseId.trim(),
        sourceLocation: form.sourceLocation.trim() || "BULK",
        destWarehouseId: form.destWarehouseId.trim(),
        destLocation: form.destLocation.trim() || "QUARANTINE-01",
        requestedBy,
      };
      const res = await apiFetch(`${API_BASE}/quality/transfers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || (res.status === 403 ? "Necesitas permiso QUALITY_WRITE." : "No se pudo solicitar."), "Traslado"); return; }
      toast.success("Traslado solicitado (pendiente de completar).", "Traslado");
      onSaved();
    } catch { toast.error("Error de red.", "Traslado"); } finally { setBusy(false); }
  }

  return (
    <Modal title={`Trasladar a cuarentena · ${hold.partNumber}`} icon={<Move className="w-4 h-4" style={{ color: "#3b82f6" }} />} accent="#3b82f6" busy={busy} onClose={onClose} onSubmit={submit} submitLabel="Solicitar">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Cantidad *"><input type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="q-input" /></Field>
        <div />
        <Field label="Almacén origen *"><input value={form.sourceWarehouseId} onChange={(e) => setForm({ ...form, sourceWarehouseId: e.target.value })} className="q-input" placeholder="WH-01" /></Field>
        <Field label="Ubicación origen"><input value={form.sourceLocation} onChange={(e) => setForm({ ...form, sourceLocation: e.target.value })} className="q-input" /></Field>
        <Field label="Almacén destino *"><input value={form.destWarehouseId} onChange={(e) => setForm({ ...form, destWarehouseId: e.target.value })} className="q-input" /></Field>
        <Field label="Ubicación destino"><input value={form.destLocation} onChange={(e) => setForm({ ...form, destLocation: e.target.value })} className="q-input" /></Field>
      </div>
      <p className="text-[11px] text-gray-400 mt-3">Al completar, el inventario se mueve físicamente (ledger TRANSFER) y la posición destino queda en <span className="font-mono">quarantine</span>.</p>
    </Modal>
  );
}

// Modal shell (local). TODO: extraer a quality.ui si crece el reuso entre rutas.
function Modal({ title, icon, accent, busy, onClose, onSubmit, submitLabel, children }: { title: string; icon: React.ReactNode; accent: string; busy: boolean; onClose: () => void; onSubmit: () => void; submitLabel: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className={`${glass} rounded-2xl p-5 w-full max-w-xl max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">{icon} {title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
        {children}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
          <button onClick={onSubmit} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: accent }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {submitLabel}
          </button>
        </div>
      </div>
      <QInputStyle />
    </div>
  );
}
