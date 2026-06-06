"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, DollarSign, Loader2, Lock, Inbox } from "lucide-react";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";

interface Transaction {
  id: number | string; reference?: string; description?: string; type?: string;
  amount?: number; currency?: string; createdAt?: string;
}

export default function FinancePage() {
  const { data, isLoading, forbidden } = useApi<Transaction[]>("/accounting/transactions");
  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4 rounded-none border-x-0 border-t-0 flex items-center justify-between`}>
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-black dark:hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" /> Dashboard
        </Link>
        <span className="text-sm font-semibold">Finanzas</span>
      </div>

      <main className="max-w-4xl mx-auto px-6 pt-10">
        <header className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-2xl bg-green-50 dark:bg-green-500/10"><DollarSign className="w-7 h-7 text-green-500" strokeWidth={1.5} /></div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Finanzas</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Movimientos y costos</p>
          </div>
        </header>

        {forbidden ? (
          <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso al backend" body="Verifica que el servicio de API esté conectado." />
        ) : isLoading ? (
          <div className="flex justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <Empty icon={<Inbox className="w-6 h-6" />} title="Sin movimientos" body="No hay transacciones registradas todavía. Se listarán aquí conforme se generen." />
        ) : (
          <div className={`${glass} rounded-2xl p-2`}>
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {rows.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{t.description ?? t.reference ?? `Movimiento ${t.id}`}</p>
                    <p className="text-[11px] text-gray-400">{t.type ?? ""}{t.reference ? ` · ${t.reference}` : ""}</p>
                  </div>
                  {typeof t.amount === "number" && (
                    <p className="font-semibold tabular-nums flex-shrink-0">{t.amount.toLocaleString()} {t.currency ?? ""}</p>
                  )}
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
