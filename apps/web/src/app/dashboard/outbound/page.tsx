'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Truck,
  Plus,
  Lock,
  Loader2,
  Inbox,
  X,
  CheckCircle2,
  ArrowRight,
  ScanLine,
  FileText,
  ListChecks,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';
import { DockLoading } from './DockLoading';
import { Documents } from './Documents';
import { Content } from './Content';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const GREEN = '#10b981';
const AMBER = '#f59e0b';
const BLUE = '#3b82f6';
const GRAY = '#6b7280';
const RED = '#ef4444';

type Status = 'PACKING' | 'READY' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

interface SalesOrderLite {
  id: number;
  soNumber: string;
  customerName: string | null;
  status: string;
}
interface Shipment {
  id: string;
  folio: string | null;
  asn: string | null;
  salesOrderNumber?: string | null;
  title: string;
  customerName?: string | null;
  destination?: string | null;
  incoterm: string;
  status: Status;
  carrier?: string | null;
  trackingNumber?: string | null;
  packageCount: number;
  promisedDate?: string | null;
}

interface Kpis {
  toShip: number;
  inTransit: number;
  delivered: number;
  overdue: number;
  otdPct: number | null;
}

const STATUS_META: Record<Status, { label: string; color: string }> = {
  PACKING: { label: 'Empaque', color: GRAY },
  READY: { label: 'Listo', color: AMBER },
  SHIPPED: { label: 'Embarcado', color: BLUE },
  DELIVERED: { label: 'Entregado', color: GREEN },
  CANCELLED: { label: 'Cancelado', color: RED },
};
const NEXT: Record<Status, Status[]> = {
  PACKING: ['READY', 'CANCELLED'],
  READY: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};
const ORDER: Status[] = ['PACKING', 'READY', 'SHIPPED', 'DELIVERED'];
const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CIF', 'DAP', 'DDP', 'OTHER'];

