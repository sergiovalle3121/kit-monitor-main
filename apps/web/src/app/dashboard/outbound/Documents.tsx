'use client';

// Documentos de embarque — ASN + lista de empaque (Fase 2c) y BOL + Carta Porte +
// factura comercial (Fase #1 docs). Cada documento se arma en el backend
// (GET /outbound/shipments/:id/{packing-list,asn,bol,carta-porte,invoice}); aquí se
// muestran y se descargan/imprimen (EDI 856, CSV, o impresión a PDF del navegador).
import React, { useState } from 'react';
import { Boxes, Download, FileText, Layers, Loader2, Package, Printer, ScanLine, Settings, ShieldCheck, Truck, X } from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { FiscalConfig } from './FiscalConfig';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const BLUE = '#3b82f6';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const GRAY = '#6b7280';

interface AsnLine { partNumber: string; quantity: number; serials: string[]; }
interface AsnPack { id: string; sscc: string | null; type: string; loaded: boolean; weightKg: number | null; lines: AsnLine[]; }
interface AsnTare extends AsnPack { packs: AsnPack[]; }
interface Asn {
  asn: string | null; folio: string | null; incoterm: string; carrier: string | null; tracking: string | null;
  shipTo: { name: string | null; destination: string | null };
  hierarchy: AsnTare[];
  totals: { tares: number; packs: number; units: number; pieces: number; parts: number; weightKg: number; loaded: number };
}
interface PackingRow { sscc: string | null; type: string; partNumber: string; quantity: number; serials: string[]; loaded: boolean; }
interface PackingList { rows: PackingRow[]; totals: { units: number; pieces: number; parts: number; weightKg: number }; }
interface Bol {
  bolNumber: string | null; date: string; shipTo: { name: string | null; address: string | null };
  carrier: string | null; vehicle: { plate: string | null; type: string | null }; driver: string | null; dock: string | null;
  freightTerms: string; tracking: string | null;
  items: { partNumber: string; description: string | null; quantity: number; uom: string; lotNumber: string | null }[];
  totals: { packages: number; pieces: number; weightKg: number }; requiresConfig: string[];
}
interface CartaPorte {
  version: string; idCCP: string | null; fecha: string;
  receptor: { nombre: string | null; rfc: string | null; domicilio: string | null };
  transporte: { transportista: string | null; placaVM: string | null; unidad: string | null; operador: string | null };
  mercancias: { descripcion: string; cantidad: number; claveUnidad: string; lote: string | null }[];
  pesoBrutoTotal: number; numTotalMercancias: number; requiresConfig: string[]; note: string;
}
interface InvLine { partNumber: string; description: string | null; quantity: number; uom: string; unitPrice: number; amount: number; }
interface CommercialInvoice {
  invoiceNumber: string | null; date: string; buyer: { name: string | null; address: string | null };
  incoterm: string; currency: string; lines: InvLine[]; subtotal: number; total: number; requiresConfig: string[];
}

interface CocItem { partNumber: string; description: string | null; lotNumber: string | null; quantity: number; uom: string; }
interface Coc {
  certNumber: string | null; date: string; customer: string | null; destination: string | null; poRef: string | null;
  statement: string; items: CocItem[]; serials: string[]; totals: { lines: number; pieces: number }; requiresConfig: string[];
}

type Tab = 'packing' | 'asn' | 'bol' | 'carta' | 'factura' | 'coc';
const TYPE_LABEL: Record<string, string> = { PALLET: 'Tarima', CARTON: 'Caja', BOX: 'Bulto' };

