'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft, Loader2, Lock, Target, Layers, ShieldAlert, Truck, DollarSign,
  ArrowUpRight, Crown, ExternalLink,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import {
  money, compactMoney, TIER_COLOR, PROGRAM_META, healthColor, type Customer360,
} from '@/lib/customer360';

const SEV_COLOR: Record<string, string> = { LOW: '#6b7280', MEDIUM: '#f59e0b', HIGH: '#ef4444', CRITICAL: '#dc2626' };

export default function Customer360Page() {
  const params = useParams();
  const code = String(params.code);
  const { data, isLoading, forbidden } = useApi<Customer360>(`/customer-insights/${code}`);

  if (forbidden) return <Guard />;
  if (isLoading || !data) return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  const { customer: c, account, programs, commercial, quality, delivery, finance, metrics } = data;
  const tierColor = account?.tier ? TIER_COLOR[account.tier] || '#6b7280' : '#0fb39a';
  const ccy = commercial.currency || 'USD';

  return (
    <div className="min-h-screen text-black dark:text-white">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Link href="/dashboard/customers" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><ChevronLeft className="w-5 h-5" /></Link>
          <span className="w-10 h-10 rounded-xl grid place-items-center text-white font-bold flex-shrink-0" style={{ background: `linear-gradient(135deg, ${tierColor}, #0fb39a)` }}>{c.name.slice(0, 2).toUpperCase()}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2"><h1 className="text-lg font-semibold leading-tight truncate">{c.name}</h1>{account?.tier === 'STRATEGIC' && <Crown className="w-4 h-4" style={{ color: '#7c3aed' }} />}</div>
            <p className="text-[12px] text-gray-400 leading-tight font-mono">{c.code}{c.industry ? ` · ${c.industry}` : ''}</p>
          </div>
          {account && (
            <Link href={`/dashboard/crm/accounts/${account.id}`} className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10">
              Cuenta CRM <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 pt-6 pb-24">
        {/* Metric strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <Metric label="Programas" value={String(metrics.programs)} sub={`${metrics.activePrograms} activos`} color="#3b82f6" />
          <Metric label="Pipeline" value={compactMoney(metrics.pipelineValue, ccy)} color="#7c3aed" />
          <Metric label="Ganado" value={compactMoney(metrics.wonValue, ccy)} color="#10b981" />
          <Metric label="RMAs abiertas" value={String(metrics.openRmas)} color={metrics.openRmas ? '#ef4444' : '#10b981'} />
          <Metric label="OTD" value={metrics.otdPct != null ? `${metrics.otdPct}%` : '—'} color={metrics.otdPct == null ? '#6b7280' : metrics.otdPct >= 95 ? '#10b981' : '#f59e0b'} />
          <Metric label="Órdenes venta" value={compactMoney(metrics.salesOrderValue, ccy)} color="#0fb39a" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Comercial */}
          <Section icon={Target} title="Comercial (CRM)" accent="#7c3aed" right={account && <Link href={`/dashboard/crm/accounts/${account.id}`} className="text-[12px] font-medium inline-flex items-center gap-1" style={{ color: '#7c3aed' }}>Abrir <ExternalLink className="w-3 h-3" /></Link>}>
            {commercial.account ? (
              <div className="space-y-2.5">
                <Row label="Pipeline" value={money(commercial.pipelineValue, ccy)} />
                <Row label="Ponderado" value={money(commercial.weightedValue, ccy)} />
                <Row label="Ganado" value={money(commercial.wonValue, ccy)} valueColor="#10b981" />
                <Row label="Cotizaciones abiertas" value={`${commercial.openQuotes} · ${compactMoney(commercial.quoteValue, ccy)}`} />
                <div className="pt-2 mt-1 border-t border-black/5 dark:border-white/10 space-y-2.5">
                  <Row label="Tier" value={account?.tier || '—'} />
                  <Row label="Términos" value={commercial.account.paymentTerms || '—'} />
                  <Row label="Crédito" value={commercial.account.creditLimit ? money(commercial.account.creditLimit, ccy) : '—'} />
                </div>
              </div>
            ) : <Muted text="Sin cuenta comercial ligada." />}
          </Section>

          {/* Programas */}
          <Section icon={Layers} title="Programas" accent="#3b82f6">
            {programs.length === 0 ? <Muted text="Sin programas." /> : (
              <div className="space-y-2">
                {programs.map((p) => {
                  const m = PROGRAM_META[p.status] || { label: p.status, color: '#6b7280' };
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0"><div className="text-sm font-medium truncate">{p.name}</div><div className="text-[11px] text-gray-400 font-mono">{p.code}</div></div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0" style={{ background: `${m.color}1f`, color: m.color }}>{m.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* Calidad */}
          <Section icon={ShieldAlert} title="Calidad (RMA)" accent="#ef4444">
            <div className="flex items-center gap-4 mb-3">
              <div><div className="text-2xl font-bold tabular-nums" style={{ color: quality.open ? '#ef4444' : '#10b981' }}>{quality.open}</div><div className="text-[11px] text-gray-400">abiertas</div></div>
              <div><div className="text-2xl font-bold tabular-nums text-gray-400">{quality.total}</div><div className="text-[11px] text-gray-400">totales</div></div>
            </div>
            {quality.recent.length === 0 ? <Muted text="Sin RMAs." /> : (
              <div className="space-y-2 max-h-44 overflow-y-auto">
                {quality.recent.map((r) => (
                  <div key={r.id} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: SEV_COLOR[r.severity] || '#6b7280' }} />
                    <div className="min-w-0"><div className="text-[12px] font-medium truncate">{r.failureDescription}</div><div className="text-[10px] text-gray-400">{r.folio || ''} · {r.status}</div></div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Entrega */}
          <Section icon={Truck} title="Entrega" accent="#0a84ff">
            <div className="space-y-2.5">
              <Row label="Embarques" value={String(delivery.total)} />
              <Row label="Enviados" value={String(delivery.shipped)} />
              <Row label="En tránsito" value={String(delivery.inTransit)} />
              <Row label="OTD" value={delivery.otdPct != null ? `${delivery.otdPct}%` : '—'} valueColor={delivery.otdPct == null ? undefined : delivery.otdPct >= 95 ? '#10b981' : '#f59e0b'} />
            </div>
          </Section>

          {/* Finanzas */}
          <Section icon={DollarSign} title="Finanzas" accent="#0fb39a">
            <div className="space-y-2.5">
              <Row label="Órdenes de venta" value={String(finance.total)} />
              <Row label="Abiertas" value={`${finance.open} · ${compactMoney(finance.openValue, finance.currency)}`} />
              <Row label="Valor total" value={money(finance.totalValue, finance.currency)} valueColor="#0fb39a" />
            </div>
          </Section>

          {/* Salud */}
          {account && (
            <Section icon={Target} title="Salud de cuenta" accent={healthColor(account.healthScore)}>
              <div className="flex items-end gap-2 mb-2"><div className="text-4xl font-bold tabular-nums" style={{ color: healthColor(account.healthScore) }}>{account.healthScore}</div><div className="text-[12px] text-gray-400 mb-1.5">/ 100</div></div>
              <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden mb-3"><div className="h-full rounded-full" style={{ width: `${account.healthScore}%`, background: healthColor(account.healthScore) }} /></div>
              <Row label="Account manager" value={account.ownerEmail || '—'} />
            </Section>
          )}
        </div>
      </main>
    </div>
  );
}

function Section({ icon: Icon, title, accent, right, children }: { icon: typeof Target; title: string; accent: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={`${glass} rounded-2xl p-5`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2"><span className="w-7 h-7 rounded-lg grid place-items-center flex-shrink-0" style={{ background: `${accent}1a`, color: accent }}><Icon className="w-4 h-4" /></span><h3 className="text-sm font-semibold">{title}</h3></div>
        {right}
      </div>
      {children}
    </div>
  );
}
function Metric({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return <div className={`${glass} rounded-2xl p-3.5`}><div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div><div className="text-lg font-semibold mt-0.5 tabular-nums truncate" style={{ color }}>{value}</div>{sub && <div className="text-[11px] text-gray-400 truncate">{sub}</div>}</div>;
}
function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return <div className="flex items-center justify-between gap-2 text-[13px]"><span className="text-gray-400">{label}</span><span className="font-medium truncate ml-2" style={{ color: valueColor }}>{value}</span></div>;
}
function Muted({ text }: { text: string }) { return <p className="text-[13px] text-gray-400 py-2">{text}</p>; }
function Guard() { return <div className="min-h-screen grid place-items-center text-black dark:text-white"><div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}><Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" /><h2 className="text-lg font-semibold">Sin acceso</h2></div></div>; }
