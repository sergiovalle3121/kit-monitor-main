"use client";

// Shared presentational atoms for the quality lane (cockpit · NCR detail ·
// analytics). Single source so the three routes stay visually consistent without
// duplicating markup (AGENTS.md §3).
import React, { useId } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { glass } from "@/lib/glass";

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

export function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <span className="block text-[12px] font-medium text-gray-500 mb-1">{label}</span>
      {children}
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
      <div className="p-4 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 mb-4">{icon}</div>
      <h3 className="font-bold text-lg mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{body}</p>
      {cta && <div className="mt-5">{cta}</div>}
    </div>
  );
}

/**
 * Generic form modal used by the lane's create/record dialogs (inspections,
 * inventory holds, …). Renders the `.q-input` styles so the forms inside it pick
 * up the glassy input look without each caller importing QInputStyle.
 */
export function Modal({
  title,
  icon,
  accent,
  busy,
  onClose,
  onSubmit,
  submitLabel,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  accent: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const panelRef = useDialogA11y<HTMLDivElement>(onClose);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`${glass} rounded-2xl p-5 w-full max-w-xl max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 id={titleId} className="font-semibold flex items-center gap-2">{icon} {title}</h3>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
        {children}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
          <button onClick={onSubmit} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: accent }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {submitLabel}
          </button>
        </div>
      </div>
      <QInputStyle />
    </div>
  );
}

/** Glassy text inputs/selects/textarea used inside the lane's forms. */
export function QInputStyle() {
  return (
    <style jsx global>{`
      .q-input {
        width: 100%;
        border-radius: 0.75rem;
        padding: 0.55rem 0.75rem;
        background: rgba(0, 0, 0, 0.03);
        border: 1px solid rgba(0, 0, 0, 0.08);
        outline: none;
        font-size: 0.875rem;
      }
      .q-input:focus {
        border-color: #2ec27e;
      }
      :global(.dark) .q-input {
        background: rgba(255, 255, 255, 0.06);
        border-color: rgba(255, 255, 255, 0.1);
      }
    `}</style>
  );
}
