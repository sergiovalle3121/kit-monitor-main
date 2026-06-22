'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, Lock, Inbox, Search, Truck, Plus, X, CheckCircle2, ShieldCheck,
  AlertTriangle, ChevronRight,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/contexts/ToastContext';
import {
  supApi, supInput, QUAL_META, RISK_META, scoreColor, otdColor,
  type Supplier, type SupplierKpis,
} from '@/lib/suppliers';

const BLUE = '#3b82f6';
const QUALS = ['APPROVED', 'CONDITIONAL', 'PENDING', 'DISQUALIFIED'];
const TYPES = ['COMPONENT', 'CONTRACT', 'SERVICE', 'DISTRIBUTOR', 'RAW_MATERIAL'];

export default function SuppliersPage() {
  const router = useRouter();
  const { data, isLoading, forbidden, mutate } = useApi<Supplier[]>('/suppliers');
  const { data: kpis } = useApi<SupplierKpis>('/suppliers/kpis');
  const all = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const [q, setQ] = useState('');
  const [qual, setQual] = useState('');
  const [showNew, setShowNew] = useState(false);

  const rows = useMemo(() => all.filter((s) => {
    if (qual && (s.qualificationStatus || 'PENDING') !== qual) return false;
    if (!q) return true;
    return `${s.code} ${s.name ?? ''} ${s.commodity ?? ''} ${s.country ?? ''}`.toLowerCase().includes(q.toLowerCase());
  }), [all, q, qual]);

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <main className="max-w-5xl mx-auto px-6 pt-10">
        <div className="flex items-start justify-between gap-3">
          <PageHeader domain="logistics" title="Proveedores" subtitle="Cadena de suministro · calificación, scorecard y riesgo" icon={Truck} />
          <button onClick={() => setShowNew(true)} className="mt-1 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white flex-shrink-0" style={{ background: BLUE }}>
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Proveedor</span>
          </button>
        </div>

        {!forbidden && !isLoading && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
              <Kpi label="Proveedores" value={String(kpis?.total ?? all.length)} sub={`${kpis?.approved ?? 0} aprobados`} color={BLUE} />
              <Kpi label="OTD prom." value={kpis?.avgOtd != null ? `${kpis.avgOtd}%` : '—'} color={otdColor(kpis?.avgOtd)} />
              <Kpi label="PPM prom." value={kpis?.avgPpm != null ? String(kpis.avgPpm) : '—'} color={(kpis?.avgPpm ?? 0) > 100 ? '#ef4444' : (kpis?.avgPpm ?? 0) > 50 ? '#f59e0b' : '#10b981'} />
              <Kpi label="En riesgo" value={String(kpis?.atRisk ?? 0)} sub={`${kpis?.singleSource ?? 0} sole-source`} color={kpis?.atRisk ? '#ef4444' : '#10b981'} />
              <Kpi label="Certs por vencer" value={String(kpis?.expiringCerts ?? 0)} color={kpis?.expiringCerts ? '#f59e0b' : '#10b981'} />
              <Kpi label="SCARs abiertas" value={String(kpis?.openScars ?? 0)} color={kpis?.openScars ? '#f59e0b' : '#10b981'} />
            </div>

            <div className="flex items-center gap-2 mb-5 flex-wrap">
              <div className={`${glass} flex items-center gap-2 px-4 py-2.5 rounded-2xl flex-1 min-w-[200px]`}>
                <Search className="w-4 h-4 text-gray-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar código, nombre, commodity o país…" className="bg-transparent outline-none text-sm w-full" />
              </div>
              <select value={qual} onChange={(e) => setQual(e.target.value)} className="rounded-2xl px-3 py-2.5 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10">
                <option value="">Toda calificación</option>
                {QUALS.map((qz) => <option key={qz} value={qz}>{QUAL_META[qz].label}</option>)}
              </select>
            </div>
          </>
        )}

        {forbidden ? (
          <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso al backend" body="Verifica que el servicio de API esté conectado." />
        ) : isLoading ? (
          <div className="flex justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <Empty icon={<Inbox className="w-6 h-6" />} title={all.length === 0 ? 'Sin proveedores' : 'Sin coincidencias'} body={all.length === 0 ? 'Da de alta el primer proveedor.' : 'Ningún proveedor coincide con el filtro.'} />
        ) : (
          <div className="space-y-2.5">
            {rows.map((s) => {
              const qz = QUAL_META[s.qualificationStatus || 'PENDING'] ?? QUAL_META.PENDING;
              const risk = RISK_META[s.riskLevel || 'LOW'] ?? RISK_META.LOW;
              return (
                <button key={s.id} onClick={() => router.push(`/dashboard/suppliers/${s.id}`)} className={`${glass} rounded-2xl p-4 w-full text-left hover:shadow-lg transition-shadow flex items-center gap-4`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{s.code}</span>
                      <span className="font-semibold truncate">{s.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${qz.color}1f`, color: qz.color }}>{qz.label}</span>
                      {s.singleSource && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-500 inline-flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" />sole-source</span>}
                    </div>
                    <div className="text-[12px] text-gray-400 flex items-center gap-2 flex-wrap">
                      {s.commodity && <span>{s.commodity}</span>}
                      {s.country && <><span>·</span><span>{s.country}</span></>}
                      {s.leadTimeDays != null && <><span>·</span><span>LT {s.leadTimeDays}d</span></>}
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-5 flex-shrink-0 text-right">
                    <Stat label="OTD" value={s.otdPct != null ? `${s.otdPct}%` : '—'} color={otdColor(s.otdPct)} />
                    <Stat label="PPM" value={s.ppm != null ? String(s.ppm) : '—'} color={(s.ppm ?? 0) > 100 ? '#ef4444' : (s.ppm ?? 0) > 50 ? '#f59e0b' : '#10b981'} />
                    <Stat label="Calidad" value={`${Math.round(s.qualityScore ?? 0)}%`} color={scoreColor(s.qualityScore ?? 0)} />
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: risk.color }}><ShieldCheck className="w-3.5 h-3.5" />{risk.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </main>

      {showNew && <NewSupplierModal onClose={() => setShowNew(false)} onCreated={(s) => { setShowNew(false); mutate(); router.push(`/dashboard/suppliers/${s.id}`); }} />}
    </div>
  );
}

function NewSupplierModal({ onClose, onCreated }: { onClose: () => void; onCreated: (s: Supplier) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ code: '', name: '', type: 'COMPONENT', commodity: '', country: '', region: 'NAM', qualificationStatus: 'PENDING', paymentTerms: 'NET30', incoterm: 'FCA', leadTimeDays: 30, ownerEmail: '' });
  async function submit() {
    if (!f.code.trim() || !f.name.trim()) { toast.error('Código y nombre requeridos.', 'Proveedores'); return; }
    setBusy(true);
    try {
      const s = await supApi.create({ ...f, leadTimeDays: Number(f.leadTimeDays) || undefined } as Partial<Supplier>);
      toast.success('Proveedor creado.', 'Proveedores'); onCreated(s);
    } catch { toast.error('No se pudo crear.', 'Proveedores'); } finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-16 bg-black/40 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className={`${glass} rounded-3xl p-6 w-full max-w-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-semibold">Nuevo proveedor</h3><button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <L label="Código"><input className={supInput} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="AX-SUP-ACME" /></L>
          <L label="Nombre"><input className={supInput} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></L>
          <L label="Tipo"><select className={supInput} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></L>
          <L label="Commodity"><input className={supInput} value={f.commodity} onChange={(e) => setF({ ...f, commodity: e.target.value })} placeholder="Pasivos" /></L>
          <L label="País"><input className={supInput} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} /></L>
          <L label="Región"><select className={supInput} value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })}>{['NAM', 'LATAM', 'EMEA', 'APAC'].map((r) => <option key={r}>{r}</option>)}</select></L>
          <L label="Calificación"><select className={supInput} value={f.qualificationStatus} onChange={(e) => setF({ ...f, qualificationStatus: e.target.value })}>{QUALS.map((qz) => <option key={qz} value={qz}>{QUAL_META[qz].label}</option>)}</select></L>
          <L label="Lead time (días)"><input type="number" className={supInput} value={f.leadTimeDays} onChange={(e) => setF({ ...f, leadTimeDays: Number(e.target.value) })} /></L>
          <L label="Términos de pago"><input className={supInput} value={f.paymentTerms} onChange={(e) => setF({ ...f, paymentTerms: e.target.value })} /></L>
          <L label="SQE / comprador (email)"><input className={supInput} value={f.ownerEmail} onChange={(e) => setF({ ...f, ownerEmail: e.target.value })} /></L>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
          <button onClick={submit} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: BLUE }}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Guardar</button>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-3.5`}>
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-lg font-semibold mt-0.5 tabular-nums truncate" style={{ color }}>{value}</div>
      {sub && <div className="text-[11px] text-gray-400 truncate">{sub}</div>}
    </div>
  );
}
function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return <div><div className="text-sm font-semibold tabular-nums" style={{ color }}>{value}</div><div className="text-[10px] text-gray-400">{label}</div></div>;
}
function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-[12px] font-medium text-gray-500 mb-1">{label}</span>{children}</label>;
}
function Empty({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-6">
      <div className="p-4 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-400 mb-4">{icon}</div>
      <h3 className="font-bold text-lg mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{body}</p>
    </div>
  );
}
