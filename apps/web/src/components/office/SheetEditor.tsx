'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useRef } from 'react';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';

/** Excel-like spreadsheet (Fortune-sheet, MIT) — formulas, formats, toolbar. */
export function SheetEditor({ value, onChange }: { value: any; onChange: (data: any) => void }) {
  const init = Array.isArray(value) && value.length
    ? value
    : [{ name: 'Hoja 1', celldata: [], order: 0, row: 100, column: 30, config: {} }];
  const latest = useRef(init);

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-white/10 overflow-hidden bg-white" style={{ height: 'calc(100vh - 110px)' }}>
      <Workbook
        data={init as any}
        lang="es"
        onChange={(d: any) => { latest.current = d; onChange(d); }}
      />
    </div>
  );
}
