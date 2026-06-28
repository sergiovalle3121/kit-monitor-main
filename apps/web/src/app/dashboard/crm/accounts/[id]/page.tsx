'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft, Loader2, Lock, Plus, X, CheckCircle2, Users,
  Target, FileText, Activity as ActivityIcon, Mail, Phone, Globe, MapPin,
  CreditCard, Briefcase, ShieldAlert, Star, Pencil, ArrowRight, CalendarDays,
  AlertTriangle, Crown, ExternalLink,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/contexts/ToastContext';
import {
  crmApi, money, compactMoney, crmInput, isOverdue, TIER_META, TYPE_META, OPP_META,
  QUOTE_META, healthColor, type Account360, type Contact, type Account,
} from '@/lib/crm';

const VIOLET = '#7c3aed';
const DEPTS = ['PROCUREMENT', 'ENGINEERING', 'QUALITY', 'EXECUTIVE', 'SUPPLY_CHAIN', 'FINANCE', 'OPERATIONS', 'OTHER'];
const ROLES = ['DECISION_MAKER', 'INFLUENCER', 'CHAMPION', 'USER', 'GATEKEEPER'];
const DEPT_LABEL: Record<string, string> = {
  PROCUREMENT: 'Compras', ENGINEERING: 'Ingeniería', QUALITY: 'Calidad', EXECUTIVE: 'Dirección',
  SUPPLY_CHAIN: 'Cadena de suministro', FINANCE: 'Finanzas', OPERATIONS: 'Operaciones', OTHER: 'Otro',
};
const ROLE_LABEL: Record<string, string> = {
  DECISION_MAKER: 'Decisor', INFLUENCER: 'Influenciador', CHAMPION: 'Campeón', USER: 'Usuario', GATEKEEPER: 'Filtro',
};
const ACT_TYPES = ['CALL', 'EMAIL', 'MEETING', 'VISIT', 'NOTE', 'TASK'];
const ACT_LABEL: Record<string, string> = { CALL: 'Llamada', EMAIL: 'Correo', MEETING: 'Reunión', VISIT: 'Visita', NOTE: 'Nota', TASK: 'Tarea' };

