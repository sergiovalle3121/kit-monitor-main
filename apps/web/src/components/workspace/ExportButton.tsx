'use client';

import { useState } from 'react';
import { saveAs } from 'file-saver';
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

export interface ExportColumn<T> {
  /** Clave del campo en el registro (usada si no se pasa `value`). */
  key: string;
  /** Encabezado de la columna en el archivo. */
  header: string;
  /** Extractor del valor a exportar (formateo de moneda, fechas, etc.). */
  value?: (row: T) => string | number | null | undefined;
}

export type ExportFormat = 'csv' | 'xlsx';

export interface ExportButtonProps<T> {
  /** Filas a exportar — el padre pasa el dataset YA filtrado. */
  rows: T[];
  columns: ExportColumn<T>[];
  /** Nombre base del archivo (sin extensión). Se le añade la fecha. */
  filename?: string;
  label?: string;
  /** Formatos ofrecidos. Por defecto CSV + Excel. */
  formats?: ExportFormat[];
  className?: string;
}

function cellValue<T>(row: T, col: ExportColumn<T>): string | number {
  const raw = col.value ? col.value(row) : (row as Record<string, unknown>)[col.key];
  if (raw == null) return '';
  if (typeof raw === 'number') return raw;
  return String(raw);
}

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Botón de exportación del dataset actual (respeta los filtros, porque el padre
 * decide qué `rows` entrega). CSV con BOM para Excel; XLSX real vía la dependencia
 * `xlsx` ya presente. Genérico por tipo <T> y sin acoplarse a ningún módulo.
 */
export function ExportButton<T>({
  rows,
  columns,
  filename = 'export',
  label = 'Exportar',
  formats = ['csv', 'xlsx'],
  className = '',
}: ExportButtonProps<T>) {
  const [open, setOpen] = useState(false);
  const disabled = rows.length === 0;

  function exportCsv() {
    const header = columns.map((c) => csvEscape(c.header)).join(',');
    const body = rows
      .map((row) => columns.map((c) => csvEscape(cellValue(row, c))).join(','))
      .join('\r\n');
    // BOM (﻿) para que Excel reconozca UTF-8 (acentos correctos).
    const blob = new Blob([`﻿${header}\r\n${body}`], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `${filename}-${stamp()}.csv`);
  }

  async function exportXlsx() {
    const XLSX = await import('xlsx');
    const aoa: (string | number)[][] = [
      columns.map((c) => c.header),
      ...rows.map((row) => columns.map((c) => cellValue(row, c))),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    XLSX.writeFile(wb, `${filename}-${stamp()}.xlsx`);
  }

  function run(fmt: ExportFormat) {
    setOpen(false);
    if (fmt === 'csv') exportCsv();
    else void exportXlsx();
  }

  // Un solo formato → botón directo (sin menú).
  if (formats.length === 1) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => run(formats[0])}
        className={clsx(
          'inline-flex h-9 items-center gap-2 rounded-xl border border-black/10 bg-black/[0.03] px-3 text-sm font-medium transition-colors hover:bg-black/[0.06] disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]',
          className,
        )}
      >
        <Download className="h-4 w-4" /> {label}
      </button>
    );
  }

  return (
    <div className={clsx('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-2 rounded-xl border border-black/10 bg-black/[0.03] px-3 text-sm font-medium transition-colors hover:bg-black/[0.06] disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
      >
        <Download className="h-4 w-4" /> {label}
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-1 w-44 overflow-hidden rounded-xl border border-black/10 bg-white/95 p-1 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/95"
          >
            {formats.includes('csv') && (
              <button
                type="button"
                role="menuitem"
                onClick={() => run('csv')}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
              >
                <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" /> CSV (.csv)
              </button>
            )}
            {formats.includes('xlsx') && (
              <button
                type="button"
                role="menuitem"
                onClick={() => run('xlsx')}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> Excel (.xlsx)
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
