'use client';

// Documentos de embarque (Fase 2c) — ASN + lista de empaque armados desde la carga
// verificada. Muestra la jerarquía SSCC (tarima → caja → ítem) y la lista plana, y
// permite descargar el EDI 856 (ASN) y el CSV (packing list). Lee
// GET /outbound/shipments/:id/{asn,packing-list}; descarga los .edi/.csv.
import React, { useState } from 'react';
import { Boxes, Download, FileText, Layers, Loader2, Package, ScanLine, X } from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const BLUE = '#3b82f6';
const GREEN = '#10b981';
const GRAY = '#6b7280';

interface AsnLine { partNumber: string; quantity: number; serials: string[]; }
interface AsnPack { id: string; sscc: string | null; type: string; loaded: boolean; weightKg: number | null; lines: AsnLine[]; }
interface AsnTare extends AsnPack { packs: AsnPack[]; }
interface Asn {
  asn: string | null;
  folio: string | null;
  shipDate: string | null;
  shipTo: { name: string | null; destination: string | null };
  carrier: string | null;
  tracking: string | null;
  incoterm: string;
  status: string;
  hierarchy: AsnTare[];
  totals: { tares: number; packs: number; units: number; pieces: number; parts: number; weightKg: number; loaded: number };
}
interface PackingRow { sscc: string | null; type: string; partNumber: string; quantity: number; serials: string[]; weightKg: number | null; loaded: boolean; }
interface PackingList {
  folio: string | null;
  customer: string | null;
  destination: string | null;
  date: string;
  rows: PackingRow[];
  totals: { units: number; pieces: number; parts: number; weightKg: number };
}

const TYPE_LABEL: Record<string, string> = { PALLET: 'Tarima', CARTON: 'Caja', BOX: 'Bulto' };

async function download(path: string, filename: string) {
  try {
    const res = await apiFetch(`${API_BASE}${path}`);
    const text = await res.text();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    /* ignore */
  }
}

