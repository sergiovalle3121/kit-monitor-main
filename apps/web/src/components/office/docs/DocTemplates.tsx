'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import type { Editor } from '@tiptap/react';
import {
  LayoutTemplate, File, FileText, Mail, ClipboardList, ClipboardCheck,
  Wrench, ShieldCheck, ListChecks, FileSignature, Repeat, Table2,
} from 'lucide-react';
import { RibbonMenuButton } from '../ribbon';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { TEMPLATES, TEMPLATE_CATEGORIES, type TemplateDef } from '@/lib/office/templates';

// Icono por plantilla (cae a uno por defecto). Las definiciones viven en
// `lib/office/templates.ts` — fuente ÚNICA compartida con la galería de "nuevo
// documento" para no duplicar contenido.
const ICONS: Record<string, any> = {
  blank: File, report: FileText, letter: Mail, memo: FileText, proposal: FileSignature,
  minutes: ClipboardList, sop: Wrench, eightd: ShieldCheck, fai: ClipboardCheck,
  controlplan: Table2, audit: ListChecks, capa: ShieldCheck, handover: Repeat,
};
const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] };

/** Galería de plantillas de documento (menú del ribbon). Reemplaza el contenido. */
export function DocTemplates({ editor, notifyChange }: { editor: Editor; notifyChange: () => void }) {
  const confirm = useConfirm();
  const apply = async (t: TemplateDef) => {
    if (!(await confirm({ message: 'Esto reemplazará el contenido actual del documento. ¿Continuar?', confirmLabel: 'Reemplazar' }))) return;
    const doc = (t.build() as any) || EMPTY_DOC;
    (editor.chain() as any).setContent(doc, { emitUpdate: true }).focus().run();
    notifyChange();
  };

  const groups = TEMPLATE_CATEGORIES.doc
    .map((cat) => ({ cat, items: TEMPLATES.doc.filter((t) => (t.category || 'General') === cat) }))
    .filter((g) => g.items.length);

  return (
    <RibbonMenuButton icon={LayoutTemplate} label="Plantillas" menuWidth={272}>
      <div className="max-h-[60vh] overflow-y-auto pr-0.5">
        {groups.map((g) => (
          <div key={g.cat} className="mb-1.5 last:mb-0">
            <p className="px-2 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{g.cat}</p>
            <div className="grid grid-cols-1 gap-1">
              {g.items.map((t) => {
                const Icon = ICONS[t.id] || FileText;
                return (
                  <button
                    key={t.id} type="button" title={t.description}
                    onMouseDown={(e) => e.preventDefault()} onClick={() => apply(t)}
                    className="flex items-center gap-3 px-2.5 py-2 rounded-xl text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                  >
                    <span
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: (t.accent || '#2563eb') + '1f', color: t.accent || '#2563eb' }}
                    >
                      <Icon className="w-4 h-4" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium truncate">{t.title}</span>
                      <span className="block text-[11px] text-gray-500 dark:text-gray-400 truncate">{t.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </RibbonMenuButton>
  );
}
