'use client';

import React, { useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Cell, Legend,
} from 'recharts';
import { LineChart as LineChartIcon, Loader2, Clock, Truck, AlertTriangle, RefreshCw, Package } from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { KpiRow, ExportButton, EmptyState, type StatCardProps, type ExportColumn } from '@/components/workspace';
import { BLUE, TEAL, VIOLET, AMBER, GREEN, RED, type SupplyAnalytics, formatAging } from './shared';

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className={`${glass} rounded-2xl p-5`}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-[12px] text-gray-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

const AXIS = { fontSize: 11, fill: '#9ca3af' };

export default function AnalyticsPanel() {
  const { data, isLoading } = useApi<SupplyAnalytics>('/warehouse/analytics');

  const a = data;
  const byWarehouse = useMemo(() => (a?.byWarehouse ?? []).map((w) => ({ ...w, name: (w.warehouseName || w.warehouseId).replace(/^.*—\s*/, '') })), [a]);
  const byProject = useMemo(() => (a?.byProject ?? []).filter((p) => p.project && p.project !== '—').slice(0, 8), [a]);
  const perDay = useMemo(() => (a?.perDay ?? []).map((d) => ({ ...d, label: d.day.slice(5) })), [a]);
  const topParts = a?.topParts ?? [];

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  }

  if (!a?.totals || a.totals.total === 0) {
    return (
      <EmptyState
        icon={LineChartIcon}
        accent={VIOLET}
        title="La analítica de suministro espera datos"
        description="Cuando empiecen a fluir los pulls, aquí verás qué se pide, quién, cuándo, de qué almacén y cuánto tarda el suministro. Medirá: tiempo de suministro promedio por almacén y proyecto, pulls por día, top de partes/proyectos pedidos, % fuera de SLA y touches promedio."
        hint={[
          'Tiempo de suministro = del alta del pull a su entrega (aging al entregar).',
          'Detecta picos de demanda y almacenes con SLA en riesgo.',
          'Exporta el análisis a CSV para tu reporte de turno.',
        ]}
      />
    );
  }

  const t = a.totals;
  const kpiItems: StatCardProps[] = [
    { label: 'Pulls (histórico)', value: t.total, color: BLUE, icon: Package },
    { label: 'Entregados', value: t.delivered, color: GREEN, icon: Truck },
    { label: 'Suministro prom.', value: formatAging(t.avgSupplyMinutes), color: t.avgSupplyMinutes > 120 ? RED : t.avgSupplyMinutes > 90 ? AMBER : TEAL, icon: Clock },
    { label: '% fuera de SLA', value: `${t.pctOutOfSla}%`, color: t.pctOutOfSla > 20 ? RED : t.pctOutOfSla > 10 ? AMBER : GREEN, icon: AlertTriangle },
    { label: 'Touches prom.', value: t.avgTouches, color: t.avgTouches >= 2 ? AMBER : TEAL, icon: RefreshCw },
  ];

  const PROJECT_EXPORT: ExportColumn<{ project: string; count: number; avgSupplyMinutes: number }>[] = [
    { key: 'project', header: 'Proyecto' },
    { key: 'count', header: 'Pulls' },
    { key: 'avgSupplyMinutes', header: 'Suministro prom. (min)' },
  ];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <KpiRow items={kpiItems} columns={5} />
      </div>
      <div className="mb-5 flex justify-end">
        <ExportButton<{ project: string; count: number; avgSupplyMinutes: number }>
          rows={a.byProject}
          columns={PROJECT_EXPORT}
          filename="analitica-suministro-proyecto"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Tiempo de suministro por almacén" subtitle="Minutos promedio del alta del pull a su entrega">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byWarehouse} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb22" />
              <XAxis dataKey="name" tick={AXIS} interval={0} angle={-12} textAnchor="end" height={50} />
              <YAxis tick={AXIS} />
              <Tooltip formatter={(v) => [`${v} min`, 'Suministro prom.']} />
              <Bar dataKey="avgSupplyMinutes" radius={[6, 6, 0, 0]}>
                {byWarehouse.map((w, i) => <Cell key={i} fill={w.breachedOpen > 0 ? RED : TEAL} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Tiempo de suministro por proyecto" subtitle="Qué proyectos esperan más su material">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byProject} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb22" />
              <XAxis dataKey="project" tick={AXIS} interval={0} angle={-12} textAnchor="end" height={50} />
              <YAxis tick={AXIS} />
              <Tooltip formatter={(v) => [`${v} min`, 'Suministro prom.']} />
              <Bar dataKey="avgSupplyMinutes" radius={[6, 6, 0, 0]} fill={VIOLET} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Pulls por día" subtitle="Demanda (creados) vs suministro (entregados) — detecta picos">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={perDay} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
              <defs>
                <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={BLUE} stopOpacity={0.7} /><stop offset="95%" stopColor={BLUE} stopOpacity={0.05} /></linearGradient>
                <linearGradient id="gDelivered" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={GREEN} stopOpacity={0.7} /><stop offset="95%" stopColor={GREEN} stopOpacity={0.05} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb22" />
              <XAxis dataKey="label" tick={AXIS} />
              <YAxis tick={AXIS} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="created" name="Creados" stroke={BLUE} fill="url(#gCreated)" />
              <Area type="monotone" dataKey="delivered" name="Entregados" stroke={GREEN} fill="url(#gDelivered)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Top partes pedidas" subtitle="Las más solicitadas al almacén">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart layout="vertical" data={topParts} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb22" />
              <XAxis type="number" tick={AXIS} allowDecimals={false} />
              <YAxis type="category" dataKey="partNumber" tick={{ ...AXIS, fontSize: 10 }} width={110} />
              <Tooltip formatter={(v) => [v, 'Pulls']} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} fill={AMBER} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Resumen por almacén (cuadra con las gráficas; drill-down de cifras) */}
      <div className={`${glass} mt-4 overflow-x-auto rounded-2xl p-5`}>
        <h3 className="mb-3 text-sm font-semibold">Resumen por almacén</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-[11px] uppercase tracking-wide text-gray-400 dark:border-white/10">
              <th className="py-2">Almacén</th>
              <th className="py-2 text-right">Abiertos</th>
              <th className="py-2 text-right">Entregados</th>
              <th className="py-2 text-right">Suministro prom.</th>
              <th className="py-2 text-right">Touches prom.</th>
              <th className="py-2 text-right">SLA roto (abiertos)</th>
            </tr>
          </thead>
          <tbody>
            {byWarehouse.map((w) => (
              <tr key={w.warehouseId} className="border-b border-black/5 last:border-0 dark:border-white/5">
                <td className="py-2 font-medium">{w.name}</td>
                <td className="py-2 text-right tabular-nums">{w.open}</td>
                <td className="py-2 text-right tabular-nums">{w.delivered}</td>
                <td className="py-2 text-right tabular-nums">{formatAging(w.avgSupplyMinutes)}</td>
                <td className="py-2 text-right tabular-nums">{w.avgTouches}</td>
                <td className="py-2 text-right tabular-nums" style={{ color: w.breachedOpen > 0 ? RED : undefined }}>{w.breachedOpen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
