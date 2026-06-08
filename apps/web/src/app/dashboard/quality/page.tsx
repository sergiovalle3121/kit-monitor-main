"use client";

import React, { useMemo, useState } from "react";
import { Loader2, Lock, Inbox } from "lucide-react";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";
import { PageHeader } from "@/components/ui/PageHeader";

interface Ncr {
  id: number | string; code?: string; title?: string; description?: string;
  status?: string; severity?: string; partNumber?: string; model?: string | null; createdAt?: string;
}
// Maestro de Modelo — para el filtro por modelo (referencia la espina dorsal).
interface ModelOption { id: string; modelNumber: string; name: string; status: string }

export default function QualityPage() {
  const { data, isLoading, forbidden } = useApi<Ncr[]>("/ncr");
  const { data: modelsData } = useApi<ModelOption[]>("/product-models");
  const all = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const models = Array.isArray(modelsData) ? modelsData : [];

  const [modelFilter, setModelFilter] = useState("");
  const rows = modelFilter ? all.filter((n) => (n.model ?? "") === modelFilter) : all;

  // Modelos presentes en las NCRs (para no ofrecer filtros vacíos).
  const modelsInUse = useMemo(() => new Set(all.map((n) => n.model).filter(Boolean) as string[]), [all]);

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <main className="max-w-4xl mx-auto px-6 pt-10">
        <PageHeader domain="quality" title="Calidad" subtitle="No conformidades (NCR) y disposiciones" />

        {/* Filtro por modelo del maestro (solo cuando hay NCRs con modelo) */}
        {!forbidden && !isLoading && all.length > 0 && (models.length > 0 || modelsInUse.size > 0) && (
          <div className={`${glass} flex items-center gap-2 px-4 py-2.5 rounded-2xl mb-5`}>
            <span className="text-[12px] font-medium text-gray-500">Modelo</span>
            <select value={modelFilter} onChange={(e) => setModelFilter(e.target.value)} className="bg-transparent outline-none text-sm flex-1">
              <option value="">Todos</option>
              {(models.length > 0 ? models.map((m) => m.modelNumber) : Array.from(modelsInUse)).map((mn) => (
                <option key={mn} value={mn}>{mn}{modelsInUse.has(mn) ? "" : " (sin NCR)"}</option>
              ))}
            </select>
          </div>
        )}

        {forbidden ? (
          <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso al backend" body="Verifica que el servicio de API esté conectado." />
        ) : isLoading ? (
          <div className="flex justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <Empty icon={<Inbox className="w-6 h-6" />} title={modelFilter ? "Sin NCRs para ese modelo" : "Sin NCRs"} body={modelFilter ? "Ninguna no-conformidad coincide con el modelo seleccionado." : "No hay no-conformidades registradas. Se listarán aquí conforme calidad las levante."} />
        ) : (
          <div className="space-y-3">
            {rows.map((n) => (
              <div key={n.id} className={`${glass} rounded-2xl p-4`}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {n.status && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500">{n.status}</span>}
                  {n.code && <span className="text-[11px] text-gray-400 font-mono">{n.code}</span>}
                  {n.model && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: "#2ec27e1f", color: "#2ec27e" }}>{n.model}</span>}
                </div>
                <h3 className="font-bold truncate">{n.title ?? n.partNumber ?? `NCR ${n.id}`}</h3>
                {n.description && <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{n.description}</p>}
              </div>
            ))}
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
