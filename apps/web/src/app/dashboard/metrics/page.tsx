'use client';

import React from 'react';
import { Activity, Calculator, RadioTower, LineChart, Factory } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useCostRollup, type CostCategory } from '@/hooks/useCostRollup';
import { glass } from '@/lib/glass';
import { DepartmentWorkspace } from '@/components/DepartmentWorkspace';

interface PlanRow { status?: string }

const CAT_LABEL: Record<CostCategory, string> = {
  mano_de_obra: 'Mano de obra',
  materia_prima: 'Materiales',
  energia: 'Energía',
  gastos_fijos: 'Gastos fijos',
};
const CAT_COLOR: Record<CostCategory, string> = {
  mano_de_obra: '#7c3aed',
  materia_prima: '#3b82f6',
  energia: '#f59e0b',
  gastos_fijos: '#10b981',
};

const fmtMoney = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default function MetricsPage() {
  const { data: plansData } = useApi<PlanRow[]>('/plans');
  const plans = Array.isArray(plansData) ? plansData : [];
  const norm = (s?: string) => (s || '').toLowerCase();
  const open = plans.filter((p) => ['pending', 'active'].includes(norm(p.status))).length;
  const published = plans.filter((p) => ['published', 'released', 'active'].includes(norm(p.status))).length;
  const completed = plans.filter((p) => norm(p.status) === 'completed').length;

  const { data: cost } = useCostRollup();
  const totalCost = cost?.totalCost ?? 0;
  const breakdown = cost?.breakdown ?? [];

  return (
    <DepartmentWorkspace
      title="Costos y métricas"
      subtitle="Medir para controlar — dinero por operación y eficiencia de planta"
      icon={Activity}
      iconClass="text-cyan-600"
      iconTint="bg-cyan-50 dark:bg-cyan-500/10"
      kpis={[
        { label: 'Costo total', value: fmtMoney(totalCost), color: '#0891b2' },
        { label: 'WOs abiertas', value: open, color: '#f59e0b' },
        { label: 'Publicadas', value: published, color: '#7c3aed' },
        { label: 'Completadas', value: completed, color: '#10b981' },
      ]}
      tools={[
        { title: 'Costeo por orden', desc: 'Desglose por WO (MO, material, energía, fijos)', href: '/dashboard/finance/cost-rollup', icon: Calculator, color: 'text-emerald-500', tint: 'bg-emerald-50 dark:bg-emerald-500/10' },
        { title: 'Mission Control', desc: 'OEE, throughput, paros y cuellos en vivo', href: '/dashboard/mission-control', icon: RadioTower, color: 'text-cyan-500', tint: 'bg-cyan-50 dark:bg-cyan-500/10' },
        { title: 'Forecast y simulación', desc: 'Escenarios y Monte Carlo', href: '/dashboard/forecast', icon: LineChart, color: 'text-violet-500', tint: 'bg-violet-50 dark:bg-violet-500/10' },
        { title: 'Piso de producción', desc: 'Avance y paros por línea', href: '/dashboard/production', icon: Factory, color: 'text-amber-500', tint: 'bg-amber-50 dark:bg-amber-500/10' },
      ]}
    >
      {breakdown.length > 0 && (
        <>
          <h2 className="text-sm font-semibold tracking-wide text-gray-500 dark:text-gray-400 mb-4">¿En qué se va el dinero?</h2>
          <div className={`${glass} rounded-3xl p-6 space-y-4`}>
            {breakdown.map((b) => {
              const cat = b.category as CostCategory;
              return (
                <div key={b.category}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-semibold">{CAT_LABEL[cat] ?? b.category}</span>
                    <span className="tabular-nums text-gray-500">{fmtMoney(b.amount)} · {Math.round(b.percentage)}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, b.percentage)}%`, backgroundColor: CAT_COLOR[cat] ?? '#6366f1' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </DepartmentWorkspace>
  );
}
