'use client';

import { apiFetch } from '@/lib/apiFetch';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

export interface Supplier {
  id: number;
  code: string;
  name: string;
  legalName?: string | null;
  country?: string | null;
  city?: string | null;
  region?: string | null;
  status: string;
  type?: string;
  commodity?: string | null;
  qualificationStatus?: string;
  qualityScore: number;
  otdPct?: number | null;
  ppm?: number | null;
  responsivenessScore?: number | null;
  riskLevel?: string;
  financialHealth?: string | null;
  singleSource?: boolean;
  currency?: string;
  paymentTerms?: string | null;
  incoterm?: string | null;
  leadTimeDays?: number | null;
  website?: string | null;
  ownerEmail?: string | null;
  taxId?: string | null;
  tags?: string[] | null;
  notes?: string | null;
}

export interface SupplierContact {
  id: number;
  supplierId: number;
  name: string;
  title?: string | null;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  isPrimary: boolean;
}

export interface SupplierCertification {
  id: number;
  supplierId: number;
  standard: string;
  certNumber?: string | null;
  issuedBy?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  status: string;
}

export interface SupplierPart {
  id: number;
  supplierId: number;
  partNumber: string;
  unitPrice: number;
  currency: string;
  moq: number;
  leadTimeDays: number;
  preferred: boolean;
  active: boolean;
}

export interface Scar {
  id: number;
  scarNumber: string;
  status: string;
  severity: string;
  partNumber: string;
  issueSummary?: string;
  createdAt?: string;
}

export interface Supplier360 {
  supplier: Supplier;
  scorecard: { qualityScore: number; responseScore: number; riskLevel: string; trend: string };
  metrics: {
    iqc: { total: number; passed: number; passRate: number; failed: number };
    scars: { total: number; open: number; closed: number; avgClosureDays: number };
    parts: number; certifications: number; expiringCerts: number; contacts: number;
    otdPct: number | null; ppm: number | null;
  };
  contacts: SupplierContact[];
  certifications: SupplierCertification[];
  parts: SupplierPart[];
  scars: Scar[];
}

export interface SupplierKpis {
  total: number; approved: number; conditional: number; pending: number; disqualified: number;
  atRisk: number; singleSource: number; avgOtd: number | null; avgPpm: number | null;
  expiringCerts: number; openScars: number;
}

/** SCAR del listado global `/suppliers/scars` (proveedor incrustado). */
export interface ScarRow {
  id: number;
  scarNumber: string;
  status: string;
  severity: string;
  partNumber: string;
  lotNumber?: string | null;
  issueSummary?: string | null;
  quantityAffected?: number | null;
  createdAt?: string | null;
  closedAt?: string | null;
  supplier?: { id: number; code: string; name: string } | null;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(`${API_BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(`${API_BASE}${path}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function del(path: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export const supApi = {
  create: (b: Partial<Supplier>) => post<Supplier>('/suppliers', b),
  update: (id: number, b: Partial<Supplier>) => patch<Supplier>(`/suppliers/${id}`, b),
  addContact: (b: Partial<SupplierContact>) => post<SupplierContact>('/suppliers/contacts', b),
  removeContact: (id: number) => del(`/suppliers/contacts/${id}`),
  addCertification: (b: Partial<SupplierCertification>) => post<SupplierCertification>('/suppliers/certifications', b),
  removeCertification: (id: number) => del(`/suppliers/certifications/${id}`),
};

// ── Presentation ─────────────────────────────────────────────────────────────
export const QUAL_META: Record<string, { label: string; color: string }> = {
  APPROVED: { label: 'Aprobado', color: '#10b981' },
  CONDITIONAL: { label: 'Condicional', color: '#f59e0b' },
  PENDING: { label: 'Pendiente', color: '#6b7280' },
  DISQUALIFIED: { label: 'Descalificado', color: '#ef4444' },
};
export const RISK_META: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Bajo', color: '#10b981' },
  MEDIUM: { label: 'Medio', color: '#f59e0b' },
  HIGH: { label: 'Alto', color: '#ef4444' },
};
export const TYPE_LABEL: Record<string, string> = {
  COMPONENT: 'Componente',
  CONTRACT: 'Maquila',
  SERVICE: 'Servicio',
  DISTRIBUTOR: 'Distribuidor',
  RAW_MATERIAL: 'Materia prima',
};
/** Estados de un SCAR (8D de proveedor) — espejo de ScarStatus en el backend. */
export const SCAR_STATUS_META: Record<string, { label: string; color: string; open: boolean }> = {
  open: { label: 'Abierta', color: '#ef4444', open: true },
  sent_to_supplier: { label: 'Enviada', color: '#f59e0b', open: true },
  awaiting_response: { label: 'Esperando respuesta', color: '#f59e0b', open: true },
  response_under_review: { label: 'En revisión', color: '#3b82f6', open: true },
  action_accepted: { label: 'Acción aceptada', color: '#6366f1', open: true },
  effectiveness_review: { label: 'Verificando eficacia', color: '#6366f1', open: true },
  closed: { label: 'Cerrada', color: '#10b981', open: false },
};
export const SCAR_SEV_META: Record<string, { label: string; color: string }> = {
  minor: { label: 'Menor', color: '#6b7280' },
  major: { label: 'Mayor', color: '#f59e0b' },
  critical: { label: 'Crítica', color: '#ef4444' },
};
export function ppmColor(p?: number | null): string {
  if (p == null) return '#6b7280';
  if (p > 100) return '#ef4444';
  if (p > 50) return '#f59e0b';
  return '#10b981';
}
export const CERT_META: Record<string, { label: string; color: string }> = {
  VALID: { label: 'Vigente', color: '#10b981' },
  EXPIRING: { label: 'Por vencer', color: '#f59e0b' },
  EXPIRED: { label: 'Vencida', color: '#ef4444' },
  REVOKED: { label: 'Revocada', color: '#6b7280' },
};
export function scoreColor(s: number): string {
  if (s >= 95) return '#10b981';
  if (s >= 85) return '#f59e0b';
  return '#ef4444';
}
export function otdColor(s?: number | null): string {
  if (s == null) return '#6b7280';
  if (s >= 95) return '#10b981';
  if (s >= 90) return '#f59e0b';
  return '#ef4444';
}
export function money(n: number | null | undefined, ccy = 'USD'): string {
  try { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: ccy || 'USD', maximumFractionDigits: 2 }).format(n || 0); }
  catch { return `${(n || 0).toLocaleString()} ${ccy}`; }
}
export const supInput =
  'w-full rounded-xl px-3 py-2.5 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 outline-none focus:border-blue-500 transition-colors';
