'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { formatSheetGovernanceSummary, summarizeSheetGovernance, type SheetGovernanceStatus } from '@/lib/office/sheetGovernanceSummary';

const tone: Record<SheetGovernanceStatus, { label: string; icon: typeof ShieldCheck; cls: string; panel: string }> = {
  ready: {
    label: 'Sheets ready',
    icon: CheckCircle2,
    cls: 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200',
    panel: 'border-emerald-500/20 bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100',
  },
  review: {
    label: 'Sheets review',
    icon: AlertTriangle,
    cls: 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200',
    panel: 'border-amber-500/20 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100',
  },
  blocked: {
    label: 'Sheets blocked',
    icon: ShieldAlert,
    cls: 'border-rose-500/30 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200',
    panel: 'border-rose-500/20 bg-rose-50 text-rose-900 dark:bg-rose-500/10 dark:text-rose-100',
  },
};

export function SheetGovernanceBadge({ content }: { content: unknown }) {
  const [open, setOpen] = useState(false);
  const summary = useMemo(() => summarizeSheetGovernance(content), [content]);
  const current = tone[summary.status];
  const Icon = current.icon;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title={formatSheetGovernanceSummary(summary)}
        className={`inline-flex h-5 items-center gap-1 rounded-full border px-2 text-[10px] font-semibold ${current.cls}`}
      >
        <Icon className="h-3 w-3" />
        <span>{current.label}</span>
        <span>{summary.score}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute bottom-6 right-0 z-30 w-80 rounded-xl border border-black/10 bg-white p-3 text-xs shadow-xl dark:border-white/10 dark:bg-[#181818]">
            <div className={`rounded-lg border px-3 py-2 ${current.panel}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Icon className="h-3.5 w-3.5" />
                  {current.label}
                </span>
                <span>{summary.score}/100</span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-gray-600 dark:text-gray-300">
              <Metric label="Open comments" value={summary.openComments} />
              <Metric label="Assigned" value={summary.assignedComments} />
              <Metric label="Locked ranges" value={summary.protectedRanges} />
              <Metric label="Connector locks" value={summary.connectorRanges} />
              <Metric label="Unprotected connectors" value={summary.unprotectedConnectors} />
              <Metric label="XLSX review" value={summary.xlsxReview} />
            </div>
            <div className="mt-3 space-y-1.5">
              {summary.messages.slice(0, 5).map((message) => (
                <div key={message} className="rounded-lg bg-gray-50 px-2.5 py-1.5 text-[11px] text-gray-600 dark:bg-white/[0.05] dark:text-gray-300">
                  {message}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-black/5 bg-gray-50 px-2 py-1 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
