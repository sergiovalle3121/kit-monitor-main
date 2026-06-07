'use client';

import React from 'react';
import { Users, ShieldAlert, Building2, UserCog } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { DepartmentWorkspace } from '@/components/DepartmentWorkspace';

interface U { id: string; role?: string; isActive?: boolean; status?: string }

export default function RhPage() {
  const { data } = useApi<U[]>('/governance/users');
  const users = Array.isArray(data) ? data : [];
  const total = users.length;
  const activos = users.filter((u) => u.isActive ?? u.status === 'active').length;
  const admins = users.filter((u) => (u.role || '').toLowerCase().includes('admin')).length;
  const inactivos = Math.max(0, total - activos);

  return (
    <DepartmentWorkspace
      title="Personas (RH)"
      subtitle="Plantilla, accesos y altas — la gente de la operación"
      icon={Users}
      iconClass="text-pink-500"
      iconTint="bg-pink-50 dark:bg-pink-500/10"
      kpis={[
        { label: 'Colaboradores', value: total, color: '#ec4899' },
        { label: 'Activos', value: activos, color: '#10b981' },
        { label: 'Administradores', value: admins, color: '#7c3aed' },
        { label: 'Inactivos', value: inactivos, color: '#94a3b8' },
      ]}
      tools={[
        { title: 'Usuarios y accesos', desc: 'Altas, roles y permisos', href: '/dashboard/settings/users', icon: UserCog, color: 'text-blue-500', tint: 'bg-blue-50 dark:bg-blue-500/10' },
        { title: 'Aprobaciones', desc: 'Solicitudes de acceso pendientes', href: '/dashboard/admin/approvals', icon: ShieldAlert, color: 'text-rose-500', tint: 'bg-rose-50 dark:bg-rose-500/10' },
        { title: 'Organización', desc: 'Edificios, clientes y proyectos', href: '/dashboard/settings/organization', icon: Building2, color: 'text-violet-500', tint: 'bg-violet-50 dark:bg-violet-500/10' },
      ]}
    />
  );
}
