'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Loader2, Lock, Calculator, ArrowRight, AlertTriangle, Factory, ShoppingCart,
  CheckCircle2, FileText,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface Material { id: string; partNumber: string; description: string; }
interface PoDraft { supplierName: string; lineCount: number; totalValue: number; currency: string; parts: { partNumber: string; description: string; qty: number; uom: string; value: number }[]; }
interface PoSuggest { root: { partNumber: string; qty: number }; drafts: PoDraft[]; shortageCount: number; }
interface PoGenerated { created: { folio: string | null; supplierName: string; totalValue: number; lineCount: number }[]; count: number; }
interface BomLite { id: string; revision: string; material?: Material | null; lineCount: number; }
interface MrpRow {
  partNumber: string; description: string; uom: string; makeBuy: string;
  gross: number; available: number; inTransit: number; net: number;
  suggestedOrder: number; unitCost: number; shortageValue: number;
}
interface MrpResult {
  root: { partNumber: string; description: string; revision: string; qty: number };
  rows: MrpRow[];
  summary: { parts: number; shortageParts: number; totalShortageValue: number };
}

const field =
  'w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-lg py-2 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export default function MrpPage() {
  const toast = useToast();
  const { data: boms, isLoading, forbidden } = useApi<BomLite[]>('/bom-tree');

  const [bomNodeId, setBomNodeId] = useState('');
  const [qty, setQty] = useState('1');
  const [warehouseId, setWarehouseId] = useState('');
  const [params, setParams] = useState<{ id: string; qty: number; wh: string } | null>(null);

  const bomList = useMemo(() => (Array.isArray(boms) ? boms : []), [boms]);

  const key = params
    ? `/mrp/${params.id}/netting?qty=${params.qty}${params.wh ? `&warehouseId=${encodeURIComponent(params.wh)}` : ''}`
    : null;
  const { data: result, isLoading: running } = useApi<MrpResult>(key);

  const [poSuggest, setPoSuggest] = useState<PoSuggest | null>(null);
  const [poGenerated, setPoGenerated] = useState<PoGenerated | null>(null);
  const [poBusy, setPoBusy] = useState<string | null>(null);

  function run() {
    if (!bomNodeId) { toast.error('Elige un ensamble.', 'MRP'); return; }
    setParams({ id: bomNodeId, qty: Number(qty) || 1, wh: warehouseId.trim() });
    setPoSuggest(null); setPoGenerated(null);
  }

  async function suggestPOs() {
    if (!params) return;
    setPoBusy('suggest');
    try {
      const url = `${API_BASE}/purchase-planning/${params.id}/suggest?qty=${params.qty}${params.wh ? `&warehouseId=${encodeURIComponent(params.wh)}` : ''}`;
      const res = await apiFetch(url);
      const d = await res.json().catch(() => null);
      if (!res.ok || !d) { toast.error(d?.message || 'No se pudo sugerir.', 'Compras'); return; }
      setPoSuggest(d); setPoGenerated(null);
    } catch { toast.error('Error de red.', 'Compras'); } finally { setPoBusy(null); }
  }

  async function generatePOs() {
    if (!params) return;
    setPoBusy('generate');
    try {
      const res = await apiFetch(`${API_BASE}/purchase-planning/${params.id}/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qty: params.qty, warehouseId: params.wh || undefined }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d) { toast.error(d?.message || 'No se pudo generar.', 'Compras'); return; }
      setPoGenerated(d);
      toast.success(`${d.count} orden(es) de compra creada(s).`, 'Compras');
    } catch { toast.error('Error de red.', 'Compras'); } finally { setPoBusy(null); }
  }

  if (forbidden) {
    return <div className="min-h-screen grid place-items-center text-foreground"><div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}><Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" /><h2 className="text-lg font-semibold">Sin acceso</h2></div></div>;
  }

  return (
    <div className="min-h-screen text-foreground font-sans pb-28">
      <main className="max-w-7xl mx-auto px-6 pt-10">
        <PageHeader domain="planning" title="MRP · Requerimiento Neto" icon={Calculator}
          subtitle="Explota un BOM por cantidad a construir, neto contra existencias y en tránsito, y sugiere qué ordenar (compra/fabricación)." />

        {!isLoading && bomList.length === 0 && (
          <div className={`${glass} rounded-2xl p-4 mb-6 text-sm text-amber-600 dark:text-amber-400`}>
            No hay BOMs. Crea uno en{' '}
            <Link href="/dashboard/bom" className="underline font-medium">BOM Multinivel</Link>.
          </div>
        )}

        <div className={`${glass} rounded-2xl p-5 mb-4`}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <label className="block md:col-span-2">
              <span className="block text-[11px] font-medium text-gray-500 mb-1">Ensamble (BOM)</span>
              <select className={field} value={bomNodeId} onChange={(e) => setBomNodeId(e.target.value)}>
                <option value="">Elegir BOM…</option>
                {bomList.map((b) => <option key={b.id} value={b.id}>{b.material?.partNumber} · {b.material?.description} (rev {b.revision})</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-[11px] font-medium text-gray-500 mb-1">Cantidad a construir</span>
              <input className={field} type="number" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
            </label>
            <label className="block">
              <span className="block text-[11px] font-medium text-gray-500 mb-1">Almacén (opcional)</span>
              <input className={field} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} placeholder="Todos" />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={run} disabled={!bomNodeId} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white dark:text-black bg-black dark:bg-white disabled:opacity-50">
              <ArrowRight className="w-4 h-4" /> Calcular MRP
            </button>
          </div>
        </div>

        {running ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : result ? (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Kpi label="Materiales" value={result.summary.parts} color="#5b5bd6" />
              <Kpi label="En escasez" value={result.summary.shortageParts} color="#f43f5e" />
              <Kpi label="Valor faltante" value={money(result.summary.totalShortageValue)} color="#f59e0b" />
            </div>

            <div className="text-sm text-gray-500 mb-2">
              Para construir <b>{result.root.qty}</b> × {result.root.partNumber} · {result.root.description}
            </div>

            {result.rows.length === 0 ? (
              <div className={`${glass} rounded-2xl p-8 text-center text-sm text-gray-400`}>Este BOM no tiene componentes que requerir.</div>
            ) : (
              <div className={`${glass} rounded-2xl overflow-hidden`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100 dark:border-white/10">
                        <th className="px-3 py-2">Parte</th>
                        <th className="px-3 py-2 text-right">Bruto</th>
                        <th className="px-3 py-2 text-right">Disp.</th>
                        <th className="px-3 py-2 text-right">Tránsito</th>
                        <th className="px-3 py-2 text-right">Neto</th>
                        <th className="px-3 py-2 text-right">Ordenar</th>
                        <th className="px-3 py-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                      {result.rows.map((r) => (
                        <tr key={r.partNumber} className={r.net > 0 ? 'bg-rose-500/[0.04]' : ''}>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span title={r.makeBuy === 'MAKE' ? 'Fabricar' : 'Comprar'} className="shrink-0">
                                {r.makeBuy === 'MAKE'
                                  ? <Factory className="w-3.5 h-3.5 text-violet-500" />
                                  : <ShoppingCart className="w-3.5 h-3.5 text-blue-500" />}
                              </span>
                              <span className="font-mono text-xs text-gray-500">{r.partNumber}</span>
                            </div>
                            <div className="text-xs text-gray-400 truncate max-w-[220px]">{r.description}</div>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.gross} <span className="text-gray-400 text-xs">{r.uom}</span></td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-500">{r.available}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-500">{r.inTransit}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ color: r.net > 0 ? '#f43f5e' : '#10b981' }}>{r.net}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">{r.suggestedOrder > 0 ? `${r.suggestedOrder} ${r.uom}` : '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-500">{r.shortageValue > 0 ? money(r.shortageValue) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="mt-3 text-[11px] text-gray-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Disponible = on-hand − asignado (solo stock <b>available</b>).
            </div>

            {/* Purchase orders from MRP shortages */}
            {result.summary.shortageParts > 0 && (
              <div className={`${glass} rounded-2xl p-5 mt-4`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-blue-500" />
                    <h3 className="font-semibold text-sm">Órdenes de compra desde el MRP</h3>
                  </div>
                  {!poSuggest && (
                    <button onClick={suggestPOs} disabled={poBusy === 'suggest'} className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full border border-gray-200 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50">
                      {poBusy === 'suggest' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />} Sugerir órdenes
                    </button>
                  )}
                </div>

                {poSuggest && (
                  <>
                    <p className="text-xs text-gray-400 mb-3">{poSuggest.drafts.length} orden(es) agrupadas por proveedor (fabricante AVL preferido).</p>
                    <div className="space-y-2">
                      {poSuggest.drafts.map((d, i) => (
                        <div key={i} className="rounded-xl border border-gray-100 dark:border-white/10 p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{d.supplierName}</span>
                            <span className="text-sm tabular-nums text-gray-500">{money(d.totalValue)} · {d.lineCount} parte(s)</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1 truncate">{d.parts.map((p) => `${p.partNumber}×${p.qty}`).join(' · ')}</div>
                        </div>
                      ))}
                    </div>
                    {!poGenerated && (
                      <div className="mt-4 flex justify-end">
                        <button onClick={generatePOs} disabled={poBusy === 'generate'} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white dark:text-black bg-blue-500 disabled:opacity-60">
                          {poBusy === 'generate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Generar {poSuggest.drafts.length} orden(es)
                        </button>
                      </div>
                    )}
                  </>
                )}

                {poGenerated && (
                  <div className="mt-4 rounded-xl bg-emerald-500/10 p-3">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium mb-2">
                      <CheckCircle2 className="w-4 h-4" /> {poGenerated.count} orden(es) creada(s)
                    </div>
                    <div className="space-y-1">
                      {poGenerated.created.map((c, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="font-mono text-xs text-gray-500">{c.folio ?? '(sin folio)'}</span>
                          <span className="truncate flex-1">{c.supplierName}</span>
                          <span className="tabular-nums text-gray-500">{money(c.totalValue)}</span>
                        </div>
                      ))}
                    </div>
                    <Link href="/dashboard/procurement" className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-500 hover:underline mt-3">
                      Ver en Compras <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className={`${glass} rounded-3xl p-10 text-center text-sm text-gray-400`}>Elige un ensamble y calcula el requerimiento neto.</div>
        )}
      </main>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-xl font-semibold mt-1 tabular-nums" style={{ color }}>{value}</div>
    </div>
  );
}
