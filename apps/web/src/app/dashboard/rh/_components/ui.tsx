'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronLeft, Loader2, Lock } from 'lucide-react';
import { glass } from '@/lib/glass';

export const COLORS = {
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  violet: '#7c3aed',
  pink: '#ec4899',
  blue: '#3b82f6',
  gray: '#6b7280',
} as const;

export const RISK_COLOR: Record<string, string> = {
  LOW: COLORS.green,
  MEDIUM: COLORS.amber,
  HIGH: '#fb923c',
  CRITICAL: COLORS.red,
};

export function fmtInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return Math.round(n).toLocaleString('es-MX');
}

export function fmtMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

/** Sticky header + page body shell shared by every RH sub-screen. */
export function RhShell({
  title,
  subtitle,
  icon: Icon,
  color,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen text-black dark:text-white">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Link href="/dashboard/rh" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <span className="w-9 h-9 rounded-xl grid place-items-center flex-shrink-0" style={{ background: `${color}1f` }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight truncate">{title}</h1>
            <p className="text-[12px] text-gray-400 leading-tight truncate">{subtitle}</p>
          </div>
          {action}
        </div>
      </div>
      <main className="max-w-6xl mx-auto px-6 pt-8 pb-28">{children}</main>
    </div>
  );
}

export function Kpi({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  color?: string;
}) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums" style={{ color }}>
        {value}
      </div>
      {sub != null && <div className="text-[12px] text-gray-400 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

/** Horizontal labelled bar for distributions. */
export function Bar({
  label,
  value,
  max,
  color = COLORS.violet,
  right,
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
  right?: React.ReactNode;
}) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[12px] mb-1">
        <span className="truncate">{label}</span>
        <span className="text-gray-400 tabular-nums">{right ?? value}</span>
      </div>
      <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export function RiskPill({ band }: { band: string }) {
  const color = RISK_COLOR[band] ?? COLORS.gray;
  const label =
    band === 'CRITICAL' ? 'Crítico' : band === 'HIGH' ? 'Alto' : band === 'MEDIUM' ? 'Medio' : 'Bajo';
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: `${color}1f`, color }}>
      {label}
    </span>
  );
}

export function Forbidden() {
  return (
    <div className="min-h-screen grid place-items-center text-black dark:text-white">
      <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
        <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
        <h2 className="text-lg font-semibold">Sin acceso</h2>
        <p className="text-sm text-gray-400 mt-1">Inicia sesión para ver esta sección de RH.</p>
      </div>
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  );
}

/** Shared input class injected once per page via <RhStyles/>. */
export function RhStyles() {
  return (
    <style jsx global>{`
      .rh-input {
        width: 100%;
        border-radius: 0.75rem;
        padding: 0.55rem 0.75rem;
        background: rgba(0, 0, 0, 0.03);
        border: 1px solid rgba(0, 0, 0, 0.08);
        outline: none;
        font-size: 0.875rem;
      }
      .rh-input:focus {
        border-color: #ec4899;
      }
      :global(.dark) .rh-input {
        background: rgba(255, 255, 255, 0.06);
        border-color: rgba(255, 255, 255, 0.1);
        color: white;
      }
    `}</style>
  );
}
