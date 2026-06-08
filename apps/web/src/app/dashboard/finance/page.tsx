"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Loader2, Lock, Inbox, ChevronRight,
  Calculator, Landmark, Boxes, Terminal, Receipt, TrendingUp, Wallet,
} from "lucide-react";
import { glass } from "@/lib/glass";
import { containerRM, itemRM, hoverRM, pressRM } from "@/lib/motion";
import { useApi } from "@/hooks/useApi";
import { PageHeader } from "@/components/ui/PageHeader";

const MotionLink = motion.create(Link);

interface Transaction {
  id: number | string; reference?: string; description?: string; type?: string;
  amount?: number; currency?: string; createdAt?: string;
}

// Herramientas reales del dominio financiero (rutas que ya existen en la app).
const TOOLS: { title: string; desc: string; href: string; icon: React.ElementType; color: string; tint: string }[] = [
  { title: "Costeo por orden", desc: "Mano de obra, materiales, energía y overhead por WO", href: "/dashboard/finance/cost-rollup", icon: Calculator, color: "text-emerald-500", tint: "bg-emerald-50 dark:bg-emerald-500/10" },
  { title: "Contabilidad (FIN)", desc: "Cuentas, pólizas y periodos fiscales", href: "/dashboard/erp/fin", icon: Landmark, color: "text-violet-500", tint: "bg-violet-50 dark:bg-violet-500/10" },
  { title: "Materiales (MM)", desc: "Valuación de inventario y movimientos", href: "/dashboard/erp/mm", icon: Boxes, color: "text-sky-500", tint: "bg-sky-50 dark:bg-sky-500/10" },
  { title: "Consola ERP · T-Codes", desc: "FIN · MM · PP · SD en una sola consola", href: "/dashboard/erp", icon: Terminal, color: "text-indigo-500", tint: "bg-indigo-50 dark:bg-indigo-500/10" },
];

export default function FinancePage() {
  const reduce = useReducedMotion();
  const { data, isLoading, forbidden } = useApi<Transaction[]>("/accounting/transactions");
  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const kpis = useMemo(() => {
    const total = rows.reduce((s, t) => s + (typeof t.amount === "number" ? t.amount : 0), 0);
    const now = new Date();
    const thisMonth = rows.filter((t) => {
      if (!t.createdAt) return false;
      const d = new Date(t.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const currency = rows.find((t) => t.currency)?.currency ?? "MXN";
    return [
      { label: "Movimientos", value: rows.length.toLocaleString(), icon: Receipt, color: "#7c3aed" },
      { label: "Monto acumulado", value: `${total.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`, icon: Wallet, color: "#10b981" },
      { label: "Este mes", value: thisMonth.toLocaleString(), icon: TrendingUp, color: "#3b82f6" },
    ];
  }, [rows]);

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <main className="max-w-5xl mx-auto px-6 pt-10">
        <PageHeader domain="finance" title="Finanzas" subtitle="Costos, contabilidad y movimientos · todo el dinero de la operación" />

        {/* KPIs en vivo */}
        <motion.section variants={containerRM(reduce)} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {kpis.map((k) => (
            <motion.div key={k.label} variants={itemRM(reduce)} className={`${glass} rounded-3xl p-5`}>
              <div className="flex items-center justify-between mb-3"><k.icon className="w-5 h-5" style={{ color: k.color }} /></div>
              <div className="text-3xl font-bold tracking-tight tabular-nums" style={{ color: k.color }}>{k.value}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{k.label}</div>
            </motion.div>
          ))}
        </motion.section>

        {/* Herramientas del departamento */}
        <h2 className="text-sm font-semibold tracking-wide text-gray-500 dark:text-gray-400 mb-4">Herramientas</h2>
        <motion.section variants={containerRM(reduce)} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {TOOLS.map((t) => (
            <MotionLink key={t.href} href={t.href} variants={itemRM(reduce)} whileHover={hoverRM(reduce)} whileTap={pressRM(reduce)} className={`${glass} rounded-3xl p-5 flex items-center gap-4`}>
              <div className={`inline-flex p-3 rounded-2xl ${t.tint} flex-shrink-0`}><t.icon className={`w-6 h-6 ${t.color}`} strokeWidth={1.5} /></div>
              <div className="min-w-0 flex-1">
                <div className="font-bold">{t.title}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{t.desc}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </MotionLink>
          ))}
        </motion.section>

        {/* Movimientos recientes */}
        <h2 className="text-sm font-semibold tracking-wide text-gray-500 dark:text-gray-400 mb-4">Movimientos recientes</h2>
        {forbidden ? (
          <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso al backend" body="Verifica que el servicio de API esté conectado." />
        ) : isLoading ? (
          <div className="flex justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <Empty icon={<Inbox className="w-6 h-6" />} title="Sin movimientos" body="Aún no hay transacciones. Se registrarán aquí conforme la operación genere consumos, recepciones y cierres." />
        ) : (
          <div className={`${glass} rounded-2xl p-2`}>
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {rows.slice(0, 30).map((t) => (
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
    <div className={`${glass} rounded-2xl flex flex-col items-center text-center py-16 px-6`}>
      <div className="p-4 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-400 mb-4">{icon}</div>
      <h3 className="font-bold text-lg mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{body}</p>
    </div>
  );
}
