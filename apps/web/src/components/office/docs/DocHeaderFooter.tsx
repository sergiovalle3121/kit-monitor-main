'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import type { Editor } from '@tiptap/react';
import { PanelTop, Hash } from 'lucide-react';
import { RibbonGroup, RibbonMenuButton } from '../ribbon';

/** Editor de encabezado / pie de página + números (se guardan en pageMeta y se
 *  muestran en la página y en la vista de impresión / export .docx). */
export function DocHeaderFooter({ editor }: { editor: Editor }) {
  const a: any = editor.state.doc.attrs || {};
  const set = (attrs: Record<string, any>) => (editor.chain() as any).setPageMeta(attrs).run();
  const field = 'w-full h-8 text-sm rounded-lg bg-gray-100 dark:bg-white/10 px-2.5 outline-none focus:ring-2 ring-blue-500/40';

  return (
    <RibbonGroup label="Encabezado y pie">
      <RibbonMenuButton icon={PanelTop} label="Encabezado / pie" menuWidth={250}>
        <div className="p-1.5 space-y-2" onClick={(e) => e.stopPropagation()}>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Encabezado</label>
            <input value={a.pageHeader || ''} onChange={(e) => set({ pageHeader: e.target.value })} placeholder="Texto del encabezado" className={field} />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pie de página</label>
            <input value={a.pageFooter || ''} onChange={(e) => set({ pageFooter: e.target.value })} placeholder="Texto del pie" className={field} />
          </div>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-snug">Campos: <code>{'{page}'}</code> <code>{'{pages}'}</code> <code>{'{title}'}</code> <code>{'{date}'}</code></p>
          <label className="flex items-center gap-2 text-sm pt-1 cursor-pointer">
            <input type="checkbox" checked={!!a.pageNumbers} onChange={(e) => set({ pageNumbers: e.target.checked })} />
            <Hash className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" /> Números de página
          </label>
        </div>
      </RibbonMenuButton>
    </RibbonGroup>
  );
}
