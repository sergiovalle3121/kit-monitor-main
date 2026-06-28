'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, Target, Plus, Lock, Loader2, Inbox, X, CheckCircle2,
  ArrowRight, Building2, Users, Activity as ActivityIcon, TrendingUp,
  AlertTriangle, Clock, Phone, Mail, CalendarDays, MapPin,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/contexts/ToastContext';
import {
  crmApi, money, compactMoney, crmInput, isOverdue, TIER_META, TYPE_META, OPP_META, healthColor,
  type Account, type Opportunity, type Activity, type OppStatus,
} from '@/lib/crm';

const VIOLET = '#7c3aed';

interface CrmKpis {
  total: number; open: number; pipelineValue: number; weightedValue: number;
  wonValue: number; winRatePct: number | null; currency: string;
}
interface AcctKpis {
  total: number; customers: number; prospects: number; strategic: number;
  atRisk: number; avgHealth: number;
}

const NEXT: Record<OppStatus, OppStatus[]> = {
  LEAD: ['QUALIFIED', 'LOST'], QUALIFIED: ['PROPOSAL', 'LOST'],
  PROPOSAL: ['WON', 'LOST'], WON: [], LOST: [],
};
const SOURCES = ['RFQ', 'REFERRAL', 'INBOUND', 'TRADESHOW', 'OUTBOUND', 'EXISTING'];
const PRODUCT_LINES = ['PCBA', 'Box-Build', 'Cable & Harness', 'Sub-ensamble', 'Sistema completo'];

type Tab = 'pipeline' | 'accounts' | 'activities';

function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

