"use client";

import React, { useMemo, useState } from "react";
import { Loader2, Lock, Inbox, Search, Truck } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";

interface Supplier {
  id: number | string;
  code: string;
  name?: string;
  category?: string | null;
  status?: string;
  qualityScore?: number;
}

// Espejo de los estatus del backend (supplier.entity.ts: active/inactive/restricted).
const STATUS_COLOR: Record<string, string> = {
  active: "#2ec27e",
  inactive: "#6b7280",
  restricted: "#f59e0b",
  blocked: "#ef4444",
};

function scoreColor(s: number): string {
  if (s >= 95) return "#2ec27e";
  if (s >= 85) return "#f59e0b";
  return "#ef4444";
}

export default function SuppliersPage() {
  const { data, isLoading, forbidden } = useApi<Supplier[]>("/suppliers");
  const all = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const [q, setQ] = useState("");

  const rows = q
    ? all.filter((s) => `${s.code} ${s.name ?? ""} ${s.category ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    : all;

  const active = all.filter((s) => (s.status ?? "active") === "active").length;
  const avgQuality = all.length
    ? Math.round(all.reduce((acc, s) => acc + (s.qualityScore ?? 0), 0) / all.length)
    : 0;

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <main className="max-w-4xl mx-auto px-6 pt-10">
        <PageHeader domain="erp" title="Proveedores" subtitle="Maestro de proveedores · estatus y calidad" icon={Truck} />

        {!forbidden && !isLoading && all.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-5">
              <Kpi label="Proveedores" value={String(all.length)} color="#7c5cff" />
              <Kpi label="Activos" value={String(active)} color="#2ec27e" />
              <Kpi label="Calidad prom." value={`${avgQuality}%`} color={scoreColor(avgQuality)} />
            </div>
            <div className={`${glass} flex items-center gap-2 px-4 py-2.5 rounded-2xl mb-5`}>
              <Search className="w-4 h-4 text-gray-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar código, nombre o categoría…" className="bg-transparent outline-none text-sm w-full" />
            </div>
          </>
        )}

        {forbidden ? (
          <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso al backend" body="Verifica que el servicio de API esté conectado." />
        ) : isLoading ? (
          <div className="flex justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <Empty icon={<Inbox className="w-6 h-6" />} title={all.length === 0 ? "Sin proveedores" : "Sin coincidencias"} body={all.length === 0 ? "No hay proveedores registrados. Se listarán aquí conforme compras los dé de alta." : "Ningún proveedor coincide con la búsqueda."} />
        ) : (
          <div className={`${glass} rounded-2xl p-2`}>
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {rows.map((s) => {
                const st = s.status ?? "active";
                const color = STATUS_COLOR[st] ?? "#6b7280";
                const score = s.qualityScore ?? 0;
                return (
                  <div key={s.id} className="flex items-center gap-3 px-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{s.code}</span>
                        <span className="font-semibold truncate">{s.name ?? s.code}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: `${color}1f`, color }}>{st}</span>
                      </div>
                      {s.category && <p className="text-[11px] text-gray-400 mt-0.5">{s.category}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-semibold tabular-nums" style={{ color: scoreColor(score) }}>{Math.round(score)}%</p>
                      <p className="text-[10px] text-gray-400">calidad</p>
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
