"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Lock, Inbox } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";

interface Plan {
  id: number; workOrder: string; model: string; line?: number; quantity: number;
  shift?: string; status: string; kitStatus?: string | null;
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
  const [tab, setTab] = useState("active");
  const plans = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const active = TABS.find((t) => t.id === tab)!;
  const rows = active.match.length ? plans.filter((p) => active.match.includes(p.status)) : plans;

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <main className="max-w-4xl mx-auto px-6 pt-10">
        <PageHeader domain="production" title="Producción" subtitle="Órdenes de trabajo desde los planes publicados" />

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
              return (
                <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${glass} rounded-2xl p-4 flex items-center justify-between gap-4`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color: meta.color, backgroundColor: `${meta.color}1f` }}>{meta.label}</span>
                      <span className="text-[11px] text-gray-400 font-mono">WO {p.workOrder}</span>
                    </div>
                    <h3 className="text-lg font-bold tracking-tight truncate">{p.model}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{p.quantity} unidades{p.line ? ` · Línea ${p.line}` : ""}{p.shift ? ` · Turno ${p.shift}` : ""}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
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
