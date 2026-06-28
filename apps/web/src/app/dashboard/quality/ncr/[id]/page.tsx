"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ChevronLeft,
  Loader2,
  Lock,
  Inbox,
  Plus,
  X,
  ArrowRight,
  ShieldAlert,
  ClipboardList,
  CheckCircle2,
} from "lucide-react";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Empty, Field, QInputStyle } from "../../quality.ui";
import type { Capa, CapaPriority, Ncr, NcrStatus } from "../../quality.types";
import {
  CAPA_PRIORITY_META,
  CAPA_PRIORITY_ORDER,
  CAPA_STATUS_META,
  capasForNcr,
  NCR_SEVERITY_META,
  NCR_SOURCE_META,
  NCR_STATUS_META,
  nextNcrStates,
} from "../../quality.utils";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

export default function NcrDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const { data: ncr, isLoading, forbidden, mutate } = useApi<Ncr>(id ? `/ncr/${id}` : null);
  const [busy, setBusy] = useState<string | null>(null);

  async function move(to: NcrStatus) {
    setBusy(to);
    try {
      const res = await apiFetch(`${API_BASE}/ncr/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to, actor: user?.email || "QA" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || "No se pudo cambiar el estado.", "Calidad");
        return;
      }
      toast.success(`NCR → ${NCR_STATUS_META[to].label}.`, "Calidad");
      mutate();
    } catch {
      toast.error("Error de red.", "Calidad");
    } finally {
      setBusy(null);
    }
  }

  const backLink = (
    <Link href="/dashboard/quality" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 mb-4">
      <ChevronLeft className="w-4 h-4" /> Calidad · NCR
    </Link>
  );

  if (forbidden) {
    return (
      <div className="min-h-screen text-foreground font-sans pb-32">
        <main className="max-w-4xl mx-auto px-6 pt-10">
          {backLink}
          <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso al backend" body="Verifica que el servicio de API esté conectado y tu sesión sea válida." />
        </main>
      </div>
    );
  }

  if (isLoading || !ncr) {
    return (
      <div className="min-h-screen grid place-items-center text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const st = NCR_STATUS_META[ncr.status] ?? { label: ncr.status, color: "#6b7280" };
  const sev = NCR_SEVERITY_META[ncr.severity];
  const transitions = nextNcrStates(ncr.status);

  return (
    <div className="min-h-screen text-foreground font-sans pb-32">
      <main className="max-w-4xl mx-auto px-6 pt-10">
        {backLink}
        <PageHeader
          domain="quality"
          title={ncr.ncrNumber}
          subtitle={`${ncr.partNumber} · ${ncr.category}`}
          right={
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-semibold" style={{ background: `${st.color}1f`, color: st.color }}>
              <span className="w-2 h-2 rounded-full" style={{ background: st.color }} /> {st.label}
            </span>
          }
        />

        {/* Estado + transiciones válidas */}
        <div className={`${glass} rounded-2xl p-4 mb-5`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-400">Ciclo de la NCR</div>
              <div className="text-sm mt-0.5">
                Estado actual: <span className="font-semibold" style={{ color: st.color }}>{st.label}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {transitions.length === 0 ? (
                <span className="inline-flex items-center gap-1.5 text-[13px] text-gray-400">
                  <CheckCircle2 className="w-4 h-4" style={{ color: NCR_STATUS_META.closed.color }} /> Ciclo cerrado
                </span>
              ) : (
                transitions.map((to) => (
                  <button
                    key={to}
                    onClick={() => move(to)}
                    disabled={busy === to}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60"
                    style={{ background: NCR_STATUS_META[to].color }}
                  >
                    {busy === to ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />} Mover a {NCR_STATUS_META[to].label}
                  </button>
                ))
              )}
            </div>
          </div>
          {/* Mini-stepper visual del ciclo */}
          <Stepper current={ncr.status} />
        </div>

        {/* Ficha de la NCR */}
        <div data-testid="ncr-detail" className={`${glass} rounded-2xl p-5 mb-5`}>
          <h3 className="font-semibold mb-3 flex items-center gap-2"><ShieldAlert className="w-4 h-4" style={{ color: sev?.color ?? "#6b7280" }} /> No conformidad</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 whitespace-pre-wrap">{ncr.description}</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <Info label="Severidad" value={sev ? sev.label : ncr.severity} color={sev?.color} />
            <Info label="Origen" value={NCR_SOURCE_META[ncr.sourceType] ?? ncr.sourceType} />
            <Info label="Cantidad afectada" value={`${ncr.quantityAffected} u`} />
            {ncr.model && <Info label="Modelo" value={ncr.model} />}
            {ncr.workOrder && <Info label="Orden de trabajo" value={ncr.workOrder} />}
            {ncr.lotNumber && <Info label="Lote" value={ncr.lotNumber} />}
            {ncr.serialNumber && <Info label="Serial" value={ncr.serialNumber} />}
            {ncr.building && <Info label="Edificio" value={ncr.building} />}
            {ncr.warehouse && <Info label="Almacén" value={ncr.warehouse} />}
            {ncr.line && <Info label="Línea" value={ncr.line} />}
            {ncr.customer && <Info label="Cliente" value={ncr.customer} />}
            {ncr.program && <Info label="Programa" value={ncr.program} />}
            <Info label="Levantada por" value={ncr.createdBy} />
            {ncr.owner && <Info label="Responsable" value={ncr.owner} />}
            <Info label="Creada" value={ncr.createdAt ? new Date(ncr.createdAt).toLocaleString() : "—"} />
          </div>
          {ncr.dispositionNotes && (
            <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/10">
              <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Notas de disposición</div>
              <p className="text-sm whitespace-pre-wrap">{ncr.dispositionNotes}</p>
            </div>
          )}
        </div>

        {/* CAPA ligadas */}
        <CapaSection ncr={ncr} createdBy={user?.email || "QA"} />
      </main>
    </div>
  );
}

// ── Stepper ───────────────────────────────────────────────────────────────────
function Stepper({ current }: { current: NcrStatus }) {
  const flow: NcrStatus[] = ["open", "under_review", "contained", "dispositioned", "closed"];
  const idx = flow.indexOf(current);
  return (
    <div className="mt-4 flex items-center gap-1">
      {flow.map((s, i) => {
        const reached = idx >= 0 && i <= idx;
        const meta = NCR_STATUS_META[s];
        return (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center gap-1 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: reached ? meta.color : "rgba(148,163,184,0.4)" }} />
              <span className="text-[10px] text-gray-400 truncate">{meta.label}</span>
            </div>
            {i < flow.length - 1 && (
              <div className="flex-1 h-px" style={{ background: idx > i ? NCR_STATUS_META[flow[i + 1]].color : "rgba(148,163,184,0.3)" }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function Info({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="font-medium truncate" style={color ? { color } : undefined}>{value}</div>
    </div>
  );
}

// ── CAPA section ──────────────────────────────────────────────────────────────
function CapaSection({ ncr, createdBy }: { ncr: Ncr; createdBy: string }) {
  const { data, forbidden, mutate } = useApi<Capa[]>("/quality/capas");
  const linked = useMemo(() => capasForNcr(Array.isArray(data) ? data : [], ncr.id), [data, ncr.id]);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className={`${glass} rounded-2xl p-5`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2"><ClipboardList className="w-4 h-4 text-violet-500" /> CAPA ligadas</h3>
        {!forbidden && (
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium" style={{ background: "#7c3aed1f", color: "#7c3aed" }}>
            <Plus className="w-4 h-4" /> Abrir CAPA
          </button>
        )}
      </div>

      {forbidden ? (
        <p className="text-sm text-gray-400">Inicia sesión con permisos de calidad para ver y abrir CAPA.</p>
      ) : linked.length === 0 ? (
        <div className="text-center py-8">
          <Inbox className="w-7 h-7 mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-400">Sin CAPA ligadas a esta NCR. Abre una acción correctiva/preventiva para atacar la causa raíz.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {linked.map((c) => {
            const cs = CAPA_STATUS_META[c.status] ?? { label: c.status, color: "#6b7280" };
            const cp = CAPA_PRIORITY_META[c.priority];
            return (
              <div key={c.id} className="rounded-xl p-3 bg-black/[0.03] dark:bg-white/[0.04]">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[11px] font-mono text-gray-400">{c.capaNumber}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: `${cs.color}1f`, color: cs.color }}>{cs.label}</span>
                  {cp && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${cp.color}1f`, color: cp.color }}>{cp.label}</span>}
                </div>
                <p className="text-sm">{c.problemStatement}</p>
                {c.rootCause && <p className="text-[13px] text-gray-500 mt-1"><span className="text-gray-400">Causa raíz:</span> {c.rootCause}</p>}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <NewCapaModal
          ncr={ncr}
          createdBy={createdBy}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); mutate(); }}
        />
      )}
    </div>
  );
}

