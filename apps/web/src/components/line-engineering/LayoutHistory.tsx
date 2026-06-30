'use client';

import React, { useEffect, useState } from 'react';
import {
  Loader2,
  X,
  History,
  Save,
  Stamp,
  Camera,
  RotateCcw,
  FileUp,
  Copy,
  CircleDot,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';

/**
 * Layout audit timeline (Fase 32). Read-only history of who touched this layout
 * — saves, approvals, snapshots, restores, DXF uploads and clones — read from
 * the event ledger the mutating endpoints already write to. Isolated component
 * so its fetch doesn't re-render the heavy editor; pairs with the F29 approval
 * lifecycle to give a full change record.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const ROSE = '#f43f5e';

type Kind = 'save' | 'approval' | 'snapshot' | 'restore' | 'dxf' | 'clone' | 'other';

interface HistoryEntry {
  id: string;
  action: string;
  kind: Kind;
  actor: string;
  at: string;
  title: string;
  detail: string;
}

const KIND_META: Record<Kind, { color: string; Icon: React.ComponentType<{ className?: string }> }> = {
  save: { color: '#3b82f6', Icon: Save },
  approval: { color: '#10b981', Icon: Stamp },
  snapshot: { color: '#8b5cf6', Icon: Camera },
  restore: { color: '#f59e0b', Icon: RotateCcw },
  dxf: { color: '#06b6d4', Icon: FileUp },
  clone: { color: '#64748b', Icon: Copy },
  other: { color: '#94a3b8', Icon: CircleDot },
};

/** Compact "hace …" relative label, falling back to an absolute date. */
function relTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const diff = Date.now() - t;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `hace ${d} d`;
  return new Date(t).toLocaleDateString();
}

function absTime(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleString() : iso;
}

export default function LayoutHistory({
  model,
  revision,
  open,
  onClose,
}: {
  model: string;
  revision: string;
  open: boolean;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !model) return;
    let alive = true;
    (async () => {
      if (alive) {
        setEntries(null);
        setError(null);
      }
      try {
        const r = await apiFetch(
          `${API_BASE}/line-engineering/layout/history?model=${encodeURIComponent(model)}&revision=${encodeURIComponent(revision)}&limit=100`,
        );
        if (!alive) return;
        if (!r.ok) {
          setError('No se pudo cargar la bitácora.');
          return;
        }
        setEntries((await r.json()) as HistoryEntry[]);
      } catch {
        if (alive) setError('No se pudo cargar la bitácora.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, model, revision]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className={`${glass} rounded-2xl p-5 w-full max-w-lg`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold inline-flex items-center gap-2">
            <History className="w-4 h-4" style={{ color: ROSE }} /> Bitácora · {model} · {revision}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        {error ? (
          <p className="text-[12px] text-amber-500 py-10 text-center">{error}</p>
        ) : !entries ? (
          <div className="py-16 grid place-items-center text-gray-500 dark:text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : entries.length === 0 ? (
          <p className="text-[12px] text-gray-500 dark:text-gray-400 py-10 text-center">
            Sin movimientos registrados todavía. Guarda, versiona o aprueba el layout y aparecerán aquí.
          </p>
        ) : (
          <ol className="relative max-h-[60vh] overflow-y-auto pr-1 ml-1.5 border-l border-black/10 dark:border-white/10">
            {entries.map((e) => {
              const { color, Icon } = KIND_META[e.kind] ?? KIND_META.other;
              return (
                <li key={e.id} className="relative pl-5 pb-4 last:pb-0">
                  <span
                    className="absolute -left-[7px] top-0.5 grid place-items-center w-3.5 h-3.5 rounded-full ring-2 ring-white dark:ring-gray-900"
                    style={{ background: color }}
                  >
                    <Icon className="w-2 h-2 text-white" />
                  </span>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium" style={{ color }}>{e.title}</span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 shrink-0" title={absTime(e.at)}>{relTime(e.at)}</span>
                  </div>
                  {e.detail && <div className="text-[12px] text-gray-500 mt-0.5 leading-snug">{e.detail}</div>}
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{e.actor}</div>
                </li>
              );
            })}
          </ol>
        )}

        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3">
          Registro de auditoría inmutable. Se anota automáticamente cada guardado, aprobación, snapshot, restauración, plano y clonación.
        </p>
      </div>
    </div>
  );
}