async function download(path: string, filename: string) {
  try {
    const res = await apiFetch(`${API_BASE}${path}`);
    const text = await res.text();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  } catch { /* ignore */ }
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
const v = (s: unknown) => (s === null || s === undefined || s === '' ? '—' : esc(s));

function printDoc(title: string, bodyHtml: string) {
  const w = window.open('', '_blank', 'width=860,height=920');
  if (!w) return;
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>` +
      `body{font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;color:#111;padding:36px;font-size:13px;line-height:1.4}` +
      `h1{font-size:20px;margin:0 0 2px}.sub{color:#777;margin:0 0 16px;font-size:12px}` +
      `h2{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#666;margin:18px 0 6px}` +
      `table{width:100%;border-collapse:collapse;margin-top:4px}th,td{border:1px solid #e2e2e2;padding:6px 9px;text-align:left;font-size:12px}th{background:#f6f6f6}` +
      `.row{display:flex;gap:40px;flex-wrap:wrap}.row>div{min-width:200px}.k{color:#888}.tot{text-align:right;font-weight:600}` +
      `.warn{margin-top:20px;padding:10px 12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;color:#9a3412;font-size:11px}` +
      `</style></head><body>${bodyHtml}<script>window.onload=function(){setTimeout(function(){window.print()},150)}<\/script></body></html>`,
  );
  w.document.close();
}

const warnHtml = (items: string[]) =>
  items.length ? `<div class="warn"><strong>Requiere configuración:</strong> ${items.map(esc).join(' · ')}</div>` : '';

export function Documents({
  shipment,
  onClose,
}: {
  shipment: { id: string; folio: string | null; title: string };
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('packing');
  const [fiscalOpen, setFiscalOpen] = useState(false);
  const id = shipment.id;
  const { data: pl } = useApi<PackingList>(tab === 'packing' ? `/outbound/shipments/${id}/packing-list` : null);
  const { data: asn } = useApi<Asn>(tab === 'asn' ? `/outbound/shipments/${id}/asn` : null);
  const { data: bol } = useApi<Bol>(tab === 'bol' ? `/outbound/shipments/${id}/bol` : null);
  const { data: carta } = useApi<CartaPorte>(tab === 'carta' ? `/outbound/shipments/${id}/carta-porte` : null);
  const { data: inv } = useApi<CommercialInvoice>(tab === 'factura' ? `/outbound/shipments/${id}/invoice` : null);
  const { data: coc } = useApi<Coc>(tab === 'coc' ? `/outbound/shipments/${id}/coc` : null);
  const base = shipment.folio ?? id;

  function printBol(b: Bol) {
    const rows = b.items.map((i) => `<tr><td>${v(i.partNumber)}</td><td>${v(i.description)}</td><td>${v(i.quantity)} ${v(i.uom)}</td><td>${v(i.lotNumber)}</td></tr>`).join('');
    printDoc(`BOL ${base}`,
      `<h1>Bill of Lading</h1><p class="sub">${v(b.bolNumber)} · ${v(b.date)}</p>` +
      `<div class="row"><div><h2>Consignatario</h2>${v(b.shipTo.name)}<br>${v(b.shipTo.address)}</div>` +
      `<div><h2>Transporte</h2><span class="k">Transportista:</span> ${v(b.carrier)}<br><span class="k">Unidad:</span> ${v(b.vehicle.plate)} (${v(b.vehicle.type)})<br><span class="k">Operador:</span> ${v(b.driver)}<br><span class="k">Andén:</span> ${v(b.dock)} · <span class="k">Guía:</span> ${v(b.tracking)} · <span class="k">Flete:</span> ${v(b.freightTerms)}</div></div>` +
      `<h2>Mercancía</h2><table><thead><tr><th>Parte</th><th>Descripción</th><th>Cantidad</th><th>Lote</th></tr></thead><tbody>${rows}</tbody></table>` +
      `<p style="margin-top:10px">Bultos: <strong>${b.totals.packages}</strong> · Piezas: <strong>${b.totals.pieces}</strong> · Peso: <strong>${b.totals.weightKg} kg</strong></p>` +
      warnHtml(b.requiresConfig));
  }
  function printCarta(c: CartaPorte) {
    const rows = c.mercancias.map((m) => `<tr><td>${v(m.descripcion)}</td><td>${v(m.cantidad)}</td><td>${v(m.claveUnidad)}</td><td>${v(m.lote)}</td></tr>`).join('');
    printDoc(`Carta Porte ${base}`,
      `<h1>Carta Porte <span style="font-size:12px;color:#777">CFDI ${v(c.version)}</span></h1><p class="sub">IdCCP ${v(c.idCCP)} · ${v(c.fecha)} · Traslado</p>` +
      `<div class="row"><div><h2>Receptor</h2>${v(c.receptor.nombre)}<br>${v(c.receptor.domicilio)}<br><span class="k">RFC:</span> ${v(c.receptor.rfc)}</div>` +
      `<div><h2>Autotransporte</h2><span class="k">Transportista:</span> ${v(c.transporte.transportista)}<br><span class="k">Placa:</span> ${v(c.transporte.placaVM)} · <span class="k">Unidad:</span> ${v(c.transporte.unidad)}<br><span class="k">Operador:</span> ${v(c.transporte.operador)}</div></div>` +
      `<h2>Mercancías (peso bruto ${c.pesoBrutoTotal} kg · ${c.numTotalMercancias})</h2><table><thead><tr><th>Descripción</th><th>Cantidad</th><th>Clave unidad</th><th>Lote</th></tr></thead><tbody>${rows}</tbody></table>` +
      `<p class="sub" style="margin-top:12px">${esc(c.note)}</p>` + warnHtml(c.requiresConfig));
  }
  function printInvoice(f: CommercialInvoice) {
    const rows = f.lines.map((l) => `<tr><td>${v(l.partNumber)}</td><td>${v(l.description)}</td><td>${v(l.quantity)} ${v(l.uom)}</td><td class="tot">${l.unitPrice.toFixed(2)}</td><td class="tot">${l.amount.toFixed(2)}</td></tr>`).join('');
    printDoc(`Factura ${base}`,
      `<h1>Factura comercial</h1><p class="sub">${v(f.invoiceNumber)} · ${v(f.date)} · ${v(f.incoterm)} · ${v(f.currency)}</p>` +
      `<h2>Cliente</h2>${v(f.buyer.name)}<br>${v(f.buyer.address)}` +
      `<h2>Conceptos</h2><table><thead><tr><th>Parte</th><th>Descripción</th><th>Cantidad</th><th class="tot">P. unitario</th><th class="tot">Importe</th></tr></thead><tbody>${rows}` +
      `<tr><td colspan="4" class="tot">Total (${esc(f.currency)})</td><td class="tot">${f.total.toFixed(2)}</td></tr></tbody></table>` +
      warnHtml(f.requiresConfig));
  }
  function printCoc(c: Coc) {
    const rows = c.items.map((i) => `<tr><td>${v(i.partNumber)}</td><td>${v(i.description)}</td><td>${v(i.lotNumber)}</td><td>${v(i.quantity)} ${v(i.uom)}</td></tr>`).join('');
    const serials = c.serials.length ? `<h2>Series (${c.serials.length})</h2><p style="font-family:monospace;font-size:11px">${c.serials.map(esc).join(', ')}</p>` : '';
    printDoc(`CoC ${base}`,
      `<h1>Certificado de Conformancia</h1><p class="sub">${v(c.certNumber)} · ${v(c.date)}</p>` +
      `<div class="row"><div><h2>Cliente</h2>${v(c.customer)}<br>${v(c.destination)}</div><div><h2>Referencia</h2><span class="k">OV:</span> ${v(c.poRef)}</div></div>` +
      `<p style="margin-top:14px">${esc(c.statement)}</p>` +
      `<h2>Productos</h2><table><thead><tr><th>Parte</th><th>Descripción</th><th>Lote</th><th>Cantidad</th></tr></thead><tbody>${rows}</tbody></table>` +
      serials + warnHtml(c.requiresConfig));
  }

  return (
    <>
    <div className="fixed inset-0 z-[120] flex justify-end bg-black/40" onClick={onClose}>
      <div className={`${glass} h-full w-full max-w-lg overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 px-5 py-4 flex items-center gap-3 backdrop-blur" style={{ background: 'rgba(0,0,0,0.02)' }}>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: `${BLUE}1f` }}>
            <FileText className="w-5 h-5" style={{ color: BLUE }} />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold leading-tight truncate">Documentos de embarque</h2>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-tight truncate">{shipment.folio ? `${shipment.folio} · ` : ''}{shipment.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 pt-4 flex gap-1.5 flex-wrap">
          <TabBtn active={tab === 'packing'} onClick={() => setTab('packing')} icon={<Package className="w-4 h-4" />}>Empaque</TabBtn>
          <TabBtn active={tab === 'asn'} onClick={() => setTab('asn')} icon={<Layers className="w-4 h-4" />}>ASN</TabBtn>
          <TabBtn active={tab === 'bol'} onClick={() => setTab('bol')} icon={<Truck className="w-4 h-4" />}>BOL</TabBtn>
          <TabBtn active={tab === 'carta'} onClick={() => setTab('carta')} icon={<FileText className="w-4 h-4" />}>Carta Porte</TabBtn>
          <TabBtn active={tab === 'factura'} onClick={() => setTab('factura')} icon={<FileText className="w-4 h-4" />}>Factura</TabBtn>
          <TabBtn active={tab === 'coc'} onClick={() => setTab('coc')} icon={<ShieldCheck className="w-4 h-4" />}>CoC</TabBtn>
        </div>

        <div className="px-5 py-4">
          {tab === 'packing' && (!pl ? <Spinner /> : pl.rows.length === 0 ? <EmptyDocs /> : (
            <>
              <div className="flex items-center justify-between mb-3">
                <Totals items={[`${pl.totals.units} unidades`, `${pl.totals.pieces} pzs`, `${pl.totals.parts} partes`, `${pl.totals.weightKg} kg`]} />
                <button onClick={() => download(`/outbound/shipments/${id}/packing-list.csv`, `${base}-packing.csv`)} className="btn-doc"><Download className="w-3.5 h-3.5" /> CSV</button>
              </div>
              <div className="space-y-1.5">
                {pl.rows.map((r, i) => (
                  <div key={i} className={`${glass} rounded-xl p-2.5 flex items-center gap-2.5`}>
                    <span className="w-6 h-6 rounded-md grid place-items-center flex-shrink-0" style={{ background: r.loaded ? `${GREEN}1f` : `${GRAY}1f`, color: r.loaded ? GREEN : GRAY }}><Package className="w-3.5 h-3.5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium truncate">{r.partNumber} <span className="text-gray-500 dark:text-gray-400 font-normal">×{r.quantity}</span></div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate font-mono">{r.sscc ?? '—'} · {TYPE_LABEL[r.type] ?? r.type}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ))}

          {tab === 'asn' && (!asn ? <Spinner /> : asn.hierarchy.length === 0 ? <EmptyDocs /> : (
            <>
              <div className={`${glass} rounded-xl p-3 mb-3`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: `${BLUE}1f`, color: BLUE }}>{asn.asn ?? 'ASN: se asigna al embarcar'}</span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">{asn.incoterm}</span>
                </div>
                <div className="grid grid-cols-2 gap-y-1 text-[12px]">
                  <Field label="Cliente" value={asn.shipTo.name} /><Field label="Destino" value={asn.shipTo.destination} />
                  <Field label="Transportista" value={asn.carrier} /><Field label="Guía" value={asn.tracking} />
                </div>
                <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/10">
                  <Totals items={[`${asn.totals.tares} tarimas`, `${asn.totals.packs} cajas`, `${asn.totals.pieces} pzs`, `${asn.totals.loaded}/${asn.totals.units} cargadas`]} />
                </div>
              </div>
              <div className="flex justify-end mb-3">
                <button onClick={() => download(`/outbound/shipments/${id}/asn.edi`, `${base}-asn.edi`)} className="btn-doc"><Download className="w-3.5 h-3.5" /> EDI 856</button>
              </div>
              <div className="space-y-2">
                {asn.hierarchy.map((tare) => (
                  <div key={tare.id} className={`${glass} rounded-xl p-3`}>
                    <UnitHead sscc={tare.sscc} type={tare.type} loaded={tare.loaded} icon={<Layers className="w-3.5 h-3.5" />} />
                    {tare.lines.map((l, i) => <LineRow key={i} line={l} />)}
                    {tare.packs.length > 0 && (
                      <div className="mt-2 pl-3 border-l-2 border-black/5 dark:border-white/10 space-y-2">
                        {tare.packs.map((p) => (<div key={p.id}><UnitHead sscc={p.sscc} type={p.type} loaded={p.loaded} icon={<Boxes className="w-3.5 h-3.5" />} />{p.lines.map((l, i) => <LineRow key={i} line={l} />)}</div>))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ))}

          {tab === 'bol' && (!bol ? <Spinner /> : (
            <DocView onPrint={() => printBol(bol)} fields={[['Consignatario', bol.shipTo.name], ['Destino', bol.shipTo.address], ['Transportista', bol.carrier], ['Unidad', bol.vehicle.plate], ['Operador', bol.driver], ['Guía', bol.tracking]]}
              totals={[`${bol.totals.packages} bultos`, `${bol.totals.pieces} pzs`, `${bol.totals.weightKg} kg`]} requiresConfig={bol.requiresConfig} />
          ))}

          {tab === 'carta' && (!carta ? <Spinner /> : (
            <>
              <div className="flex justify-end gap-2 mb-3">
                <button onClick={() => download(`/outbound/shipments/${id}/carta-porte.xml`, `${base}-cartaporte.xml`)} className="btn-doc"><Download className="w-3.5 h-3.5" /> XML CFDI</button>
                <button onClick={() => setFiscalOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium" style={{ background: `${GRAY}1f`, color: GRAY }}><Settings className="w-3.5 h-3.5" /> Perfil fiscal</button>
              </div>
              <DocView onPrint={() => printCarta(carta)} fields={[['Receptor', carta.receptor.nombre], ['Domicilio', carta.receptor.domicilio], ['Transportista', carta.transporte.transportista], ['Placa', carta.transporte.placaVM], ['Operador', carta.transporte.operador], ['CFDI', `Carta Porte ${carta.version}`]]}
                totals={[`${carta.numTotalMercancias} mercancías`, `${carta.pesoBrutoTotal} kg bruto`]} requiresConfig={carta.requiresConfig} note={carta.note} />
            </>
          ))}

          {tab === 'factura' && (!inv ? <Spinner /> : (
            <DocView onPrint={() => printInvoice(inv)} fields={[['Cliente', inv.buyer.name], ['Destino', inv.buyer.address], ['Incoterm', inv.incoterm], ['Moneda', inv.currency], ['Folio', inv.invoiceNumber]]}
              totals={[`${inv.lines.length} conceptos`, `Total ${inv.total.toFixed(2)} ${inv.currency}`]} requiresConfig={inv.requiresConfig} />
          ))}

          {tab === 'coc' && (!coc ? <Spinner /> : (
            <DocView onPrint={() => printCoc(coc)} fields={[['Cliente', coc.customer], ['Destino', coc.destination], ['Folio', coc.certNumber], ['Ref OV', coc.poRef]]}
              totals={[`${coc.totals.lines} líneas`, `${coc.totals.pieces} pzs`, `${coc.serials.length} series`]} requiresConfig={coc.requiresConfig} note={coc.statement} />
          ))}
        </div>

        <style jsx global>{`
          .btn-doc { display:inline-flex; align-items:center; gap:.35rem; padding:.4rem .8rem; border-radius:.5rem; font-size:12px; font-weight:600; color:#fff; background:${BLUE}; }
        `}</style>
      </div>
    </div>
    {fiscalOpen && <FiscalConfig onClose={() => setFiscalOpen(false)} />}
    </>
  );
}

function DocView({ fields, totals, requiresConfig, note, onPrint }: { fields: [string, string | null][]; totals: string[]; requiresConfig: string[]; note?: string; onPrint: () => void }) {
  return (
    <>
      <div className="flex justify-end mb-3">
        <button onClick={onPrint} className="btn-doc"><Printer className="w-3.5 h-3.5" /> Imprimir / PDF</button>
      </div>
      <div className={`${glass} rounded-xl p-3`}>
        <div className="grid grid-cols-2 gap-y-1.5 text-[12px]">
          {fields.map(([k, val]) => <Field key={k} label={k} value={val} />)}
        </div>
        <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/10"><Totals items={totals} /></div>
      </div>
      {note && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3">{note}</p>}
      {requiresConfig.length > 0 && (
        <div className="mt-3 rounded-xl p-3 text-[12px]" style={{ background: `${AMBER}14`, color: '#9a3412' }}>
          <div className="font-semibold mb-1">Requiere configuración</div>
          <ul className="list-disc pl-4 space-y-0.5">{requiresConfig.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      )}
    </>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors" style={active ? { background: `${BLUE}1f`, color: BLUE } : { color: GRAY }}>{icon} {children}</button>
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
      <span className="font-medium">{line.partNumber}</span><span className="text-gray-500 dark:text-gray-400">×{line.quantity}</span>
      {line.serials.length > 0 && <span className="text-[10px] text-gray-500 dark:text-gray-400">({line.serials.length} series)</span>}
    </div>
  );
}
function Field({ label, value }: { label: string; value: string | null }) {
  return (<div className="min-w-0"><span className="text-gray-500 dark:text-gray-400">{label}: </span><span className="font-medium">{value || '—'}</span></div>);
}
function Totals({ items }: { items: string[] }) {
  return (
    <div className="flex items-center gap-2 flex-wrap text-[11px] text-gray-500 dark:text-gray-400">
      {items.map((t, i) => (<React.Fragment key={i}>{i > 0 && <span className="text-gray-300 dark:text-gray-600">·</span>}<span>{t}</span></React.Fragment>))}
    </div>
  );
}
function Spinner() { return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-500 dark:text-gray-400" /></div>; }
function EmptyDocs() {
  return (
    <div className="text-center py-16">
      <ScanLine className="w-8 h-8 mx-auto mb-3 text-gray-500 dark:text-gray-400" />
      <p className="text-sm font-medium">Sin contenido todavía</p>
      <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">Agrega contenido y unidades de manejo (SSCC) para generar los documentos.</p>
    </div>
  );
}
