'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Table as TableIcon } from 'lucide-react';
import { RibbonMenuButton } from '../ribbon';

const ROWS = 8;
const COLS = 10;

/** Inserción de tabla con selector visual de tamaño (cuadrícula al pasar el ratón). */
export function DocTableInsert({ editor }: { editor: Editor }) {
  const [hover, setHover] = useState({ r: 0, c: 0 });
  const insert = (r: number, c: number) => (editor.chain().focus() as any).insertTable({ rows: r, cols: c, withHeaderRow: true }).run();

  return (
    <RibbonMenuButton icon={TableIcon} label="Tabla" menuWidth={232}>
      <div className="p-1">
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }} onMouseLeave={() => setHover({ r: 0, c: 0 })}>
          {Array.from({ length: ROWS * COLS }).map((_, i) => {
            const r = Math.floor(i / COLS) + 1;
            const c = (i % COLS) + 1;
            const on = r <= hover.r && c <= hover.c;
            return (
              <button key={i} onMouseEnter={() => setHover({ r, c })} onMouseDown={(e) => e.preventDefault()} onClick={() => insert(r, c)}
                className={`w-[18px] h-[18px] rounded-[3px] border transition-colors ${on ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-white/15 hover:border-blue-400'}`} />
            );
          })}
        </div>
        <div className="text-center text-xs font-medium mt-1.5 tabular-nums">{hover.r || '—'} × {hover.c || '—'}</div>
      </div>
    </RibbonMenuButton>
  );
}
