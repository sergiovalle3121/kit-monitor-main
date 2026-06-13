"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Lock, Inbox, AlertTriangle, PackageX, Activity } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";

interface Plan {
  id: number; workOrder: string; model: string; line?: number; quantity: number;
  shift?: string; status: string; kitStatus?: string | null;
}

// Live floor runtime per line (production-runtime /lines), joined by workOrder.
interface LineView {
  kitId: number; line: number | string; model: string; workOrder: string;
  targetQty: number; completedQty: number; status: string; hasIncident: boolean;
  startedAt: string | null; completedAt: string | null; lowStockCount: number;
}

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Por publicar", color: "#f59e0b" },
  published: { label: "Publicado", color: "#7c3aed" },
  released: { label: "Liberado", color: "#7c3aed" },
  active: { label: "En producción", color: "#10b981" },
  completed: { label: "Completado", color: "#6b7280" },
  cancelled: { label: "Cancelado", color: "#ef4444" },
};

const TABS = [
  { id: "active", label: "En producción", match: ["active"] },
  { id: "scheduled", label: "Programadas", match: ["published", "released", "pending"] },
  { id: "completed", label: "Completadas", match: ["completed"] },
  { id: "all", label: "Todas", match: [] as string[] },
];

export default function ProductionPage() {
  const { data, isLoading, forbidden } = useApi<Plan[]>("/plans");
  // Live runtime (target vs real, incidents, low stock). Best-effort: if the
  // operator has no access to runtime, the page still shows the order list.
  const { data: runtimeData } = useApi<LineView[]>("/production-runtime/lines", { refreshInterval: 10000 });
  const [tab, setTab] = useState("active");

  const plans = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const lines = useMemo(() => (Array.isArray(runtimeData) ? runtimeData : []), [runtimeData]);
  const runtimeByWo = useMemo(() => {
    const m = new Map<string, LineView>();
    for (const l of lines) if (l.workOrder) m.set(l.workOrder, l);
    return m;
  }, [lines]);

  const active = TABS.find((t) => t.id === tab)!;
  const rows = active.match.length ? plans.filter((p) => active.match.includes(p.status)) : plans;

  const inProd = lines.filter((l) => l.status === "in_progress").length;
  const withIncident = lines.filter((l) => l.hasIncident).length;
  const lowStock = lines.filter((l) => (l.lowStockCount ?? 0) > 0).length;

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <main className="max-w-4xl mx-auto px-6 pt-10">
        <PageHeader domain="production" title="Producción" subtitle="Órdenes de trabajo y su avance en piso, en vivo" />

        {lines.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Kpi icon={<Activity className="w-4 h-4" />} label="En producción" value={inProd} color="#10b981" />
            <Kpi icon={<AlertTriangle className="w-4 h-4" />} label="Con incidencia" value={withIncident} color={withIncident ? "#ef4444" : undefined} />
            <Kpi icon={<PackageX className="w-4 h-4" />} label="Bajo stock" value={lowStock} color={lowStock ? "#f59e0b" : undefined} />
          </div>
        )}

        <div className={`${glass} inline-flex p-1 rounded-2xl mb-6 gap-1`}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === t.id ? "bg-black text-white dark:bg-white dark:text-black" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {forbidden ? (
          <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso al backend" body="Verifica que el servicio de API esté conectado." />
        ) : isLoading ? (
          <div className="flex justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <Empty icon={<Inbox className="w-6 h-6" />} title="Sin órdenes" body="Cuando planeación publique un plan, aparecerá aquí como orden de trabajo." />
        ) : (
          <div className="space-y-3">
            {rows.map((p) => {
              const meta = STATUS[p.status] ?? STATUS.pending;
              const rt = runtimeByWo.get(p.workOrder);
              const target = rt?.targetQty ?? p.quantity;
              const done = rt?.completedQty ?? 0;
              const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
              return (
                <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${glass} rounded-2xl p-4`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color: meta.color, backgroundColor: `${meta.color}1f` }}>{meta.label}</span>
                        <span className="text-[11px] text-gray-400 font-mono">WO {p.workOrder}</span>
                        {rt?.hasIncident && <Badge color="#ef4444" icon={<AlertTriangle className="w-3 h-3" />}>Incidencia</Badge>}
                        {(rt?.lowStockCount ?? 0) > 0 && <Badge color="#f59e0b" icon={<PackageX className="w-3 h-3" />}>Bajo stock</Badge>}
                      </div>
                      <h3 className="text-lg font-bold tracking-tight truncate">{p.model}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{p.quantity} unidades{p.line ? ` · Línea ${p.line}` : ""}{p.shift ? ` · Turno ${p.shift}` : ""}</p>
                    </div>
                    {rt && (
                      <div className="text-right flex-shrink-0">
                        <div className="text-xl font-bold tabular-nums">{done}<span className="text-sm text-gray-400">/{target}</span></div>
                        <div className="text-[11px] text-gray-400">{pct}% en piso</div>
                      </div>
                    )}
                  </div>
                  {rt && (
                    <div className="mt-3 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: meta.color }} />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function Kpi({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color?: string }) {
  return (
    <div className={`${glass} rounded-2xl p-3`}>
      <div className="flex items-center gap-1.5 text-gray-400 text-[11px] uppercase tracking-wide">{icon} {label}</div>
      <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color }}>{value}</div>
    </div>
  );
}

function Badge({ color, icon, children }: { color: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ color, backgroundColor: `${color}1f` }}>
      {icon} {children}
    </span>
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