type Tab = 'overview' | 'contacts' | 'opps' | 'quotes' | 'activities';

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const [tab, setTab] = useState<Tab>('overview');
  const [modal, setModal] = useState<null | 'contact' | 'activity' | 'quote' | 'edit'>(null);

  const { data, isLoading, forbidden, mutate } = useApi<Account360>(`/crm/accounts/${id}/360`);

  if (forbidden) return <Guard />;
  if (isLoading || !data) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  const { account: a, contacts, opportunities, quotes, activities, metrics } = data;

  const tabs: { key: Tab; label: string; icon: typeof Target; count?: number }[] = [
    { key: 'overview', label: 'Resumen', icon: Briefcase },
    { key: 'contacts', label: 'Contactos', icon: Users, count: contacts.length },
    { key: 'opps', label: 'Oportunidades', icon: Target, count: opportunities.length },
    { key: 'quotes', label: 'Cotizaciones', icon: FileText, count: quotes.length },
    { key: 'activities', label: 'Actividades', icon: ActivityIcon, count: activities.length },
  ];

  return (
    <div className="min-h-screen text-foreground">
      {/* Header */}
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Link href="/dashboard/crm" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><ChevronLeft className="w-5 h-5" /></Link>
          <span className="w-10 h-10 rounded-xl grid place-items-center text-white font-bold flex-shrink-0" style={{ background: `linear-gradient(135deg, ${TIER_META[a.tier].color}, ${VIOLET})` }}>
            {a.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold leading-tight truncate">{a.name}</h1>
              {a.tier === 'STRATEGIC' && <Crown className="w-4 h-4" style={{ color: VIOLET }} />}
            </div>
            <p className="text-[12px] text-gray-400 leading-tight font-mono">{a.code} · {TYPE_META[a.type].label}</p>
          </div>
          <span className="hidden sm:inline text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: `${TIER_META[a.tier].color}1a`, color: TIER_META[a.tier].color }}>{TIER_META[a.tier].label}</span>
          <button onClick={() => setModal('edit')} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10" title="Editar"><Pencil className="w-4 h-4" /></button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 pt-6 pb-24">
        {/* Metric strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <Metric label="Pipeline" value={compactMoney(metrics.pipelineValue, a.currency)} sub={`${metrics.openOpportunities} abiertas`} color={VIOLET} />
          <Metric label="Ponderado" value={compactMoney(metrics.weightedValue, a.currency)} color="#3b82f6" />
          <Metric label="Ganado" value={compactMoney(metrics.wonValue, a.currency)} color="#10b981" />
          <Metric label="Cotizado" value={compactMoney(metrics.quoteValue, a.currency)} sub={`${metrics.openQuotes} abiertas`} color="#0fb39a" />
          <Metric label="Contactos" value={String(metrics.contacts)} color="#6b7280" />
          <Metric label="Tareas" value={String(metrics.openTasks)} sub={metrics.overdueTasks ? `${metrics.overdueTasks} vencidas` : 'al día'} color={metrics.overdueTasks ? '#ef4444' : '#10b981'} />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-black/5 dark:border-white/10 overflow-x-auto">
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} className={`relative px-4 py-2.5 text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-colors ${active ? '' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`} style={active ? { color: VIOLET } : undefined}>
                <t.icon className="w-4 h-4" />{t.label}
                {t.count != null && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10">{t.count}</span>}
                {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: VIOLET }} />}
              </button>
            );
          })}
        </div>

        {tab === 'overview' && <Overview a={a} activities={activities} />}
        {tab === 'contacts' && <ContactsTab contacts={contacts} onAdd={() => setModal('contact')} onChanged={mutate} />}
        {tab === 'opps' && <OppsTab opportunities={opportunities} currency={a.currency} onChanged={mutate} />}
        {tab === 'quotes' && <QuotesTab quotes={quotes} onNew={() => setModal('quote')} onOpen={(q) => router.push(`/dashboard/crm/quotes/${q}`)} />}
        {tab === 'activities' && <ActivitiesTab activities={activities} onAdd={() => setModal('activity')} onChanged={mutate} />}
      </main>

      {modal === 'contact' && <ContactModal accountId={id} onClose={() => setModal(null)} onDone={() => { setModal(null); mutate(); }} />}
      {modal === 'activity' && <ActivityModal accountId={id} onClose={() => setModal(null)} onDone={() => { setModal(null); mutate(); }} />}
      {modal === 'quote' && <QuoteModal accountId={id} opportunities={opportunities} onClose={() => setModal(null)} onCreated={(qid) => router.push(`/dashboard/crm/quotes/${qid}`)} />}
      {modal === 'edit' && <EditAccountModal account={a} onClose={() => setModal(null)} onDone={() => { setModal(null); mutate(); }} />}
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────
function Overview({ a, activities }: { a: Account; activities: Account360['activities'] }) {
  const rows: { icon: typeof Globe; label: string; value: React.ReactNode }[] = [
    { icon: Briefcase, label: 'Industria', value: a.industry || '—' },
    { icon: Star, label: 'Segmento', value: a.segment || '—' },
    { icon: Globe, label: 'Región', value: [a.region, a.country].filter(Boolean).join(' · ') || '—' },
    { icon: MapPin, label: 'Ubicación', value: [a.city, a.addressLine].filter(Boolean).join(', ') || '—' },
    { icon: CreditCard, label: 'Términos', value: [a.paymentTerms, a.incoterm].filter(Boolean).join(' · ') || '—' },
    { icon: CreditCard, label: 'Crédito', value: a.creditLimit ? money(a.creditLimit, a.currency) : '—' },
    { icon: Briefcase, label: 'Ingreso anual', value: a.annualRevenue ? compactMoney(a.annualRevenue, a.currency) : '—' },
    { icon: Users, label: 'Empleados', value: a.employees ? a.employees.toLocaleString() : '—' },
  ];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className={`${glass} rounded-2xl p-5`}>
          <h3 className="text-sm font-semibold mb-4">Perfil de la cuenta</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {rows.map((r) => (
              <div key={r.label} className="flex items-start gap-3">
                <r.icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wide text-gray-400">{r.label}</div>
                  <div className="text-sm font-medium truncate">{r.value}</div>
                </div>
              </div>
            ))}
          </div>
          {a.website && (
            <a href={`https://${a.website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: VIOLET }}>
              <Globe className="w-3.5 h-3.5" />{a.website}<ExternalLink className="w-3 h-3" />
            </a>
          )}
          {a.tags && a.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {a.tags.map((t) => <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-gray-500">{t}</span>)}
            </div>
          )}
          {a.notes && <p className="mt-4 text-sm text-gray-500 border-t border-black/5 dark:border-white/10 pt-4">{a.notes}</p>}
        </div>
      </div>

      <div className="space-y-6">
        {/* Health + risk card */}
        <div className={`${glass} rounded-2xl p-5`}>
          <h3 className="text-sm font-semibold mb-4">Salud de la relación</h3>
          <div className="flex items-end gap-3 mb-2">
            <div className="text-4xl font-bold tabular-nums" style={{ color: healthColor(a.healthScore) }}>{a.healthScore}</div>
            <div className="text-[12px] text-gray-400 mb-1.5">/ 100</div>
          </div>
          <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden mb-4">
            <div className="h-full rounded-full" style={{ width: `${a.healthScore}%`, background: healthColor(a.healthScore) }} />
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-gray-400">Riesgo</span>
            <span className="inline-flex items-center gap-1 font-medium" style={{ color: a.riskLevel === 'HIGH' ? '#ef4444' : a.riskLevel === 'MEDIUM' ? '#f59e0b' : '#10b981' }}>
              <ShieldAlert className="w-3.5 h-3.5" />{a.riskLevel === 'HIGH' ? 'Alto' : a.riskLevel === 'MEDIUM' ? 'Medio' : 'Bajo'}
            </span>
          </div>
          {a.npsScore != null && (
            <div className="flex items-center justify-between text-[13px] mt-2">
              <span className="text-gray-400">NPS</span><span className="font-medium">{a.npsScore}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-[13px] mt-2">
            <span className="text-gray-400">Account manager</span><span className="font-medium truncate ml-2">{a.ownerEmail || '—'}</span>
          </div>
        </div>

        {/* Mini timeline */}
        <div className={`${glass} rounded-2xl p-5`}>
          <h3 className="text-sm font-semibold mb-3">Última actividad</h3>
          {activities.length === 0 ? <p className="text-[13px] text-gray-400">Sin actividad.</p> : (
            <div className="space-y-3">
              {activities.slice(0, 4).map((ac) => (
                <div key={ac.id} className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: VIOLET }} />
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium truncate">{ac.subject}</div>
                    <div className="text-[11px] text-gray-400">{ACT_LABEL[ac.type]} · {ac.created_at ? new Date(ac.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Contacts ─────────────────────────────────────────────────────────────────
function ContactsTab({ contacts, onAdd, onChanged }: { contacts: Contact[]; onAdd: () => void; onChanged: () => void }) {
  const toast = useToast();
  async function setPrimary(c: Contact) {
    try { await crmApi.updateContact(c.id, { isPrimary: true }); onChanged(); } catch { toast.error('Error', 'CRM'); }
  }
  async function remove(c: Contact) {
    if (!window.confirm(`¿Eliminar a ${c.firstName}?`)) return;
    try { await crmApi.removeContact(c.id); toast.success('Contacto eliminado.', 'CRM'); onChanged(); } catch { toast.error('Error', 'CRM'); }
  }
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-semibold">Buying center <span className="text-gray-400">({contacts.length})</span></h2>
        <button onClick={onAdd} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white" style={{ background: VIOLET }}><Plus className="w-3.5 h-3.5" /> Contacto</button>
      </div>
      {contacts.length === 0 ? <EmptyCard text="Sin contactos. Agrega el primer contacto del cliente." /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {contacts.map((c) => (
            <div key={c.id} className={`${glass} rounded-2xl p-4`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-full grid place-items-center font-semibold text-white flex-shrink-0" style={{ background: VIOLET }}>{c.firstName[0]}{(c.lastName || ' ')[0]}</span>
                  <div className="min-w-0">
                    <div className="font-semibold flex items-center gap-1.5 truncate">{c.firstName} {c.lastName} {c.isPrimary && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />}</div>
                    <div className="text-[12px] text-gray-400 truncate">{c.title || '—'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!c.isPrimary && <button onClick={() => setPrimary(c)} title="Marcar principal" className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Star className="w-3.5 h-3.5 text-gray-400" /></button>}
                  <button onClick={() => remove(c)} title="Eliminar" className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px]">
                {c.department && <span className="px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-gray-500">{DEPT_LABEL[c.department] || c.department}</span>}
                {c.buyingRole && <span className="px-2 py-0.5 rounded-full" style={{ background: `${VIOLET}14`, color: VIOLET }}>{ROLE_LABEL[c.buyingRole] || c.buyingRole}</span>}
              </div>
              <div className="mt-3 space-y-1 text-[12px] text-gray-500">
                {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-2 hover:text-violet-500"><Mail className="w-3.5 h-3.5" />{c.email}</a>}
                {(c.phone || c.mobile) && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" />{c.phone || c.mobile}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Opportunities ────────────────────────────────────────────────────────────
function OppsTab({ opportunities, currency, onChanged }: { opportunities: Account360['opportunities']; currency: string; onChanged: () => void }) {
  const toast = useToast();
  async function transition(id: string, status: 'QUALIFIED' | 'PROPOSAL' | 'WON' | 'LOST') {
    try {
      const lossReason = status === 'LOST' ? (window.prompt('Razón de pérdida:') || undefined) : undefined;
      await crmApi.transitionOpportunity(id, status, lossReason);
      toast.success(`→ ${OPP_META[status].label}`, 'CRM'); onChanged();
    } catch { toast.error('Error', 'CRM'); }
  }
  const NEXT: Record<string, ('QUALIFIED' | 'PROPOSAL' | 'WON' | 'LOST')[]> = { LEAD: ['QUALIFIED', 'LOST'], QUALIFIED: ['PROPOSAL', 'LOST'], PROPOSAL: ['WON', 'LOST'], WON: [], LOST: [] };
  if (opportunities.length === 0) return <EmptyCard text="Sin oportunidades para esta cuenta." />;
  return (
    <div className="space-y-3">
      {opportunities.map((o) => (
        <div key={o.id} className={`${glass} rounded-2xl p-4`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {o.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{o.folio}</span>}
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${OPP_META[o.status].color}1a`, color: OPP_META[o.status].color }}>{OPP_META[o.status].label}</span>
                {o.productLine && <span className="text-[10px] text-gray-400">{o.productLine}</span>}
              </div>
              <div className="font-semibold">{o.title}</div>
              <div className="mt-1 flex items-center gap-2 text-[12px] text-gray-400 flex-wrap">
                <span className="font-medium text-gray-600 dark:text-gray-300">{money(o.estimatedValue, currency)}</span>
                <span>·</span><span>{o.probability}%</span>
                {o.source && <><span>·</span><span>{o.source}</span></>}
                {o.lossReason && <><span>·</span><span className="text-red-400">{o.lossReason}</span></>}
              </div>
              {o.nextStep && <div className="mt-2 text-[11px] text-gray-500 flex items-center gap-1"><ArrowRight className="w-3 h-3" />{o.nextStep}</div>}
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              {NEXT[o.status].map((to) => (
                <button key={to} onClick={() => transition(o.id, to)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium" style={{ background: `${OPP_META[to].color}1f`, color: OPP_META[to].color }}>{OPP_META[to].label}</button>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Quotes ───────────────────────────────────────────────────────────────────
function QuotesTab({ quotes, onNew, onOpen }: { quotes: Account360['quotes']; onNew: () => void; onOpen: (id: string) => void }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-semibold">Cotizaciones <span className="text-gray-400">({quotes.length})</span></h2>
        <button onClick={onNew} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white" style={{ background: VIOLET }}><Plus className="w-3.5 h-3.5" /> Cotización</button>
      </div>
      {quotes.length === 0 ? <EmptyCard text="Sin cotizaciones. Crea una cotización con líneas, EAU y margen." /> : (
        <div className="space-y-2.5">
          {quotes.map((q) => (
            <button key={q.id} onClick={() => onOpen(q.id)} className={`${glass} rounded-2xl p-4 w-full text-left hover:shadow-lg transition-shadow`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {q.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{q.folio}</span>}
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${QUOTE_META[q.status].color}1a`, color: QUOTE_META[q.status].color }}>{QUOTE_META[q.status].label}</span>
                    {q.rev > 1 && <span className="text-[10px] text-gray-400">rev {q.rev}</span>}
                  </div>
                  <div className="font-semibold truncate">{q.title}</div>
                  <div className="text-[12px] text-gray-400">{[q.paymentTerms, q.incoterm, q.leadTimeDays ? `${q.leadTimeDays} d` : null].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-semibold">{money(q.total, q.currency)}</div>
                  <div className="text-[11px] text-gray-400">{q.marginPct != null ? `margen ${q.marginPct}%` : ''}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Activities ───────────────────────────────────────────────────────────────
const ACT_ICON = { CALL: Phone, EMAIL: Mail, MEETING: Users, VISIT: MapPin, NOTE: ActivityIcon, TASK: CheckCircle2 } as const;
function ActivitiesTab({ activities, onAdd, onChanged }: { activities: Account360['activities']; onAdd: () => void; onChanged: () => void }) {
  const toast = useToast();
  async function complete(id: string) {
    try { await crmApi.completeActivity(id); toast.success('Completada.', 'CRM'); onChanged(); } catch { toast.error('Error', 'CRM'); }
  }
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-semibold">Timeline <span className="text-gray-400">({activities.length})</span></h2>
        <button onClick={onAdd} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white" style={{ background: VIOLET }}><Plus className="w-3.5 h-3.5" /> Registrar</button>
      </div>
      {activities.length === 0 ? <EmptyCard text="Sin actividad. Registra una llamada, reunión o tarea." /> : (
        <div className="relative pl-6">
          <div className="absolute left-2 top-1 bottom-1 w-px bg-black/10 dark:bg-white/10" />
          <div className="space-y-3">
            {activities.map((ac) => {
              const Icon = ACT_ICON[ac.type] ?? ActivityIcon;
              const overdue = ac.status === 'OPEN' && isOverdue(ac.dueAt);
              return (
                <div key={ac.id} className="relative">
                  <span className="absolute -left-[18px] top-1 w-4 h-4 rounded-full grid place-items-center" style={{ background: VIOLET }}><Icon className="w-2.5 h-2.5 text-white" /></span>
                  <div className={`${glass} rounded-2xl p-3.5`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium flex items-center gap-2">{ac.subject}{ac.status === 'OPEN' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600">tarea</span>}</div>
                        {ac.body && <p className="text-[12px] text-gray-500 mt-0.5">{ac.body}</p>}
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-400 flex-wrap">
                          <span>{ACT_LABEL[ac.type]}</span>
                          {ac.created_at && <><span>·</span><span>{new Date(ac.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</span></>}
                          {ac.dueAt && <span className={`inline-flex items-center gap-1 ${overdue ? 'text-red-500 font-semibold' : ''}`}>{overdue && <AlertTriangle className="w-3 h-3" />}<CalendarDays className="w-3 h-3" />vence {new Date(ac.dueAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>}
                        </div>
                      </div>
                      {ac.status === 'OPEN' && <button onClick={() => complete(ac.id)} className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/15 text-emerald-600 flex-shrink-0 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Listo</button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modals ───────────────────────────────────────────────────────────────────
function ContactModal({ accountId, onClose, onDone }: { accountId: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ firstName: '', lastName: '', title: '', department: 'PROCUREMENT', buyingRole: 'INFLUENCER', email: '', phone: '', mobile: '', linkedin: '', isPrimary: false });
  async function submit() {
    if (!f.firstName.trim()) { toast.error('Nombre requerido.', 'CRM'); return; }
    setBusy(true);
    try { await crmApi.createContact({ accountId, ...f } as Partial<Contact> & { accountId: string }); toast.success('Contacto agregado.', 'CRM'); onDone(); }
    catch { toast.error('Error.', 'CRM'); } finally { setBusy(false); }
  }
  return (
    <Modal title="Nuevo contacto" onClose={onClose}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nombre"><input className={crmInput} value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></Field>
        <Field label="Apellido"><input className={crmInput} value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></Field>
        <Field label="Puesto" full><input className={crmInput} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Gerente de Commodity" /></Field>
        <Field label="Área"><select className={crmInput} value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })}>{DEPTS.map((d) => <option key={d} value={d}>{DEPT_LABEL[d]}</option>)}</select></Field>
        <Field label="Rol de compra"><select className={crmInput} value={f.buyingRole} onChange={(e) => setF({ ...f, buyingRole: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
        <Field label="Email"><input className={crmInput} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Teléfono"><input className={crmInput} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      </div>
      <label className="flex items-center gap-2 mt-3 text-sm"><input type="checkbox" checked={f.isPrimary} onChange={(e) => setF({ ...f, isPrimary: e.target.checked })} /> Contacto principal</label>
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} />
    </Modal>
  );
}

function ActivityModal({ accountId, onClose, onDone }: { accountId: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ type: 'CALL', subject: '', body: '', dueAt: '' });
  const isTask = f.type === 'TASK';
  async function submit() {
    if (!f.subject.trim()) { toast.error('Asunto requerido.', 'CRM'); return; }
    setBusy(true);
    try { await crmApi.createActivity({ accountId, type: f.type, subject: f.subject, body: f.body || undefined, dueAt: isTask && f.dueAt ? f.dueAt : undefined, status: isTask ? 'OPEN' : undefined }); toast.success('Registrado.', 'CRM'); onDone(); }
    catch { toast.error('Error.', 'CRM'); } finally { setBusy(false); }
  }
  return (
    <Modal title="Registrar actividad" onClose={onClose}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Tipo"><select className={crmInput} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{ACT_TYPES.map((t) => <option key={t} value={t}>{ACT_LABEL[t]}</option>)}</select></Field>
        {isTask && <Field label="Vence"><input type="date" className={crmInput} value={f.dueAt} onChange={(e) => setF({ ...f, dueAt: e.target.value })} /></Field>}
        <Field label="Asunto" full><input className={crmInput} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder={isTask ? 'Enviar cotización formal' : 'Llamada de seguimiento'} /></Field>
        <Field label="Detalle" full><textarea className={crmInput} rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
      </div>
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} />
    </Modal>
  );
}

function QuoteModal({ accountId, opportunities, onClose, onCreated }: { accountId: string; opportunities: Account360['opportunities']; onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ title: '', opportunityId: '', paymentTerms: 'NET30', incoterm: 'DAP', leadTimeDays: 30, validUntil: '' });
  async function submit() {
    if (f.title.trim().length < 2) { toast.error('Título requerido.', 'CRM'); return; }
    setBusy(true);
    try {
      const q = await crmApi.createQuote({ accountId, title: f.title, opportunityId: f.opportunityId || undefined, paymentTerms: f.paymentTerms, incoterm: f.incoterm, leadTimeDays: Number(f.leadTimeDays) || undefined, validUntil: f.validUntil || undefined });
      toast.success('Cotización creada.', 'CRM'); onCreated(q.id);
    } catch { toast.error('Error.', 'CRM'); } finally { setBusy(false); }
  }
  return (
    <Modal title="Nueva cotización" onClose={onClose}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Título" full><input className={crmInput} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Cotización PCBA Gen-3" /></Field>
        <Field label="Oportunidad" full><select className={crmInput} value={f.opportunityId} onChange={(e) => setF({ ...f, opportunityId: e.target.value })}><option value="">— Ninguna —</option>{opportunities.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</select></Field>
        <Field label="Términos de pago"><input className={crmInput} value={f.paymentTerms} onChange={(e) => setF({ ...f, paymentTerms: e.target.value })} /></Field>
        <Field label="Incoterm"><input className={crmInput} value={f.incoterm} onChange={(e) => setF({ ...f, incoterm: e.target.value })} /></Field>
        <Field label="Lead time (días)"><input type="number" className={crmInput} value={f.leadTimeDays} onChange={(e) => setF({ ...f, leadTimeDays: Number(e.target.value) })} /></Field>
        <Field label="Válida hasta"><input type="date" className={crmInput} value={f.validUntil} onChange={(e) => setF({ ...f, validUntil: e.target.value })} /></Field>
      </div>
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} label="Crear y agregar líneas" />
    </Modal>
  );
}

function EditAccountModal({ account, onClose, onDone }: { account: Account; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: account.name, type: account.type, tier: account.tier, status: account.status,
    industry: account.industry || '', segment: account.segment || '', region: account.region || 'NAM',
    country: account.country || '', city: account.city || '', website: account.website || '',
    paymentTerms: account.paymentTerms || '', incoterm: account.incoterm || '',
    creditLimit: account.creditLimit || 0, annualRevenue: account.annualRevenue || 0,
    employees: account.employees || 0, ownerEmail: account.ownerEmail || '',
    healthScore: account.healthScore, riskLevel: account.riskLevel, notes: account.notes || '',
  });
  async function submit() {
    setBusy(true);
    try {
      await crmApi.updateAccount(account.id, {
        ...f, creditLimit: Number(f.creditLimit) || 0, annualRevenue: Number(f.annualRevenue) || undefined,
        employees: Number(f.employees) || undefined, healthScore: Number(f.healthScore),
        type: f.type as Account['type'], tier: f.tier as Account['tier'], riskLevel: f.riskLevel as Account['riskLevel'],
      } as Partial<Account>);
      toast.success('Cuenta actualizada.', 'CRM'); onDone();
    } catch { toast.error('Error.', 'CRM'); } finally { setBusy(false); }
  }
  return (
    <Modal title="Editar cuenta" onClose={onClose} wide>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Nombre" full><input className={crmInput} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Tipo"><select className={crmInput} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as Account['type'] })}>{Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
        <Field label="Tier"><select className={crmInput} value={f.tier} onChange={(e) => setF({ ...f, tier: e.target.value as Account['tier'] })}>{Object.entries(TIER_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
        <Field label="Estatus"><select className={crmInput} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{['ACTIVE', 'ON_HOLD', 'INACTIVE'].map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Industria"><input className={crmInput} value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} /></Field>
        <Field label="Segmento"><input className={crmInput} value={f.segment} onChange={(e) => setF({ ...f, segment: e.target.value })} /></Field>
        <Field label="Región"><select className={crmInput} value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })}>{['NAM', 'LATAM', 'EMEA', 'APAC'].map((r) => <option key={r}>{r}</option>)}</select></Field>
        <Field label="País"><input className={crmInput} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} /></Field>
        <Field label="Ciudad"><input className={crmInput} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
        <Field label="Sitio web"><input className={crmInput} value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /></Field>
        <Field label="Términos"><input className={crmInput} value={f.paymentTerms} onChange={(e) => setF({ ...f, paymentTerms: e.target.value })} /></Field>
        <Field label="Incoterm"><input className={crmInput} value={f.incoterm} onChange={(e) => setF({ ...f, incoterm: e.target.value })} /></Field>
        <Field label="Crédito"><input type="number" className={crmInput} value={f.creditLimit} onChange={(e) => setF({ ...f, creditLimit: Number(e.target.value) })} /></Field>
        <Field label="Ingreso anual"><input type="number" className={crmInput} value={f.annualRevenue} onChange={(e) => setF({ ...f, annualRevenue: Number(e.target.value) })} /></Field>
        <Field label="Empleados"><input type="number" className={crmInput} value={f.employees} onChange={(e) => setF({ ...f, employees: Number(e.target.value) })} /></Field>
        <Field label="Salud (0-100)"><input type="number" min={0} max={100} className={crmInput} value={f.healthScore} onChange={(e) => setF({ ...f, healthScore: Number(e.target.value) })} /></Field>
        <Field label="Riesgo"><select className={crmInput} value={f.riskLevel} onChange={(e) => setF({ ...f, riskLevel: e.target.value as Account['riskLevel'] })}>{['LOW', 'MEDIUM', 'HIGH'].map((r) => <option key={r}>{r}</option>)}</select></Field>
        <Field label="Account manager"><input className={crmInput} value={f.ownerEmail} onChange={(e) => setF({ ...f, ownerEmail: e.target.value })} /></Field>
        <Field label="Notas" full><textarea className={crmInput} rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} />
    </Modal>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────
function Metric({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-3.5`}>
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-lg font-semibold mt-0.5 tabular-nums truncate" style={{ color }}>{value}</div>
      {sub && <div className="text-[11px] text-gray-400 truncate">{sub}</div>}
    </div>
  );
}
function EmptyCard({ text }: { text: string }) {
  return <div className={`${glass} rounded-2xl p-10 text-center text-sm text-gray-400`}>{text}</div>;
}
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={`block ${full ? 'md:col-span-full' : ''}`}><span className="block text-[12px] font-medium text-gray-500 mb-1">{label}</span>{children}</label>;
}
function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-16 bg-black/40 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className={`${glass} rounded-3xl p-6 w-full ${wide ? 'max-w-3xl' : 'max-w-xl'}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-semibold">{title}</h3><button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button></div>
        {children}
      </div>
    </div>
  );
}
function ModalActions({ busy, onClose, onSubmit, label }: { busy: boolean; onClose: () => void; onSubmit: () => void; label?: string }) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
      <button onClick={onSubmit} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: VIOLET }}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {label || 'Guardar'}</button>
    </div>
  );
}
function Guard() {
  return (
    <div className="min-h-screen grid place-items-center text-foreground">
      <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}><Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" /><h2 className="text-lg font-semibold">Sin acceso</h2></div>
    </div>
  );
}
