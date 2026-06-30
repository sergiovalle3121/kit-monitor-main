'use client';

// Carga verificada (Fase 2b) — scan each handling unit's SSCC at the dock against
// this shipment. Matched units flip to "cargada"; a unit from another shipment or
// an unknown SSCC is rejected (poka-yoke). The shipment can't move to READY until
// every assigned unit is verified. Reads GET /packing/loading/:id; scans via POST.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Loader2,
  PackageCheck,
  RotateCcw,
  ScanLine,
  Truck,
  X,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const BLUE = '#3b82f6';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const GRAY = '#6b7280';

type HuStatus = 'OPEN' | 'PACKED' | 'LOADED';
interface LoadingUnit {
  id: string;
  sscc: string | null;
  type?: string;
  status: HuStatus;
  loaded: boolean;
}
interface LoadingState {
  shipmentId: string;
  total: number;
  loaded: number;
  pending: number;
  complete: boolean;
  hasUnits: boolean;
  units: LoadingUnit[];
}
type ScanResult = 'matched' | 'already' | 'unknown' | 'wrong-shipment';
interface Feedback {
  tone: string;
  text: string;
}

const TYPE_LABEL: Record<string, string> = { PALLET: 'Tarima', CARTON: 'Caja', BOX: 'Bulto' };

export function DockLoading({
  shipment,
  onClose,
  onChanged,
}: {
  shipment: { id: string; folio: string | null; title: string };
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data, isLoading, mutate } = useApi<LoadingState>(`/packing/loading/${shipment.id}`);
  const state = data;

  const [scan, setScan] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the scanner focused so a wedge scanner's keystrokes always land here.
  useEffect(() => {
    if (!isLoading) inputRef.current?.focus();
  }, [isLoading, feedback]);

  const pct = useMemo(() => {
    if (!state || state.total === 0) return 0;
    return Math.round((state.loaded / state.total) * 100);
  }, [state]);

  async function submitScan() {
    const sscc = scan.trim();
    if (!sscc || busy) return;
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/packing/loading/${shipment.id}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sscc }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Poka-yoke rejection (unknown SSCC / belongs to another shipment).
        setFeedback({ tone: RED, text: d?.message || 'SSCC rechazado.' });
      } else {
        const result: ScanResult = d?.outcome?.result;
        if (result === 'already') {
          setFeedback({ tone: AMBER, text: 'Esa unidad ya estaba cargada.' });
        } else {
          setFeedback({ tone: GREEN, text: 'Unidad verificada y cargada.' });
        }
        await mutate();
        onChanged();
      }
    } catch {
      setFeedback({ tone: RED, text: 'Error de red al escanear.' });
    } finally {
      setScan('');
      setBusy(false);
    }
  }

  async function reset(huId: string) {
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/packing/loading/${shipment.id}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handlingUnitId: huId }),
      });
      if (res.ok) {
        setFeedback({ tone: GRAY, text: 'Unidad regresada a pendiente.' });
        await mutate();
        onChanged();
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-black/40" onClick={onClose}>
      <div
        className={`${glass} h-full w-full max-w-md overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 px-5 py-4 flex items-center gap-3 backdrop-blur" style={{ background: 'rgba(0,0,0,0.02)' }}>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: `${BLUE}1f` }}>
            <Truck className="w-5 h-5" style={{ color: BLUE }} />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold leading-tight truncate">Carga verificada</h2>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-tight truncate">
              {shipment.folio ? `${shipment.folio} · ` : ''}{shipment.title}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          {isLoading && !state ? (
            <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-500 dark:text-gray-400" /></div>
          ) : !state || !state.hasUnits ? (
            <div className="text-center py-16">
              <PackageCheck className="w-8 h-8 mx-auto mb-3 text-gray-500 dark:text-gray-400" />
              <p className="text-sm font-medium">Sin unidades de manejo</p>
              <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">
                Crea las tarimas/cajas de este embarque en <span className="font-medium">Empaque</span> (con su SSCC) para poder verificar la carga.
              </p>
            </div>
          ) : (
            <>
              {/* Progress */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-[13px] mb-1.5">
                  <span className="font-medium">{state.loaded} / {state.total} cargadas</span>
                  <span style={{ color: state.complete ? GREEN : AMBER }}>
                    {state.complete ? 'Carga completa' : `${state.pending} pendientes`}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: state.complete ? GREEN : BLUE }} />
                </div>
              </div>

              {state.complete && (
                <div className="mb-4 flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px]" style={{ background: `${GREEN}14`, color: GREEN }}>
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>Todas las unidades verificadas. El embarque puede marcarse <strong>Listo</strong>.</span>
                </div>
              )}

              {/* Scanner */}
              <label className="block text-[12px] font-medium text-gray-500 mb-1.5">Escanea el SSCC</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <ScanLine className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
                  <input
                    ref={inputRef}
                    value={scan}
                    onChange={(e) => setScan(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitScan(); }}
                    placeholder="00 + 18 dígitos…"
                    disabled={busy}
                    inputMode="numeric"
                    autoComplete="off"
                    className="w-full rounded-xl pl-9 pr-3 py-2.5 font-mono text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 outline-none focus:border-blue-500 disabled:opacity-60"
                  />
                </div>
                <button
                  onClick={submitScan}
                  disabled={busy || !scan.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: BLUE }}
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Verificar
                </button>
              </div>
              {feedback && (
                <div className="mt-2 flex items-center gap-1.5 text-[13px]" style={{ color: feedback.tone }}>
                  {feedback.tone === RED ? <AlertTriangle className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{feedback.text}</span>
                </div>
              )}

              {/* Checklist */}
              <div className="mt-5 space-y-2">
                {state.units.map((u) => (
                  <div key={u.id} className={`${glass} rounded-xl p-3 flex items-center gap-3`}>
                    <span
                      className="w-7 h-7 rounded-lg grid place-items-center flex-shrink-0"
                      style={{ background: u.loaded ? `${GREEN}1f` : `${GRAY}1f`, color: u.loaded ? GREEN : GRAY }}
                    >
                      {u.loaded ? <Check className="w-4 h-4" /> : <PackageCheck className="w-4 h-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[12px] truncate">{u.sscc ?? '—'}</div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">
                        {TYPE_LABEL[u.type ?? ''] ?? u.type ?? '—'} · {u.loaded ? 'Cargada' : 'Pendiente'}
                      </div>
                    </div>
                    {u.loaded && (
                      <button
                        onClick={() => reset(u.id)}
                        disabled={busy}
                        title="Regresar a pendiente"
                        className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-amber-500 hover:bg-amber-500/10 disabled:opacity-50"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
