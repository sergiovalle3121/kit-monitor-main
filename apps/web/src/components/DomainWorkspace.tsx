'use client';

import React from 'react';
import { Domain } from '@/config/domains';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SubAppGrid } from './SubAppGrid';

interface DomainWorkspaceProps {
  domain: Domain;
}

export function DomainWorkspace({ domain }: DomainWorkspaceProps) {
  const IconComponent = Icons[domain.icon as keyof typeof Icons] as LucideIcon | undefined;

  // KPIs simulados - se reemplazarán con datos reales
  const kpis = [
    { label: 'KPI principal', value: '98.5%', trend: '+2.3%', icon: 'TrendingUp' },
    { label: 'En proceso', value: '24', trend: '-1', icon: 'Activity' },
    { label: 'Pendientes', value: '7', trend: '0', icon: 'Clock' },
  ];

  return (
    <div className="space-y-8">
      {/* Header del dominio */}
      <div className="flex items-center space-x-4">
        <div className={`p-3 rounded-2xl ${domain.tint}`}>
          {IconComponent && <IconComponent className={`w-8 h-8 ${domain.accent}`} strokeWidth={1.5} />}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{domain.name}</h1>
          <p className="text-gray-500">{domain.subtitle}</p>
        </div>
      </div>

      {/* KPIs del dominio */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpis.map((kpi, index) => {
          const KpiIcon = Icons[kpi.icon as keyof typeof Icons] as LucideIcon | undefined;
          return (
            <div key={index} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                {KpiIcon && <KpiIcon className="w-5 h-5 text-gray-400" />}
                <span className={`text-xs font-medium ${kpi.trend.startsWith('+') ? 'text-green-600' : kpi.trend === '0' ? 'text-gray-400' : 'text-red-600'}`}>
                  {kpi.trend}
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
              <div className="text-sm text-gray-500">{kpi.label}</div>
            </div>
          );
        })}
      </div>

      {/* Sub-apps */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Aplicaciones</h2>
        <SubAppGrid subApps={domain.subApps} domainId={domain.id} />
      </div>
    </div>
  );
}