export default function OutboundPage() {
  const { data, isLoading, forbidden, mutate } = useApi<Shipment[]>('/outbound/shipments');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/outbound/kpis');
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadingShipment, setLoadingShipment] = useState<Shipment | null>(null);
  const [docsShipment, setDocsShipment] = useState<Shipment | null>(null);
  const [contentShipment, setContentShipment] = useState<Shipment | null>(null);
  const [soPicker, setSoPicker] = useState<SalesOrderLite[] | null>(null);
  const [form, setForm] = useState({
    title: '',
    customerName: '',
    destination: '',
    incoterm: 'DAP',
    carrier: '',
    packageCount: 0,
    promisedDate: '',
  });

  const list = Array.isArray(data) ? data : [];

  function refresh() {
    mutate();
    mutateKpis();
  }

  async function openSoPicker() {
    setSoPicker([]);
    try {
      const res = await apiFetch(`${API_BASE}/outbound/sales-orders`);
      const d = await res.json().catch(() => []);
      setSoPicker(Array.isArray(d) ? d : []);
    } catch {
      setSoPicker([]);
    }
  }

  async function createFromSo(soId: number) {
    setBusy(`so-${soId}`);
    try {
      const res = await apiFetch(`${API_BASE}/outbound/from-sales-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo crear desde la OV.', 'Embarque');
        return;
      }
      toast.success('Embarque creado desde la orden de venta.', 'Embarque');
      setSoPicker(null);
      refresh();
    } catch {
      toast.error('Error de red.', 'Embarque');
    } finally {
      setBusy(null);
    }
  }

  async function createShipment() {
    if (form.title.trim().length < 3) {
      toast.error('Describe el embarque (mín. 3 caracteres).', 'Embarque');
      return;
    }
    setBusy('new');
    try {
      const res = await apiFetch(`${API_BASE}/outbound/shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, promisedDate: form.promisedDate || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo crear.', 'Embarque');
        return;
      }
      toast.success('Embarque creado.', 'Embarque');
      setShowForm(false);
      setForm({ title: '', customerName: '', destination: '', incoterm: 'DAP', carrier: '', packageCount: 0, promisedDate: '' });
      refresh();
    } catch {
      toast.error('Error de red.', 'Embarque');
    } finally {
      setBusy(null);
    }
  }

  async function transition(s: Shipment, status: Status) {
    const body: Record<string, unknown> = { status };
    if (status === 'SHIPPED') {
      const tn = window.prompt('Número de guía / tracking:', s.trackingNumber || '');
      if (tn === null) return;
      if (tn) body.trackingNumber = tn;
    }
    setBusy(s.id);
    try {
      const res = await apiFetch(`${API_BASE}/outbound/shipments/${s.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo actualizar.', 'Embarque');
        return;
      }
      toast.success(`→ ${STATUS_META[status].label}`, 'Embarque');
      refresh();
    } catch {
      toast.error('Error de red.', 'Embarque');
    } finally {
      setBusy(null);
    }
  }

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-foreground">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-400 mt-1">Inicia sesión para ver embarques.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-foreground">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgba(59,130,246,0.12)' }}>
            <Truck className="w-5 h-5" style={{ color: BLUE }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Logística · Embarque</h1>
            <p className="text-[12px] text-gray-400 leading-tight">Empaque, embarque y entrega (ASN)</p>
          </div>
          <button onClick={openSoPicker} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium" style={{ background: `${BLUE}1f`, color: BLUE }}>
            <ListChecks className="w-4 h-4" /> <span className="hidden sm:inline">Desde OV</span>
          </button>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: BLUE }}>
            <Plus className="w-4 h-4" /> Nuevo embarque
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-8 pb-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Kpi label="Por embarcar" value={kpis?.toShip ?? 0} color={AMBER} />
          <Kpi label="En tránsito" value={kpis?.inTransit ?? 0} color={BLUE} />
          <Kpi label="Vencidas" value={kpis?.overdue ?? 0} color={(kpis?.overdue ?? 0) > 0 ? RED : GREEN} />
          <Kpi label="OTD a cliente" value={kpis?.otdPct === null || kpis?.otdPct === undefined ? '—' : `${kpis.otdPct}%`} color={GREEN} />
        </div>

        {showForm && (
          <div className={`${glass} rounded-2xl p-5 mb-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Nuevo embarque</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block md:col-span-2">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Descripción</span>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="PT Modelo X — 500 pzs" className="ob-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Cliente</span>
                <input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Cliente A" className="ob-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Destino</span>
                <input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="Guadalajara, MX" className="ob-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Incoterm</span>
                <select value={form.incoterm} onChange={(e) => setForm({ ...form, incoterm: e.target.value })} className="ob-input">
                  {INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Bultos</span>
                <input type="number" min={0} value={form.packageCount} onChange={(e) => setForm({ ...form, packageCount: Number(e.target.value) })} className="ob-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Prometido</span>
                <input type="date" value={form.promisedDate} onChange={(e) => setForm({ ...form, promisedDate: e.target.value })} className="ob-input" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
              <button onClick={createShipment} disabled={busy === 'new'} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: BLUE }}>
                {busy === 'new' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Crear
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : list.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold">Sin embarques</h3>
            <p className="text-sm text-gray-400 mt-1">Crea el primer embarque para seguir el OTD a cliente.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {ORDER.map((status) => {
              const items = list.filter((s) => s.status === status);
              if (items.length === 0) return null;
              return (
                <section key={status}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_META[status].color }} />
                    <h2 className="text-sm font-semibold">{STATUS_META[status].label}</h2>
                    <span className="text-[11px] text-gray-400">({items.length})</span>
                  </div>
                  <div className="space-y-3">
                    {items.map((s) => {
                      // Comparar por DÍA local: promisedDate es fecha-sólo (YYYY-MM-DD);
                      // parsearla como medianoche LOCAL evita marcar "vencida" un embarque
                      // que aún vence hoy en zonas UTC negativas (p. ej. México, UTC-6).
                      const overdue = (s.status === 'PACKING' || s.status === 'READY') && !!s.promisedDate && (() => {
                        const d = new Date(`${String(s.promisedDate).slice(0, 10)}T00:00:00`);
                        if (Number.isNaN(d.getTime())) return false;
                        const t = new Date(); t.setHours(0, 0, 0, 0);
                        return d.getTime() < t.getTime();
                      })();
                      return (
                        <div key={s.id} className={`${glass} rounded-2xl p-4`}>
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {s.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{s.folio}</span>}
                                {s.asn && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: `${BLUE}1f`, color: BLUE }}>{s.asn}</span>}
                                {s.salesOrderNumber && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: `${GREEN}1f`, color: GREEN }}>{s.salesOrderNumber}</span>}
                                <span className="font-semibold truncate">{s.title}</span>
                                {overdue && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${RED}1f`, color: RED }}>vencida</span>}
                              </div>
                              <div className="mt-1 flex items-center gap-3 text-[12px] text-gray-400 flex-wrap">
                                {s.customerName && <><span>{s.customerName}</span><span>•</span></>}
                                {s.destination && <><span>{s.destination}</span><span>•</span></>}
                                <span>{s.incoterm}</span>
                                {s.packageCount > 0 && <><span>•</span><span>{s.packageCount} bultos</span></>}
                                {s.trackingNumber && <><span>•</span><span>{s.trackingNumber}</span></>}
                                {s.promisedDate && <><span>•</span><span>prom. {new Date(s.promisedDate).toLocaleDateString()}</span></>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {s.status !== 'CANCELLED' && (
                                <button
                                  onClick={() => setContentShipment(s)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium"
                                  style={{ background: `${GRAY}1f`, color: GRAY }}
                                  title="Contenido del embarque (líneas de PT)"
                                >
                                  <ListChecks className="w-3 h-3" /> Contenido
                                </button>
                              )}
                              {s.status !== 'CANCELLED' && (
                                <button
                                  onClick={() => setDocsShipment(s)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium"
                                  style={{ background: `${GRAY}1f`, color: GRAY }}
                                  title="ASN y lista de empaque"
                                >
                                  <FileText className="w-3 h-3" /> Docs
                                </button>
                              )}
                              {(s.status === 'PACKING' || s.status === 'READY') && (
                                <button
                                  onClick={() => setLoadingShipment(s)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium"
                                  style={{ background: `${BLUE}1f`, color: BLUE }}
                                  title="Carga verificada por escaneo (SSCC)"
                                >
                                  <ScanLine className="w-3 h-3" /> Carga
                                </button>
                              )}
                              {NEXT[s.status].map((to) => (
                                <button
                                  key={to}
                                  onClick={() => transition(s, to)}
                                  disabled={busy === s.id}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50"
                                  style={{ background: `${STATUS_META[to].color}1f`, color: STATUS_META[to].color }}
                                  title={`Mover a ${STATUS_META[to].label}`}
                                >
                                  {to === 'CANCELLED' ? <X className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                                  {STATUS_META[to].label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {loadingShipment && (
        <DockLoading
          shipment={loadingShipment}
          onClose={() => setLoadingShipment(null)}
          onChanged={refresh}
        />
      )}

      {docsShipment && (
        <Documents shipment={docsShipment} onClose={() => setDocsShipment(null)} />
      )}

      {contentShipment && (
        <Content shipment={contentShipment} onClose={() => { setContentShipment(null); refresh(); }} />
      )}

      {soPicker !== null && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/40 p-4" onClick={() => setSoPicker(null)}>
          <div className={`${glass} rounded-2xl p-5 w-full max-w-md max-h-[80vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Embarcar desde orden de venta</h3>
              <button onClick={() => setSoPicker(null)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
            </div>
            {soPicker.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">No hay órdenes de venta embarcables (confirmadas o en producción).</p>
            ) : (
              <div className="space-y-2">
                {soPicker.map((so) => (
                  <div key={so.id} className={`${glass} rounded-xl p-3 flex items-center gap-3`}>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium truncate">{so.soNumber}</div>
                      <div className="text-[11px] text-gray-400 truncate">{so.customerName ?? '—'} · {so.status}</div>
                    </div>
                    <button onClick={() => createFromSo(so.id)} disabled={busy === `so-${so.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white disabled:opacity-60" style={{ background: BLUE }}>
                      {busy === `so-${so.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Crear
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        .ob-input {
          width: 100%;
          border-radius: 0.75rem;
          padding: 0.55rem 0.75rem;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.08);
          outline: none;
          font-size: 0.875rem;
        }
        .ob-input:focus { border-color: #3b82f6; }
        :global(.dark) .ob-input {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-2xl font-semibold mt-1" style={{ color }}>{value}</div>
    </div>
  );
}
