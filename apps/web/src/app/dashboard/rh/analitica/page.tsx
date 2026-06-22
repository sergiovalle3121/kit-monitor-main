'use client';

import React from 'react';
import { Activity, TrendingDown, AlertTriangle, Gauge } from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import {
  RhShell,
  Kpi,
  Bar,
  RiskPill,
  Forbidden,
  Spinner,
  COLORS,
  RISK_COLOR,
  fmtInt,
  fmtMoney,
  fmtPct,
} from '../_components/ui';

interface Overview {
  headcount: number;
  direct: number;
  indirect: number;
  directIndirectRatio: number;
  turnoverPct: number;
  voluntaryPct: number;
  earlyAttritionPct: number;
  absenteeismPct: number;
  spanOfControl: number;
  avgTenureYears: number;
  tenureBands: { band: string; count: number }[];
  byShift: { key: string; count: number }[];
}

interface Attrition {
  turnoverPct: number;
  voluntary: number;
  involuntary: number;
  earlyAttritionPct: number;
  byArea: { key: string; separations: number; headcount: number; turnoverPct: number }[];
  byShift: { key: string; separations: number; headcount: number; turnoverPct: number }[];
  topReasons: { reason: string; count: number }[];
  trend: { month: string; separations: number; hires: number }[];
}

interface StaffingCell {
  area: string;
  shift: string;
  headcount: number;
  openOpenings: number;
  attritionPct: number;
  absenteeismPct: number;
  skillCoveragePct: number;
  score: number;
  band: string;
  gapPct: number;
  recommendation: string;
  drivers: string[];
}

interface FlightRow {
  id: string;
  name: string;
  area: string | null;
  shift: string | null;
  tenureYears: number;
  score: number;
  band: string;
  drivers: string[];
}

interface LaborCost {
  monthlyDirect: number;
  monthlyIndirect: number;
  total: number;
  byCostCenter: { key: string; cost: number; headcount: number }[];
}

