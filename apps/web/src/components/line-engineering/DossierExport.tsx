'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X, FileDown, FileJson, FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';

/**
 * Layout dossier export (Fase 39). Read-only: fetches the consolidated dossier
 * (report + manning + cost + station table) and lets the planner download it as
 * JSON or as a spreadsheet-ready CSV — closing the loop on the analytics suite
 * by making its output portable. Isolated component so its fetch doesn't
 * re-render the heavy editor.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const ROSE = '#f43f5e';

interface Dossier {
  generatedAt: string;
  model: string;
  revision: string;
  unit: string;
  report: {
    stations: { total: number; placed: number; readinessPct: number };
    space: { utilizationPct: number; assetCount: number };
    balance: { balancePct: number; bottleneckStation: string | null } | null;
  };
  staffing: { totalOperators: number; avgUtilizationPct: number } | null;
  cost: { totalCostPerUnit: number; monthlyVolume: number } | null;
  completeness: { total: number; complete: number; completenessPct: number };
  stations: unknown[];
  csv: string;
  review: {
    score: number;
    grade: string;
    releasable: boolean;
    indices: {
      readinessPct: number;
      balancePct: number | null;
      circulationPct: number | null;
      continuityPct: number | null;
      cohesionPct: number | null;
      utilizationPct: number | null;
    };
    findings: string[];
  };
}

const gradeColor = (g: string) => (g === 'A' ? '#10b981' : g === 'B' ? '#84cc16' : g === 'C' ? '#f59e0b' : '#ef4444');

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function DossierExport({
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
  const [data, setData] = useState<Dossier | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !model) return;
    let alive = true;
    (async () => {
      if (alive) {
        setData(null);
        setError(null);
      }
      try {
        const r = await apiFetch(
          `${API_BASE}/line-engineering/layout/dossier?model=${encodeURIComponent(model)}&revision=${encodeURIComponent(revision)}`,
        );
        if (!alive) return;
        if (!r.ok) {
          setError('No se pudo generar el expediente.');
          return;
        }
        setData((await r.json()) as Dossier);
      } catch {
        if (alive) setError('No se pudo generar el expediente.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, model, revision]);

  if (!open) return null;

  const slug = `${model}_${revision}`.replace(/[^a-zA-Z0-9_-]+/g, '-');
  const downloadJson = () => {
    if (data) download(`layout_${slug}.json`, JSON.stringify(data, null, 2), 'application/json');
  };
  const downloadCsv = () => {
    if (data) download(`estaciones_${slug}.csv`, data.csv, 'text/csv;charset=utf-8');
  };

  // Portal to <body>: the editor sits inside a `glass` (backdrop-filter) card
  // that creates a containing block which would trap this `fixed inset-0` overlay
  // (rendered low / clipped). Rendering at the body root re-anchors it to the
  // viewport so it centres correctly.
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className={`${glass} rounded-2xl p-5 w-full max-w-md max-h-[88vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold inline-flex items-center gap-2">
            <FileDown className="w-4 h-4" style={{ color: ROSE }} /> Exportar expediente · {model} · {revision}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        {error ? (
          <p className="text-[12px] text-amber-500 py-8 text-center">{error}</p>
        ) : !data ? (
          <div className="py-10 grid place-items-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5 text-sm mb-4">
              <Mini label="Estaciones" value={`${data.report.stations.placed}/${data.report.stations.total}`} sub={`${Math.round(data.report.stations.readinessPct)}% listas`} />
              <Mini label="Completitud" value={`${Math.round(data.completeness.completenessPct)}%`} sub={`${data.completeness.complete}/${data.completeness.total} docs`} />
              <Mini label="Operadores" value={`${data.staffing?.totalOperators ?? '—'}`} sub={data.staffing ? `${data.staffing.avgUtilizationPct}% util.` : 'sin ruteo'} />
              <Mini label="Costo/unidad" value={data.cost ? `$${data.cost.totalCostPerUnit.toFixed(2)}` : '—'} sub={data.cost ? `${data.cost.monthlyVolume.toLocaleString()} u/mes` : ''} />
              <Mini label="Balance" value={data.report.balance ? `${Math.round(data.report.balance.balancePct * 100)}%` : '—'} sub={data.report.balance?.bottleneckStation ? `cuello ${data.report.balance.bottleneckStation}` : ''} />
              <Mini label="Uso de piso" value={`${Math.round(data.report.space.utilizationPct)}%`} sub={`${data.report.space.assetCount} equipos`} />
            </div>

            <div className="rounded-xl p-3 mb-4 bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <div className="grid place-items-center w-10 h-10 rounded-xl text-xl font-bold text-white shrink-0" style={{ background: gradeColor(data.review.grade) }}>
                  {data.review.grade}
                </div>
                <div className="text-[12px]">
                  <div className="font-semibold">Revisión del layout · {Math.round(data.review.score)}/100</div>
                  <div className={`inline-flex items-center gap-1 ${data.review.releasable ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {data.review.releasable
                      ? <><CheckCircle2 className="w-3.5 h-3.5" /> Listo para liberar</>
                      : <><AlertTriangle className="w-3.5 h-3.5" /> Con observaciones</>}
                  </div>
                </div>
              </div>
              {data.review.findings.length === 0 ? (
                <p className="text-[12px] text-gray-500">Sin observaciones pendientes.</p>
              ) : (
                <ul className="list-disc pl-5 space-y-0.5 text-[12px] text-gray-600 dark:text-gray-300">
                  {data.review.findings.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button onClick={downloadJson} className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-white" style={{ background: '#3b82f6' }}>
                <FileJson className="w-4 h-4" /> Descargar JSON
              </button>
              <button onClick={downloadCsv} className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-white" style={{ background: '#10b981' }}>
                <FileSpreadsheet className="w-4 h-4" /> Descargar CSV
              </button>
            </div>

            <p className="text-[11px] text-gray-400 mt-3">
              El JSON lleva el expediente completo (reporte, revisión, personal, costo y estaciones). El CSV es la tabla de estaciones lista para Excel. Generado {new Date(data.generatedAt).toLocaleString()}.
            </p>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl p-2.5 bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10">
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-base font-semibold mt-0.5">{value}</div>
      <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">{sub}</div>
    </div>
  );
}