export function Documents({
  shipment,
  onClose,
}: {
  shipment: { id: string; folio: string | null; title: string };
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'packing' | 'asn'>('packing');
  const { data: asn, isLoading: la } = useApi<Asn>(`/outbound/shipments/${shipment.id}/asn`);
  const { data: pl, isLoading: lp } = useApi<PackingList>(`/outbound/shipments/${shipment.id}/packing-list`);
  const base = shipment.folio ?? shipment.id;

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-black/40" onClick={onClose}>
      <div className={`${glass} h-full w-full max-w-lg overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 px-5 py-4 flex items-center gap-3 backdrop-blur" style={{ background: 'rgba(0,0,0,0.02)' }}>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: `${BLUE}1f` }}>
            <FileText className="w-5 h-5" style={{ color: BLUE }} />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold leading-tight truncate">Documentos de embarque</h2>
            <p className="text-[12px] text-gray-400 leading-tight truncate">
              {shipment.folio ? `${shipment.folio} · ` : ''}{shipment.title}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-4 flex gap-1.5">
          <TabBtn active={tab === 'packing'} onClick={() => setTab('packing')} icon={<Package className="w-4 h-4" />}>Lista de empaque</TabBtn>
          <TabBtn active={tab === 'asn'} onClick={() => setTab('asn')} icon={<Layers className="w-4 h-4" />}>ASN</TabBtn>
        </div>

        <div className="px-5 py-4">
          {tab === 'packing' ? (
            lp && !pl ? (
              <Spinner />
            ) : !pl || pl.rows.length === 0 ? (
              <EmptyDocs />
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <Totals items={[`${pl.totals.units} unidades`, `${pl.totals.pieces} pzs`, `${pl.totals.parts} partes`, `${pl.totals.weightKg} kg`]} />
                  <button onClick={() => download(`/outbound/shipments/${shipment.id}/packing-list.csv`, `${base}-packing.csv`)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white" style={{ background: BLUE }}>
                    <Download className="w-3.5 h-3.5" /> CSV
                  </button>
                </div>
                <div className="space-y-1.5">
                  {pl.rows.map((r, i) => (
                    <div key={i} className={`${glass} rounded-xl p-2.5 flex items-center gap-2.5`}>
                      <span className="w-6 h-6 rounded-md grid place-items-center flex-shrink-0" style={{ background: r.loaded ? `${GREEN}1f` : `${GRAY}1f`, color: r.loaded ? GREEN : GRAY }}>
                        <Package className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium truncate">{r.partNumber} <span className="text-gray-400 font-normal">×{r.quantity}</span></div>
                        <div className="text-[11px] text-gray-400 truncate font-mono">{r.sscc ?? '—'} · {TYPE_LABEL[r.type] ?? r.type}{r.serials.length ? ` · ${r.serials.length} series` : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )
          ) : la && !asn ? (
            <Spinner />
          ) : !asn || asn.hierarchy.length === 0 ? (
            <EmptyDocs />
          ) : (
            <>
              {/* ASN header */}
              <div className={`${glass} rounded-xl p-3 mb-3`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: `${BLUE}1f`, color: BLUE }}>
                    {asn.asn ?? 'ASN: se asigna al embarcar'}
                  </span>
                  <span className="text-[11px] text-gray-400">{asn.incoterm}</span>
                </div>
                <div className="grid grid-cols-2 gap-y-1 text-[12px]">
                  <Field label="Cliente" value={asn.shipTo.name} />
                  <Field label="Destino" value={asn.shipTo.destination} />
                  <Field label="Transportista" value={asn.carrier} />
                  <Field label="Guía" value={asn.tracking} />
                </div>
                <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/10">
                  <Totals items={[`${asn.totals.tares} tarimas`, `${asn.totals.packs} cajas`, `${asn.totals.pieces} pzs`, `${asn.totals.loaded}/${asn.totals.units} cargadas`]} />
                </div>
              </div>

              <div className="flex justify-end mb-3">
                <button onClick={() => download(`/outbound/shipments/${shipment.id}/asn.edi`, `${base}-asn.edi`)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white" style={{ background: BLUE }}>
                  <Download className="w-3.5 h-3.5" /> EDI 856
                </button>
              </div>

              {/* Hierarchy */}
              <div className="space-y-2">
                {asn.hierarchy.map((tare) => (
                  <div key={tare.id} className={`${glass} rounded-xl p-3`}>
                    <UnitHead sscc={tare.sscc} type={tare.type} loaded={tare.loaded} icon={<Layers className="w-3.5 h-3.5" />} />
                    {tare.lines.map((l, i) => <LineRow key={i} line={l} />)}
                    {tare.packs.length > 0 && (
                      <div className="mt-2 pl-3 border-l-2 border-black/5 dark:border-white/10 space-y-2">
                        {tare.packs.map((p) => (
                          <div key={p.id}>
                            <UnitHead sscc={p.sscc} type={p.type} loaded={p.loaded} icon={<Boxes className="w-3.5 h-3.5" />} />
                            {p.lines.map((l, i) => <LineRow key={i} line={l} />)}
                          </div>
                        ))}
                      </div>
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

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors" style={active ? { background: `${BLUE}1f`, color: BLUE } : { color: GRAY }}>
      {icon} {children}
    </button>
  );
}
function UnitHead({ sscc, type, loaded, icon }: { sscc: string | null; type: string; loaded: boolean; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 h-6 rounded-md grid place-items-center flex-shrink-0" style={{ background: `${BLUE}14`, color: BLUE }}>{icon}</span>
      <span className="font-mono text-[12px] truncate">{sscc ?? '—'}</span>
      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${GRAY}1f`, color: GRAY }}>{TYPE_LABEL[type] ?? type}</span>
      {loaded && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${GREEN}1f`, color: GREEN }}>cargada</span>}
    </div>
  );
}
function LineRow({ line }: { line: AsnLine }) {
  return (
    <div className="mt-1 ml-8 text-[12px] flex items-center gap-2">
      <span className="font-medium">{line.partNumber}</span>
      <span className="text-gray-400">×{line.quantity}</span>
      {line.serials.length > 0 && <span className="text-[10px] text-gray-400">({line.serials.length} series)</span>}
    </div>
  );
}
function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <span className="text-gray-400">{label}: </span>
      <span className="font-medium">{value || '—'}</span>
    </div>
  );
}
function Totals({ items }: { items: string[] }) {
  return (
    <div className="flex items-center gap-2 flex-wrap text-[11px] text-gray-500 dark:text-gray-400">
      {items.map((t, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-gray-300 dark:text-gray-600">·</span>}
          <span>{t}</span>
        </React.Fragment>
      ))}
    </div>
  );
}
function Spinner() {
  return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
}
function EmptyDocs() {
  return (
    <div className="text-center py-16">
      <ScanLine className="w-8 h-8 mx-auto mb-3 text-gray-400" />
      <p className="text-sm font-medium">Sin contenido todavía</p>
      <p className="text-[13px] text-gray-400 mt-1 max-w-xs mx-auto">
        Crea las unidades de manejo (SSCC) de este embarque en <span className="font-medium">Empaque</span> para generar el ASN y la lista de empaque.
      </p>
    </div>
  );
}
