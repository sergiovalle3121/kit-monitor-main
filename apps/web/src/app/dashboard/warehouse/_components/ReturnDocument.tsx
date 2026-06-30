'use client';

import React from 'react';
import { Printer, X } from 'lucide-react';
import { type MaterialReturn, fmtQty, fmtTime } from './shared';

/**
 * Documento/etiqueta de devolución imprimible. Vía honesta de "Imprimir / Guardar
 * como PDF" del navegador (no hay backend de PDF): en `@media print` se oculta
 * todo salvo `.axos-doc`. Estilo local al carril de almacén para respetar el
 * límite del módulo (mismo precedente que Reportes).
 */
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  .axos-doc, .axos-doc * { visibility: visible !important; }
  .axos-doc {
    position: absolute !important; left: 0 !important; top: 0 !important;
    width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important;
    background: #ffffff !important; color: #000000 !important;
    -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
  }
  .axos-no-print { display: none !important; }
  @page { margin: 16mm; }
}
`;

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="border border-gray-300 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-sm font-medium text-black">{value === null || value === undefined || value === '' ? '—' : value}</div>
    </div>
  );
}

export function ReturnDocument({ ret, onClose }: { ret: MaterialReturn; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-auto bg-black/50 p-4 backdrop-blur-sm">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="axos-doc w-full max-w-3xl rounded-2xl bg-white p-8 text-black shadow-2xl">
        {/* Controles (no se imprimen) */}
        <div className="axos-no-print mb-6 flex items-center justify-between">
          <span className="text-sm text-gray-500">Documento de devolución</span>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-black px-3.5 py-2 text-sm font-medium text-white">
              <Printer className="h-4 w-4" /> Imprimir / PDF
            </button>
            <button aria-label="Cerrar" onClick={onClose} className="rounded-lg p-2 hover:bg-black/5"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Encabezado */}
        <div className="flex items-start justify-between border-b-2 border-black pb-4">
          <div>
            <div className="text-2xl font-bold tracking-tight">DEVOLUCIÓN DE MATERIAL</div>
            <div className="text-sm text-gray-600">Return to Stock · AXOS OS — Almacén</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Folio</div>
            <div className="font-mono text-xl font-bold">{ret.returnNumber}</div>
          </div>
        </div>

        {/* Líneas del documento */}
        <div className="mt-6 grid grid-cols-2 gap-px bg-gray-300 sm:grid-cols-3">
          <Field label="Parte" value={ret.partNumber} />
          <Field label="Descripción" value={ret.description} />
          <Field label="Cantidad" value={`${fmtQty(ret.quantity)} ${ret.uom || ''}`.trim()} />
          <Field label="Batch / Lote" value={ret.batch} />
          <Field label="Vendor" value={ret.vendor} />
          <Field label="Proyecto" value={ret.project} />
          <Field label="Origen" value={ret.fromLocation} />
          <Field label="Almacén destino" value={ret.toWarehouseId} />
          <Field label="Ubicación destino" value={ret.toLocation} />
          <Field label="Motivo" value={ret.reason} />
          <Field label="Reingresado a stock" value={ret.restocked ? 'Sí' : 'No'} />
          <Field label="Registrada por" value={ret.createdBy} />
        </div>

        {ret.notes && (
          <div className="mt-4 border border-gray-300 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Notas</div>
            <div className="text-sm text-black">{ret.notes}</div>
          </div>
        )}

        {/* Pie con firmas */}
        <div className="mt-10 grid grid-cols-2 gap-8">
          <div>
            <div className="border-t border-black pt-1 text-[11px] text-gray-600">Entrega (línea / producción)</div>
          </div>
          <div>
            <div className="border-t border-black pt-1 text-[11px] text-gray-600">Recibe (almacén)</div>
          </div>
        </div>
        <div className="mt-6 text-[10px] text-gray-500 dark:text-gray-400">Generado {fmtTime(new Date().toISOString())} · AXOS OS</div>
      </div>
    </div>
  );
}
