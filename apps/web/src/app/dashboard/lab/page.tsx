'use client';

import React from 'react';
import { FlaskConical, ShieldCheck, Cpu, RadioTower } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { DepartmentWorkspace } from '@/components/DepartmentWorkspace';

interface Ncr { id: number | string; status?: string; severity?: string }

export default function LabPage() {
  const { data, isLoading } = useApi<Ncr[]>('/ncr');
  const ncrs = Array.isArray(data) ? data : [];
  const open = ncrs.filter((n) => (n.status || '').toLowerCase() !== 'closed').length;
  const critical = ncrs.filter((n) => (n.severity || '').toLowerCase() === 'critical' && (n.status || '').toLowerCase() !== 'closed').length;

  return (
    <DepartmentWorkspace
      title="Pruebas / Lab"
      subtitle="Inspección, validación y laboratorio (NPI)"
      icon={FlaskConical}
      iconClass="text-teal-500"
      iconTint="bg-teal-50 dark:bg-teal-500/10"
      loading={isLoading}
      kpis={[
        { label: 'NCR abiertas', value: open, color: '#f43f5e' },
        { label: 'Críticas', value: critical, color: '#ef4444' },
        { label: 'Total NCR', value: ncrs.length, color: '#64748b' },
      ]}
      tools={[
        { title: 'Calidad', desc: 'NCR, holds, CAPA, IQC/OQC', href: '/dashboard/quality', icon: ShieldCheck, color: 'text-emerald-500', tint: 'bg-emerald-50 dark:bg-emerald-500/10' },
        { title: 'Ingeniería / BOM', desc: 'Definición de producto y materiales', href: '/dashboard/engineering', icon: Cpu, color: 'text-indigo-500', tint: 'bg-indigo-50 dark:bg-indigo-500/10' },
        { title: 'Métricas de calidad', desc: 'FPY, tendencias y excepciones', href: '/dashboard/mission-control', icon: RadioTower, color: 'text-cyan-500', tint: 'bg-cyan-50 dark:bg-cyan-500/10' },
      ]}
    />
  );
}
