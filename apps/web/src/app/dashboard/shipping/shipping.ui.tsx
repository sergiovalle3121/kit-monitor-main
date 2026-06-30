"use client";

// Presentational atoms for the shipping lane (list · row · detail drawer · action
// modals). Single source so everything stays visually consistent without
// duplicating markup. Dumb on purpose — no data fetching lives here; the
// interactive widgets that hit the API live in shipping.actions.tsx.
import React, { useId } from "react";
import { Loader2, X } from "lucide-react";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { glass } from "@/lib/glass";
import { STATUS_META } from "./shipping.utils";
import type { ShipmentStatus } from "./shipping.types";

// ── KPI card ─────────────────────────────────────────────────────────────────
export function Kpi({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: number | string;
  color: string;
  sub?: string;
}) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-2xl font-semibold mt-1" style={{ color }}>{value}</div>
      {sub && <div className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">{sub}</div>}
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
  submitDisabled,
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
  submitDisabled?: boolean;
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
            disabled={busy || submitDisabled}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60"
            style={{ background: accent }}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : submitIcon} {submitLabel}
          </button>
        </div>
      </div>
      <ShpInputStyle />
    </div>
  );
}

// ── Glassy inputs (.shp-input) ───────────────────────────────────────────────
export function ShpInputStyle() {
  return (
    <style jsx global>{`
      .shp-input {
        width: 100%;
        border-radius: 0.75rem;
        padding: 0.55rem 0.75rem;
        background: rgba(0, 0, 0, 0.03);
        border: 1px solid rgba(0, 0, 0, 0.08);
        outline: none;
        font-size: 0.875rem;
        color: inherit;
      }
      .shp-input:focus {
        border-color: #3b82f6;
      }
      :global(.dark) .shp-input {
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

export function StatusPill({ status }: { status: ShipmentStatus }) {
  const m = STATUS_META[status];
  return <Pill label={m.label} color={m.color} dot />;
}

// ── Chip de estado (filtro segmentado, con conteo) ───────────────────────────
export function StatusChip({
  label,
  count,
  active,
  color,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
        active ? "text-white" : "hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"
      }`}
      style={active ? { background: color } : undefined}
    >
      {label}
      <span className={`text-[11px] px-1.5 rounded-full tabular-nums ${active ? "bg-white/25" : "bg-black/5 dark:bg-white/10"}`}>{count}</span>
    </button>
  );
}

// ── Fila de detalle (drawer) ─────────────────────────────────────────────────
export function DetailRow({
  icon,
  label,
  value,
  sub,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-gray-500 dark:text-gray-400 mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-gray-500 dark:text-gray-400">{label}</div>
        <div className="text-sm break-words" style={valueColor ? { color: valueColor } : undefined}>{value}</div>
        {sub && <div className="text-[12px] text-gray-500 dark:text-gray-400 truncate">{sub}</div>}
      </div>
    </div>
  );
}

// ── Encabezado de sección (drawer) ───────────────────────────────────────────
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">{children}</div>;
}
