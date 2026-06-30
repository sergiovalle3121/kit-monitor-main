"use client";

// Presentational atoms for the maintenance lane (overview · assets · orders ·
// preventive). Single source so the four views stay visually consistent without
// duplicating markup (AGENTS.md §3). Dumb on purpose — no data fetching lives
// here; the interactive widgets that hit the API live in maintenance.actions.tsx.
import React, { useId } from "react";
import { Loader2, X } from "lucide-react";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { glass } from "@/lib/glass";
import {
  ASSET_STATUS_META,
  CRITICALITY_META,
  ORDER_STATUS_META,
  PM_STATUS_META,
  PRIORITY_META,
  TYPE_META,
} from "./maintenance.utils";
import type { PmDueStatus } from "./maintenance.utils";
import type {
  AssetCriticality,
  AssetStatus,
  MaintenanceOrderStatus,
  MaintenancePriority,
  MaintenanceType,
} from "./maintenance.types";

// ── KPI card ─────────────────────────────────────────────────────────────────
export function Kpi({
  label,
  value,
  color,
  sub,
  hint,
}: {
  label: string;
  value: number | string;
  color: string;
  sub?: string;
  /** Nota pequeña (p.ej. "requiere backend") bajo el valor. */
  hint?: string;
}) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-2xl font-semibold mt-1" style={{ color }}>{value}</div>
      {sub && <div className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">{sub}</div>}
      {hint && (
        <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400/80 mt-1">{hint}</div>
      )}
    </div>
  );
}

// ── Form field ───────────────────────────────────────────────────────────────
export function Field({
  label,
  children,
  full,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
  hint?: string;
}) {
  return (
    <label className={`block ${full ? "md:col-span-2" : ""}`}>
      <span className="block text-[12px] font-medium text-gray-500 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-gray-500 dark:text-gray-400 mt-1">{hint}</span>}
    </label>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────
export function Empty({
  icon,
  title,
  body,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-6">
      <div className="p-4 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 mb-4">{icon}</div>
      <h3 className="font-bold text-lg mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{body}</p>
      {cta && <div className="mt-5">{cta}</div>}
    </div>
  );
}

// ── Generic dialog ───────────────────────────────────────────────────────────
export function Modal({
  title,
  icon,
  accent,
  busy,
  onClose,
  onSubmit,
  submitLabel,
  submitIcon,
  children,
  wide,
}: {
  title: string;
  icon: React.ReactNode;
  accent: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitIcon: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const panelRef = useDialogA11y<HTMLDivElement>(onClose);
  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`${glass} rounded-2xl p-5 w-full ${wide ? "max-w-2xl" : "max-w-xl"} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id={titleId} className="font-semibold flex items-center gap-2">{icon} {title}</h3>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
        {children}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
          <button
            onClick={onSubmit}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60"
            style={{ background: accent }}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : submitIcon} {submitLabel}
          </button>
        </div>
      </div>
      <MInputStyle />
    </div>
  );
}

// ── Glassy inputs (.m-input) ─────────────────────────────────────────────────
export function MInputStyle() {
  return (
    <style jsx global>{`
      .m-input {
        width: 100%;
        border-radius: 0.75rem;
        padding: 0.55rem 0.75rem;
        background: rgba(0, 0, 0, 0.03);
        border: 1px solid rgba(0, 0, 0, 0.08);
        outline: none;
        font-size: 0.875rem;
        color: inherit;
      }
      .m-input:focus {
        border-color: #7c3aed;
      }
      :global(.dark) .m-input {
        background: rgba(255, 255, 255, 0.06);
        border-color: rgba(255, 255, 255, 0.1);
      }
    `}</style>
  );
}

// ── Badges / pills ───────────────────────────────────────────────────────────
export function Pill({
  label,
  color,
  dot,
}: {
  label: string;
  color: string;
  dot?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
      style={{ background: `${color}1f`, color }}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />}
      {label}
    </span>
  );
}

export function StatusPill({ status }: { status: MaintenanceOrderStatus }) {
  const m = ORDER_STATUS_META[status];
  return <Pill label={m.label} color={m.color} dot />;
}

export function TypePill({ type }: { type: MaintenanceType }) {
  const m = TYPE_META[type];
  return <Pill label={m.label} color={m.color} />;
}

export function PriorityPill({ priority }: { priority: MaintenancePriority }) {
  const m = PRIORITY_META[priority];
  return <Pill label={`Prioridad ${m.label.toLowerCase()}`} color={m.color} />;
}

export function CriticalityPill({ criticality }: { criticality: AssetCriticality }) {
  const m = CRITICALITY_META[criticality];
  return <Pill label={m.label} color={m.color} />;
}

export function AssetStatusPill({ status }: { status: AssetStatus }) {
  const m = ASSET_STATUS_META[status];
  return <Pill label={m.label} color={m.color} dot />;
}

export function PmStatusPill({ status }: { status: PmDueStatus }) {
  const m = PM_STATUS_META[status];
  return <Pill label={m.label} color={m.color} dot />;
}

// ── Tab button ───────────────────────────────────────────────────────────────
export function TabBtn({
  active,
  onClick,
  icon,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
        active
          ? "bg-white text-black shadow-sm dark:bg-white/15 dark:text-white"
          : "text-gray-500 hover:text-foreground"
      }`}
    >
      {icon}
      {children}
      {count !== undefined && count > 0 && (
        <span className={`text-[11px] px-1.5 rounded-full ${active ? "bg-black/10 dark:bg-white/20" : "bg-black/5 dark:bg-white/10"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── Mini load bar (órdenes por activo) ───────────────────────────────────────
export function MiniBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.max(6, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
