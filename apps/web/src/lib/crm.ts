'use client';

import { apiFetch } from '@/lib/apiFetch';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

// ── Types ────────────────────────────────────────────────────────────────────
export type AccountType = 'CUSTOMER' | 'PROSPECT' | 'PARTNER' | 'INACTIVE';
export type AccountTier = 'STRATEGIC' | 'A' | 'B' | 'C';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type OppStatus = 'LEAD' | 'QUALIFIED' | 'PROPOSAL' | 'WON' | 'LOST';
export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export interface Account {
  id: string;
  code: string;
  name: string;
  legalName?: string | null;
  type: AccountType;
  tier: AccountTier;
  status: string;
  industry?: string | null;
  segment?: string | null;
  website?: string | null;
  region?: string | null;
  country?: string | null;
  city?: string | null;
  addressLine?: string | null;
  currency: string;
  paymentTerms?: string | null;
  incoterm?: string | null;
  creditLimit?: number;
  annualRevenue?: number | null;
  employees?: number | null;
  taxId?: string | null;
  duns?: string | null;
  ownerEmail?: string | null;
  enterpriseCustomerCode?: string | null;
  healthScore: number;
  riskLevel: RiskLevel;
  npsScore?: number | null;
  tags?: string[] | null;
  notes?: string | null;
}

export interface Contact {
  id: string;
  account_id: string;
  firstName: string;
  lastName?: string | null;
  title?: string | null;
  department?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  isPrimary: boolean;
  buyingRole?: string | null;
  linkedin?: string | null;
  status: string;
  notes?: string | null;
}

export interface Opportunity {
  id: string;
  folio: string | null;
  title: string;
  customerName?: string | null;
  accountId?: string | null;
  status: OppStatus;
  estimatedValue: number;
  currency: string;
  probability: number;
  source?: string | null;
  competitor?: string | null;
  productLine?: string | null;
  nextStep?: string | null;
  nextStepDate?: string | null;
  lossReason?: string | null;
  expectedCloseDate?: string | null;
  ownerEmail?: string | null;
  createdAt?: string;
  created_at?: string;
}

export interface QuoteLine {
  id: string;
  quote_id: string;
  lineNo: number;
  partNumber?: string | null;
  description: string;
  eau: number;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  leadTimeDays?: number | null;
  notes?: string | null;
}

export interface Quote {
  id: string;
  folio: string | null;
  account_id: string;
  opportunityId?: string | null;
  rev: number;
  title: string;
  status: QuoteStatus;
  currency: string;
  validUntil?: string | null;
  paymentTerms?: string | null;
  incoterm?: string | null;
  leadTimeDays?: number | null;
  subtotal: number;
  discountPct: number;
  total: number;
  estAnnualValue: number;
  marginPct?: number | null;
  ownerEmail?: string | null;
  notes?: string | null;
}

export interface Activity {
  id: string;
  account_id?: string | null;
  contactId?: string | null;
  opportunityId?: string | null;
  quoteId?: string | null;
  type: 'CALL' | 'EMAIL' | 'MEETING' | 'VISIT' | 'NOTE' | 'TASK';
  subject: string;
  body?: string | null;
  direction?: string | null;
  status: 'OPEN' | 'DONE' | 'CANCELLED';
  dueAt?: string | null;
  completedAt?: string | null;
  ownerEmail?: string | null;
  outcome?: string | null;
  created_at?: string;
}

export interface Account360 {
  account: Account;
  contacts: Contact[];
  opportunities: Opportunity[];
  quotes: Quote[];
  activities: Activity[];
  metrics: {
    contacts: number;
    openOpportunities: number;
    pipelineValue: number;
    weightedValue: number;
    wonValue: number;
    openQuotes: number;
    quoteValue: number;
    openTasks: number;
    overdueTasks: number;
    lastActivityAt: string | null;
  };
}

