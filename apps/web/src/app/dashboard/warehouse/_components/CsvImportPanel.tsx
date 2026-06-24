'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Upload, X, Loader2, FileDown, CheckCircle2, AlertTriangle } from 'lucide-react';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';
import { API_BASE, BLUE, GREEN, AMBER, inputCls } from './shared';

/** Cabecera CSV → campo del pull (tolerante a sinónimos/acentos/may-min). */
const FIELD_BY_HEADER: Record<string, string> = {};
const add = (field: string, ...keys: string[]) => keys.forEach((k) => (FIELD_BY_HEADER[k] = field));
add('partNumber', 'partnumber', 'parte', 'part', 'numerodeparte', 'pn', 'numparte');
add('quantity', 'quantity', 'cantidad', 'qty', 'cant');
add('fromWarehouseId', 'fromwarehouseid', 'almacen', 'warehouse', 'almacenorigen', 'sloc', 'almorigen');
add('project', 'project', 'proyecto', 'programa');
add('toLocation', 'tolocation', 'destino', 'ubicacion', 'location', 'estacion');
add('requestor', 'requestor', 'requisitor', 'solicitante');
add('slaMinutes', 'slaminutes', 'sla', 'slamin');
add('urgent', 'urgent', 'urgente');
add('referenceId', 'referenceid', 'referencia', 'reference', 'wo', 'orden');

const TEMPLATE_HEADERS = ['partNumber', 'quantity', 'fromWarehouseId', 'project', 'toLocation', 'requestor', 'slaMinutes', 'urgent', 'referenceId'];

function normHeader(h: string): string {
  return h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

/** Parser CSV mínimo con soporte de comillas (RFC 4180). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

type ParsedRow = Record<string, string>;

export default function CsvImportPanel({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [busy, setBusy] = useState(false);

  const { valid, invalid } = useMemo(() => {
    let v = 0;
    let inv = 0;
    for (const r of rows) {
      if (r.partNumber && r.fromWarehouseId) v++;
      else inv++;
    }
    return { valid: v, invalid: inv };
  }, [rows]);

  function ingest(text: string) {
    setParseError('');
    const matrix = parseCsv(text);
    if (matrix.length < 2) { setParseError('El CSV necesita una fila de encabezados y al menos una fila de datos.'); setRows([]); return; }
    const headers = matrix[0].map((h) => FIELD_BY_HEADER[normHeader(h)] ?? '');
    if (!headers.includes('partNumber') || !headers.includes('fromWarehouseId')) {
      setParseError('Faltan columnas obligatorias: necesito al menos "partNumber" y "fromWarehouseId" (acepto sinónimos: parte, almacén…).');
      setRows([]);
      return;
    }
    const parsed: ParsedRow[] = matrix.slice(1).map((cells) => {
      const obj: ParsedRow = {};
      headers.forEach((field, idx) => { if (field) obj[field] = (cells[idx] ?? '').trim(); });
      return obj;
    });
    setRows(parsed);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => ingest(String(reader.result || ''));
    reader.readAsText(f);
  }

  function downloadTemplate() {
    const csv = TEMPLATE_HEADERS.join(',') + '\n' + 'IC-MCU-32B,50,AX-WH-NORTE-RM,AX-MOBILITY,L1-POU,Líder L1,60,sí,AX-WO-0001\n';
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'plantilla-pull-list.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  async function submit() {
    if (rows.length === 0) { toast.error('Carga un CSV con filas primero.', 'Pull-list'); return; }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/warehouse/pulls/import`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo importar la pull-list.', 'Pull-list');
        return;
      }
      const r = await res.json().catch(() => ({ imported: 0, failed: 0 }));
      if (r.imported > 0) toast.success(`Pull-list: ${r.imported} pull(s) creados${r.failed ? `, ${r.failed} con error` : ''}.`, 'Pull-list');
      else toast.error(`No se importó ningún pull (${r.failed} con error). Revisa parte y almacén.`, 'Pull-list');
      onImported();
      if (r.failed === 0) onClose();
    } catch {
      toast.error('Error de red.', 'Pull-list');
    } finally { setBusy(false); }
  }

  return (
    <div className={`${glass} mb-5 rounded-2xl p-5`}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Cargar pull-list (CSV)</h3>
          <p className="text-[12px] text-gray-400">
            Sube un archivo CSV y se crea un pull por fila. Columnas: <code className="text-[11px]">partNumber, quantity, fromWarehouseId</code> (obligatorias), y opcionales <code className="text-[11px]">project, toLocation, requestor, slaMinutes, urgent, referenceId</code>. Un conector SAP futuro alimentaría este mismo flujo.
          </p>
        </div>
        <button aria-label="Cerrar" onClick={onClose} className="rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
        <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-white" style={{ background: BLUE }}>
          <Upload className="h-4 w-4" /> Elegir archivo CSV
        </button>
        <button onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10">
          <FileDown className="h-4 w-4" /> Descargar plantilla
        </button>
        {fileName && <span className="text-[13px] text-gray-500">{fileName}</span>}
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-[12px] font-medium text-gray-500">…o pega el CSV aquí</span>
        <textarea onChange={(e) => ingest(e.target.value)} rows={3} placeholder="partNumber,quantity,fromWarehouseId,project&#10;IC-MCU-32B,50,AX-WH-NORTE-RM,AX-MOBILITY" className={`${inputCls} font-mono text-[12px]`} />
      </label>

      {parseError && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.07] px-3 py-2 text-[13px] text-red-700 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {parseError}
        </div>
      )}

      {rows.length > 0 && !parseError && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-black/[0.03] px-3 py-2 text-[13px] dark:bg-white/[0.05]">
          <span>
            <CheckCircle2 className="mr-1 inline h-4 w-4" style={{ color: GREEN }} /> {valid} fila(s) válida(s)
            {invalid > 0 && <span style={{ color: AMBER }}> · {invalid} sin parte/almacén (se omitirán)</span>}
          </span>
          <button onClick={submit} disabled={busy || valid === 0} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: GREEN }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Importar {valid} pull(s)
          </button>
        </div>
      )}
    </div>
  );
}