export default function CrmPage() {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('pipeline');
  const [showOpp, setShowOpp] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [accountSearch, setAccountSearch] = useState('');

  const { data: kpis } = useApi<CrmKpis>('/crm/kpis');
  const { data: acctKpis } = useApi<AcctKpis>('/crm/accounts/kpis');
  const { data: oppsData, isLoading, forbidden, mutate: mutateOpps } = useApi<Opportunity[]>('/crm/opportunities');
  const { data: accountsData, mutate: mutateAccounts } = useApi<Account[]>('/crm/accounts');
  const { data: tasksData, mutate: mutateTasks } = useApi<Activity[]>('/crm/activities/my-tasks');
  const { data: recentData } = useApi<Activity[]>('/crm/activities');

  const opps = useMemo(() => (Array.isArray(oppsData) ? oppsData : []), [oppsData]);
  const accounts = useMemo(() => (Array.isArray(accountsData) ? accountsData : []), [accountsData]);
  const tasks = useMemo(() => (Array.isArray(tasksData) ? tasksData : []), [tasksData]);
  const recent = useMemo(() => (Array.isArray(recentData) ? recentData : []), [recentData]);
  const ccy = kpis?.currency ?? 'USD';

  const filteredAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) =>
      [a.name, a.code, a.industry, a.country].filter(Boolean).some((s) => s!.toLowerCase().includes(q)),
    );
  }, [accounts, accountSearch]);

  const accountNameById = useMemo(() => {
    const m = new Map<string, string>();
    accounts.forEach((a) => m.set(a.id, a.name));
    return m;
  }, [accounts]);

  async function transition(o: Opportunity, status: OppStatus) {
    try {
      let lossReason: string | undefined;
      if (status === 'LOST') {
        lossReason = window.prompt('Razón de pérdida (precio, lead time, calidad…):') || undefined;
      }
      await crmApi.transitionOpportunity(o.id, status, lossReason);
      toast.success(`→ ${OPP_META[status].label}`, 'CRM');
      mutateOpps();
    } catch {
      toast.error('No se pudo actualizar.', 'CRM');
    }
  }

  async function completeTask(a: Activity) {
    try {
      await crmApi.completeActivity(a.id);
      toast.success('Tarea completada.', 'CRM');
      mutateTasks();
    } catch {
      toast.error('No se pudo completar.', 'CRM');
    }
  }

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-foreground">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-400 mt-1">Inicia sesión para ver el CRM.</p>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: typeof Target; count?: number }[] = [
    { key: 'pipeline', label: 'Pipeline', icon: TrendingUp, count: kpis?.open },
    { key: 'accounts', label: 'Cuentas', icon: Building2, count: acctKpis?.total },
    { key: 'activities', label: 'Actividades', icon: ActivityIcon, count: tasks.length },
  ];

  return (
    <div className="min-h-screen text-foreground">
      {/* Header */}
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgba(124,58,237,0.12)' }}>
            <Target className="w-5 h-5" style={{ color: VIOLET }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">CRM Comercial</h1>
            <p className="text-[12px] text-gray-400 leading-tight">Cuentas, pipeline, cotizaciones y actividades</p>
          </div>
          <button onClick={() => setShowAccount(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 border border-black/10 dark:border-white/10">
            <Building2 className="w-4 h-4" /> <span className="hidden sm:inline">Nueva cuenta</span>
          </button>
          <button onClick={() => setShowOpp(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: VIOLET }}>
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Oportunidad</span>
          </button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 pt-6 pb-24">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <Kpi label="Pipeline" value={compactMoney(kpis?.pipelineValue, ccy)} sub={`${kpis?.open ?? 0} abiertas`} color={VIOLET} />
          <Kpi label="Ponderado" value={compactMoney(kpis?.weightedValue, ccy)} color="#3b82f6" />
          <Kpi label="Ganado" value={compactMoney(kpis?.wonValue, ccy)} color="#10b981" />
          <Kpi label="Win-rate" value={kpis?.winRatePct == null ? '—' : `${kpis.winRatePct}%`} color="#10b981" />
          <Kpi label="Cuentas" value={String(acctKpis?.total ?? 0)} sub={`${acctKpis?.strategic ?? 0} estratégicas`} color="#0fb39a" />
          <Kpi label="En riesgo" value={String(acctKpis?.atRisk ?? 0)} sub={`salud ${acctKpis?.avgHealth ?? 0}`} color={acctKpis?.atRisk ? '#ef4444' : '#6b7280'} />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-black/5 dark:border-white/10">
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`relative px-4 py-2.5 text-sm font-medium flex items-center gap-2 transition-colors ${active ? '' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                style={active ? { color: VIOLET } : undefined}>
                <t.icon className="w-4 h-4" />
                {t.label}
                {t.count != null && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10">{t.count}</span>}
                {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: VIOLET }} />}
              </button>
            );
          })}
        </div>

        {isLoading && tab === 'pipeline' ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : (
          <>
            {tab === 'pipeline' && (
              <PipelineView opps={opps} ccy={ccy} accountNameById={accountNameById} onTransition={transition} onOpen={(o) => router.push(`/dashboard/crm/accounts/${o.accountId}`)} />
            )}
            {tab === 'accounts' && (
              <AccountsView accounts={filteredAccounts} search={accountSearch} setSearch={setAccountSearch} opps={opps} />
            )}
            {tab === 'activities' && (
              <ActivitiesView tasks={tasks} recent={recent} accountNameById={accountNameById} onComplete={completeTask} />
            )}
          </>
        )}
      </main>

      {showOpp && <NewOpportunityModal accounts={accounts} onClose={() => setShowOpp(false)} onCreated={() => { setShowOpp(false); mutateOpps(); }} />}
      {showAccount && <NewAccountModal onClose={() => setShowAccount(false)} onCreated={(a) => { setShowAccount(false); mutateAccounts(); router.push(`/dashboard/crm/accounts/${a.id}`); }} />}

    </div>
  );
}

// ── Pipeline ─────────────────────────────────────────────────────────────────
function PipelineView({ opps, ccy, accountNameById, onTransition, onOpen }: {
  opps: Opportunity[]; ccy: string; accountNameById: Map<string, string>;
  onTransition: (o: Opportunity, s: OppStatus) => void; onOpen: (o: Opportunity) => void;
}) {
  if (opps.length === 0) {
    return <Empty title="Sin oportunidades" hint="Crea la primera oportunidad para construir el pipeline." />;
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {(['LEAD', 'QUALIFIED', 'PROPOSAL'] as OppStatus[]).map((stage) => {
        const items = opps.filter((o) => o.status === stage);
        const value = items.reduce((a, o) => a + (o.estimatedValue || 0), 0);
        return (
          <div key={stage} className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: OPP_META[stage].color }} />
              <h2 className="text-sm font-semibold">{OPP_META[stage].label}</h2>
              <span className="text-[11px] text-gray-400">{items.length} · {compactMoney(value, ccy)}</span>
            </div>
            {items.length === 0 && <div className="text-[12px] text-gray-400 px-1 py-6 text-center rounded-2xl border border-dashed border-black/10 dark:border-white/10">Vacío</div>}
            {items.map((o) => (
              <div key={o.id} className={`${glass} rounded-2xl p-4`}>
                <button onClick={() => o.accountId && onOpen(o)} className="text-left w-full">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {o.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{o.folio}</span>}
                    {o.productLine && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${VIOLET}1a`, color: VIOLET }}>{o.productLine}</span>}
                  </div>
                  <div className="font-semibold text-sm leading-snug">{o.title}</div>
                  <div className="mt-1.5 flex items-center gap-2 text-[12px] text-gray-400 flex-wrap">
                    <span className="font-medium text-gray-600 dark:text-gray-300">{money(o.estimatedValue, o.currency)}</span>
                    <span>·</span><span>{o.probability}%</span>
                    {(o.accountId && accountNameById.get(o.accountId)) && <><span>·</span><span className="truncate">{accountNameById.get(o.accountId)}</span></>}
                  </div>
                  {o.nextStep && <div className="mt-2 text-[11px] text-gray-500 flex items-start gap-1"><ArrowRight className="w-3 h-3 mt-0.5 flex-shrink-0" />{o.nextStep}</div>}
                </button>
                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  {NEXT[o.status].map((to) => (
                    <button key={to} onClick={() => onTransition(o, to)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium"
                      style={{ background: `${OPP_META[to].color}1f`, color: OPP_META[to].color }}>
                      {to === 'LOST' ? <X className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}{OPP_META[to].label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })}
      {/* Closed lane summary */}
      <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        {(['WON', 'LOST'] as OppStatus[]).map((stage) => {
          const items = opps.filter((o) => o.status === stage);
          if (items.length === 0) return null;
          const value = items.reduce((a, o) => a + (o.estimatedValue || 0), 0);
          return (
            <div key={stage} className={`${glass} rounded-2xl p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: OPP_META[stage].color }} />
                <h3 className="text-sm font-semibold">{OPP_META[stage].label}</h3>
                <span className="text-[11px] text-gray-400">{items.length} · {compactMoney(value, ccy)}</span>
              </div>
              <div className="space-y-1.5">
                {items.slice(0, 5).map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-[12px] gap-2">
                    <span className="truncate">{o.title}</span>
                    <span className="text-gray-400 flex-shrink-0">{compactMoney(o.estimatedValue, o.currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Accounts ─────────────────────────────────────────────────────────────────
function AccountsView({ accounts, search, setSearch, opps }: {
  accounts: Account[]; search: string; setSearch: (s: string) => void; opps: Opportunity[];
}) {
  const pipelineByAccount = useMemo(() => {
    const m = new Map<string, number>();
    opps.filter((o) => ['LEAD', 'QUALIFIED', 'PROPOSAL'].includes(o.status)).forEach((o) => {
      if (o.accountId) m.set(o.accountId, (m.get(o.accountId) || 0) + (o.estimatedValue || 0));
    });
    return m;
  }, [opps]);

  return (
    <div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cuenta por nombre, código, industria o país…" className={`${crmInput} mb-5`} />
      {accounts.length === 0 ? (
        <Empty title="Sin cuentas" hint="Crea tu primera cuenta comercial." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((a) => (
            <Link key={a.id} href={`/dashboard/crm/accounts/${a.id}`} className={`${glass} group rounded-2xl p-4 block hover:shadow-lg transition-shadow`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{a.name}</div>
                  <div className="text-[11px] text-gray-400 font-mono">{a.code}</div>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: `${TIER_META[a.tier].color}1a`, color: TIER_META[a.tier].color }}>{TIER_META[a.tier].label}</span>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-gray-500 flex-wrap mb-3">
                <span className="px-1.5 py-0.5 rounded-full" style={{ background: `${TYPE_META[a.type].color}1a`, color: TYPE_META[a.type].color }}>{TYPE_META[a.type].label}</span>
                {a.industry && <span className="truncate">{a.industry}</span>}
                {a.country && <span className="inline-flex items-center gap-0.5"><MapPin className="w-3 h-3" />{a.country}</span>}
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1"><span>Salud</span><span>{a.healthScore}</span></div>
                  <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${a.healthScore}%`, background: healthColor(a.healthScore) }} />
                  </div>
                </div>
                {pipelineByAccount.get(a.id) ? (
                  <div className="text-right flex-shrink-0">
                    <div className="text-[10px] text-gray-400">Pipeline</div>
                    <div className="text-sm font-semibold" style={{ color: VIOLET }}>{compactMoney(pipelineByAccount.get(a.id), a.currency)}</div>
                  </div>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Activities ───────────────────────────────────────────────────────────────
const ACT_ICON = { CALL: Phone, EMAIL: Mail, MEETING: Users, VISIT: MapPin, NOTE: ActivityIcon, TASK: CheckCircle2 } as const;

function ActivitiesView({ tasks, recent, accountNameById, onComplete }: {
  tasks: Activity[]; recent: Activity[]; accountNameById: Map<string, string>; onComplete: (a: Activity) => void;
}) {
  const sortedTasks = [...tasks].sort((a, b) => (a.dueAt ? new Date(a.dueAt).getTime() : Infinity) - (b.dueAt ? new Date(b.dueAt).getTime() : Infinity));
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Clock className="w-4 h-4" /> Mis tareas <span className="text-[11px] text-gray-400">({tasks.length})</span></h2>
        {sortedTasks.length === 0 ? (
          <div className={`${glass} rounded-2xl p-8 text-center text-sm text-gray-400`}>Sin tareas pendientes. 🎉</div>
        ) : (
          <div className="space-y-2">
            {sortedTasks.map((t) => {
              const overdue = isOverdue(t.dueAt);
              return (
                <div key={t.id} className={`${glass} rounded-2xl p-3.5 flex items-start gap-3`}>
                  <button onClick={() => onComplete(t)} className="mt-0.5 w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:border-emerald-500 hover:bg-emerald-500/10 flex-shrink-0 transition-colors" title="Completar" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{t.subject}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] flex-wrap">
                      {t.account_id && accountNameById.get(t.account_id) && <span className="text-gray-500">{accountNameById.get(t.account_id)}</span>}
                      {t.dueAt && (
                        <span className={`inline-flex items-center gap-1 ${overdue ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                          {overdue && <AlertTriangle className="w-3 h-3" />}
                          <CalendarDays className="w-3 h-3" />{new Date(t.dueAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                          {overdue && ' · vencida'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><ActivityIcon className="w-4 h-4" /> Actividad reciente</h2>
        {recent.length === 0 ? (
          <div className={`${glass} rounded-2xl p-8 text-center text-sm text-gray-400`}>Sin actividad registrada.</div>
        ) : (
          <div className={`${glass} rounded-2xl p-2`}>
            <div className="divide-y divide-black/5 dark:divide-white/5">
              {recent.slice(0, 20).map((a) => {
                const Icon = ACT_ICON[a.type] ?? ActivityIcon;
                return (
                  <div key={a.id} className="flex items-start gap-3 p-3">
                    <span className="w-8 h-8 rounded-lg grid place-items-center flex-shrink-0" style={{ background: `${VIOLET}14`, color: VIOLET }}><Icon className="w-4 h-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{a.subject}</div>
                      <div className="text-[11px] text-gray-400">
                        {a.account_id && accountNameById.get(a.account_id)}{a.account_id && a.created_at ? ' · ' : ''}{timeAgo(a.created_at)}
                      </div>
                    </div>
                    {a.status === 'OPEN' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 flex-shrink-0">abierta</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Modals ───────────────────────────────────────────────────────────────────
function NewOpportunityModal({ accounts, onClose, onCreated }: { accounts: Account[]; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ title: '', accountId: '', estimatedValue: 0, source: 'RFQ', productLine: 'PCBA', expectedCloseDate: '', nextStep: '' });

  async function submit() {
    if (f.title.trim().length < 3) { toast.error('Describe la oportunidad (mín. 3).', 'CRM'); return; }
    setBusy(true);
    try {
      const acct = accounts.find((a) => a.id === f.accountId);
      await crmApi.createOpportunity({
        title: f.title, accountId: f.accountId || undefined, customerName: acct?.name,
        estimatedValue: f.estimatedValue, source: f.source, productLine: f.productLine,
        expectedCloseDate: f.expectedCloseDate || undefined, nextStep: f.nextStep || undefined,
      });
      toast.success('Oportunidad creada.', 'CRM');
      onCreated();
    } catch { toast.error('No se pudo crear.', 'CRM'); } finally { setBusy(false); }
  }

  return (
    <Modal title="Nueva oportunidad" onClose={onClose}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Oportunidad" full><input className={crmInput} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Programa Servers Gen6 — Cliente C" /></Field>
        <Field label="Cuenta"><select className={crmInput} value={f.accountId} onChange={(e) => setF({ ...f, accountId: e.target.value })}><option value="">— Sin cuenta —</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field label="Valor estimado"><input type="number" min={0} className={crmInput} value={f.estimatedValue} onChange={(e) => setF({ ...f, estimatedValue: Number(e.target.value) })} /></Field>
        <Field label="Fuente"><select className={crmInput} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Línea de producto"><select className={crmInput} value={f.productLine} onChange={(e) => setF({ ...f, productLine: e.target.value })}>{PRODUCT_LINES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Cierre esperado"><input type="date" className={crmInput} value={f.expectedCloseDate} onChange={(e) => setF({ ...f, expectedCloseDate: e.target.value })} /></Field>
        <Field label="Siguiente paso"><input className={crmInput} value={f.nextStep} onChange={(e) => setF({ ...f, nextStep: e.target.value })} placeholder="Enviar cotización formal" /></Field>
      </div>
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} />
    </Modal>
  );
}

function NewAccountModal({ onClose, onCreated }: { onClose: () => void; onCreated: (a: Account) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: '', code: '', type: 'PROSPECT', tier: 'C', industry: '', segment: '',
    region: 'NAM', country: '', city: '', website: '', paymentTerms: 'NET30',
    incoterm: 'DAP', creditLimit: 0, annualRevenue: 0, ownerEmail: '', notes: '',
  });

  async function submit() {
    if (f.name.trim().length < 2) { toast.error('Nombre requerido.', 'CRM'); return; }
    setBusy(true);
    try {
      const a = await crmApi.createAccount({
        ...f, creditLimit: Number(f.creditLimit) || 0, annualRevenue: Number(f.annualRevenue) || undefined,
        code: f.code || undefined, type: f.type as Account['type'], tier: f.tier as Account['tier'],
      } as Partial<Account>);
      toast.success('Cuenta creada.', 'CRM');
      onCreated(a);
    } catch { toast.error('No se pudo crear.', 'CRM'); } finally { setBusy(false); }
  }

  return (
    <Modal title="Nueva cuenta" onClose={onClose} wide>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Nombre" full><input className={crmInput} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Acme Electronics" /></Field>
        <Field label="Código"><input className={crmInput} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="(auto)" /></Field>
        <Field label="Tipo"><select className={crmInput} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
        <Field label="Tier"><select className={crmInput} value={f.tier} onChange={(e) => setF({ ...f, tier: e.target.value })}>{Object.entries(TIER_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
        <Field label="Industria"><input className={crmInput} value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} placeholder="Automotriz" /></Field>
        <Field label="Segmento"><input className={crmInput} value={f.segment} onChange={(e) => setF({ ...f, segment: e.target.value })} placeholder="Tier-1" /></Field>
        <Field label="Región"><select className={crmInput} value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })}>{['NAM', 'LATAM', 'EMEA', 'APAC'].map((r) => <option key={r}>{r}</option>)}</select></Field>
        <Field label="País"><input className={crmInput} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} placeholder="México" /></Field>
        <Field label="Ciudad"><input className={crmInput} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
        <Field label="Sitio web"><input className={crmInput} value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="acme.example" /></Field>
        <Field label="Términos de pago"><input className={crmInput} value={f.paymentTerms} onChange={(e) => setF({ ...f, paymentTerms: e.target.value })} /></Field>
        <Field label="Incoterm"><input className={crmInput} value={f.incoterm} onChange={(e) => setF({ ...f, incoterm: e.target.value })} /></Field>
        <Field label="Límite de crédito"><input type="number" className={crmInput} value={f.creditLimit} onChange={(e) => setF({ ...f, creditLimit: Number(e.target.value) })} /></Field>
        <Field label="Ingreso anual (cliente)"><input type="number" className={crmInput} value={f.annualRevenue} onChange={(e) => setF({ ...f, annualRevenue: Number(e.target.value) })} /></Field>
        <Field label="Account manager (email)"><input className={crmInput} value={f.ownerEmail} onChange={(e) => setF({ ...f, ownerEmail: e.target.value })} /></Field>
        <Field label="Notas" full><textarea className={crmInput} rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} />
    </Modal>
  );
}

// ── Reusable bits ────────────────────────────────────────────────────────────
function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-3.5`}>
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-lg font-semibold mt-0.5 tabular-nums truncate" style={{ color }}>{value}</div>
      {sub && <div className="text-[11px] text-gray-400 truncate">{sub}</div>}
    </div>
  );
}
function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className={`${glass} rounded-3xl p-12 text-center`}>
      <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-400" />
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-gray-400 mt-1">{hint}</p>
    </div>
  );
}
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? 'md:col-span-full' : ''}`}>
      <span className="block text-[12px] font-medium text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-16 bg-black/40 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className={`${glass} rounded-3xl p-6 w-full ${wide ? 'max-w-3xl' : 'max-w-xl'}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
function ModalActions({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: () => void }) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
      <button onClick={onSubmit} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: VIOLET }}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Guardar
      </button>
    </div>
  );
}
