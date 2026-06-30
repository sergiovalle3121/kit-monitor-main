'use client';

import React from 'react';
import Link from 'next/link';
import {
  ChevronLeft, RadioTower, Lock, Loader2, Inbox, RefreshCw, PackageCheck,
  Siren, ShieldX, Truck, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';

const GREEN = '#10b981';
const AMBER = '#f59e0b';
const RED = '#ef4444';

type Light = 'green' | 'amber' | 'red';
interface LineStatus {
  line: string; light: Light; woOpen: number; woReady: number; unitsPlanned: number; unitsCompleted: number;
  adherencePct: number; behind: number; openAndons: number; openHolds: number; openReplenish: number; models: string[]; reasons: string[];
}
interface Summary {
  global: Light; lines: LineStatus[];
  totals: { lines: number; woOpen: number; openAndons: number; openHolds: number; openReplenish: number; adherencePct: number };
  generatedAt: string;
}

const LIGHT: Record<Light, { color: string; label: string }> = {
  green: { color: GREEN, label: 'En verde' }, amber: { color: AMBER, label: 'Atención' }, red: { color: RED, label: 'Crítico' },
};
const pct = (n: number) => `${Math.round((n || 0) * 100)}%`;

export default function LineControlTowerPage() {
  const { data, isLoading, forbidden, mutate } = useApi<Summary>('/line-control-tower/summary', { refreshInterval: 15000 });

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-foreground">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}><Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" /><h2 className="text-lg font-semibold">Sin acceso</h2><p className="text-sm text-gray-400 mt-1">Necesitas permiso de producción.</p></div>
      </div>
    );
  }

  const lines = data?.lines ?? [];

  return (
    <div className="min-h-screen text-foreground">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" aria-label="Volver al inicio" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><ChevronLeft className="w-5 h-5" /></Link>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgba(6,182,212,0.14)' }}><RadioTower className="w-5 h-5" style={{ color: '#06b6d4' }} /></span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Torre de control de línea</h1>
            <p className="text-[12px] text-gray-400 leading-tight">Readiness, plan vs real, andons, holds y reposición — la vista de la mañana del gerente.</p>
          </div>
          <button onClick={() => mutate()} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 pt-8 pb-24">
        {/* Global banner */}
        {data && (
          <div className="rounded-2xl p-5 mb-6 flex items-center gap-4" style={{ background: `${LIGHT[data.global].color}14`, border: `1px solid ${LIGHT[data.global].color}55` }}>
            <span className="w-3.5 h-3.5 rounded-full" style={{ background: LIGHT[data.global].color, boxShadow: `0 0 0 4px ${LIGHT[data.global].color}33` }} />
            <div className="flex-1">
              <div className="font-semibold" style={{ color: LIGHT[data.global].color }}>Estado global: {LIGHT[data.global].label}</div>
              <div className="text-[12px] text-gray-500">{data.totals.lines} líneas · {data.totals.woOpen} WO abiertas · adherencia {pct(data.totals.adherencePct)}</div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <Tot icon={Siren} label="Andons" value={data.totals.openAndons} color={RED} />
              <Tot icon={ShieldX} label="Holds" value={data.totals.openHolds} color={RED} />
              <Tot icon={Truck} label="Reposición" value={data.totals.openReplenish} color={AMBER} />
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : lines.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}><Inbox className="w-8 h-8 mx-auto mb-3 text-gray-400" /><h3 className="font-semibold">Sin líneas activas</h3><p className="text-sm text-gray-400 mt-1">Publica WOs en el muro del plan para verlas aquí.</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lines.map((l) => (
              <div key={l.line} className={`${glass} rounded-2xl p-5`} style={{ borderTop: `3px solid ${LIGHT[l.light].color}` }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: LIGHT[l.light].color }} />
                    <h3 className="font-semibold text-lg">{l.line}</h3>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded" style={{ background: `${LIGHT[l.light].color}1f`, color: LIGHT[l.light].color }}>{LIGHT[l.light].label}</span>
                </div>

                <div className="mt-3 flex items-center gap-2 text-[12px] text-gray-400">
                  <PackageCheck className="w-4 h-4" style={{ color: l.woReady === l.woOpen ? GREEN : AMBER }} />
                  Readiness {l.woReady}/{l.woOpen} WO
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[12px] text-gray-400"><span>Plan vs real</span><span>{l.unitsCompleted}/{l.unitsPlanned} · {pct(l.adherencePct)}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round(l.adherencePct * 100))}%`, background: LIGHT[l.light].color }} /></div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Mini icon={Siren} label="Andons" value={l.openAndons} color={l.openAndons ? RED : undefined} />
                  <Mini icon={ShieldX} label="Holds" value={l.openHolds} color={l.openHolds ? RED : undefined} />
                  <Mini icon={Truck} label="Repos." value={l.openReplenish} color={l.openReplenish ? AMBER : undefined} />
                </div>

                {l.models.length > 0 && <div className="mt-3 text-[11px] text-gray-400">Modelos: {l.models.join(', ')}</div>}

                {l.reasons.length > 0 ? (
                  <ul className="mt-3 space-y-1">
                    {l.reasons.map((r, i) => <li key={i} className="text-[12px] flex items-start gap-1.5" style={{ color: LIGHT[l.light].color }}><AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {r}</li>)}
                  </ul>
                ) : (
                  <div className="mt-3 text-[12px] flex items-center gap-1.5" style={{ color: GREEN }}><CheckCircle2 className="w-3.5 h-3.5" /> Lista para correr</div>
                )}
              </div>
            ))}
          </div>
        )}
        {data && <div className="mt-6 text-center text-[11px] text-gray-400">Actualizado {new Date(data.generatedAt).toLocaleTimeString()}</div>}
      </main>
    </div>
  );
}

function Tot({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return <div className="flex items-center gap-1.5" title={label}><Icon className="w-4 h-4" style={{ color: value ? color : '#9ca3af' }} /> <b>{value}</b></div>;
}
function Mini({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl p-2 bg-black/[0.03] dark:bg-white/[0.04]">
      <Icon className="w-3.5 h-3.5 mx-auto" style={{ color: color ?? '#9ca3af' }} />
      <div className="text-lg font-semibold" style={{ color }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
    </div>
  );
}
