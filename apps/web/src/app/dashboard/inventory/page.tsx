"use client";

import React, { useMemo, useState } from "react";
import { Loader2, Lock, Inbox, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";

interface Position {
  id: number | string; partNumber: string; location?: string;
  warehouse?: { name?: string; code?: string } | null;
  quantityOnHand?: number; quantityAvailable?: number; quantityAllocated?: number;
}

export default function InventoryPage() {
  const { data, isLoading, forbidden } = useApi<Position[]>("/inventory/positions");
  const [q, setQ] = useState("");
  const positions = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const rows = q
    ? positions.filter((p) => `${p.partNumber} ${p.location ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    : positions;

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <main className="max-w-4xl mx-auto px-6 pt-10">
        <PageHeader domain="inventory" title="Inventario" subtitle="Existencias por ubicación" />

        {positions.length > 0 && (
          <div className={`${glass} flex items-center gap-2 px-4 py-2.5 rounded-2xl mb-5`}>
            <Search className="w-4 h-4 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar número de parte o ubicación…" className="bg-transparent outline-none text-sm w-full" />
          </div>
        )}

        {forbidden ? (
          <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso al backend" body="Verifica que el servicio de API esté conectado." />
        ) : isLoading ? (
          <div className="flex justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <Empty icon={<Inbox className="w-6 h-6" />} title="Sin existencias" body="Aún no hay inventario registrado. Se irá poblando con las recepciones y movimientos de almacén." />
        ) : (
          <div className={`${glass} rounded-2xl p-2`}>
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {rows.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-3 py-3">
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-sm truncate">{p.partNumber}</p>
                    <p className="text-[11px] text-gray-400">{p.location ?? "—"}{p.warehouse?.name ? ` · ${p.warehouse.name}` : ""}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold tabular-nums">{p.quantityAvailable ?? p.quantityOnHand ?? 0}</p>
                    <p className="text-[10px] text-gray-400">disponible</p>
                  </div>
                </div>
              ))}
            </div>
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
