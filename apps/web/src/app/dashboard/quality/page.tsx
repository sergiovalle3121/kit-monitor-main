"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, Lock, Inbox } from "lucide-react";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";
import { PageHeader } from "@/components/ui/PageHeader";

interface Ncr {
  id: number | string; code?: string; title?: string; description?: string;
  status?: string; severity?: string; partNumber?: string; createdAt?: string;
}

export default function QualityPage() {
  const { data, isLoading, forbidden } = useApi<Ncr[]>("/ncr");
  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4 rounded-none border-x-0 border-t-0 flex items-center justify-between`}>
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-black dark:hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" /> Dashboard
        </Link>
        <span className="text-sm font-semibold">Calidad</span>
      </div>

      <main className="max-w-4xl mx-auto px-6 pt-10">
        <PageHeader domain="quality" title="Calidad" subtitle="No conformidades (NCR) y disposiciones" />

        {forbidden ? (
          <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso al backend" body="Verifica que el servicio de API esté conectado." />
        ) : isLoading ? (
          <div className="flex justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <Empty icon={<Inbox className="w-6 h-6" />} title="Sin NCRs" body="No hay no-conformidades registradas. Se listarán aquí conforme calidad las levante." />
        ) : (
          <div className="space-y-3">
            {rows.map((n) => (
              <div key={n.id} className={`${glass} rounded-2xl p-4`}>
                <div className="flex items-center gap-2 mb-1">
                  {n.status && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500">{n.status}</span>}
                  {n.code && <span className="text-[11px] text-gray-400 font-mono">{n.code}</span>}
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
