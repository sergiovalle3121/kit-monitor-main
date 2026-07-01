'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Download,
  Inbox,
  Command,
  Terminal,
} from 'lucide-react';
import { glass } from '@/lib/glass';

export type Row = Record<string, unknown>;

export interface Column {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  render?: (row: Row) => React.ReactNode;
  sortable?: boolean;
}

export const GREEN = '#10b981';
export const AMBER = '#f59e0b';
export const RED = '#ef4444';

export function fmtMoney(n: unknown): string {
  return Number(n ?? 0).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'USD',
  });
}
export function fmtNum(n: unknown): string {
  return Number(n ?? 0).toLocaleString('es-MX');
}
export function fmtDate(n: unknown): string {
  if (!n) return '—';
  const d = new Date(String(n));
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-MX');
}

export function exportToXlsx(name: string, rows: Row[]): void {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  XLSX.writeFile(wb, `${name}.xlsx`);
}

const ERP_ROUTES: Record<string, string> = {
  ERP: '/dashboard/erp',
  MM01: '/dashboard/erp/mm?tab=valuation',
  MM02: '/dashboard/erp/mm?tab=po',
  MM03: '/dashboard/erp/mm?tab=requisitions',
  PP01: '/dashboard/erp/pp?tab=planned',
  PP02: '/dashboard/erp/pp',
  PP03: '/dashboard/erp/pp?tab=planned',
};

export function ErpHeader({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}) {
  const router = useRouter();
  const [cmd, setCmd] = useState('');
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const route = ERP_ROUTES[cmd.trim().toUpperCase()];
    if (route) {
      router.push(route);
      setCmd('');
    }
  };
  return (
    <div
      className={`${glass} sticky top-0 z-40 px-5 py-3 rounded-none border-x-0 border-t-0 flex items-center justify-between gap-4`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href="/dashboard/erp"
          className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> ERP
        </Link>
        <span className="flex items-center gap-2 text-lg font-bold tracking-tight truncate">
          {icon}
          {title}
        </span>
        {subtitle && (
          <span className="hidden md:inline text-xs text-gray-500 dark:text-gray-400">· {subtitle}</span>
        )}
      </div>
      <form onSubmit={go} className="flex items-center gap-2 flex-shrink-0">
        <div className={`${glass} hidden sm:flex items-center gap-2 rounded-full px-3 py-1.5`}>
          <Terminal className="w-3.5 h-3.5 text-violet-500" />
          <input
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            placeholder="T-Code…"
            className="bg-transparent outline-none text-sm font-mono w-24 placeholder:text-gray-400"
          />
        </div>
        <span className="hidden lg:flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
          <Command className="w-3 h-3" />K
        </span>
      </form>
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="text-[11px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-2xl font-bold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1.5 flex-wrap mb-5">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`text-sm font-semibold px-4 py-2 rounded-full transition ${
            active === t.id
              ? 'bg-black text-white dark:bg-white dark:text-black'
              : `${glass} text-gray-600 dark:text-gray-300`
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Pill({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
      style={{ color, backgroundColor: `${color}1f` }}
    >
      {text}
    </span>
  );
}

export function DataTable({
  columns,
  rows,
  pageSize = 12,
  exportName,
  emptyText,
}: {
  columns: Column[];
  rows: Row[];
  pageSize?: number;
  exportName?: string;
  emptyText?: string;
}) {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const an = Number(av);
      const bn = Number(bv);
      const cmp =
        !Number.isNaN(an) && !Number.isNaN(bn) && av !== '' && bv !== ''
          ? an - bn
          : String(av ?? '').localeCompare(String(bv ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clamped = Math.min(page, pages - 1);
  const slice = sorted.slice(clamped * pageSize, clamped * pageSize + pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  if (!rows.length) {
    return (
      <div className="flex flex-col items-center text-center py-14 text-gray-500 dark:text-gray-400">
        <Inbox className="w-7 h-7 mb-2" />
        <p className="text-sm">{emptyText ?? 'No hay registros'}</p>
      </div>
    );
  }

  return (
    <div>
      {exportName && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => exportToXlsx(exportName, rows)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition"
          >
            <Download className="w-3.5 h-3.5" /> Exportar xlsx
          </button>
        </div>
      )}
      <div className={`${glass} rounded-2xl overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-[11px] uppercase tracking-wider text-gray-500">
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={`px-4 py-2.5 font-semibold ${
                      c.align === 'right'
                        ? 'text-right'
                        : c.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                    }`}
                  >
                    <button
                      onClick={() => (c.sortable === false ? undefined : toggleSort(c.key))}
                      className={`inline-flex items-center gap-1 ${
                        c.sortable === false
                          ? 'cursor-default'
                          : 'hover:text-foreground'
                      }`}
                    >
                      {c.label}
                      {c.sortable !== false && <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slice.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-gray-50 dark:border-white/5 hover:bg-gray-50/60 dark:hover:bg-white/5"
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-4 py-2.5 ${
                        c.align === 'right'
                          ? 'text-right tabular-nums'
                          : c.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                      }`}
                    >
                      {c.render ? c.render(row) : String(row[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
          <span>{sorted.length} registros</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(0, clamped - 1))}
              disabled={clamped === 0}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>
              {clamped + 1} / {pages}
            </span>
            <button
              onClick={() => setPage(Math.min(pages - 1, clamped + 1))}
              disabled={clamped >= pages - 1}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
