'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  Terminal,
  Boxes,
  Factory,
  ArrowRight,
  Command,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { StatCard, fmtMoney, RED } from '@/components/erp/ErpUI';

interface Valuation {
  totalValue: number;
  rows: unknown[];
}
interface MrpRun {
  runNumber: string;
  summary?: { plannedOrders?: number; requisitions?: number; shortages?: number };
}

const ROUTES: Record<string, string> = {
  ERP: '/dashboard/erp',
  MM01: '/dashboard/erp/mm?tab=valuation',
  MM02: '/dashboard/erp/mm?tab=po',
  MM03: '/dashboard/erp/mm?tab=requisitions',
  PP01: '/dashboard/erp/pp?tab=planned',
  PP02: '/dashboard/erp/pp',
  PP03: '/dashboard/erp/pp?tab=planned',
};

const MODULES = [
  {
    href: '/dashboard/erp/mm',
    name: 'Materiales',
    code: 'MM01–03',
    desc: 'Compras · Valuación · Inventario',
    icon: Boxes,
    color: 'text-blue-500',
    tint: 'bg-blue-50 dark:bg-blue-500/10',
  },
  {
    href: '/dashboard/erp/pp',
    name: 'Producción',
    code: 'PP01–03',
    desc: 'MRP · Órdenes de fabricación',
    icon: Factory,
    color: 'text-amber-500',
    tint: 'bg-amber-50 dark:bg-amber-500/10',
  },
];

export default function ErpHubPage() {
  const router = useRouter();
  const [cmd, setCmd] = useState('');
  const { data: val } = useApi<Valuation>('/erp/mm/valuation');
  const { data: runs } = useApi<MrpRun[]>('/erp/pp/mrp/runs');

  const lastRun = Array.isArray(runs) && runs.length ? runs[0] : null;

  const run = (e: React.FormEvent) => {
    e.preventDefault();
    const route = ROUTES[cmd.trim().toUpperCase()];
    if (route) {
      router.push(route);
      setCmd('');
    }
  };

  return (
    <div className="min-h-screen text-foreground font-sans pb-24">
      <div
        className={`${glass} sticky top-0 z-40 px-5 py-3 rounded-none border-x-0 border-t-0 flex items-center justify-between`}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Dashboard
        </Link>
        <span className="text-lg font-bold tracking-tight">Axos Core ERP</span>
        <span className="hidden sm:flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
          <Command className="w-3 h-3" />K para T-Codes
        </span>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
        {/* Command line */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-1">Centro de comandos</h1>
          <p className="text-gray-500 text-sm mb-4">
            Escribe un T-Code para saltar a su pantalla (ej. <span className="font-mono">MM02</span>,{' '}
            <span className="font-mono">PP02</span>) o usa <span className="font-mono">Ctrl+K</span>.
          </p>
          <form onSubmit={run} className={`${glass} rounded-3xl p-4 flex items-center gap-3`}>
            <Terminal className="w-6 h-6 text-primary flex-shrink-0" />
            <input
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              autoFocus
              placeholder="Escribe un T-Code…  MM02 · PP02 · MM01"
              className="flex-1 bg-transparent outline-none text-lg font-mono tracking-wide placeholder:text-gray-400"
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 bg-primary text-white text-sm font-bold px-5 py-2.5 rounded-full hover:bg-primary active:scale-95 transition-all"
            >
              Ir <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <StatCard label="Valor de inventario" value={fmtMoney(val?.totalValue)} sub="Valuación MM" />
          <StatCard
            label="Última corrida MRP"
            value={lastRun ? `${lastRun.summary?.plannedOrders ?? 0} órdenes` : '—'}
            sub={lastRun ? lastRun.runNumber : 'Sin corridas'}
            color={lastRun?.summary?.shortages ? RED : undefined}
          />
        </div>

        {/* Modules */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {MODULES.map((m) => (
            <motion.button
              key={m.href}
              onClick={() => router.push(m.href)}
              whileHover={{ y: -3 }}
              className={`${glass} rounded-3xl p-5 text-left flex flex-col gap-3`}
            >
              <div className="flex items-center justify-between">
                <div className={`inline-flex p-3 rounded-2xl ${m.tint} w-fit`}>
                  <m.icon className={`w-6 h-6 ${m.color}`} strokeWidth={1.5} />
                </div>
                <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">{m.code}</span>
              </div>
              <div>
                <div className="font-bold text-lg">{m.name}</div>
                <div className="text-xs text-gray-500">{m.desc}</div>
              </div>
            </motion.button>
          ))}
        </div>
      </main>
    </div>
  );
}