// ── Mutations (GETs go through useApi/SWR) ───────────────────────────────────
async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.text().catch(() => '')) || `HTTP ${res.status}`);
  return res.json();
}
async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.text().catch(() => '')) || `HTTP ${res.status}`);
  return res.json();
}
async function del(path: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export const crmApi = {
  createAccount: (b: Partial<Account>) => post<Account>('/crm/accounts', b),
  updateAccount: (id: string, b: Partial<Account>) => patch<Account>(`/crm/accounts/${id}`, b),
  createContact: (b: Partial<Contact> & { accountId: string }) => post<Contact>('/crm/contacts', b),
  updateContact: (id: string, b: Partial<Contact>) => patch<Contact>(`/crm/contacts/${id}`, b),
  removeContact: (id: string) => del(`/crm/contacts/${id}`),
  createOpportunity: (b: Record<string, unknown>) => post<Opportunity>('/crm/opportunities', b),
  transitionOpportunity: (id: string, status: OppStatus, lossReason?: string) =>
    post<Opportunity>(`/crm/opportunities/${id}/transition`, { status, lossReason }),
  createActivity: (b: Record<string, unknown>) => post<Activity>('/crm/activities', b),
  completeActivity: (id: string, outcome?: string) => post<Activity>(`/crm/activities/${id}/complete`, { outcome }),
  createQuote: (b: Record<string, unknown>) => post<Quote>('/crm/quotes', b),
  updateQuote: (id: string, b: Record<string, unknown>) => patch<Quote>(`/crm/quotes/${id}`, b),
  transitionQuote: (id: string, status: QuoteStatus) => post<Quote>(`/crm/quotes/${id}/transition`, { status }),
  addQuoteLine: (id: string, b: Record<string, unknown>) => post<Quote>(`/crm/quotes/${id}/lines`, b),
  updateQuoteLine: (lineId: string, b: Record<string, unknown>) => patch<Quote>(`/crm/quotes/lines/${lineId}`, b),
  removeQuoteLine: (lineId: string) => del(`/crm/quotes/lines/${lineId}`),
};

// ── Shared presentation helpers ──────────────────────────────────────────────
export function money(n: number | null | undefined, ccy = 'USD'): string {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: ccy || 'USD', maximumFractionDigits: 0 }).format(n || 0);
  } catch {
    return `${(n || 0).toLocaleString()} ${ccy}`;
  }
}
export function compactMoney(n: number | null | undefined, ccy = 'USD'): string {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: ccy || 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
  } catch {
    return money(n, ccy);
  }
}

export const TIER_META: Record<AccountTier, { label: string; color: string }> = {
  STRATEGIC: { label: 'Estratégico', color: '#7c3aed' },
  A: { label: 'Tier A', color: '#0fb39a' },
  B: { label: 'Tier B', color: '#3b82f6' },
  C: { label: 'Tier C', color: '#6b7280' },
};
export const TYPE_META: Record<AccountType, { label: string; color: string }> = {
  CUSTOMER: { label: 'Cliente', color: '#10b981' },
  PROSPECT: { label: 'Prospecto', color: '#f59e0b' },
  PARTNER: { label: 'Socio', color: '#3b82f6' },
  INACTIVE: { label: 'Inactivo', color: '#6b7280' },
};
export const OPP_META: Record<OppStatus, { label: string; color: string }> = {
  LEAD: { label: 'Lead', color: '#6b7280' },
  QUALIFIED: { label: 'Calificada', color: '#3b82f6' },
  PROPOSAL: { label: 'Propuesta', color: '#7c3aed' },
  WON: { label: 'Ganada', color: '#10b981' },
  LOST: { label: 'Perdida', color: '#ef4444' },
};
export const QUOTE_META: Record<QuoteStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Borrador', color: '#6b7280' },
  SENT: { label: 'Enviada', color: '#3b82f6' },
  ACCEPTED: { label: 'Aceptada', color: '#10b981' },
  REJECTED: { label: 'Rechazada', color: '#ef4444' },
  EXPIRED: { label: 'Vencida', color: '#f59e0b' },
};
export function healthColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

/** True when a task due date is in the past (kept out of render to stay pure). */
export function isOverdue(due?: string | null): boolean {
  return !!due && new Date(due).getTime() < Date.now();
}

/** Shared Tailwind input styling (Tailwind-only, no custom CSS). */
export const crmInput =
  'w-full rounded-xl px-3 py-2.5 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 outline-none focus:border-violet-500 transition-colors';

