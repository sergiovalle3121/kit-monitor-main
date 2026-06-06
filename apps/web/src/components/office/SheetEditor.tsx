'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useRef } from 'react';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';

/** Excel-like spreadsheet (Fortune-sheet, MIT) — formulas, formats, toolbar. */
export function SheetEditor({ value, onChange, readOnly }: { value: any; onChange: (data: any) => void; readOnly?: boolean }) {
  const init = Array.isArray(value) && value.length
    ? value
    : [{ name: 'Hoja 1', celldata: [], order: 0, row: 100, column: 30, config: {} }];
  const latest = useRef(init);

  return (
    <div className="h-full w-full bg-white">
      <Workbook
        data={init as any}
        lang="es"
        allowEdit={!readOnly}
        onChange={(d: any) => { latest.current = d; if (!readOnly) onChange(d); }}
      />
    </div>
  );
}
