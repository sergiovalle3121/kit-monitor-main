"use client";

import React, { useMemo, useState } from "react";
import { Loader2, Lock, Inbox, Search, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";

// Valores tal cual los devuelve el backend (warehouse-task.entity.ts, en minúsculas).
type TaskType = "put_away" | "transfer" | "pick" | "confirm";
type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";

interface WarehouseTask {
  id: number | string;
  taskNumber: string;
  type: TaskType | string;
  status: TaskStatus | string;
  partNumber: string;
  quantity?: number;
  fromWarehouseId?: string | null;
  toWarehouseId?: string | null;
  fromLocation?: string | null;
  toLocation?: string | null;
  assignedTo?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  createdAt?: string | null;
}

const TYPE_META: Record<string, { label: string; color: string }> = {
  put_away: { label: "Acomodo", color: "#0a84ff" },
  transfer: { label: "Traslado", color: "#0a84ff" },
  pick: { label: "Surtido", color: "#16a394" },
  confirm: { label: "Confirmar", color: "#7c5cff" },
};
const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "#f59e0b" },
  in_progress: { label: "En proceso", color: "#0a84ff" },
  completed: { label: "Completada", color: "#6b7280" },
  cancelled: { label: "Cancelada", color: "#ef4444" },
};

function fmtQty(n?: number): string {
  const v = n ?? 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

export default function WarehousePage() {
  const { data, isLoading, forbidden } = useApi<WarehouseTask[]>("/warehouse/tasks");
  const all = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const [q, setQ] = useState("");
  const [openOnly, setOpenOnly] = useState(true);

  const open = all.filter((t) => t.status === "pending" || t.status === "in_progress");
  const base = openOnly ? open : all;
  const rows = q
    ? base.filter((t) => `${t.taskNumber} ${t.partNumber} ${t.assignedTo ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    : base;

  const pending = all.filter((t) => t.status === "pending").length;
  const inProgress = all.filter((t) => t.status === "in_progress").length;

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <main className="max-w-4xl mx-auto px-6 pt-10">
        <PageHeader domain="warehouse" title="Tareas de almacén" subtitle="Acomodo, traslado y surtido (picking) en piso" icon={ClipboardList} />

        {!forbidden && !isLoading && all.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-5">
              <Kpi label="Pendientes" value={String(pending)} color="#f59e0b" />
              <Kpi label="En proceso" value={String(inProgress)} color="#0a84ff" />
              <Kpi label="Total" value={String(all.length)} color="#16a394" />
            </div>
            <div className="flex items-center gap-2 mb-5">
              <div className={`${glass} flex items-center gap-2 px-4 py-2.5 rounded-2xl flex-1`}>
                <Search className="w-4 h-4 text-gray-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar folio, parte o responsable…" className="bg-transparent outline-none text-sm w-full" />
              </div>
              <button onClick={() => setOpenOnly((s) => !s)} className={`${glass} px-3.5 py-2.5 rounded-2xl text-sm font-medium ${openOnly ? "text-[#0a84ff]" : "text-gray-500"}`}>
                {openOnly ? "Abiertas" : "Todas"}
              </button>
            </div>
          </>
        )}

        {forbidden ? (
          <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso al backend" body="Necesitas permiso de materiales para ver las tareas de almacén." />
        ) : isLoading ? (
          <div className="flex justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <Empty icon={<Inbox className="w-6 h-6" />} title={all.length === 0 ? "Sin tareas de almacén" : "Sin tareas abiertas"} body={all.length === 0 ? "Las tareas de acomodo, traslado y surtido aparecerán aquí conforme se generen (recibos, resurtidos, picking de kits)." : "No hay tareas pendientes ni en proceso. Activa 'Todas' para ver el historial."} />
        ) : (
          <div className={`${glass} rounded-2xl p-2`}>
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {rows.map((t) => {
                const ty = TYPE_META[t.type] ?? { label: String(t.type), color: "#6b7280" };
                const st = STATUS_META[t.status] ?? { label: String(t.status), color: "#6b7280" };
                const where = [t.fromLocation || t.fromWarehouseId, t.toLocation || t.toWarehouseId].filter(Boolean).join(" → ");
                return (
                  <div key={t.id} className="flex items-center gap-3 px-3 py-3">
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-lg flex-shrink-0" style={{ background: `${ty.color}1f`, color: ty.color }}>{ty.label}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{t.taskNumber}</span>
                        <span className="font-mono font-semibold text-sm truncate">{t.partNumber}</span>
                      </div>
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">
                        {where || "—"}
                        {t.referenceType ? ` · ${t.referenceType}${t.referenceId ? ` ${t.referenceId}` : ""}` : ""}
                        {t.assignedTo ? ` · ${t.assignedTo}` : ""}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-semibold tabular-nums">{fmtQty(t.quantity)}</p>
                      <span className="text-[10px] font-medium" style={{ color: st.color }}>{st.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-3`}>
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-xl font-semibold mt-1 tabular-nums" style={{ color }}>{value}</div>
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