export default function AnaliticaPage() {
  const { data: ov, isLoading, forbidden } = useApi<Overview>('/hr/analytics/overview');
  const { data: at } = useApi<Attrition>('/hr/analytics/attrition');
  const { data: risk } = useApi<StaffingCell[]>('/hr/analytics/staffing-risk');
  const { data: flight } = useApi<FlightRow[]>('/hr/analytics/flight-risk');
  const { data: cost } = useApi<LaborCost>('/hr/analytics/labor-cost');

  if (forbidden) return <Forbidden />;

  const riskCells = (risk ?? []).filter((c) => c.headcount > 0 || c.openOpenings > 0);
  const maxTrend = Math.max(1, ...(at?.trend ?? []).flatMap((t) => [t.separations, t.hires]));
  const maxReason = Math.max(1, ...(at?.topReasons ?? []).map((r) => r.count));
  const maxTenure = Math.max(1, ...(ov?.tenureBands ?? []).map((b) => b.count));
  const maxCc = Math.max(1, ...(cost?.byCostCenter ?? []).map((c) => c.cost));

  return (
    <RhShell
      title="Analítica de fuerza laboral"
      subtitle="People analytics — de la data de personas a decisiones de operación"
      icon={Activity}
      color={COLORS.violet}
    >
      {isLoading ? (
        <Spinner />
      ) : (
        <>
          {/* Headline KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Kpi label="Rotación anualizada" value={fmtPct(ov?.turnoverPct)} sub={`${fmtPct(ov?.voluntaryPct, 0)} voluntaria`} color={COLORS.amber} />
            <Kpi label="Rotación temprana <90d" value={fmtPct(ov?.earlyAttritionPct)} sub="del total de nuevos ingresos" color={COLORS.red} />
            <Kpi label="Ausentismo 30d" value={fmtPct(ov?.absenteeismPct)} color={COLORS.red} />
            <Kpi label="Tramo de control" value={ov ? `${ov.spanOfControl}` : '—'} sub="reportes por líder" color={COLORS.blue} />
          </div>

          {/* STAFFING RISK — the cross-domain centerpiece */}
          <section className={`${glass} rounded-2xl p-5 mb-6`}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4" style={{ color: COLORS.amber }} />
              <h3 className="font-semibold">Riesgo de staffing por área / turno</h3>
            </div>
            <p className="text-[12px] text-gray-400 mb-4">
              Fusiona brecha de vacantes, rotación, ausentismo y cobertura de skills → ¿habrá gente certificada para correr el plan?
            </p>
            {riskCells.length === 0 ? (
              <Empty>Sin datos de plantilla para evaluar riesgo.</Empty>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-gray-400 text-[11px] uppercase tracking-wide">
                      <th className="py-2 px-1 font-medium">Área · Turno</th>
                      <th className="py-2 px-1 font-medium text-right">HC</th>
                      <th className="py-2 px-1 font-medium text-right">Vacantes</th>
                      <th className="py-2 px-1 font-medium text-right">Rotación</th>
                      <th className="py-2 px-1 font-medium text-right">Ausent.</th>
                      <th className="py-2 px-1 font-medium text-right">Skills</th>
                      <th className="py-2 px-1 font-medium">Riesgo</th>
                      <th className="py-2 px-1 font-medium">Recomendación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riskCells.slice(0, 14).map((c, i) => (
                      <tr key={i} className="border-t border-black/5 dark:border-white/10">
                        <td className="py-2 px-1 font-medium whitespace-nowrap">{c.area} <span className="text-gray-400">· T{c.shift}</span></td>
                        <td className="py-2 px-1 text-right tabular-nums">{c.headcount}</td>
                        <td className="py-2 px-1 text-right tabular-nums" style={{ color: c.openOpenings > 0 ? COLORS.amber : undefined }}>{c.openOpenings || '—'}</td>
                        <td className="py-2 px-1 text-right tabular-nums">{fmtPct(c.attritionPct, 0)}</td>
                        <td className="py-2 px-1 text-right tabular-nums">{fmtPct(c.absenteeismPct, 0)}</td>
                        <td className="py-2 px-1 text-right tabular-nums">{fmtPct(c.skillCoveragePct, 0)}</td>
                        <td className="py-2 px-1">
                          <div className="flex items-center gap-1.5">
                            <span className="tabular-nums font-semibold" style={{ color: RISK_COLOR[c.band] }}>{c.score}</span>
                            <RiskPill band={c.band} />
                          </div>
                        </td>
                        <td className="py-2 px-1 text-gray-500 dark:text-gray-400 text-[12px]">{c.recommendation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Attrition by area */}
            <section className={`${glass} rounded-2xl p-5`}>
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="w-4 h-4" style={{ color: COLORS.amber }} />
                <h3 className="font-semibold">Rotación por área</h3>
              </div>
              {at?.byArea?.length ? (
                <div className="space-y-3">
                  {at.byArea.slice(0, 7).map((a) => (
                    <Bar
                      key={a.key}
                      label={a.key}
                      value={a.turnoverPct}
                      max={Math.max(1, ...at.byArea.map((x) => x.turnoverPct))}
                      color={a.turnoverPct >= 30 ? COLORS.red : a.turnoverPct >= 15 ? COLORS.amber : COLORS.green}
                      right={`${fmtPct(a.turnoverPct, 0)} · ${a.separations} bajas`}
                    />
                  ))}
                </div>
              ) : (
                <Empty>Sin bajas registradas.</Empty>
              )}
            </section>

            {/* Hires vs separations trend */}
            <section className={`${glass} rounded-2xl p-5`}>
              <h3 className="font-semibold mb-4">Altas vs bajas (6 meses)</h3>
              {at?.trend?.length ? (
                <div className="flex items-end justify-between gap-2 h-40">
                  {at.trend.map((t) => (
                    <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end justify-center gap-1 h-32">
                        <div className="w-1/2 rounded-t" style={{ height: `${(t.hires / maxTrend) * 100}%`, background: COLORS.green, minHeight: t.hires ? 4 : 0 }} title={`${t.hires} altas`} />
                        <div className="w-1/2 rounded-t" style={{ height: `${(t.separations / maxTrend) * 100}%`, background: COLORS.red, minHeight: t.separations ? 4 : 0 }} title={`${t.separations} bajas`} />
                      </div>
                      <span className="text-[10px] text-gray-400">{t.month.slice(5)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty>Sin histórico.</Empty>
              )}
              <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-400">
                <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COLORS.green }} /> Altas</span>
                <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COLORS.red }} /> Bajas</span>
              </div>
            </section>

            {/* Tenure distribution */}
            <section className={`${glass} rounded-2xl p-5`}>
              <div className="flex items-center gap-2 mb-4">
                <Gauge className="w-4 h-4" style={{ color: COLORS.blue }} />
                <h3 className="font-semibold">Distribución de antigüedad</h3>
              </div>
              {ov?.tenureBands?.length ? (
                <div className="space-y-3">
                  {ov.tenureBands.map((b) => (
                    <Bar key={b.band} label={bandLabel(b.band)} value={b.count} max={maxTenure} color={COLORS.blue} />
                  ))}
                </div>
              ) : (
                <Empty>Sin datos.</Empty>
              )}
            </section>

            {/* Top termination reasons */}
            <section className={`${glass} rounded-2xl p-5`}>
              <h3 className="font-semibold mb-4">Motivos de baja</h3>
              {at?.topReasons?.length ? (
                <div className="space-y-3">
                  {at.topReasons.map((r) => (
                    <Bar key={r.reason} label={r.reason} value={r.count} max={maxReason} color={COLORS.amber} />
                  ))}
                </div>
              ) : (
                <Empty>Sin motivos capturados.</Empty>
              )}
            </section>
          </div>

          {/* Flight risk + labor cost */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className={`${glass} rounded-2xl p-5`}>
              <h3 className="font-semibold mb-1">Colaboradores en riesgo de salida</h3>
              <p className="text-[12px] text-gray-400 mb-4">Señal explicable: antigüedad, ausentismo, engagement y reconocimiento.</p>
              {flight?.length ? (
                <div className="space-y-2">
                  {flight.slice(0, 8).map((f) => (
                    <div key={f.id} className="flex items-center gap-3">
                      <div className="w-10 text-right tabular-nums font-semibold" style={{ color: RISK_COLOR[f.band] }}>{f.score}</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium truncate">{f.name}</div>
                        <div className="text-[11px] text-gray-400 truncate">{f.area ?? 'Sin área'}{f.shift ? ` · T${f.shift}` : ''}{f.drivers.length ? ` · ${f.drivers[0]}` : ''}</div>
                      </div>
                      <RiskPill band={f.band} />
                    </div>
                  ))}
                </div>
              ) : (
                <Empty>Sin señales de riesgo.</Empty>
              )}
            </section>

            <section className={`${glass} rounded-2xl p-5`}>
              <h3 className="font-semibold mb-4">Costo de mano de obra</h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <Mini label="Directa" value={fmtMoney(cost?.monthlyDirect)} color={COLORS.pink} />
                <Mini label="Indirecta" value={fmtMoney(cost?.monthlyIndirect)} color={COLORS.violet} />
                <Mini label="Total/mes" value={fmtMoney(cost?.total)} color={COLORS.green} />
              </div>
              {cost?.byCostCenter?.length ? (
                <div className="space-y-3">
                  {cost.byCostCenter.slice(0, 6).map((c) => (
                    <Bar key={c.key} label={`${c.key} · ${fmtInt(c.headcount)} pers`} value={c.cost} max={maxCc} color={COLORS.green} right={fmtMoney(c.cost)} />
                  ))}
                </div>
              ) : (
                <Empty>Captura costo mensual en la plantilla.</Empty>
              )}
            </section>
          </div>
        </>
      )}
    </RhShell>
  );
}

function bandLabel(band: string): string {
  switch (band) {
    case '<3m': return 'Menos de 3 meses';
    case '3-12m': return '3 a 12 meses';
    case '1-3y': return '1 a 3 años';
    case '3-5y': return '3 a 5 años';
    case '5y+': return 'Más de 5 años';
    default: return band;
  }
}

function Mini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl bg-black/5 dark:bg-white/10 p-3">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-sm font-semibold mt-0.5 tabular-nums" style={{ color }}>{value}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-[13px] text-gray-400 py-6 text-center">{children}</div>;
}
