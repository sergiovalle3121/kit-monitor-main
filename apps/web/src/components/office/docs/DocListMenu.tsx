'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import type { Editor } from '@tiptap/react';
import { ListTree, RotateCcw } from 'lucide-react';
import { RibbonMenuButton } from '../ribbon';

function SchemeCard({ active, title, lines, onPick }: { active: boolean; title: string; lines: string[]; onPick: () => void }) {
  return (
    <button onMouseDown={(e) => e.preventDefault()} onClick={onPick}
      className={`text-left rounded-xl border p-2.5 transition-colors ${active ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-black/10 dark:border-white/10 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'}`}>
      <div className="text-[11px] font-semibold mb-1">{title}</div>
      <div className="font-mono text-[10px] leading-tight text-gray-500 dark:text-gray-400 whitespace-pre">{lines.join('\n')}</div>
    </button>
  );
}

/** Menú de listas multinivel (esquemas + reiniciar numeración). */
export function DocListMenu({ editor }: { editor: Editor }) {
  const inList = editor.isActive('orderedList') || editor.isActive('bulletList');
  const scheme = editor.getAttributes('orderedList').listScheme || editor.getAttributes('bulletList').listScheme || '';
  const apply = (s: string) => (editor.chain().focus() as any).setListScheme(s).run();
  const restart = () => {
    const v = window.prompt('Reiniciar numeración en…', '1');
    if (v === null) return;
    const n = Math.max(1, parseInt(v, 10) || 1);
    (editor.chain().focus() as any).restartNumbering(n).run();
  };

  return (
    <RibbonMenuButton icon={ListTree} label="Multinivel" menuWidth={280}>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-1.5">
          <SchemeCard active={scheme === ''} title="Decimal" lines={['1.', '2.', '3.']} onPick={() => apply('')} />
          <SchemeCard active={scheme === 'doc-mlist'} title="Legal (1.1.1)" lines={['1.', '1.1.', '1.1.1.']} onPick={() => apply('doc-mlist')} />
          <SchemeCard active={scheme === 'doc-outline'} title="Esquema" lines={['I.', 'A.', '1.']} onPick={() => apply('doc-outline')} />
          <button onMouseDown={(e) => e.preventDefault()} onClick={restart} disabled={!editor.isActive('orderedList')}
            className="text-left rounded-xl border border-black/10 dark:border-white/10 p-2.5 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-40 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-gray-500" />
            <span className="text-[11px] font-semibold">Reiniciar numeración…</span>
          </button>
        </div>
        {!inList && <p className="text-[11px] text-gray-400 px-1 pt-1">Coloca el cursor en una lista para aplicar un esquema.</p>}
      </div>
    </RibbonMenuButton>
  );
}
