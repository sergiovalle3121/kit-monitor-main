'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import type { Editor } from '@tiptap/react';
import { FileCog, Tags } from 'lucide-react';
import { RibbonMenuButton } from '../ribbon';

const FIELD_OPTIONS = [
  { key: 'documentNumber', label: 'No. documento' },
  { key: 'revision', label: 'Revisión' },
  { key: 'owner', label: 'Dueño' },
  { key: 'department', label: 'Departamento' },
  { key: 'effectiveDate', label: 'Fecha efectiva' },
  { key: 'status', label: 'Estatus' },
  { key: 'customer', label: 'Cliente' },
  { key: 'model', label: 'Modelo' },
];

const fieldClass = 'w-full h-8 text-[12px] rounded-lg bg-gray-100 dark:bg-white/10 px-2 outline-none focus:ring-2 ring-blue-500/40';

export function DocProperties({ editor }: { editor: Editor }) {
  const [, force] = React.useState(0);
  const meta: any = editor.state.doc.attrs || {};
  const props: Record<string, string> = meta.docProps || {};
  const setProp = (key: string, value: string) => {
    const next = { ...props, [key]: value };
    if (!value.trim()) delete next[key];
    (editor.chain().focus() as any).setPageMeta({ docProps: next }).updateDocFields().run();
    force((n) => n + 1);
  };
  const insertField = (key: string, label: string) => {
    (editor.chain().focus() as any).insertDocField(key, label).run();
  };

  return (
    <RibbonMenuButton icon={FileCog} label="Propiedades" menuWidth={340}>
      <div className="p-2 space-y-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Control documental</p>
          <div className="grid grid-cols-2 gap-2">
            {FIELD_OPTIONS.map((f) => (
              <label key={f.key} className="space-y-1">
                <span className="text-[11px] text-gray-500">{f.label}</span>
                <input value={props[f.key] || ''} onChange={(e) => setProp(f.key, e.target.value)} className={fieldClass} />
              </label>
            ))}
          </div>
        </div>
        <div className="border-t border-black/5 dark:border-white/10 pt-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Insertar campo vivo</p>
          <div className="grid grid-cols-2 gap-1">
            {FIELD_OPTIONS.map((f) => (
              <button key={f.key} onClick={() => insertField(f.key, f.label)} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-[12px] hover:bg-black/5 dark:hover:bg-white/10">
                <Tags className="w-3.5 h-3.5 text-blue-500" /> {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </RibbonMenuButton>
  );
}
