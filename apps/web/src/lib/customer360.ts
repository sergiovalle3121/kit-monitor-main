'use client';

export interface CustomerRollup {
  code: string;
  name: string;
  industry: string | null;
  status: string;
  programs: number;
  openRmas: number;
}

export interface Program {
  id: string;
  code: string;
  name: string;
  status: string;
  primaryModelPrefix?: string | null;
}

export interface Customer360 {
  customer: { id: string; code: string; name: string; industry: string | null; status: string };
  programs: Program[];
  quality: {
    total: number; open: number; closed: number;
    recent: Array<{ id: string; folio: string | null; failureDescription: string; severity: string; status: string; partNumber: string | null; openedAt: string | null }>;
  };
  delivery: { total: number; shipped: number; inTransit: number; otdPct: number | null };
  finance: { total: number; open: number; totalValue: number; openValue: number; currency: string };
  metrics: {
    programs: number; activePrograms: number;
    openRmas: number; otdPct: number | null; salesOrderValue: number;
  };
}

export function money(n: number | null | undefined, ccy = 'USD'): string {
  try { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: ccy || 'USD', maximumFractionDigits: 0 }).format(n || 0); }
  catch { return `${(n || 0).toLocaleString()} ${ccy}`; }
}
export function compactMoney(n: number | null | undefined, ccy = 'USD'): string {
  try { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: ccy || 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(n || 0); }
  catch { return money(n, ccy); }
}

export const PROGRAM_META: Record<string, { label: string; color: string }> = {
  active: { label: 'Activo', color: '#10b981' },
  ramping: { label: 'Ramp-up', color: '#3b82f6' },
  npi: { label: 'NPI', color: '#7c3aed' },
  on_hold: { label: 'En pausa', color: '#f59e0b' },
  end_of_life: { label: 'Fin de vida', color: '#6b7280' },
};
