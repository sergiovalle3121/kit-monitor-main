'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft, Loader2, Lock, Plus, X, CheckCircle2, Trash2, Pencil,
  Send, ThumbsUp, ThumbsDown, FileText,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/contexts/ToastContext';
import {
  crmApi, money, compactMoney, crmInput, QUOTE_META,
  type Quote, type QuoteLine, type QuoteStatus,
} from '@/lib/crm';

const VIOLET = '#7c3aed';

interface QuoteDetail { quote: Quote; lines: QuoteLine[] }

export default function QuoteBuilderPage() {
  const params = useParams();
  const toast = useToast();
  const id = String(params.id);
  const { data, isLoading, forbidden, mutate } = useApi<QuoteDetail>(`/crm/quotes/${id}`);
  const [editLine, setEditLine] = useState<QuoteLine | null>(null);
  const [adding, setAdding] = useState(false);

  if (forbidden) return <Guard />;
  if (isLoading || !data) return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  const { quote: q, lines } = data;
  const ccy = q.currency;

  async function transition(status: QuoteStatus) {
    try { await crmApi.transitionQuote(id, status); toast.success(`→ ${QUOTE_META[status].label}`, 'Cotización'); mutate(); }
    catch { toast.error('Transición no permitida.', 'Cotización'); }
  }
  async function removeLine(lineId: string) {
    try { await crmApi.removeQuoteLine(lineId); mutate(); } catch { toast.error('Error', 'Cotización'); }
  }
  async function setDiscount(pct: number) {
    try { await crmApi.updateQuote(id, { discountPct: pct }); mutate(); } catch { toast.error('Error', 'Cotización'); }
  }

  const actions: { status: QuoteStatus; label: string; icon: typeof Send; show: boolean }[] = [
    { status: 'SENT', label: 'Enviar', icon: Send, show: q.status === 'DRAFT' },
    { status: 'ACCEPTED', label: 'Aceptada', icon: ThumbsUp, show: q.status === 'SENT' },
    { status: 'REJECTED', label: 'Rechazada', icon: ThumbsDown, show: q.status === 'SENT' },
  ];

  return (
    <div className="min-h-screen text-black dark:text-white">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href={`/dashboard/crm/accounts/${q.account_id}`} className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><ChevronLeft className="w-5 h-5" /></Link>
          <span className="w-9 h-9 rounded-xl grid place-items-center flex-shrink-0" style={{ background: `${VIOLET}1f` }}><FileText className="w-5 h-5" style={{ color: VIOLET }} /></span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold leading-tight truncate">{q.title}</h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: `${QUOTE_META[q.status].color}1a`, color: QUOTE_META[q.status].color }}>{QUOTE_META[q.status].label}</span>
            </div>
            <p className="text-[12px] text-gray-400 leading-tight font-mono">{q.folio || 'borrador'}{q.rev > 1 ? ` · rev ${q.rev}` : ''}</p>
          </div>
          {actions.filter((a) => a.show).map((a) => (
            <button key={a.status} onClick={() => transition(a.status)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-white" style={{ background: a.status === 'REJECTED' ? '#ef4444' : a.status === 'ACCEPTED' ? '#10b981' : VIOLET }}>
              <a.icon className="w-4 h-4" /> <span className="hidden sm:inline">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-6 pb-24">
        {/* Commercial envelope */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Info label="Términos" value={q.paymentTerms || '—'} />
          <Info label="Incoterm" value={q.incoterm || '—'} />
          <Info label="Lead time" value={q.leadTimeDays ? `${q.leadTimeDays} d` : '—'} />
          <Info label="Válida hasta" value={q.validUntil ? new Date(q.validUntil).toLocaleDateString('es-MX') : '—'} />
        </div>

        {/* Money summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <Money label="Subtotal" value={money(q.subtotal, ccy)} />
          <Money label={`Descuento ${q.discountPct || 0}%`} value={q.discountPct ? `−${money(q.subtotal - q.total, ccy)}` : money(0, ccy)} />
          <Money label="Total" value={money(q.total, ccy)} accent />
          <Money label="Valor anual (EAU)" value={compactMoney(q.estAnnualValue, ccy)} />
          <Money label="Margen" value={q.marginPct != null ? `${q.marginPct}%` : '—'} color={(q.marginPct ?? 0) >= 20 ? '#10b981' : (q.marginPct ?? 0) >= 10 ? '#f59e0b' : '#ef4444'} />
        </div>

        {/* Lines table */}
        <div className={`${glass} rounded-2xl overflow-hidden`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/10">
            <h2 className="text-sm font-semibold">Líneas <span className="text-gray-400">({lines.length})</span></h2>
            <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white" style={{ background: VIOLET }}><Plus className="w-3.5 h-3.5" /> Línea</button>
          </div>
          {lines.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">Sin líneas. Agrega partes con EAU, costo y precio para calcular el margen.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-gray-400 border-b border-black/5 dark:border-white/10">
                    <th className="text-left font-medium px-4 py-2">#</th>
                    <th className="text-left font-medium px-3 py-2">Descripción</th>
                    <th className="text-right font-medium px-3 py-2">EAU</th>
                    <th className="text-right font-medium px-3 py-2">Cant.</th>
                    <th className="text-right font-medium px-3 py-2">Costo</th>
                    <th className="text-right font-medium px-3 py-2">Precio</th>
                    <th className="text-right font-medium px-3 py-2">Extendido</th>
                    <th className="text-right font-medium px-3 py-2">Margen</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const ext = l.quantity * l.unitPrice;
                    const margin = l.unitPrice > 0 ? Math.round(((l.unitPrice - l.unitCost) / l.unitPrice) * 1000) / 10 : 0;
                    return (
                      <tr key={l.id} className="border-b border-black/[0.03] dark:border-white/[0.04] hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                        <td className="px-4 py-2.5 text-gray-400">{l.lineNo}</td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium">{l.description}</div>
                          {l.partNumber && <div className="text-[11px] text-gray-400 font-mono">{l.partNumber}</div>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{l.eau ? l.eau.toLocaleString() : '—'}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{l.quantity.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{money(l.unitCost, ccy)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-medium">{money(l.unitPrice, ccy)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{money(ext, ccy)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: margin >= 20 ? '#10b981' : margin >= 10 ? '#f59e0b' : '#ef4444' }}>{margin}%</td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <button onClick={() => setEditLine(l)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => removeLine(l.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Discount control */}
        <div className="mt-4 flex items-center justify-end gap-3">
          <span className="text-[13px] text-gray-500">Descuento global</span>
          <select value={q.discountPct || 0} onChange={(e) => setDiscount(Number(e.target.value))} className="rounded-lg px-2 py-1.5 text-[13px] bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10">
            {[0, 2, 3, 5, 7, 10, 12, 15].map((d) => <option key={d} value={d}>{d}%</option>)}
          </select>
        </div>

        {q.notes && <p className="mt-6 text-sm text-gray-500">{q.notes}</p>}
      </main>

      {adding && <LineModal quoteId={id} onClose={() => setAdding(false)} onDone={() => { setAdding(false); mutate(); }} />}
      {editLine && <LineModal quoteId={id} line={editLine} onClose={() => setEditLine(null)} onDone={() => { setEditLine(null); mutate(); }} />}
    </div>
  );
}

function LineModal({ quoteId, line, onClose, onDone }: { quoteId: string; line?: QuoteLine; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    description: line?.description || '', partNumber: line?.partNumber || '',
    eau: line?.eau || 0, quantity: line?.quantity || 1,
    unitCost: line?.unitCost || 0, unitPrice: line?.unitPrice || 0,
    leadTimeDays: line?.leadTimeDays || 0,
  });
  const margin = f.unitPrice > 0 ? Math.round(((f.unitPrice - f.unitCost) / f.unitPrice) * 1000) / 10 : 0;

  async function submit() {
    if (f.description.trim().length < 1) { toast.error('Descripción requerida.', 'Cotización'); return; }
    setBusy(true);
    try {
      const body = { ...f, leadTimeDays: Number(f.leadTimeDays) || undefined };
      if (line) await crmApi.updateQuoteLine(line.id, body);
      else await crmApi.addQuoteLine(quoteId, body);
      toast.success(line ? 'Línea actualizada.' : 'Línea agregada.', 'Cotización');
      onDone();
    } catch { toast.error('Error.', 'Cotización'); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-16 bg-black/40 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className={`${glass} rounded-3xl p-6 w-full max-w-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-semibold">{line ? 'Editar línea' : 'Nueva línea'}</h3><button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block md:col-span-2"><span className="block text-[12px] font-medium text-gray-500 mb-1">Descripción</span><input className={crmInput} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="PCBA Gen-3 (SMT doble cara + AOI)" /></label>
          <label className="block"><span className="block text-[12px] font-medium text-gray-500 mb-1">Número de parte</span><input className={crmInput} value={f.partNumber} onChange={(e) => setF({ ...f, partNumber: e.target.value })} /></label>
          <label className="block"><span className="block text-[12px] font-medium text-gray-500 mb-1">EAU (volumen anual)</span><input type="number" min={0} className={crmInput} value={f.eau} onChange={(e) => setF({ ...f, eau: Number(e.target.value) })} /></label>
          <label className="block"><span className="block text-[12px] font-medium text-gray-500 mb-1">Cantidad</span><input type="number" min={0} className={crmInput} value={f.quantity} onChange={(e) => setF({ ...f, quantity: Number(e.target.value) })} /></label>
          <label className="block"><span className="block text-[12px] font-medium text-gray-500 mb-1">Lead time (días)</span><input type="number" min={0} className={crmInput} value={f.leadTimeDays} onChange={(e) => setF({ ...f, leadTimeDays: Number(e.target.value) })} /></label>
          <label className="block"><span className="block text-[12px] font-medium text-gray-500 mb-1">Costo unitario</span><input type="number" min={0} step="0.01" className={crmInput} value={f.unitCost} onChange={(e) => setF({ ...f, unitCost: Number(e.target.value) })} /></label>
          <label className="block"><span className="block text-[12px] font-medium text-gray-500 mb-1">Precio unitario</span><input type="number" min={0} step="0.01" className={crmInput} value={f.unitPrice} onChange={(e) => setF({ ...f, unitPrice: Number(e.target.value) })} /></label>
        </div>
        <div className="mt-3 flex items-center justify-between text-[13px] px-1">
          <span className="text-gray-400">Margen de línea</span>
          <span className="font-semibold" style={{ color: margin >= 20 ? '#10b981' : margin >= 10 ? '#f59e0b' : '#ef4444' }}>{margin}%</span>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
          <button onClick={submit} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: VIOLET }}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Guardar</button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className={`${glass} rounded-xl p-3`}><div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div><div className="text-sm font-medium truncate">{value}</div></div>;
}
function Money({ label, value, accent, color }: { label: string; value: string; accent?: boolean; color?: string }) {
  return (
    <div className={`${glass} rounded-2xl p-3.5 ${accent ? 'ring-1 ring-violet-500/30' : ''}`}>
      <div className="text-[10px] uppercase tracking-wide text-gray-400 truncate">{label}</div>
      <div className="text-base font-semibold mt-0.5 tabular-nums truncate" style={{ color: color || (accent ? VIOLET : undefined) }}>{value}</div>
    </div>
  );
}
function Guard() {
  return <div className="min-h-screen grid place-items-center text-black dark:text-white"><div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}><Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" /><h2 className="text-lg font-semibold">Sin acceso</h2></div></div>;
}
