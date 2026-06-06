"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Cpu, Loader2, Lock, Inbox, Search } from "lucide-react";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";

interface BomItem {
  id: number | string; model: string; partNumber: string; description?: string;
  usageFactor?: number; unit?: string;
}

export default function EngineeringPage() {
  const { data, isLoading, forbidden } = useApi<BomItem[]>("/bom");
  const [q, setQ] = useState("");
  const items = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const rows = q
    ? items.filter((i) => `${i.model} ${i.partNumber} ${i.description ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    : items;

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4 rounded-none border-x-0 border-t-0 flex items-center justify-between`}>
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-black dark:hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" /> Dashboard
        </Link>
        <span className="text-sm font-semibold">Ingeniería</span>
      </div>

      <main className="max-w-4xl mx-auto px-6 pt-10">
        <header className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10"><Cpu className="w-7 h-7 text-indigo-500" strokeWidth={1.5} /></div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Ingeniería</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">BOM por modelo</p>
          </div>
        </header>

        {items.length > 0 && (
          <div className={`${glass} flex items-center gap-2 px-4 py-2.5 rounded-2xl mb-5`}>
            <Search className="w-4 h-4 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar modelo o número de parte…" className="bg-transparent outline-none text-sm w-full" />
          </div>
        )}

        {forbidden ? (
          <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso al backend" body="Verifica que el servicio de API esté conectado." />
        ) : isLoading ? (
          <div className="flex justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <Empty icon={<Inbox className="w-6 h-6" />} title="Sin BOM" body="Aún no hay BOM cargado. Importa o registra los componentes por modelo para habilitar el surtido." />
        ) : (
          <div className={`${glass} rounded-2xl p-2`}>
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {rows.map((i) => (
                <div key={i.id} className="flex items-center justify-between px-3 py-3">
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-sm truncate">{i.partNumber}</p>
                    <p className="text-[11px] text-gray-400 truncate">{i.model}{i.description ? ` · ${i.description}` : ""}</p>
                  </div>
                  <p className="text-xs text-gray-500 flex-shrink-0">{i.usageFactor ?? 1} {i.unit ?? "EA"}</p>
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
