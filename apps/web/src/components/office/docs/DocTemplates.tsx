'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import type { Editor } from '@tiptap/react';
import { LayoutTemplate, Mail, FileText, ClipboardList, Wrench, File } from 'lucide-react';
import { RibbonMenuButton } from '../ribbon';

const p = (text = '') => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] });
const h = (level: number, text: string, styleName = '') => ({ type: 'heading', attrs: { level, styleName }, content: [{ type: 'text', text }] });
const li = (text: string) => ({ type: 'listItem', content: [p(text)] });

const TEMPLATES: { key: string; label: string; icon: any; doc: any }[] = [
  { key: 'blank', label: 'En blanco', icon: File, doc: { type: 'doc', content: [p('')] } },
  {
    key: 'letter', label: 'Carta', icon: Mail, doc: { type: 'doc', content: [
      { type: 'paragraph', attrs: { textAlign: 'right' }, content: [{ type: 'text', text: new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) }] },
      p('Estimado/a [Nombre]:'),
      p('Por medio de la presente me dirijo a usted para…'),
      p('Quedo a la espera de su respuesta y aprovecho la ocasión para saludarle cordialmente.'),
      p(''), p('Atentamente,'), p('[Su nombre]'), p('[Cargo · Empresa]'),
    ] },
  },
  {
    key: 'memo', label: 'Memorándum', icon: FileText, doc: { type: 'doc', content: [
      h(1, 'MEMORÁNDUM', 'title'),
      p('PARA: [Destinatario]'), p('DE: [Remitente]'),
      p('FECHA: ' + new Date().toLocaleDateString('es-ES')), p('ASUNTO: [Asunto]'),
      { type: 'horizontalRule' },
      p('Cuerpo del memorándum…'),
    ] },
  },
  {
    key: 'report', label: 'Reporte', icon: ClipboardList, doc: { type: 'doc', content: [
      h(1, 'Título del reporte', 'title'),
      { type: 'paragraph', attrs: { styleName: 'subtitle' }, content: [{ type: 'text', text: 'Subtítulo · ' + new Date().toLocaleDateString('es-ES') }] },
      { type: 'toc' },
      h(2, 'Resumen ejecutivo'), p('Breve resumen…'),
      h(2, 'Introducción'), p('Contexto y objetivos…'),
      h(2, 'Análisis'), p('Hallazgos…'),
      h(2, 'Conclusiones'), p('Conclusiones y recomendaciones…'),
    ] },
  },
  {
    key: 'work', label: 'Instrucción de trabajo', icon: Wrench, doc: { type: 'doc', content: [
      h(1, 'Instrucción de trabajo', 'title'),
      p('Código: [IT-000]   ·   Revisión: 1   ·   Fecha: ' + new Date().toLocaleDateString('es-ES')),
      { type: 'callout', attrs: { tone: 'warning' }, content: [p('Seguridad: usar EPP obligatorio antes de iniciar.')] },
      h(2, 'Objetivo'), p('Describir el procedimiento para…'),
      h(2, 'Alcance'), p('Aplica a…'),
      h(2, 'Materiales y herramientas'),
      { type: 'bulletList', content: [li('Herramienta 1'), li('Material 1')] },
      h(2, 'Procedimiento'),
      { type: 'orderedList', attrs: { listScheme: 'doc-mlist' }, content: [li('Paso uno'), li('Paso dos'), li('Paso tres')] },
      h(2, 'Registro y control'), p('Registrar resultados en…'),
    ] },
  },
];

/** Galería de plantillas de documento. Reemplaza el contenido del editor. */
export function DocTemplates({ editor, notifyChange }: { editor: Editor; notifyChange: () => void }) {
  const apply = (doc: any) => {
    if (!window.confirm('Esto reemplazará el contenido actual del documento. ¿Continuar?')) return;
    (editor.chain() as any).setContent(doc, { emitUpdate: true }).focus().run();
    notifyChange();
  };
  return (
    <RibbonMenuButton icon={LayoutTemplate} label="Plantillas" menuWidth={250}>
      <div className="grid grid-cols-1 gap-1">
        {TEMPLATES.map((t) => (
          <button key={t.key} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => apply(t.doc)}
            className="flex items-center gap-3 px-2.5 py-2 rounded-xl text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
            <span className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0"><t.icon className="w-4 h-4" /></span>
            <span className="text-sm font-medium">{t.label}</span>
          </button>
        ))}
      </div>
    </RibbonMenuButton>
  );
}