function NewCapaModal({ ncr, createdBy, onClose, onCreated }: { ncr: Ncr; createdBy: string; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    problemStatement: ncr.description || "",
    priority: (ncr.severity === "critical" ? "urgent" : ncr.severity === "major" ? "high" : "medium") as CapaPriority,
    rootCause: "",
  });

  async function submit() {
    if (!form.problemStatement.trim()) { toast.error("Describe el problema.", "CAPA"); return; }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        ncr: { id: ncr.id },
        partNumber: ncr.partNumber,
        problemStatement: form.problemStatement.trim(),
        priority: form.priority,
        createdBy,
        ...(form.rootCause.trim() ? { rootCause: form.rootCause.trim() } : {}),
        ...(ncr.building ? { building: ncr.building } : {}),
        ...(ncr.line ? { line: ncr.line } : {}),
        ...(ncr.program ? { program: ncr.program } : {}),
      };
      const res = await apiFetch(`${API_BASE}/quality/capas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || (res.status === 403 ? "Necesitas permiso QUALITY_WRITE para abrir CAPA." : "No se pudo crear la CAPA."), "CAPA");
        return;
      }
      const created = await res.json().catch(() => null);
      toast.success(`CAPA abierta${created?.capaNumber ? ` · ${created.capaNumber}` : ""}.`, "CAPA");
      onCreated();
    } catch {
      toast.error("Error de red.", "CAPA");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className={`${glass} rounded-2xl p-5 w-full max-w-lg`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2"><ClipboardList className="w-4 h-4 text-violet-500" /> Abrir CAPA · {ncr.ncrNumber}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Problema (qué pasó) *" full>
            <textarea value={form.problemStatement} onChange={(e) => setForm({ ...form, problemStatement: e.target.value })} className="q-input min-h-[68px] resize-y" />
          </Field>
          <Field label="Prioridad">
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as CapaPriority })} className="q-input">
              {CAPA_PRIORITY_ORDER.map((p) => <option key={p} value={p}>{CAPA_PRIORITY_META[p].label}</option>)}
            </select>
          </Field>
          <Field label="Causa raíz (opcional)" full>
            <textarea value={form.rootCause} onChange={(e) => setForm({ ...form, rootCause: e.target.value })} className="q-input min-h-[52px] resize-y" placeholder="5 porqués, Ishikawa…" />
          </Field>
        </div>
        <div className="mt-5 flex items-center justify-between gap-2">
          <span className="text-[11px] text-gray-400">Ligada a {ncr.ncrNumber} · {ncr.partNumber}</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
            <button onClick={submit} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: "#7c3aed" }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Abrir CAPA
            </button>
          </div>
        </div>
      </div>
      <QInputStyle />
    </div>
  );
}
