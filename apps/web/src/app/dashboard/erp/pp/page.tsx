'use client';

import React, { useEffect, useState } from 'react';
import { Factory, Play, Loader2, CheckCircle2 } from 'lucide-react';
import {
  ErpHeader,
  Tabs,
  DataTable,
  StatCard,
  Pill,
  fmtNum,
  fmtDate,
  GREEN,
  AMBER,
  RED,
  type Row,
} from '@/components/erp/ErpUI';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { glass } from '@/lib/glass';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface MrpRun {
  id: number;
  runNumber: string;
  runAt: string;
  mode: string;
  summary?: { parts?: number; requisitions?: number; plannedOrders?: number; shortages?: number };
  results?: Row[];
}

const TABS = [
  { id: 'mrp', label: 'MRP' },
  { id: 'planned', label: 'Órdenes planeadas' },
];

export default function ErpPpPage() {
  const [tab, setTab] = useState('mrp');
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t && TABS.some((x) => x.id === t)) setTab(t);
  }, []);

  const { data: runs, mutate: mutateRuns } = useApi<MrpRun[]>(tab === 'mrp' ? '/erp/pp/mrp/runs' : null);
  const [selectedRun, setSelectedRun] = useState<number | null>(null);
  const runId = selectedRun ?? (Array.isArray(runs) && runs.length ? runs[0].id : null);
  const { data: run } = useApi<MrpRun>(runId ? `/erp/pp/mrp/runs/${runId}` : null);

  const { data: planned, mutate: mutatePlanned } = useApi<Row[]>(
    tab === 'planned' ? '/erp/pp/planned-orders' : null,
  );

  const [mode, setMode] = useState<'propose' | 'auto'>('propose');
  const [busy, setBusy] = useState(false);
  const [releasing, setReleasing] = useState<number | null>(null);

  async function runMrp() {
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/erp/pp/mrp/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      if (res.ok) {
        const created = (await res.json()) as MrpRun;
        await mutateRuns();
        setSelectedRun(created.id);
      }
    } finally {
      setBusy(false);
    }
  }

  async function release(id: number) {
    setReleasing(id);
    try {
      await apiFetch(`${API_BASE}/erp/pp/planned-orders/${id}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await mutatePlanned();
    } finally {
      setReleasing(null);
    }
  }

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-24">
      <ErpHeader title="Producción" subtitle="PP / MRP" icon={<Factory className="w-5 h-5 text-amber-500" />} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === 'mrp' && (
          <>
            <div className={`${glass} rounded-3xl p-4 mb-5 flex flex-wrap items-center justify-between gap-3`}>
              <div>
                <h3 className="font-bold">Correr MRP (PP02)</h3>
                <p className="text-xs text-gray-500">
                  Netea demanda (pedidos + planes) contra inventario y explota el BOM multinivel.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className={`${glass} rounded-full p-1 flex`}>
                  {(['propose', 'auto'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${
                        mode === m ? 'bg-amber-500 text-white' : 'text-gray-500'
                      }`}
                    >
                      {m === 'propose' ? 'Proponer' : 'Auto'}
                    </button>
                  ))}
                </div>
                <button
                  onClick={runMrp}
                  disabled={busy}
                  className="flex items-center gap-2 bg-amber-500 text-white text-sm font-bold px-5 py-2.5 rounded-full hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-60"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Correr MRP
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              <StatCard label="Partes" value={fmtNum(run?.summary?.parts ?? 0)} sub={run?.runNumber} />
              <StatCard label="Órdenes planeadas" value={fmtNum(run?.summary?.plannedOrders ?? 0)} />
              <StatCard label="Requisiciones" value={fmtNum(run?.summary?.requisitions ?? 0)} />
              <StatCard
                label="Faltantes"
                value={fmtNum(run?.summary?.shortages ?? 0)}
                color={run?.summary?.shortages ? RED : GREEN}
              />
            </div>

            {Array.isArray(runs) && runs.length > 1 && (
              <div className="flex gap-1.5 flex-wrap mb-4">
                {runs.slice(0, 8).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRun(r.id)}
                    className={`text-[11px] font-mono px-3 py-1.5 rounded-full transition ${
                      r.id === runId ? 'bg-black text-white dark:bg-white dark:text-black' : `${glass}`
                    }`}
                  >
                    {r.runNumber}
                  </button>
                ))}
              </div>
            )}

            <DataTable
              exportName="mrp-resultados"
              rows={run?.results ?? []}
              emptyText="Corre el MRP para ver el plan de necesidades"
              columns={[
                { key: 'level', label: 'Nivel', align: 'center' },
                { key: 'partNumber', label: 'Parte' },
                { key: 'grossReq', label: 'Demanda', align: 'right', render: (r) => fmtNum(r.grossReq) },
                { key: 'onHand', label: 'Existencia', align: 'right', render: (r) => fmtNum(r.onHand) },
                { key: 'netReq', label: 'Neto', align: 'right', render: (r) => fmtNum(r.netReq) },
                { key: 'plannedQty', label: 'Planeado', align: 'right', render: (r) => fmtNum(r.plannedQty) },
                {
                  key: 'action',
                  label: 'Acción',
                  render: (r) =>
                    r.action === 'none' ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <Pill
                        text={r.action === 'make' ? 'Fabricar' : 'Comprar'}
                        color={r.action === 'make' ? '#3b82f6' : AMBER}
                      />
                    ),
                },
                {
                  key: 'shortage',
                  label: '',
                  sortable: false,
                  render: (r) => (r.shortage ? <Pill text="Faltante" color={RED} /> : null),
                },
              ]}
            />
          </>
        )}

        {tab === 'planned' && (
          <DataTable
            rows={planned ?? []}
            emptyText="Sin órdenes planeadas"
            columns={[
              { key: 'plannedOrderNumber', label: 'Orden' },
              { key: 'partNumber', label: 'Modelo' },
              { key: 'quantity', label: 'Cantidad', align: 'right', render: (r) => fmtNum(r.quantity) },
              { key: 'needBy', label: 'Necesaria', render: (r) => fmtDate(r.needBy) },
              {
                key: 'status',
                label: 'Estado',
                render: (r) => (
                  <Pill
                    text={String(r.status)}
                    color={r.status === 'planned' ? AMBER : r.status === 'released' ? GREEN : RED}
                  />
                ),
              },
              {
                key: 'release',
                label: '',
                sortable: false,
                render: (r) =>
                  r.status === 'planned' ? (
                    <button
                      onClick={() => release(Number(r.id))}
                      disabled={releasing === Number(r.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition disabled:opacity-50"
                    >
                      {releasing === Number(r.id) ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      Liberar (PP03)
                    </button>
                  ) : (
                    <span className="text-[11px] text-gray-400">
                      {r.releasedPlanId ? `Plan #${r.releasedPlanId}` : '—'}
                    </span>
                  ),
              },
            ]}
          />
        )}
      </main>
    </div>
  );
}
