/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Starter content for the "new document" gallery. Doc/sheet templates are static
 * (well-known TipTap / Fortune-sheet shapes); slide templates are built with
 * Fabric at selection time so the serialized schema is always valid.
 */

export type DocType = 'doc' | 'sheet' | 'slides';

export interface TemplateDef {
  id: string;
  title: string;
  description: string;
  /** Returns the `content` payload for a new document (may be async). */
  build: () => any | Promise<any>;
}

// ── Docs (TipTap JSON) ───────────────────────────────────────────────────────
const h = (level: number, text: string) => ({ type: 'heading', attrs: { level, textAlign: 'left' }, content: [{ type: 'text', text }] });
const p = (text?: string) => (text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' });
const docOf = (...content: any[]) => ({ type: 'doc', content });

const DOC_TEMPLATES: TemplateDef[] = [
  { id: 'blank', title: 'En blanco', description: 'Documento vacío.', build: () => null },
  {
    id: 'report', title: 'Informe', description: 'Portada, resumen y secciones.',
    build: () => docOf(
      h(1, 'Título del informe'),
      { type: 'paragraph', attrs: { textAlign: 'left' }, content: [{ type: 'text', marks: [{ type: 'italic' }], text: 'Subtítulo o autor · fecha' }] },
      h(2, 'Resumen ejecutivo'),
      p('Describe brevemente el propósito y los hallazgos clave.'),
      h(2, 'Introducción'),
      p('Contexto y objetivos.'),
      h(2, 'Desarrollo'),
      p('Detalle del análisis.'),
      h(2, 'Conclusiones'),
      p('Resumen de resultados y próximos pasos.'),
    ),
  },
  {
    id: 'letter', title: 'Carta', description: 'Carta formal.',
    build: () => docOf(
      { type: 'paragraph', attrs: { textAlign: 'right' }, content: [{ type: 'text', text: 'Ciudad, fecha' }] },
      p('Estimado/a [Nombre]:'),
      p('Por medio de la presente me dirijo a usted para…'),
      p('Quedo a su disposición para cualquier aclaración.'),
      p('Atentamente,'),
      p('[Tu nombre]'),
    ),
  },
  {
    id: 'minutes', title: 'Acta de reunión', description: 'Asistentes, agenda y acuerdos.',
    build: () => docOf(
      h(1, 'Acta de reunión'),
      p('Fecha: ____   ·   Hora: ____   ·   Lugar: ____'),
      h(3, 'Asistentes'),
      { type: 'bulletList', content: [
        { type: 'listItem', content: [p('Persona 1')] },
        { type: 'listItem', content: [p('Persona 2')] },
      ] },
      h(3, 'Agenda'),
      { type: 'orderedList', content: [
        { type: 'listItem', content: [p('Tema 1')] },
        { type: 'listItem', content: [p('Tema 2')] },
      ] },
      h(3, 'Acuerdos'),
      { type: 'taskList', content: [
        { type: 'taskItem', attrs: { checked: false }, content: [p('Acción pendiente')] },
      ] },
    ),
  },
];

// ── Sheets (Fortune-sheet data) ──────────────────────────────────────────────
function buildSheet(name: string, aoa: any[][]): any[] {
  const celldata: any[] = [];
  aoa.forEach((row, r) => row.forEach((val, c) => {
    if (val === null || val === undefined || val === '') return;
    const t = typeof val === 'number' ? 'n' : 's';
    const v: any = { v: val, m: String(val), ct: { fa: 'General', t } };
    if (r === 0) { v.bl = 1; v.bg = '#f3f4f6'; }
    celldata.push({ r, c, v });
  }));
  return [{ name, celldata, row: 100, column: 26, order: 0, status: 1, config: {} }];
}

const SHEET_TEMPLATES: TemplateDef[] = [
  { id: 'blank', title: 'En blanco', description: 'Hoja vacía.', build: () => null },
  {
    id: 'budget', title: 'Presupuesto mensual', description: 'Categorías, presupuesto y real.',
    build: () => buildSheet('Presupuesto', [
      ['Categoría', 'Presupuesto', 'Real', 'Diferencia'],
      ['Ingresos', 0, 0, 0],
      ['Vivienda', 0, 0, 0],
      ['Alimentación', 0, 0, 0],
      ['Transporte', 0, 0, 0],
      ['Otros', 0, 0, 0],
      ['Total', 0, 0, 0],
    ]),
  },
  {
    id: 'inventory', title: 'Inventario', description: 'Artículos, cantidades y valor.',
    build: () => buildSheet('Inventario', [
      ['Artículo', 'SKU', 'Cantidad', 'Precio', 'Total'],
      ['', '', 0, 0, 0],
      ['', '', 0, 0, 0],
      ['', '', 0, 0, 0],
    ]),
  },
  {
    id: 'tracker', title: 'Seguimiento de tareas', description: 'Tareas, responsable y estado.',
    build: () => buildSheet('Tareas', [
      ['Tarea', 'Responsable', 'Fecha límite', 'Estado'],
      ['', '', '', 'Pendiente'],
      ['', '', '', 'Pendiente'],
    ]),
  },
];

// ── Slides (built with Fabric) ───────────────────────────────────────────────
async function buildDeck(builders: ((mk: any) => Promise<any>)[]): Promise<any> {
  const fabric = await import('fabric');
  const { StaticCanvas, Textbox, Rect } = fabric as any;
  const slide = async (paint: (c: any) => void) => {
    const c = new StaticCanvas(document.createElement('canvas'), { width: 960, height: 540, backgroundColor: '#ffffff' });
    paint(c);
    c.renderAll();
    const json = c.toJSON();
    c.dispose();
    return json;
  };
  const text = (t: string, o: any) => new Textbox(t, { fontFamily: 'sans-serif', fill: '#111827', ...o });
  const rect = (o: any) => new Rect(o);
  const slides = [];
  for (const b of builders) slides.push(await b({ slide, text, rect }));
  return { version: 2, slides };
}

const SLIDE_TEMPLATES: TemplateDef[] = [
  { id: 'blank', title: 'En blanco', description: 'Presentación vacía.', build: () => null },
  {
    id: 'titulo', title: 'Portada', description: 'Diapositiva de título.',
    build: () => buildDeck([
      ({ slide, text, rect }) => slide((c: any) => {
        c.add(rect({ left: 0, top: 470, width: 960, height: 70, fill: '#2563eb' }));
        c.add(text('Título de la presentación', { left: 80, top: 200, width: 800, fontSize: 56, fontWeight: 'bold', textAlign: 'center' }));
        c.add(text('Subtítulo · Autor', { left: 80, top: 290, width: 800, fontSize: 26, fill: '#6b7280', textAlign: 'center' }));
      }),
    ]),
  },
  {
    id: 'pitch', title: 'Pitch', description: 'Portada, agenda y contenido.',
    build: () => buildDeck([
      ({ slide, text }) => slide((c: any) => {
        c.add(text('Nombre del proyecto', { left: 80, top: 210, width: 800, fontSize: 54, fontWeight: 'bold', textAlign: 'center' }));
        c.add(text('Propuesta de valor en una línea', { left: 80, top: 300, width: 800, fontSize: 24, fill: '#6b7280', textAlign: 'center' }));
      }),
      ({ slide, text }) => slide((c: any) => {
        c.add(text('Agenda', { left: 64, top: 56, width: 600, fontSize: 40, fontWeight: 'bold' }));
        c.add(text('1. Problema\n2. Solución\n3. Mercado\n4. Modelo de negocio\n5. Equipo', { left: 64, top: 150, width: 800, fontSize: 28, fill: '#374151' }));
      }),
      ({ slide, text }) => slide((c: any) => {
        c.add(text('Problema', { left: 64, top: 56, width: 600, fontSize: 40, fontWeight: 'bold' }));
        c.add(text('Describe el problema que resuelves.', { left: 64, top: 160, width: 820, fontSize: 28, fill: '#374151' }));
      }),
    ]),
  },
];

export const TEMPLATES: Record<DocType, TemplateDef[]> = {
  doc: DOC_TEMPLATES,
  sheet: SHEET_TEMPLATES,
  slides: SLIDE_TEMPLATES,
};
