'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Upload, ChevronDown, Loader2 } from 'lucide-react';
import { exportSheets, importSheets } from '@/lib/office/xlsx';
import { useToast } from '@/contexts/ToastContext';

/** Export (.xlsx/.csv) + Import controls for the spreadsheet editor's ribbon. */
export function SheetActions({
  content, title, onImport, readOnly,
}: {
  content: any;
  title: string;
  onImport: (content: any) => void;
  readOnly?: boolean;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Content is either the legacy sheet array or the new { sheets, charts, names } shape.
  const sheetsOf = (v: any): any[] => (Array.isArray(v) ? v : (Array.isArray(v?.sheets) ? v.sheets : []));
  const namesOf = (v: any): any[] => (v && Array.isArray(v.names) ? v.names : []);

  async function doExport(fmt: 'xlsx' | 'csv', delimiter = ',') {
    setOpen(false);
    setBusy(true);
    try { await exportSheets(sheetsOf(content), title || 'hoja', fmt, { delimiter }, namesOf(content)); }
    catch { /* ignore */ }
    finally { setBusy(false); }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    // Importar reemplaza el documento; preserva los nombres definidos del .xlsx para que
    // el administrador de nombres y las fórmulas que los usen sigan resolviendo.
    try { const { sheets, names } = await importSheets(f); onImport({ sheets, names }); }
    catch { toast.error('No se pudo importar el archivo. Verifica que sea un .xlsx o .csv válido.'); }
    finally { setBusy(false); }
  }

  const btn = 'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors';

  return (
    <div className="flex items-center gap-0.5">
      {!readOnly && (
        <>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="hidden" />
          <button onClick={() => fileRef.current?.click()} className={btn} title="Importar .xlsx / .csv">
            <Upload className="w-4 h-4" /> <span className="hidden lg:inline">Importar</span>
          </button>
        </>
      )}
      <div className="relative">
        <button onClick={() => setOpen((o) => !o)} className={btn} title="Exportar">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span className="hidden lg:inline">Exportar</span>
          <ChevronDown className="w-3 h-3" />
        </button>
        <AnimatePresence>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="absolute right-0 mt-1 z-20 w-44 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-xl p-1"
              >
                <MenuItem onClick={() => doExport('xlsx')} label="Excel (.xlsx)" />
                <MenuItem onClick={() => doExport('csv', ',')} label="CSV (coma)" />
                <MenuItem onClick={() => doExport('csv', ';')} label="CSV (punto y coma)" />
                <MenuItem onClick={() => doExport('csv', '\t')} label="CSV (tabulación)" />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MenuItem({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
      {label}
    </button>
  );
}
