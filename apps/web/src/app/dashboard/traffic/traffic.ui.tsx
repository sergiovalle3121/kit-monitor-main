"use client";

// Presentational atoms for the traffic lane (master catalogs + assignment). Dumb
// on purpose; the widgets that hit the API live in traffic.actions.tsx.
import React from "react";
import { Loader2, X } from "lucide-react";
import { glass } from "@/lib/glass";

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
      {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
    </label>
  );
}

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
      <div className="p-4 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-400 mb-4">{icon}</div>
      <h3 className="font-bold text-lg mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{body}</p>
      {cta && <div className="mt-5">{cta}</div>}
    </div>
  );
}

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
  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={`${glass} rounded-2xl p-5 w-full ${wide ? "max-w-2xl" : "max-w-xl"} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">{icon} {title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
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
      <TrfInputStyle />
    </div>
  );
}

export function TrfInputStyle() {
  return (
    <style jsx global>{`
      .trf-input {
        width: 100%;
        border-radius: 0.75rem;
        padding: 0.55rem 0.75rem;
        background: rgba(0, 0, 0, 0.03);
        border: 1px solid rgba(0, 0, 0, 0.08);
        outline: none;
        font-size: 0.875rem;
        color: inherit;
      }
      .trf-input:focus { border-color: #6366f1; }
      :global(.dark) .trf-input {
        background: rgba(255, 255, 255, 0.06);
        border-color: rgba(255, 255, 255, 0.1);
      }
    `}</style>
  );
}

export function Pill({ label, color, dot }: { label: string; color: string; dot?: boolean }) {
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

export function StatusChip({
  label,
  count,
  active,
  color,
  onClick,
}: {
  label: string;
  count?: number;
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
      {count !== undefined && (
        <span className={`text-[11px] px-1.5 rounded-full tabular-nums ${active ? "bg-white/25" : "bg-black/5 dark:bg-white/10"}`}>{count}</span>
      )}
    </button>
  );
}

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
          : "text-gray-500 hover:text-black dark:hover:text-white"
      }`}
    >
      {icon}
      {children}
      {count !== undefined && count > 0 && (
        <span className={`text-[11px] px-1.5 rounded-full ${active ? "bg-black/10 dark:bg-white/20" : "bg-black/5 dark:bg-white/10"}`}>{count}</span>
      )}
    </button>
  );
}

// Botón compacto de acción con tinte semántico.
export function ActionButton({
  onClick,
  icon,
  label,
  color,
  busy,
  disabled,
  title,
  full,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  color: string;
  busy?: boolean;
  disabled?: boolean;
  title?: string;
  full?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
      title={title}
      className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50 ${full ? "w-full" : ""}`}
      style={{ background: `${color}1f`, color }}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {label}
    </button>
  );
}
