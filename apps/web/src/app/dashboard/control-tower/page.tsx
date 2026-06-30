'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronLeft, RadioTower, Lock, Loader2, ArrowRight, RefreshCw } from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';

type Health = 'green' | 'amber' | 'red';

interface AreaCard {
  key: string;
  label: string;
  href: string;
  health: Health;
  headline: string;
  metrics: { label: string; value: string | number }[];
}

interface Summary {
  generatedAt: string;
  overall: Health;
  areas: AreaCard[];
}

const HEALTH_COLOR: Record<Health, string> = {
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
};
const HEALTH_LABEL: Record<Health, string> = {
  green: 'En control',
  amber: 'Atención',
  red: 'Crítico',
};

export default function ControlTowerPage() {
  const { data, isLoading, forbidden, mutate } = useApi<Summary>('/control-tower/summary');

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-foreground">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-500 dark:text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Inicia sesión para ver la Torre de Control.</p>
        </div>
      </div>
    );
  }

  const overall = data?.overall ?? 'green';
  const areas = data?.areas ?? [];

  return (
    <div className="min-h-screen text-foreground">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" aria-label="Volver al inicio" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgba(59,130,246,0.12)' }}>
            <RadioTower className="w-5 h-5" style={{ color: '#3b82f6' }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Torre de Control</h1>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-tight">Vista ejecutiva cross-área en tiempo real</p>
          </div>
          <button onClick={() => mutate()} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10" title="Actualizar">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 pt-8 pb-24">
        {/* Overall banner */}
        <div className={`${glass} rounded-2xl p-5 mb-6 flex items-center gap-4`}>
          <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: HEALTH_COLOR[overall], boxShadow: `0 0 0 6px ${HEALTH_COLOR[overall]}22` }} />
          <div className="flex-1">
            <div className="text-lg font-semibold">Estado global: {HEALTH_LABEL[overall]}</div>
            <div className="text-[12px] text-gray-500 dark:text-gray-400">
              {data ? `Actualizado ${new Date(data.generatedAt).toLocaleTimeString()}` : 'Cargando…'} · {areas.length} áreas
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-500 dark:text-gray-400" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {areas.map((a) => (
              <Link key={a.key} href={a.href} className={`${glass} rounded-2xl p-5 block hover:scale-[1.01] transition-transform`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: HEALTH_COLOR[a.health] }} />
                  <span className="font-semibold flex-1 truncate">{a.label}</span>
                  <ArrowRight className="w-4 h-4 text-gray-300" />
                </div>
                <div className="text-xl font-semibold mb-3" style={{ color: HEALTH_COLOR[a.health] }}>{a.headline}</div>
                <div className="grid grid-cols-3 gap-2">
                  {a.metrics.map((m, i) => (
                    <div key={i}>
                      <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 truncate">{m.label}</div>
                      <div className="text-sm font-semibold">{m.value}</div>
                    </div>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
