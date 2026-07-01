'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, Inbox, Building2, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { type CustomerRollup } from '@/lib/customer360';

export default function CustomersPage() {
  const router = useRouter();
  const { data, isLoading, forbidden } = useApi<CustomerRollup[]>('/customer-insights');
  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const totals = useMemo(() => rows.reduce((a, c) => ({
    rmas: a.rmas + (c.openRmas || 0),
    programs: a.programs + (c.programs || 0),
  }), { rmas: 0, programs: 0 }), [rows]);

  return (
    <div className="min-h-screen text-foreground font-sans pb-32">
      <main className="max-w-7xl mx-auto px-6 pt-10">
        <PageHeader domain="finance" title="Clientes 360" subtitle="Vista ejecutiva cross-departamental por cliente" icon={Building2} />

        {!forbidden && !isLoading && rows.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Kpi label="Clientes" value={String(rows.length)} sub={`${totals.programs} programas`} color="#0fb39a" />
            <Kpi label="RMAs abiertas" value={String(totals.rmas)} color={totals.rmas ? '#ef4444' : '#10b981'} />
          </div>
        )}

        {forbidden ? (
          <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso" body="Inicia sesión para ver la vista de clientes." />
        ) : isLoading ? (
          <div className="flex justify-center py-20 text-gray-500 dark:text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <Empty icon={<Inbox className="w-6 h-6" />} title="Sin clientes" body="Aún no hay clientes en el maestro empresarial." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rows.map((c) => (
              <button key={c.code} onClick={() => router.push(`/dashboard/customers/${c.code}`)} className={`${glass} group rounded-2xl p-5 text-left hover:shadow-lg transition-shadow`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-11 h-11 rounded-xl grid place-items-center text-white font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg, #0fb39a, #0a84ff)' }}>{c.name.slice(0, 2).toUpperCase()}</span>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{c.name}</div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">{c.industry || c.code}</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 mt-1 flex-shrink-0" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <Mini label="Programas" value={String(c.programs)} />
                  <Mini label="RMAs" value={String(c.openRmas)} color={c.openRmas ? '#ef4444' : undefined} />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return <div className={`${glass} rounded-2xl p-3.5`}><div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div><div className="text-lg font-semibold mt-0.5 tabular-nums truncate" style={{ color }}>{value}</div>{sub && <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{sub}</div>}</div>;
}
function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div><div className="text-sm font-semibold tabular-nums truncate" style={{ color }}>{value}</div><div className="text-[10px] text-gray-500 dark:text-gray-400">{label}</div></div>;
}
function Empty({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return <div className="flex flex-col items-center text-center py-16 px-6"><div className="p-4 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 mb-4">{icon}</div><h3 className="font-bold text-lg mb-1">{title}</h3><p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{body}</p></div>;
}
