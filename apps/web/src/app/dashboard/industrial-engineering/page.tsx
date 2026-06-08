'use client';

import React from 'react';
import { Gauge, Cpu, RadioTower, Factory, LineChart, Calculator } from 'lucide-react';
import { DepartmentWorkspace } from '@/components/DepartmentWorkspace';
import { useApi } from '@/hooks/useApi';

interface PlanKpis {
  inExecution?: number;
  planAdherencePct?: number;
  behindSchedule?: number;
}

export default function IndustrialEngineeringPage() {
  // KPIs reales del backend que ya existe (capacidad/proceso/plan).
  const { data: planKpis } = useApi<PlanKpis>('/production-plan/kpis');
  const { data: stationsData } = useApi<unknown[]>('/line-engineering/stations');
  const stations = Array.isArray(stationsData) ? stationsData.length : 0;
  const pct = (n?: number) => `${Math.round((n ?? 0) * 100)}%`;

  return (
    <DepartmentWorkspace
      title="Ingeniería Industrial"
      subtitle="Proceso, capacidad, balanceo de línea y mejora continua"
      icon={Gauge}
      iconClass="text-rose-500"
      iconTint="bg-rose-50 dark:bg-rose-500/10"
      kpis={[
        { label: 'Estaciones de línea', value: stations, color: '#0f9bb3' },
        { label: 'WO en ejecución', value: planKpis?.inExecution ?? 0, color: '#7c3aed' },
        { label: 'Adherencia al plan', value: pct(planKpis?.planAdherencePct), color: '#10b981' },
        { label: 'WO atrasadas', value: planKpis?.behindSchedule ?? 0, color: '#ef4444' },
      ]}
      tools={[
        { title: 'Ingeniería de proceso', desc: 'Ruta, estaciones y materiales por paso', href: '/dashboard/engineering', icon: Cpu, color: 'text-indigo-500', tint: 'bg-indigo-50 dark:bg-indigo-500/10' },
        { title: 'Métricas en vivo', desc: 'OEE, throughput y cuellos de botella', href: '/dashboard/mission-control', icon: RadioTower, color: 'text-cyan-500', tint: 'bg-cyan-50 dark:bg-cyan-500/10' },
        { title: 'Piso de producción', desc: 'Líneas, avance y paros', href: '/dashboard/production', icon: Factory, color: 'text-amber-500', tint: 'bg-amber-50 dark:bg-amber-500/10' },
        { title: 'Forecast y simulación', desc: 'Monte Carlo, escenarios y capacidad', href: '/dashboard/forecast', icon: LineChart, color: 'text-violet-500', tint: 'bg-violet-50 dark:bg-violet-500/10' },
        { title: 'Costeo por operación', desc: 'Costo por WO y por proceso', href: '/dashboard/finance/cost-rollup', icon: Calculator, color: 'text-emerald-500', tint: 'bg-emerald-50 dark:bg-emerald-500/10' },
      ]}
    />
  );
}
