"use client";

import React, { useMemo, useState } from "react";
import { Loader2, Lock, Inbox, Ban, Check, X, Clock } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/hooks/useAuth";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

type Status = "pending" | "accepted" | "rejected" | "expired";

interface CancelReq {
  id: number;
  publication?: { id: number; workOrder?: string; model?: string; quantity?: number } | null;
  kit?: { id: number; status?: string } | null;
  requestedBy?: string | null;
  status: Status;
  respondedAt?: string | null;
  expiresAt?: string | null;
  createdAt?: string | null;
}

const STATUS_META: Record<Status, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "#f59e0b" },
  accepted: { label: "Aceptada", color: "#ef4444" },
  rejected: { label: "Rechazada", color: "#6b7280" },
  expired: { label: "Expirada", color: "#9ca3af" },
};

function fmtWhen(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function CancellationRequestsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: pendData, isLoading, forbidden, mutate } = useApi<CancelReq[]>("/cancellation-requests/pending");
  const { data: recentData, mutate: mutateRecent } = useApi<CancelReq[]>("/cancellation-requests/recent");

  const pending = useMemo(() => (Array.isArray(pendData) ? pendData : []), [pendData]);
  const recent = useMemo(() => (Array.isArray(recentData) ? recentData : []), [recentData]);
  const [busy, setBusy] = useState<number | null>(null);

  async function respond(req: CancelReq, action: "accept" | "reject") {
    if (action === "accept") {
      const wo = req.publication?.workOrder ? `WO ${req.publication.workOrder}` : "la orden";
      if (!(await confirm({ message: `¿Aceptar la cancelación? Esto cancela el kit de ${wo} y no se puede deshacer.`, tone: 'danger', confirmLabel: 'Aceptar cancelación' }))) return;
    }
    setBusy(req.id);
    try {
      const res = await apiFetch(`${API_BASE}/cancellation-requests/${req.id}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, respondedBy: user?.email || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || "No se pudo responder la solicitud.", "Cancelaciones");
        return;
      }
      toast.success(action === "accept" ? "Cancelación aceptada." : "Solicitud rechazada.", "Cancelaciones");
      mutate();
      mutateRecent();
    } catch {
      toast.error("Error de red.", "Cancelaciones");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <main className="max-w-4xl mx-auto px-6 pt-10">
        <PageHeader domain="production" title="Solicitudes de cancelación" subtitle="Aprobación de cancelación de kits / órdenes de trabajo" icon={Ban} />

        {forbidden ? (
          <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso al backend" body="Verifica que el servicio de API esté conectado." />
        ) : isLoading ? (
          <div className="flex justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <>
            {/* Pendientes — accionables */}
            <h2 className="text-sm font-semibold tracking-wide text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Pendientes ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <Empty icon={<Inbox className="w-6 h-6" />} title="Sin solicitudes pendientes" body="Cuando se solicite cancelar un kit/WO, aparecerá aquí para tu aprobación." />
            ) : (
              <div className="space-y-3 mb-8">
                {pending.map((r) => (
                  <div key={r.id} className={`${glass} rounded-2xl p-4`}>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {r.publication?.workOrder && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">WO {r.publication.workOrder}</span>}
                          <span className="font-semibold truncate">{r.publication?.model ?? `Solicitud ${r.id}`}</span>
                        </div>
                        <p className="text-[12px] text-gray-400 mt-1">
                          {r.publication?.quantity != null ? `${r.publication.quantity} u · ` : ""}
                          {r.requestedBy ? `por ${r.requestedBy}` : "solicitante desconocido"}
                          {r.expiresAt ? ` · expira ${fmtWhen(r.expiresAt)}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => respond(r, "reject")} disabled={busy === r.id} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50" style={{ background: "rgba(0,0,0,0.05)" }}>
                          <X className="w-3 h-3" /> Rechazar
                        </button>
                        <button onClick={() => respond(r, "accept")} disabled={busy === r.id} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-white disabled:opacity-50" style={{ background: "#ef4444" }}>
                          {busy === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Aceptar cancelación
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recientes — historial */}
            {recent.length > 0 && (
              <>
                <h2 className="text-sm font-semibold tracking-wide text-gray-500 dark:text-gray-400 mb-3">Recientes</h2>
                <div className={`${glass} rounded-2xl p-2`}>
                  <div className="divide-y divide-gray-100 dark:divide-white/5">
                    {recent.map((r) => {
                      const meta = STATUS_META[r.status] ?? { label: r.status, color: "#6b7280" };
                      return (
                        <div key={r.id} className="flex items-center justify-between px-3 py-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {r.publication?.workOrder && <span className="text-[10px] font-mono text-gray-500">WO {r.publication.workOrder}</span>}
                              <span className="font-semibold truncate text-sm">{r.publication?.model ?? `Solicitud ${r.id}`}</span>
                            </div>
                            <p className="text-[11px] text-gray-400">{r.requestedBy ?? "—"}{r.respondedAt ? ` · ${fmtWhen(r.respondedAt)}` : ""}</p>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0" style={{ background: `${meta.color}1f`, color: meta.color }}>{meta.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </main>
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
