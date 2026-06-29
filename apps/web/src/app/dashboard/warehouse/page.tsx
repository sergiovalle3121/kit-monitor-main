'use client';

import React, { useState } from 'react';
import { Lock, ClipboardList, Undo2, LineChart as LineChartIcon, Layers3 } from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { BLUE } from './_components/shared';
import type { Pull } from './_components/shared';
import PullMonitor from './_components/PullMonitor';
import ReturnsPanel from './_components/ReturnsPanel';
import LocationsPanel from './_components/LocationsPanel';
import dynamic from 'next/dynamic';

// recharts es pesado y solo se usa en la pestaña "analytics": carga diferida.
const AnalyticsPanel = dynamic(() => import('./_components/AnalyticsPanel'), {
  ssr: false,
  loading: () => null,
});

type Tab = 'monitor' | 'locations' | 'returns' | 'analytics';

const TABS: { key: Tab; label: string; icon: typeof ClipboardList }[] = [
  { key: 'monitor', label: 'Pull Monitor', icon: ClipboardList },
  { key: 'locations', label: 'Locaciones', icon: Layers3 },
  { key: 'returns', label: 'Devoluciones', icon: Undo2 },
  { key: 'analytics', label: 'Analítica', icon: LineChartIcon },
];

export default function WarehousePage() {
  // Una sola lectura para el guardrail de acceso (SWR dedupea con el monitor).
  const { forbidden } = useApi<Pull[]>('/warehouse/pulls');
  const [tab, setTab] = useState<Tab>('monitor');

  if (forbidden) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-foreground">
        <div className={`${glass} max-w-sm rounded-3xl p-10 text-center`}>
          <Lock className="mx-auto mb-3 h-8 w-8 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="mt-1 text-sm text-gray-400">Necesitas permiso de materiales para ver el centro de surtido y devoluciones.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 pb-24 text-foreground md:px-8">
      {/* Tabs */}
      <div className="mb-5 flex flex-wrap gap-1.5 pt-2">
        {TABS.map((tDef) => {
          const active = tab === tDef.key;
          const Icon = tDef.icon;
          return (
            <button
              key={tDef.key}
              type="button"
              onClick={() => setTab(tDef.key)}
              className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors"
              style={active ? { background: BLUE, color: '#fff' } : undefined}
            >
              <Icon className="h-4 w-4" />
              {tDef.label}
            </button>
          );
        })}
      </div>

      {tab === 'monitor' && <PullMonitor />}
      {tab === 'locations' && <LocationsPanel />}
      {tab === 'returns' && <ReturnsPanel />}
      {tab === 'analytics' && <AnalyticsPanel />}
    </div>
  );
}
