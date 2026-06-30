'use client';

import React from 'react';
import {
  Users,
  ShieldAlert,
  Building2,
  UserCog,
  UserPlus,
  Activity,
  Target,
  GraduationCap,
} from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { DepartmentWorkspace } from '@/components/DepartmentWorkspace';

interface Overview {
  headcount: number;
  turnoverPct: number;
  absenteeismPct: number;
  openOpenings: number;
  directIndirectRatio: number;
}

export default function RhPage() {
  const { data, isLoading } = useApi<Overview>('/hr/analytics/overview');
  const o = data ?? null;

  return (
    <DepartmentWorkspace
      title="Personas (RH)"
      subtitle="Capital humano — plantilla, talento, desempeño y analítica de personal"
      icon={Users}
      iconClass="text-pink-500"
      iconTint="bg-pink-50 dark:bg-pink-500/10"
      loading={isLoading}
      kpis={[
        { label: 'Colaboradores', value: o?.headcount ?? '—', color: '#ec4899' },
        { label: 'Rotación 12m', value: o ? `${o.turnoverPct}%` : '—', color: '#f59e0b' },
        { label: 'Ausentismo 30d', value: o ? `${o.absenteeismPct}%` : '—', color: '#ef4444' },
        { label: 'Vacantes abiertas', value: o?.openOpenings ?? '—', color: '#7c3aed' },
      ]}
      tools={[
        { title: 'Plantilla', desc: 'Maestro de colaboradores y headcount', href: '/dashboard/rh/plantilla', icon: Users, color: 'text-pink-500', tint: 'bg-pink-50 dark:bg-pink-500/10' },
        { title: 'Analítica de fuerza laboral', desc: 'Rotación, ausentismo y riesgo de staffing', href: '/dashboard/rh/analitica', icon: Activity, color: 'text-indigo-500', tint: 'bg-indigo-50 dark:bg-indigo-500/10' },
        { title: 'Reclutamiento', desc: 'Vacantes, pipeline y time-to-fill', href: '/dashboard/rh/reclutamiento', icon: UserPlus, color: 'text-emerald-500', tint: 'bg-emerald-50 dark:bg-emerald-500/10' },
        { title: 'Desempeño y 9-box', desc: 'Evaluaciones, talento y sucesión', href: '/dashboard/rh/desempeno', icon: Target, color: 'text-blue-500', tint: 'bg-blue-50 dark:bg-blue-500/10' },
        { title: 'Skills y certificaciones', desc: 'Matriz de habilidades y recertificación', href: '/dashboard/skills', icon: GraduationCap, color: 'text-amber-500', tint: 'bg-amber-50 dark:bg-amber-500/10' },
        { title: 'Usuarios y accesos', desc: 'Altas, roles y permisos', href: '/dashboard/settings/users', icon: UserCog, color: 'text-slate-500', tint: 'bg-slate-50 dark:bg-slate-500/10' },
        { title: 'Aprobaciones', desc: 'Solicitudes de acceso pendientes', href: '/dashboard/admin/approvals', icon: ShieldAlert, color: 'text-rose-500', tint: 'bg-rose-50 dark:bg-rose-500/10' },
        { title: 'Organización', desc: 'Edificios, clientes y proyectos', href: '/dashboard/settings/organization', icon: Building2, color: 'text-cyan-500', tint: 'bg-cyan-50 dark:bg-cyan-500/10' },
      ]}
    />
  );
}
