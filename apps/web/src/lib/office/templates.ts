/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Starter content for the "new document" gallery (TemplateGallery) and the
 * in-editor "Plantillas" menu (DocTemplates). Doc/sheet templates are static
 * (well-known TipTap / Fortune-sheet shapes); slide templates are painted with
 * Fabric at selection time so the serialized schema is always a valid deck
 * (`{ version: 2, slides: [...] }`, each slide = `StaticCanvas.toJSON()`).
 *
 * Design goal: every template must look finished and professional the moment it
 * opens — real palettes, painted backgrounds, typographic hierarchy and
 * populated structure (no blank shells). It only uses capabilities the engines
 * already expose (see NIGHT_LOG_TEMPLATES.md for the verified contract).
 */

export type DocType = 'doc' | 'sheet' | 'slides';

export interface TemplateDef {
  id: string;
  title: string;
  description: string;
  /** Optional grouping rendered as a section header in the gallery. */
  category?: string;
  /** Optional accent colour for the gallery card preview (cosmetic only). */
  accent?: string;
  /** Returns the `content` payload for a new document (may be async). */
  build: () => any | Promise<any>;
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCS (TipTap JSON)
// ─────────────────────────────────────────────────────────────────────────────
const txt = (text: string, marks?: any[]) => ({ type: 'text', text, ...(marks ? { marks } : {}) });
const p = (text?: string, attrs?: any) => ({ type: 'paragraph', ...(attrs ? { attrs } : {}), content: text ? [txt(text)] : [] });
const h = (level: number, text: string, styleName = '') => ({ type: 'heading', attrs: { level, textAlign: 'left', styleName }, content: [txt(text)] });
const docTitle = (text: string) => ({ type: 'heading', attrs: { level: 1, textAlign: 'left', styleName: 'title' }, content: [txt(text)] });
const docSubtitle = (text: string) => ({ type: 'paragraph', attrs: { styleName: 'subtitle' }, content: [txt(text)] });
const bullets = (items: string[]) => ({ type: 'bulletList', content: items.map((i) => ({ type: 'listItem', content: [p(i)] })) });
const ordered = (items: string[]) => ({ type: 'orderedList', content: items.map((i) => ({ type: 'listItem', content: [p(i)] })) });
const tasks = (items: string[]) => ({ type: 'taskList', content: items.map((i) => ({ type: 'taskItem', attrs: { checked: false }, content: [p(i)] })) });
const callout = (tone: string, text: string) => ({ type: 'callout', attrs: { tone }, content: [p(text)] });
const hr = () => ({ type: 'horizontalRule' });
const docOf = (...content: any[]) => ({ type: 'doc', content });

// Table helpers. Headers carry a dark fill + white bold text so every table looks
// like a real, controlled form. `colspan/rowspan/colwidth` use the schema default
// (1/1/null) when omitted.
const HEADER_BG = '#1f2937';
const th = (text: string, opt?: { bg?: string; color?: string }) => ({
  type: 'tableHeader',
  attrs: { backgroundColor: opt?.bg ?? HEADER_BG },
  content: [{ type: 'paragraph', content: [txt(text, [{ type: 'bold' }, { type: 'textStyle', attrs: { color: opt?.color ?? '#ffffff' } }])] }],
});
const td = (text = '', opt?: { bg?: string; bold?: boolean }) => ({
  type: 'tableCell',
  attrs: { backgroundColor: opt?.bg ?? null },
  content: [opt?.bold ? { type: 'paragraph', content: [txt(text, [{ type: 'bold' }])] } : p(text)],
});
const trow = (cells: any[]) => ({ type: 'tableRow', content: cells });
const tableOf = (rows: any[][]) => ({ type: 'table', content: rows.map((r) => trow(r)) });
// Two-column "document control" grid (Código / Rev / Fecha …) used by plant forms.
const controlGrid = (pairs: [string, string][]) => tableOf(
  pairs.map(([k, v]) => [th(k, { bg: '#f1f5f9', color: '#0f172a' }), td(v)]),
);
const field = (key: string, label: string, value = '') => ({ type: 'docField', attrs: { key, label, value: value || label } });
const axosRef = (entity: string, refId: string, label: string, status = 'draft') => ({ type: 'axosRef', attrs: { entity, refId, label, status } });
const mixedP = (content: any[], attrs?: any) => ({ type: 'paragraph', ...(attrs ? { attrs } : {}), content });
const controlledDoc = (props: Record<string, string>, ...content: any[]) => ({
  type: 'doc',
  attrs: {
    pageHeader: `${props.documentNumber || 'AXOS-DOC'} · Rev ${props.revision || 'A'} · ${props.status || 'Draft'}`,
    pageFooter: 'Controlled copy when exported from AXOS Docs',
    pageNumbers: true,
    pageSize: 'letter',
    pageMargin: 'normal',
    pageWatermark: props.status === 'Draft' ? 'DRAFT' : '',
    docProps: props,
  },
  content,
});
const approvalBlock = () => tableOf([
  [th('Función'), th('Nombre'), th('Firma / aprobación'), th('Fecha')],
  [td('Elaboró'), td(''), td(''), td('')],
  [td('Revisó'), td(''), td(''), td('')],
  [td('Aprobó'), td(''), td(''), td('')],
]);
const revisionBlock = () => tableOf([
  [th('Rev.'), th('Fecha'), th('Descripción del cambio'), th('Autor')],
  [td('A'), td(new Date().toLocaleDateString('es-ES')), td('Emisión inicial'), td('')],
]);
const linkedAxosContext = () => tableOf([
  [th('Entidad AXOS'), th('Referencia inteligente'), th('Uso documental')],
  [td('Work Order'), td('', { bg: '#eff6ff' }), td('Ejecución / lote afectado')],
  [td('BOM'), td('', { bg: '#eff6ff' }), td('Materiales y revisión aplicable')],
  [td('Routing'), td('', { bg: '#eff6ff' }), td('Operaciones y estación')],
  [td('NCR / CAPA'), td('', { bg: '#eff6ff' }), td('Calidad y acciones')],
]);

const DOC_TEMPLATES: TemplateDef[] = [
  { id: 'blank', title: 'En blanco', description: 'Documento vacío.', category: 'General', accent: '#64748b', build: () => null },

  // ── Formales ───────────────────────────────────────────────────────────────
  {
    id: 'report', title: 'Informe', description: 'Portada, índice, secciones y tabla de datos.', category: 'Formales', accent: '#2563eb',
    build: () => docOf(
      docTitle('Título del informe'),
      docSubtitle('Subtítulo · Autor · ' + new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })),
      { type: 'toc', attrs: { maxLevel: 3 } },
      h(2, 'Resumen ejecutivo'),
      p('Describe en un párrafo el propósito, el alcance y los hallazgos clave del informe.'),
      callout('info', 'Hallazgo clave: resume aquí el dato o conclusión más importante para el lector apurado.'),
      h(2, 'Introducción'),
      p('Contexto, antecedentes y objetivos del análisis.'),
      h(2, 'Análisis'),
      p('Detalle de los resultados. Apóyate en tablas y figuras.'),
      tableOf([
        [th('Indicador'), th('Periodo anterior'), th('Periodo actual'), th('Variación')],
        [td('Métrica A'), td('—'), td('—'), td('—')],
        [td('Métrica B'), td('—'), td('—'), td('—')],
        [td('Métrica C'), td('—'), td('—'), td('—')],
      ]),
      p('Figura/Tabla 1. Comparativo del periodo.', { styleName: 'caption' }),
      h(2, 'Conclusiones y recomendaciones'),
      bullets(['Conclusión principal.', 'Recomendación 1.', 'Recomendación 2.']),
    ),
  },
  {
    id: 'letter', title: 'Carta formal', description: 'Membrete, fecha, cuerpo y firma.', category: 'Formales', accent: '#2563eb',
    build: () => docOf(
      { type: 'paragraph', attrs: { styleName: 'reference' }, content: [txt('NOMBRE DE LA EMPRESA')] },
      p('Dirección · Ciudad · Teléfono · correo@empresa.com'),
      hr(),
      { type: 'paragraph', attrs: { textAlign: 'right' }, content: [txt(new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }))] },
      p('Estimado/a [Nombre]:'),
      p('Por medio de la presente me dirijo a usted para…'),
      p('Quedo a la espera de su respuesta y aprovecho la ocasión para saludarle cordialmente.'),
      p(''),
      p('Atentamente,'),
      p(''),
      p('[Su nombre]'),
      { type: 'paragraph', attrs: { styleName: 'caption' }, content: [txt('[Cargo · Empresa]')] },
    ),
  },
  {
    id: 'memo', title: 'Memorándum', description: 'Para / De / Asunto y cuerpo.', category: 'Formales', accent: '#2563eb',
    build: () => docOf(
      docTitle('MEMORÁNDUM'),
      controlGrid([
        ['PARA', '[Destinatario]'],
        ['DE', '[Remitente]'],
        ['FECHA', new Date().toLocaleDateString('es-ES')],
        ['ASUNTO', '[Asunto]'],
      ]),
      hr(),
      p('Cuerpo del memorándum. Sé breve y directo: una idea por párrafo.'),
      h(3, 'Acciones solicitadas'),
      bullets(['Acción 1 — responsable — fecha.', 'Acción 2 — responsable — fecha.']),
    ),
  },
  {
    id: 'proposal', title: 'Propuesta comercial', description: 'Resumen, alcance, precios y términos.', category: 'Formales', accent: '#2563eb',
    build: () => docOf(
      docTitle('Propuesta comercial'),
      docSubtitle('Preparada para [Cliente] · ' + new Date().toLocaleDateString('es-ES')),
      h(2, 'Resumen'),
      p('Una o dos frases sobre el problema del cliente y la solución que propones.'),
      h(2, 'Alcance del trabajo'),
      bullets(['Entregable 1.', 'Entregable 2.', 'Entregable 3.']),
      h(2, 'Inversión'),
      tableOf([
        [th('Concepto'), th('Cantidad'), th('Precio unitario'), th('Subtotal')],
        [td('Servicio / producto 1'), td('1'), td('$0.00'), td('$0.00')],
        [td('Servicio / producto 2'), td('1'), td('$0.00'), td('$0.00')],
        [td('Total', { bold: true, bg: '#f1f5f9' }), td('', { bg: '#f1f5f9' }), td('', { bg: '#f1f5f9' }), td('$0.00', { bold: true, bg: '#f1f5f9' })],
      ]),
      h(2, 'Términos y condiciones'),
      ordered(['Validez de la oferta: 30 días.', 'Condiciones de pago: 50% anticipo, 50% contra entrega.', 'Tiempo de entrega estimado: [X] semanas.']),
      callout('success', 'Para aceptar esta propuesta, firme y devuelva una copia o responda por correo.'),
    ),
  },
  {
    id: 'minutes', title: 'Acta de reunión', description: 'Asistentes, agenda, acuerdos y tareas.', category: 'Formales', accent: '#2563eb',
    build: () => docOf(
      docTitle('Acta de reunión'),
      controlGrid([
        ['Fecha', new Date().toLocaleDateString('es-ES')],
        ['Hora', '__:__'],
        ['Lugar / enlace', '____'],
        ['Convoca', '____'],
      ]),
      h(3, 'Asistentes'),
      bullets(['Persona 1 — rol', 'Persona 2 — rol']),
      h(3, 'Agenda'),
      ordered(['Tema 1', 'Tema 2', 'Tema 3']),
      h(3, 'Acuerdos'),
      bullets(['Acuerdo 1.', 'Acuerdo 2.']),
      h(3, 'Tareas (responsable · fecha)'),
      tasks(['[Responsable] — Acción pendiente — [fecha]', '[Responsable] — Acción pendiente — [fecha]']),
    ),
  },

  // ── Calidad y planta (diferenciadores que Word no trae) ──────────────────────
  {
    id: 'sop', title: 'Instrucción de trabajo (SOP)', description: 'Control del documento, EPP, pasos y registro.', category: 'Calidad y planta', accent: '#0ea5e9',
    build: () => docOf(
      docTitle('Instrucción de trabajo'),
      controlGrid([
        ['Documento', 'Instrucción de trabajo'],
        ['Código', 'IT-000'],
        ['Revisión', '1'],
        ['Fecha de emisión', new Date().toLocaleDateString('es-ES')],
        ['Proceso / Estación', '____'],
        ['Elaboró / Aprobó', '____ / ____'],
      ]),
      callout('warning', 'Seguridad: usar EPP obligatorio (lentes, guantes, calzado) antes de iniciar. Verificar paro de emergencia.'),
      h(2, 'Objetivo'),
      p('Describir el procedimiento estándar para realizar [operación] de forma segura y consistente.'),
      h(2, 'Alcance'),
      p('Aplica a [modelo/línea/estación].'),
      h(2, 'Materiales, herramientas y parámetros'),
      tableOf([
        [th('Recurso'), th('Especificación'), th('Parámetro / Torque')],
        [td('Herramienta 1'), td('—'), td('—')],
        [td('Material 1'), td('NP —'), td('—')],
      ]),
      h(2, 'Procedimiento'),
      ordered(['Paso 1 — verificar NP esperado (poka-yoke).', 'Paso 2 — realizar la operación según parámetro.', 'Paso 3 — confirmar en la terminal del operador.']),
      callout('info', 'Característica crítica (CTQ): marca aquí los pasos con tolerancia estrecha o de seguridad.'),
      h(2, 'Registro y control de calidad'),
      tasks(['Inspección de primera pieza (FAI) realizada', 'Backflush confirmado', 'Registro de defectos al día']),
    ),
  },
  {
    id: 'controlled-sop', title: 'SOP controlado AXOS', description: 'SOP con propiedades vivas, aprobaciones y referencias AXOS.', category: 'Calidad y planta', accent: '#0ea5e9',
    build: () => controlledDoc(
      { documentNumber: 'SOP-EMS-000', revision: 'A', owner: 'Calidad', department: 'Operaciones', effectiveDate: new Date().toLocaleDateString('es-ES'), status: 'Draft', customer: 'Cliente', model: 'Modelo' },
      docTitle('Procedimiento Operativo Estándar'),
      mixedP([txt('Documento '), field('documentNumber', 'No. documento', 'SOP-EMS-000'), txt(' · Rev. '), field('revision', 'Revisión', 'A'), txt(' · Estado '), field('status', 'Estado', 'Draft')], { styleName: 'subtitle' }),
      controlGrid([
        ['Dueño del proceso', 'Calidad / Operaciones'],
        ['Área aplicable', 'SMT / Ensamble / Prueba'],
        ['Cliente / Modelo', 'Cliente · Modelo'],
        ['Fecha efectiva', new Date().toLocaleDateString('es-ES')],
      ]),
      callout('warning', 'Documento controlado. No usar copias impresas no emitidas por AXOS Docs.'),
      h(2, '1. Propósito'),
      p('Definir el método estándar, seguro y verificable para ejecutar el proceso descrito.'),
      h(2, '2. Alcance y referencias AXOS'),
      mixedP([txt('Este SOP puede vincularse a '), axosRef('routing', 'RT-000', 'Routing RT-000'), txt(', '), axosRef('bom', 'BOM-000', 'BOM BOM-000'), txt(' y '), axosRef('customer', 'CUST-000', 'Cliente CUST-000'), txt(' para mantener trazabilidad operacional.')]),
      linkedAxosContext(),
      h(2, '3. Responsabilidades'),
      tableOf([
        [th('Rol'), th('Responsabilidad'), th('Evidencia esperada')],
        [td('Operador'), td('Ejecutar el proceso según esta versión vigente'), td('Registro de operación / firma electrónica')],
        [td('Supervisor'), td('Verificar cumplimiento y escalar desviaciones'), td('Checklist de arranque / LPA')],
        [td('Calidad'), td('Auditar CTQ y liberar cambios documentales'), td('Inspección / aprobación')],
      ]),
      h(2, '4. Riesgos, EPP y controles'),
      tableOf([
        [th('Riesgo'), th('Control preventivo'), th('Plan de reacción')],
        [td('ESD'), td('Pulsera ESD, tapete verificado'), td('Detener lote y abrir NCR si falla verificación')],
        [td('Parámetro fuera de ventana'), td('Poka-yoke / receta bloqueada'), td('Escalar a Ingeniería de Proceso')],
      ]),
      h(2, '5. Procedimiento'),
      tableOf([
        [th('Paso'), th('Actividad'), th('CTQ'), th('Registro')],
        [td('1'), td('Validar WO, modelo y revisión antes de iniciar'), td('Sí'), td('Terminal AXOS')],
        [td('2'), td('Preparar estación y material según BOM vigente'), td('Sí'), td('Checklist')],
        [td('3'), td('Ejecutar operación y confirmar resultado'), td('No'), td('Backflush / evento MES')],
      ]),
      h(2, '6. Registros y retención'),
      bullets(['Checklist de arranque de línea.', 'Evidencia de inspección de primera pieza.', 'Eventos MES vinculados a WO/lote.']),
      h(2, '7. Aprobaciones'),
      approvalBlock(),
      h(2, '8. Historial de revisiones'),
      revisionBlock(),
    ),
  },
  {
    id: 'work-instruction-premium', title: 'Work Instruction premium', description: 'Instrucción visual por operación con CTQ, herramientas y reacción.', category: 'Calidad y planta', accent: '#0284c7',
    build: () => controlledDoc(
      { documentNumber: 'WI-000', revision: 'A', owner: 'Ingeniería de Manufactura', department: 'Producción', effectiveDate: new Date().toLocaleDateString('es-ES'), status: 'Draft', customer: 'Cliente', model: 'Modelo' },
      docTitle('Work Instruction — Operación crítica'),
      mixedP([field('documentNumber', 'No. documento', 'WI-000'), txt(' · '), field('model', 'Modelo', 'Modelo'), txt(' · '), axosRef('work_order', 'WO-000', 'WO WO-000')], { styleName: 'subtitle' }),
      controlGrid([
        ['Operación / Estación', 'OP-010 · Estación'],
        ['Herramental', 'Fixture / Torque / Programa'],
        ['Tiempo estándar', '__ segundos'],
        ['Skill requerido', 'Operador certificado'],
      ]),
      h(2, 'Preparación de estación'),
      tasks(['Validar versión vigente de esta instrucción', 'Confirmar material contra BOM', 'Verificar herramienta calibrada', 'Confirmar ESD / 5S']),
      h(2, 'Secuencia visual de trabajo'),
      tableOf([
        [th('Imagen / Evidencia'), th('Paso'), th('Qué hacer'), th('Punto clave'), th('Defecto si falla')],
        [td('[Insertar imagen]'), td('1'), td('Colocar ensamble en fixture'), td('Orientación contra poka-yoke'), td('Daño mecánico / mala orientación')],
        [td('[Insertar imagen]'), td('2'), td('Aplicar torque especificado'), td('Torque __ ± __'), td('Falla funcional / retrabajo')],
        [td('[Insertar imagen]'), td('3'), td('Escanear serial y liberar estación'), td('Serial legible y único'), td('Pérdida de trazabilidad')],
      ]),
      h(2, 'Plan de reacción'),
      callout('danger', 'Si se detecta defecto crítico: detener operación, contener WIP desde última pieza buena y abrir NCR.'),
      tableOf([
        [th('Evento'), th('Contención'), th('Escalamiento'), th('Registro')],
        [td('Herramienta fuera de calibración'), td('Bloquear estación'), td('Calidad + Metrología'), td('NCR / mantenimiento')],
        [td('Material incorrecto'), td('Segregar lote'), td('Materiales + Supervisor'), td('Evento MES')],
      ]),
      approvalBlock(),
    ),
  },
  {
    id: 'ppap-packet', title: 'Paquete PPAP', description: 'Checklist PPAP con evidencias, PSW y aprobación del cliente.', category: 'Calidad y planta', accent: '#16a34a',
    build: () => controlledDoc(
      { documentNumber: 'PPAP-000', revision: 'A', owner: 'Calidad Proveedores', department: 'Calidad', effectiveDate: new Date().toLocaleDateString('es-ES'), status: 'Draft', customer: 'Cliente', model: 'Número de parte' },
      docTitle('PPAP — Production Part Approval Process'),
      mixedP([txt('Cliente '), field('customer', 'Cliente', 'Cliente'), txt(' · Parte '), field('model', 'Modelo / Parte', 'Número de parte'), txt(' · '), axosRef('supplier', 'SUP-000', 'Proveedor SUP-000')], { styleName: 'subtitle' }),
      controlGrid([
        ['Nivel PPAP', 'Nivel 3'],
        ['Motivo de envío', 'Nuevo producto / cambio / corrección'],
        ['Proveedor / Planta', '____'],
        ['Fecha objetivo', '____'],
      ]),
      h(2, 'Checklist de elementos PPAP'),
      tableOf([
        [th('No.'), th('Elemento'), th('Requerido'), th('Evidencia / archivo'), th('Estatus')],
        [td('1'), td('Design Records'), td('Sí'), td('Dibujo aprobado'), td('Pendiente')],
        [td('2'), td('Engineering Change Documents'), td('Si aplica'), td('ECO / desviación'), td('Pendiente')],
        [td('3'), td('Customer Engineering Approval'), td('Si aplica'), td('Aprobación cliente'), td('Pendiente')],
        [td('4'), td('Design FMEA'), td('Si aplica'), td('DFMEA'), td('Pendiente')],
        [td('5'), td('Process Flow Diagram'), td('Sí'), td('Flujo de proceso'), td('Pendiente')],
        [td('6'), td('Process FMEA'), td('Sí'), td('PFMEA'), td('Pendiente')],
        [td('7'), td('Control Plan'), td('Sí'), td('Plan de control'), td('Pendiente')],
        [td('8'), td('MSA / Gage R&R'), td('Sí'), td('Estudios MSA'), td('Pendiente')],
        [td('9'), td('Dimensional Results'), td('Sí'), td('FAI / resultados'), td('Pendiente')],
        [td('10'), td('Material / Performance Results'), td('Sí'), td('Certificados / pruebas'), td('Pendiente')],
        [td('11'), td('Initial Process Studies'), td('Si aplica'), td('Cp/Cpk'), td('Pendiente')],
        [td('12'), td('PSW'), td('Sí'), td('Part Submission Warrant'), td('Pendiente')],
      ]),
      h(2, 'Riesgos y condiciones de aprobación'),
      bullets(['Identificar elementos con aprobación condicional.', 'Documentar desviaciones abiertas y fechas de cierre.', 'Vincular NCR/CAPA/ECO cuando aplique.']),
      h(2, 'Aprobación PSW'),
      approvalBlock(),
    ),
  },
  {
    id: 'engineering-change', title: 'Engineering Change Notice', description: 'ECN/ECO con impacto en BOM, routing, calidad y cliente.', category: 'Calidad y planta', accent: '#7c3aed',
    build: () => controlledDoc(
      { documentNumber: 'ECN-000', revision: 'A', owner: 'Ingeniería', department: 'NPI', effectiveDate: new Date().toLocaleDateString('es-ES'), status: 'Draft', customer: 'Cliente', model: 'Modelo' },
      docTitle('Engineering Change Notice (ECN)'),
      mixedP([field('documentNumber', 'No. ECN', 'ECN-000'), txt(' · '), axosRef('engineering_change', 'ECO-000', 'ECO-000'), txt(' · Modelo '), field('model', 'Modelo', 'Modelo')], { styleName: 'subtitle' }),
      h(2, 'Descripción del cambio'),
      p('Describe el cambio propuesto, motivo, origen y fecha efectiva requerida.'),
      h(2, 'Impacto AXOS'),
      tableOf([
        [th('Dominio'), th('Referencia'), th('Impacto'), th('Acción requerida')],
        [td('BOM'), td('BOM actual / nueva rev.'), td('Materiales / alternos'), td('Actualizar y liberar')],
        [td('Routing'), td('Operación afectada'), td('Tiempo estándar / estación'), td('Validar capacidad')],
        [td('Calidad'), td('Plan de control / PFMEA'), td('CTQ / inspección'), td('Actualizar documentos')],
        [td('Cliente'), td('Aprobación'), td('Notificación / PPAP'), td('Obtener waiver si aplica')],
      ]),
      h(2, 'Inventario y WIP afectados'),
      tableOf([
        [th('Ubicación'), th('Cantidad'), th('Disposición'), th('Responsable')],
        [td('Raw material'), td('—'), td('Usar / bloquear / retrabajar'), td('Materiales')],
        [td('WIP'), td('—'), td('Contener desde último punto bueno'), td('Producción')],
        [td('FG'), td('—'), td('Evaluar embarque'), td('Calidad')],
      ]),
      h(2, 'Plan de implementación'),
      tasks(['Liberar nueva revisión documental', 'Actualizar BOM/routing', 'Capacitar operadores', 'Validar primera corrida', 'Cerrar ECO']),
      approvalBlock(),
    ),
  },
  {
    id: 'maintenance-procedure', title: 'Procedimiento de mantenimiento', description: 'LOTO, repuestos, PM/CM y verificación de equipo.', category: 'Calidad y planta', accent: '#f59e0b',
    build: () => controlledDoc(
      { documentNumber: 'MNT-PROC-000', revision: 'A', owner: 'Mantenimiento', department: 'Operaciones', effectiveDate: new Date().toLocaleDateString('es-ES'), status: 'Draft', customer: 'Interno', model: 'Equipo' },
      docTitle('Procedimiento de mantenimiento'),
      mixedP([txt('Equipo: '), field('model', 'Equipo', 'Equipo'), txt(' · Orden: '), axosRef('maintenance_order', 'MNT-000', 'MNT-000')], { styleName: 'subtitle' }),
      callout('danger', 'Aplicar LOTO antes de intervenir equipo. Verificar cero energía y liberar únicamente por personal autorizado.'),
      h(2, 'Alcance y frecuencia'),
      controlGrid([
        ['Tipo', 'Preventivo / Correctivo'],
        ['Frecuencia', 'Diaria / Semanal / Mensual'],
        ['Duración estimada', '__ min'],
        ['Repuestos críticos', '____'],
      ]),
      h(2, 'Herramientas y refacciones'),
      tableOf([
        [th('Recurso'), th('Especificación'), th('Cantidad'), th('Validación')],
        [td('Herramienta'), td('—'), td('1'), td('Calibrada / OK')],
        [td('Refacción'), td('NP —'), td('—'), td('Disponible')],
      ]),
      h(2, 'Secuencia'),
      ordered(['Notificar a producción y poner equipo en modo seguro.', 'Ejecutar LOTO y verificar cero energía.', 'Realizar inspección/servicio según checklist.', 'Retirar herramientas, limpiar área y liberar LOTO.', 'Correr prueba funcional y registrar resultado.']),
      h(2, 'Checklist de cierre'),
      tasks(['Guardas reinstaladas', 'Paro de emergencia validado', 'Prueba funcional OK', 'Orden cerrada con evidencia']),
    ),
  },
  {
    id: 'calibration-procedure', title: 'Procedimiento de calibración', description: 'Instrumentos, patrón, tolerancia e incertidumbre.', category: 'Calidad y planta', accent: '#0891b2',
    build: () => controlledDoc(
      { documentNumber: 'CAL-000', revision: 'A', owner: 'Metrología', department: 'Calidad', effectiveDate: new Date().toLocaleDateString('es-ES'), status: 'Draft', customer: 'Interno', model: 'Instrumento' },
      docTitle('Procedimiento de calibración'),
      controlGrid([
        ['Instrumento', '____'],
        ['Rango', '____'],
        ['Patrón trazable', '____'],
        ['Intervalo de calibración', '____'],
      ]),
      h(2, 'Condiciones ambientales'),
      tableOf([
        [th('Variable'), th('Requisito'), th('Resultado')],
        [td('Temperatura'), td('20–25 °C'), td('')],
        [td('Humedad'), td('30–70% HR'), td('')],
      ]),
      h(2, 'Puntos de calibración'),
      tableOf([
        [th('Punto'), th('Nominal'), th('Patrón'), th('Lectura'), th('Error'), th('Tolerancia'), th('Resultado')],
        [td('1'), td('—'), td('—'), td('—'), td('—'), td('±—'), td('')],
        [td('2'), td('—'), td('—'), td('—'), td('—'), td('±—'), td('')],
        [td('3'), td('—'), td('—'), td('—'), td('—'), td('±—'), td('')],
      ]),
      callout('warning', 'Si el instrumento está fuera de tolerancia, bloquear uso, evaluar producto medido desde la última calibración válida y abrir NCR si aplica.'),
      approvalBlock(),
    ),
  },
  {
    id: 'test-procedure', title: 'Procedimiento de prueba', description: 'Prueba funcional con equipo, límites y criterios pass/fail.', category: 'Calidad y planta', accent: '#2563eb',
    build: () => controlledDoc(
      { documentNumber: 'TEST-000', revision: 'A', owner: 'Test Engineering', department: 'Ingeniería', effectiveDate: new Date().toLocaleDateString('es-ES'), status: 'Draft', customer: 'Cliente', model: 'Modelo' },
      docTitle('Procedimiento de prueba funcional'),
      mixedP([txt('Modelo '), field('model', 'Modelo', 'Modelo'), txt(' · Fixture '), axosRef('fixture', 'FX-000', 'Fixture FX-000'), txt(' · Programa '), axosRef('test_program', 'TP-000', 'TP-000')], { styleName: 'subtitle' }),
      h(2, 'Equipo requerido'),
      tableOf([
        [th('Equipo / fixture'), th('Versión'), th('Calibración'), th('Estado')],
        [td('Fixture'), td('—'), td('—'), td('OK')],
        [td('Software de prueba'), td('—'), td('N/A'), td('Aprobado')],
      ]),
      h(2, 'Criterios de aceptación'),
      tableOf([
        [th('Prueba'), th('Límite inferior'), th('Límite superior'), th('Unidad'), th('Reacción ante falla')],
        [td('Voltaje'), td('—'), td('—'), td('V'), td('Retestar una vez; si falla, NCR')],
        [td('Corriente'), td('—'), td('—'), td('A'), td('Segregar')],
      ]),
      h(2, 'Secuencia de prueba'),
      ordered(['Escanear serial y validar modelo/revisión.', 'Conectar unidad al fixture.', 'Ejecutar programa aprobado.', 'Registrar resultado PASS/FAIL en AXOS.', 'Etiquetar unidad y liberar/someter a MRB.']),
      callout('info', 'La prueba debe generar trazabilidad por serial: operador, fixture, programa, límites y resultado.'),
      approvalBlock(),
    ),
  },
  {
    id: 'customer-spec', title: 'Especificación de cliente', description: 'Requisitos contractuales, CTQ, empaque y aceptación.', category: 'Calidad y planta', accent: '#334155',
    build: () => controlledDoc(
      { documentNumber: 'CUST-SPEC-000', revision: 'A', owner: 'Program Management', department: 'Comercial / Calidad', effectiveDate: new Date().toLocaleDateString('es-ES'), status: 'Draft', customer: 'Cliente', model: 'Modelo' },
      docTitle('Especificación de cliente'),
      mixedP([field('customer', 'Cliente', 'Cliente'), txt(' · '), field('model', 'Modelo', 'Modelo'), txt(' · Cuenta '), axosRef('customer', 'CUST-000', 'CUST-000')], { styleName: 'subtitle' }),
      h(2, 'Requisitos del producto'),
      tableOf([
        [th('Requisito'), th('Fuente'), th('Criterio de aceptación'), th('Evidencia')],
        [td('Dimensional'), td('Dibujo rev. __'), td('Dentro de tolerancia'), td('FAI / inspección')],
        [td('Funcional'), td('Spec cliente'), td('PASS'), td('Reporte de prueba')],
        [td('Cosmético'), td('AQL / estándar'), td('Sin defectos críticos'), td('Inspección final')],
      ]),
      h(2, 'Requisitos logísticos y empaque'),
      bullets(['Etiqueta cliente requerida.', 'Cantidad por empaque.', 'Certificado de conformidad / trazabilidad por lote.']),
      h(2, 'Requisitos de cambio'),
      callout('warning', 'No implementar cambios de material, proceso, proveedor o ubicación sin autorización escrita del cliente cuando aplique.'),
      approvalBlock(),
    ),
  },
  {
    id: 'supplier-spec', title: 'Especificación de proveedor', description: 'Calidad de proveedor, CoC, empaque y SCAR.', category: 'Calidad y planta', accent: '#475569',
    build: () => controlledDoc(
      { documentNumber: 'SUP-SPEC-000', revision: 'A', owner: 'Supplier Quality', department: 'Calidad Proveedores', effectiveDate: new Date().toLocaleDateString('es-ES'), status: 'Draft', customer: 'Interno', model: 'Material' },
      docTitle('Especificación de proveedor'),
      mixedP([txt('Proveedor '), axosRef('supplier', 'SUP-000', 'SUP-000'), txt(' · Material '), axosRef('material', 'MAT-000', 'MAT-000')], { styleName: 'subtitle' }),
      h(2, 'Requisitos de calidad'),
      tableOf([
        [th('Categoría'), th('Requisito'), th('Método de verificación'), th('Reacción')],
        [td('Certificados'), td('CoC / CoA por lote'), td('Revisión documental'), td('Bloquear recibo si falta')],
        [td('Empaque'), td('Protección ESD / humedad'), td('Inspección recibo'), td('NCR proveedor')],
        [td('Cambio'), td('Notificación previa'), td('Aprobación AXOS/cliente'), td('SCAR / contención')],
      ]),
      h(2, 'Criterios de inspección recibo'),
      tableOf([
        [th('Característica'), th('Plan de muestreo'), th('AQL / criterio'), th('Registro')],
        [td('Cantidad'), td('100% documental'), td('Coincide PO/ASN'), td('Recepción')],
        [td('Daño visible'), td('Muestreo'), td('Cero crítico'), td('NCR si aplica')],
      ]),
      approvalBlock(),
    ),
  },
  {
    id: 'quality-manual', title: 'Manual de calidad', description: 'Manual QMS para EMS con procesos, KPIs y auditorías.', category: 'Calidad y planta', accent: '#111827',
    build: () => controlledDoc(
      { documentNumber: 'QM-000', revision: 'A', owner: 'Director de Calidad', department: 'QMS', effectiveDate: new Date().toLocaleDateString('es-ES'), status: 'Draft', customer: 'Interno', model: 'Sistema de calidad' },
      docTitle('Manual de calidad — AXOS EMS'),
      docSubtitle('Sistema de gestión de calidad para manufactura electrónica'),
      { type: 'toc', attrs: { maxLevel: 3 } },
      h(2, 'Política de calidad'),
      callout('success', 'Entregar productos conformes, a tiempo y con trazabilidad completa, impulsando mejora continua y prevención de defectos.'),
      h(2, 'Mapa de procesos'),
      tableOf([
        [th('Proceso'), th('Dueño'), th('Entradas'), th('Salidas'), th('KPI')],
        [td('NPI'), td('Ingeniería'), td('Requisitos cliente'), td('Producto liberado'), td('Launch readiness')],
        [td('Producción'), td('Operaciones'), td('Plan / WO'), td('Producto terminado'), td('OEE / FPY')],
        [td('Calidad'), td('Calidad'), td('Plan control'), td('Liberación / NCR'), td('PPM / CAPA aging')],
      ]),
      h(2, 'Control documental'),
      bullets(['Todo documento controlado debe tener dueño, revisión, fecha efectiva y aprobación.', 'Las copias controladas se exportan desde AXOS Docs con trazabilidad.', 'Documentos obsoletos se retiran del punto de uso.']),
      h(2, 'Auditorías y mejora continua'),
      tasks(['Programa anual de auditoría', 'Revisión de CAPA y efectividad', 'Management review trimestral']),
      revisionBlock(),
    ),
  },
  {
    id: 'production-report', title: 'Reporte de producción', description: 'Salida diaria con WO, OEE, scrap, downtime y acciones.', category: 'Calidad y planta', accent: '#0f766e',
    build: () => controlledDoc(
      { documentNumber: 'PROD-REP-000', revision: 'A', owner: 'Supervisor de Producción', department: 'Operaciones', effectiveDate: new Date().toLocaleDateString('es-ES'), status: 'Draft', customer: 'Interno', model: 'Línea' },
      docTitle('Reporte diario de producción'),
      mixedP([txt('Línea '), field('model', 'Línea', 'Línea'), txt(' · WO principal '), axosRef('work_order', 'WO-000', 'WO-000')], { styleName: 'subtitle' }),
      h(2, 'Resumen del turno'),
      tableOf([
        [th('Turno'), th('Plan'), th('Real'), th('Adherencia'), th('Scrap'), th('OEE')],
        [td('T1'), td('0'), td('0'), td('0%'), td('0'), td('0%')],
        [td('T2'), td('0'), td('0'), td('0%'), td('0'), td('0%')],
        [td('T3'), td('0'), td('0'), td('0%'), td('0'), td('0%')],
      ]),
      h(2, 'Principales paros'),
      tableOf([
        [th('Categoría'), th('Minutos'), th('Causa'), th('Acción')],
        [td('Material'), td('—'), td('—'), td('—')],
        [td('Equipo'), td('—'), td('—'), td('—')],
      ]),
      h(2, 'Calidad'),
      tableOf([
        [th('Defecto'), th('Cantidad'), th('Ubicación'), th('NCR / Acción')],
        [td('—'), td('—'), td('—'), td('—')],
      ]),
      h(2, 'Acciones para siguiente turno'),
      tasks(['Acción 1 — responsable — hora', 'Acción 2 — responsable — hora']),
    ),
  },
  {
    id: 'lessons-learned', title: 'Lecciones aprendidas', description: 'Captura de conocimiento de NPI, calidad y operaciones.', category: 'Calidad y planta', accent: '#9333ea',
    build: () => controlledDoc(
      { documentNumber: 'LL-000', revision: 'A', owner: 'Mejora continua', department: 'NPI / Operaciones', effectiveDate: new Date().toLocaleDateString('es-ES'), status: 'Draft', customer: 'Cliente', model: 'Modelo' },
      docTitle('Lecciones aprendidas'),
      mixedP([txt('Proyecto / modelo '), field('model', 'Modelo', 'Modelo'), txt(' · '), axosRef('project', 'NPI-000', 'NPI-000')], { styleName: 'subtitle' }),
      h(2, 'Contexto'),
      p('Describe el evento, lanzamiento, auditoría, NCR o mejora que originó esta lección.'),
      h(2, 'Qué funcionó'),
      bullets(['Práctica que debe repetirse.', 'Decisión o preparación que redujo riesgo.']),
      h(2, 'Qué debe cambiar'),
      tableOf([
        [th('Hallazgo'), th('Impacto'), th('Contramedida'), th('Documento/proceso a actualizar')],
        [td('—'), td('—'), td('—'), td('SOP / PFMEA / Control Plan')],
      ]),
      h(2, 'Estandarización'),
      tasks(['Actualizar documentos controlados', 'Entrenar al equipo', 'Verificar adopción en auditoría LPA']),
    ),
  },
  {
    id: 'launch-readiness', title: 'Launch Readiness', description: 'Checklist de lanzamiento EMS para NPI y transferencia a producción.', category: 'Calidad y planta', accent: '#0ea5e9',
    build: () => controlledDoc(
      { documentNumber: 'LR-000', revision: 'A', owner: 'NPI', department: 'Ingeniería', effectiveDate: new Date().toLocaleDateString('es-ES'), status: 'Draft', customer: 'Cliente', model: 'Modelo' },
      docTitle('Launch Readiness Review'),
      mixedP([field('customer', 'Cliente', 'Cliente'), txt(' · '), field('model', 'Modelo', 'Modelo'), txt(' · '), axosRef('routing', 'RT-000', 'Routing RT-000')], { styleName: 'subtitle' }),
      h(2, 'Gate summary'),
      tableOf([
        [th('Gate'), th('Criterio'), th('Estatus'), th('Riesgo'), th('Dueño')],
        [td('Diseño'), td('BOM / dibujo liberado'), td('Pendiente'), td('Medio'), td('Ingeniería')],
        [td('Proceso'), td('Routing / WI / fixtures listos'), td('Pendiente'), td('Alto'), td('NPI')],
        [td('Calidad'), td('PFMEA / Control Plan / FAI'), td('Pendiente'), td('Alto'), td('Calidad')],
        [td('Supply'), td('Material crítico disponible'), td('Pendiente'), td('Medio'), td('Compras')],
      ]),
      h(2, 'Checklist de liberación'),
      tasks(['BOM liberada y costeada', 'Routing con tiempos estándar', 'Work Instructions publicadas', 'Plan de control aprobado', 'FAI completado', 'Capacidad validada', 'Empaque aprobado', 'Plan de ramp-up acordado']),
      h(2, 'Decisión'),
      callout('warning', 'Go / Conditional Go / No Go — documentar condiciones abiertas y dueño.'),
      approvalBlock(),
    ),
  },
  {
    id: 'management-review', title: 'Management Review', description: 'Revisión directiva QMS con KPIs, riesgos y acciones.', category: 'Calidad y planta', accent: '#1e3a8a',
    build: () => controlledDoc(
      { documentNumber: 'MR-000', revision: 'A', owner: 'Dirección', department: 'QMS', effectiveDate: new Date().toLocaleDateString('es-ES'), status: 'Draft', customer: 'Interno', model: 'QMS' },
      docTitle('Management Review — Sistema de calidad'),
      docSubtitle('Revisión directiva · ' + new Date().toLocaleDateString('es-ES')),
      h(2, 'Agenda'),
      ordered(['Estado de acciones previas', 'Cambios internos/externos', 'Desempeño de procesos', 'Satisfacción cliente', 'No conformidades y CAPA', 'Riesgos y oportunidades', 'Recursos y decisiones']),
      h(2, 'KPI dashboard'),
      tableOf([
        [th('KPI'), th('Meta'), th('Resultado'), th('Tendencia'), th('Acción')],
        [td('On-time delivery'), td('≥95%'), td('—'), td('—'), td('—')],
        [td('Customer PPM'), td('≤ objetivo'), td('—'), td('—'), td('—')],
        [td('CAPA aging'), td('≤30 días'), td('—'), td('—'), td('—')],
        [td('Audit findings'), td('Cierre a tiempo'), td('—'), td('—'), td('—')],
      ]),
      h(2, 'Decisiones y acciones'),
      tableOf([
        [th('Decisión / acción'), th('Dueño'), th('Fecha compromiso'), th('Criterio de cierre')],
        [td('—'), td('—'), td('—'), td('—')],
      ]),
      approvalBlock(),
    ),
  },
  {
    id: 'eightd', title: 'Reporte 8D', description: 'Las 8 disciplinas de solución de problemas.', category: 'Calidad y planta', accent: '#ef4444',
    build: () => docOf(
      docTitle('Reporte 8D — Solución de problemas'),
      controlGrid([
        ['No. de 8D', '8D-000'],
        ['Cliente / Parte', '____'],
        ['Fecha de apertura', new Date().toLocaleDateString('es-ES')],
        ['Estatus', 'Abierto'],
      ]),
      h(2, 'D1 — Equipo'),
      tableOf([
        [th('Nombre'), th('Rol'), th('Área')],
        [td('—'), td('Líder'), td('Calidad')],
        [td('—'), td('Miembro'), td('Producción')],
      ]),
      h(2, 'D2 — Descripción del problema'),
      p('¿Qué, dónde, cuándo, cuánto? Define el problema con datos (5W2H).'),
      h(2, 'D3 — Acción de contención (ICA)'),
      bullets(['Contención inmediata aplicada el [fecha].', 'Verificación de efectividad de la contención.']),
      h(2, 'D4 — Causa raíz'),
      p('Análisis (5 Por qué / Ishikawa). Causa raíz de ocurrencia y de detección.'),
      tableOf([
        [th('¿Por qué? 1'), th('¿Por qué? 2'), th('¿Por qué? 3'), th('¿Por qué? 4'), th('¿Por qué? 5')],
        [td('—'), td('—'), td('—'), td('—'), td('—')],
      ]),
      h(2, 'D5 — Acción correctiva permanente (PCA)'),
      p('Acción que elimina la causa raíz, validada antes de implementar.'),
      h(2, 'D6 — Implementación y validación'),
      tasks(['PCA implementada en piso', 'Validación con datos posterior a la implementación']),
      h(2, 'D7 — Prevención de recurrencia'),
      bullets(['Actualizar PFMEA / plan de control.', 'Actualizar instrucción de trabajo y lecciones aprendidas.']),
      h(2, 'D8 — Cierre y reconocimiento'),
      callout('success', 'Reconocer al equipo y cerrar formalmente con la firma del cliente / dueño del proceso.'),
    ),
  },
  {
    id: 'fai', title: 'Reporte FAI (AS9102)', description: 'Inspección de primera pieza — Forms 1/2/3.', category: 'Calidad y planta', accent: '#0ea5e9',
    build: () => docOf(
      docTitle('First Article Inspection Report (FAIR)'),
      docSubtitle('AS9102 · ' + new Date().toLocaleDateString('es-ES')),
      h(2, 'Form 1 — Identificación de la pieza'),
      controlGrid([
        ['Número de parte', '____'],
        ['Nombre de la parte', '____'],
        ['Número de revisión', '____'],
        ['Número de dibujo', '____'],
        ['No. de orden / lote', '____'],
        ['FAIR completo / parcial', '____'],
      ]),
      h(2, 'Form 2 — Materiales, procesos especiales y funcional'),
      tableOf([
        [th('Material / Proceso'), th('Especificación'), th('Código / Certificado'), th('Proveedor')],
        [td('—'), td('—'), td('—'), td('—')],
      ]),
      h(2, 'Form 3 — Resultados de características'),
      tableOf([
        [th('No.'), th('Característica (req.)'), th('Tolerancia'), th('Resultado'), th('Instrumento'), th('OK/NOK')],
        [td('1'), td('—'), td('±—'), td('—'), td('—'), td('')],
        [td('2'), td('—'), td('±—'), td('—'), td('—'), td('')],
        [td('3'), td('—'), td('±—'), td('—'), td('—'), td('')],
      ]),
      callout('info', 'Adjunta el dibujo globalizado (ballooned) y los certificados de material referidos en el Form 2.'),
      h(2, 'Disposición'),
      tasks(['Aprobado — libera producción', 'Rechazado — abrir no conformidad']),
    ),
  },
  {
    id: 'controlplan', title: 'Plan de control', description: 'Características, especificación y método de control.', category: 'Calidad y planta', accent: '#16a34a',
    build: () => docOf(
      docTitle('Plan de control'),
      controlGrid([
        ['Número de plan', 'PC-000'],
        ['Modelo / Parte', '____'],
        ['Nivel (Prototipo/Pre/Prod)', 'Producción'],
        ['Fecha', new Date().toLocaleDateString('es-ES')],
      ]),
      h(2, 'Matriz de control'),
      tableOf([
        [th('Op.'), th('Proceso / Estación'), th('Característica'), th('Especificación / Tolerancia'), th('Técnica de medición'), th('Tamaño/Frec. muestra'), th('Método de control'), th('Plan de reacción')],
        [td('10'), td('—'), td('—'), td('±—'), td('—'), td('1 / hora'), td('Carta de control'), td('Contener y avisar')],
        [td('20'), td('—'), td('—'), td('±—'), td('—'), td('100%'), td('Poka-yoke'), td('Paro de línea')],
        [td('30'), td('—'), td('—'), td('±—'), td('—'), td('5 / turno'), td('Inspección visual'), td('Segregar')],
      ]),
      callout('warning', 'Toda característica crítica/significativa (CTQ) debe tener método de control y plan de reacción definidos.'),
    ),
  },
  {
    id: 'audit', title: 'Checklist de auditoría (LPA/5S)', description: 'Criterios, cumplimiento y puntaje.', category: 'Calidad y planta', accent: '#9333ea',
    build: () => docOf(
      docTitle('Checklist de auditoría por capas (LPA)'),
      controlGrid([
        ['Área / Línea', '____'],
        ['Auditor', '____'],
        ['Capa / Nivel', '____'],
        ['Fecha', new Date().toLocaleDateString('es-ES')],
      ]),
      h(2, 'Criterios (5S + estándar)'),
      tableOf([
        [th('No.'), th('Criterio'), th('C / NC'), th('Evidencia / Observación'), th('Acción')],
        [td('1'), td('Seleccionar — sólo lo necesario en la estación'), td(''), td(''), td('')],
        [td('2'), td('Ordenar — un lugar para cada cosa'), td(''), td(''), td('')],
        [td('3'), td('Limpiar — estación y equipo limpios'), td(''), td(''), td('')],
        [td('4'), td('Estandarizar — ayudas visuales vigentes'), td(''), td(''), td('')],
        [td('5'), td('Disciplina — se sigue la instrucción de trabajo'), td(''), td(''), td('')],
        [td('6'), td('Seguridad — EPP y paros de emergencia OK'), td(''), td(''), td('')],
      ]),
      callout('info', 'Puntaje = criterios conformes ÷ total. Toda NC genera una acción con responsable y fecha.'),
      h(2, 'Acciones derivadas'),
      tasks(['[Responsable] — acción correctiva — [fecha]']),
    ),
  },
  {
    id: 'capa', title: 'CAPA', description: 'Acción correctiva y preventiva con verificación.', category: 'Calidad y planta', accent: '#ef4444',
    build: () => docOf(
      docTitle('Acción correctiva / preventiva (CAPA)'),
      controlGrid([
        ['No. de CAPA', 'CAPA-000'],
        ['Origen', 'Auditoría / NCR / Queja / 8D'],
        ['Responsable', '____'],
        ['Fecha límite', '____'],
      ]),
      h(2, 'Descripción del problema'),
      p('Qué se detectó, dónde y su impacto (con datos).'),
      h(2, 'Causa raíz'),
      p('Resultado del análisis de causa raíz (5 Por qué / Ishikawa).'),
      h(2, 'Plan de acción'),
      tableOf([
        [th('No.'), th('Acción'), th('Tipo (Corr./Prev.)'), th('Responsable'), th('Fecha'), th('Estatus')],
        [td('1'), td('—'), td('Correctiva'), td('—'), td('—'), td('Abierta')],
        [td('2'), td('—'), td('Preventiva'), td('—'), td('—'), td('Abierta')],
      ]),
      h(2, 'Verificación de efectividad'),
      tasks(['Evidencia de implementación adjunta', 'Verificación de efectividad con datos (≥30 días)', 'Cierre aprobado por Calidad']),
    ),
  },
  {
    id: 'handover', title: 'Entrega de turno', description: 'Resumen de producción, pendientes y avisos.', category: 'Calidad y planta', accent: '#f59e0b',
    build: () => docOf(
      docTitle('Entrega de turno'),
      controlGrid([
        ['Línea / Celda', '____'],
        ['Turno que entrega', '____'],
        ['Turno que recibe', '____'],
        ['Fecha', new Date().toLocaleDateString('es-ES')],
      ]),
      h(2, 'Resumen de producción'),
      tableOf([
        [th('Modelo / WO'), th('Plan'), th('Real'), th('Scrap'), th('OEE %')],
        [td('—'), td('0'), td('0'), td('0'), td('0%')],
      ]),
      h(2, 'Estado de la línea'),
      bullets(['Paros relevantes y su causa.', 'Estado de materiales / faltantes.', 'Calidad: holds o NCR abiertas.']),
      h(2, 'Pendientes para el siguiente turno'),
      tasks(['Pendiente 1', 'Pendiente 2']),
      callout('warning', 'Avisos de seguridad / 5S antes de iniciar el siguiente turno.'),
    ),
  },
  {
    id: 'ncr', title: 'Reporte de no conformidad (NCR)', description: 'Defecto, contención, disposición (MRB) y cierre.', category: 'Calidad y planta', accent: '#ef4444',
    build: () => docOf(
      docTitle('Reporte de no conformidad (NCR)'),
      controlGrid([
        ['No. de NCR', 'NCR-000'],
        ['Fecha', new Date().toLocaleDateString('es-ES')],
        ['Modelo / Parte', '____'],
        ['WO / Lote', '____'],
        ['Cantidad afectada', '____'],
        ['Detectó', '____'],
      ]),
      h(2, 'Descripción de la no conformidad'),
      p('Qué se detectó, dónde (estación / operación) y contra qué especificación.'),
      callout('danger', 'Contención inmediata: segregar y etiquetar el material no conforme (HOLD).'),
      h(2, 'Disposición (MRB)'),
      tableOf([
        [th('Disposición'), th('Cantidad'), th('Responsable'), th('Justificación')],
        [td('Usar como está'), td('—'), td('—'), td('—')],
        [td('Retrabajo'), td('—'), td('—'), td('—')],
        [td('Reparar'), td('—'), td('—'), td('—')],
        [td('Desecho (scrap)'), td('—'), td('—'), td('—')],
        [td('Devolver a proveedor'), td('—'), td('—'), td('—')],
      ]),
      h(2, 'Seguimiento'),
      tasks(['Abrir CAPA / 8D si es recurrente o crítico', 'Disposición ejecutada y verificada', 'NCR cerrada por Calidad']),
    ),
  },
  {
    id: 'a3', title: 'A3 — Resolución de problemas', description: 'Antecedentes, meta, causa, contramedidas y plan (Toyota A3).', category: 'Calidad y planta', accent: '#9333ea',
    build: () => docOf(
      docTitle('A3 — Resolución de problemas'),
      controlGrid([
        ['Tema', '____'],
        ['Dueño', '____'],
        ['Fecha', new Date().toLocaleDateString('es-ES')],
      ]),
      h(2, '1. Antecedentes'),
      p('Por qué importa este problema (contexto y conexión con los objetivos del negocio).'),
      h(2, '2. Estado actual'),
      p('Qué está pasando hoy, con datos. Adjunta gráfico o diagrama del proceso si aplica.'),
      h(2, '3. Objetivo / Meta'),
      callout('info', 'Meta medible: de [actual] a [objetivo] para [fecha].'),
      h(2, '4. Análisis de causa raíz'),
      p('5 Por qué / Ishikawa hasta llegar a la causa raíz.'),
      h(2, '5. Contramedidas'),
      tableOf([
        [th('No.'), th('Contramedida'), th('Responsable'), th('Fecha')],
        [td('1'), td('—'), td('—'), td('—')],
        [td('2'), td('—'), td('—'), td('—')],
      ]),
      h(2, '6. Plan y seguimiento'),
      tasks(['Implementar contramedidas', 'Confirmar efectividad con datos', 'Estandarizar y compartir lecciones aprendidas']),
    ),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SHEETS (Fortune-sheet data)
// ─────────────────────────────────────────────────────────────────────────────
// Cell DSL: a primitive (string|number) or an object with optional formula `f`
// (+ cached `v`/`m`), number format `fa`, bold `b`, italic `i`, bg, font colour
// `fc`, font size `fs` and alignment `a` ('l'|'c'|'r').
type CellSpec =
  | null | string | number
  | { v?: string | number; f?: string; fa?: string; t?: 'n' | 's'; b?: boolean; i?: boolean; bg?: string; fc?: string; fs?: number; a?: 'l' | 'c' | 'r' };

interface SheetSpec { name: string; rows: CellSpec[][]; cols?: number; widths?: Record<number, number>; freeze?: boolean }

// Pre-format the cached display string so numbers look right on open whether or
// not Fortune-sheet re-derives `m` from `v` + `ct.fa`.
function fmt(v: any, fa: string): string {
  if (typeof v !== 'number' || !isFinite(v)) return String(v ?? '');
  if (fa === '0.0%') return (v * 100).toFixed(1) + '%';
  if (fa === '"$"#,##0.00') return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (fa === '#,##0') return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (fa === '0.0') return v.toFixed(1);
  if (fa === '0.00') return v.toFixed(2);
  return String(v);
}

function buildBook(specs: SheetSpec[]): any[] {
  return specs.map((sh, idx) => {
    const celldata: any[] = [];
    sh.rows.forEach((row, r) => row.forEach((spec, c) => {
      if (spec === null || spec === undefined || spec === '') return;
      let cell: any;
      if (typeof spec === 'object') {
        const t = spec.t ?? (spec.f ? 'n' : (typeof spec.v === 'number' ? 'n' : 's'));
        const fa = spec.fa ?? 'General';
        const raw = spec.v ?? (spec.f ? 0 : '');
        cell = { v: raw, m: fmt(raw, fa), ct: { fa, t } };
        if (spec.f) cell.f = spec.f.startsWith('=') ? spec.f : '=' + spec.f;
        if (spec.b) cell.bl = 1;
        if (spec.i) cell.it = 1;
        if (spec.bg) cell.bg = spec.bg;
        if (spec.fc) cell.fc = spec.fc;
        if (spec.fs) cell.fs = spec.fs;
        if (spec.a) cell.ht = spec.a === 'c' ? 0 : spec.a === 'r' ? 2 : 1;
      } else {
        const t = typeof spec === 'number' ? 'n' : 's';
        cell = { v: spec, m: String(spec), ct: { fa: 'General', t } };
      }
      celldata.push({ r, c, v: cell });
    }));
    const sheet: any = {
      name: sh.name, celldata,
      row: Math.max(60, sh.rows.length + 24), column: sh.cols ?? 26,
      order: idx, status: idx === 0 ? 1 : 0, config: {},
    };
    if (sh.widths) sheet.config.columnlen = sh.widths;
    if (sh.freeze) sheet.frozen = { type: 'row', range: { row_focus: 0, column_focus: 0 } };
    return sheet;
  });
}

// Styled header cell (dark band + white bold) for a "designed" look out of the box.
const H = (v: string, a: 'l' | 'c' | 'r' = 'l'): CellSpec => ({ v, b: true, bg: '#1f2937', fc: '#ffffff', a });
const TOT = (v: string | number, fa = 'General'): CellSpec => ({ v, b: true, bg: '#f1f5f9', fa });
// Bold "total" cell that carries a formula (+ cached value for offline display).
const TF = (f: string, v: number, fa = 'General'): CellSpec => ({ f, v, b: true, bg: '#f1f5f9', fa });
const PCT = '0.0%';
const NUM = '#,##0';
const MONEY = '"$"#,##0.00';

const SHEET_TEMPLATES: TemplateDef[] = [
  { id: 'blank', title: 'En blanco', description: 'Hoja vacía.', category: 'General', accent: '#64748b', build: () => null },

  // ── Manufactura / MES ────────────────────────────────────────────────────────
  {
    id: 'production-schedule', title: 'Programa de producción', description: 'WO, modelo, línea, cantidades y avance.', category: 'Manufactura / MES', accent: '#10b981',
    build: () => buildBook([{
      name: 'Programa', freeze: true,
      widths: { 0: 90, 1: 130, 2: 80, 3: 90, 4: 70, 5: 70, 6: 80, 7: 100, 8: 100 },
      rows: [
        [H('WO'), H('Modelo'), H('Línea'), H('Fecha'), H('Plan', 'r'), H('Real', 'r'), H('Avance', 'r'), H('Estatus'), H('Notas')],
        ['WO-00001', 'MDL-00001', 'L1', '2026-06-16', { v: 250, fa: NUM }, { v: 180, fa: NUM }, { f: '=F2/E2', v: 0.72, fa: PCT }, 'En ejecución', ''],
        ['WO-00002', 'MDL-00002', 'L2', '2026-06-16', { v: 120, fa: NUM }, { v: 120, fa: NUM }, { f: '=F3/E3', v: 1, fa: PCT }, 'Completada', ''],
        ['WO-00003', 'MDL-00001', 'L1', '2026-06-17', { v: 300, fa: NUM }, { v: 0, fa: NUM }, { f: '=F4/E4', v: 0, fa: PCT }, 'Liberada', ''],
        ['', '', '', '', { v: 0, fa: NUM }, { v: 0, fa: NUM }, { v: 0, fa: PCT }, '', ''],
        [TOT('Total'), '', '', '', TF('=SUM(E2:E5)', 670, NUM), TF('=SUM(F2:F5)', 300, NUM), '', '', ''],
      ],
    }]),
  },
  {
    id: 'oee', title: 'Tracker OEE', description: 'Disponibilidad × Rendimiento × Calidad por línea.', category: 'Manufactura / MES', accent: '#10b981',
    build: () => buildBook([{
      name: 'OEE', freeze: true,
      widths: { 0: 110, 1: 80, 2: 120, 3: 120, 4: 100, 5: 90 },
      rows: [
        [H('Línea / Turno'), H('Fecha'), H('Disponibilidad', 'r'), H('Rendimiento', 'r'), H('Calidad', 'r'), H('OEE', 'r')],
        ['L1 · T1', '2026-06-16', { v: 0.92, fa: PCT }, { v: 0.88, fa: PCT }, { v: 0.99, fa: PCT }, { f: '=C2*D2*E2', v: 0.801504, fa: PCT }],
        ['L1 · T2', '2026-06-16', { v: 0.85, fa: PCT }, { v: 0.90, fa: PCT }, { v: 0.97, fa: PCT }, { f: '=C3*D3*E3', v: 0.742050, fa: PCT }],
        ['L2 · T1', '2026-06-16', { v: 0.95, fa: PCT }, { v: 0.93, fa: PCT }, { v: 0.995, fa: PCT }, { f: '=C4*D4*E4', v: 0.878933, fa: PCT }],
        ['', '', { v: 0, fa: PCT }, { v: 0, fa: PCT }, { v: 0, fa: PCT }, { f: '=C5*D5*E5', v: 0, fa: PCT }],
        [TOT('Promedio'), '', TF('=AVERAGE(C2:C4)', 0.906667, PCT), TF('=AVERAGE(D2:D4)', 0.903333, PCT), TF('=AVERAGE(E2:E4)', 0.985, PCT), { b: true, bg: '#ecfdf5', fc: '#065f46', f: '=AVERAGE(F2:F4)', v: 0.807496, fa: PCT }],
      ],
    }]),
  },
  {
    id: 'inventory-count', title: 'Conteo de inventario', description: 'Sistema vs físico, diferencia y valor.', category: 'Manufactura / MES', accent: '#10b981',
    build: () => buildBook([{
      name: 'Conteo', freeze: true,
      widths: { 0: 110, 1: 200, 2: 90, 3: 90, 4: 90, 5: 90, 6: 110 },
      rows: [
        [H('SKU / NP'), H('Descripción'), H('Sistema', 'r'), H('Físico', 'r'), H('Diferencia', 'r'), H('Costo U.', 'r'), H('Valor dif.', 'r')],
        ['PCB-DRV-01', 'Tarjeta controladora', { v: 500, fa: NUM }, { v: 498, fa: NUM }, { f: '=D2-C2', v: -2, fa: NUM }, { v: 12.5, fa: MONEY }, { f: '=E2*F2', v: -25, fa: MONEY }],
        ['MOSFET-40V', 'MOSFET 40V', { v: 3000, fa: NUM }, { v: 3010, fa: NUM }, { f: '=D3-C3', v: 10, fa: NUM }, { v: 0.35, fa: MONEY }, { f: '=E3*F3', v: 3.5, fa: MONEY }],
        ['CONN-8P', 'Conector 8 pines', { v: 1000, fa: NUM }, { v: 1000, fa: NUM }, { f: '=D4-C4', v: 0, fa: NUM }, { v: 0.8, fa: MONEY }, { f: '=E4*F4', v: 0, fa: MONEY }],
        ['', '', { v: 0, fa: NUM }, { v: 0, fa: NUM }, { f: '=D5-C5', v: 0, fa: NUM }, { v: 0, fa: MONEY }, { f: '=E5*F5', v: 0, fa: MONEY }],
        [TOT('Total'), '', '', '', '', '', { b: true, bg: '#f1f5f9', f: '=SUM(G2:G5)', v: -21.5, fa: MONEY }],
      ],
    }]),
  },
  {
    id: 'cycle-count', title: 'Conteo cíclico', description: 'Exactitud de inventario por ubicación (ABC).', category: 'Manufactura / MES', accent: '#10b981',
    build: () => buildBook([{
      name: 'Cíclico', freeze: true,
      widths: { 0: 100, 1: 110, 2: 70, 3: 90, 4: 90, 5: 100 },
      rows: [
        [H('Ubicación'), H('SKU / NP'), H('Clase'), H('Sistema', 'r'), H('Contado', 'r'), H('Exactitud', 'r')],
        ['A-01-01', 'PCB-DRV-01', 'A', { v: 500, fa: NUM }, { v: 498, fa: NUM }, { f: '=1-ABS(E2-D2)/D2', v: 0.996, fa: PCT }],
        ['A-01-02', 'MOSFET-40V', 'A', { v: 3000, fa: NUM }, { v: 3010, fa: NUM }, { f: '=1-ABS(E3-D3)/D3', v: 0.996667, fa: PCT }],
        ['B-02-05', 'CONN-8P', 'B', { v: 1000, fa: NUM }, { v: 1000, fa: NUM }, { f: '=1-ABS(E4-D4)/D4', v: 1, fa: PCT }],
        [TOT('Exactitud global'), '', '', '', '', { b: true, bg: '#ecfdf5', fc: '#065f46', f: '=AVERAGE(F2:F4)', v: 0.997556, fa: PCT }],
      ],
    }]),
  },
  {
    id: 'defect-pareto', title: 'Bitácora / Pareto de defectos', description: 'Conteo, % y % acumulado para Pareto.', category: 'Manufactura / MES', accent: '#ef4444',
    build: () => buildBook([{
      name: 'Pareto', freeze: true,
      widths: { 0: 200, 1: 90, 2: 90, 3: 110 },
      rows: [
        [H('Modo de defecto'), H('Cantidad', 'r'), H('% del total', 'r'), H('% acumulado', 'r')],
        ['Soldadura fría', { v: 48, fa: NUM }, { f: '=B2/$B$7', v: 0.436364, fa: PCT }, { f: '=SUM($B$2:B2)/$B$7', v: 0.436364, fa: PCT }],
        ['Componente faltante', { v: 31, fa: NUM }, { f: '=B3/$B$7', v: 0.281818, fa: PCT }, { f: '=SUM($B$2:B3)/$B$7', v: 0.718182, fa: PCT }],
        ['Polaridad invertida', { v: 18, fa: NUM }, { f: '=B4/$B$7', v: 0.163636, fa: PCT }, { f: '=SUM($B$2:B4)/$B$7', v: 0.881818, fa: PCT }],
        ['Rayadura cosmética', { v: 9, fa: NUM }, { f: '=B5/$B$7', v: 0.081818, fa: PCT }, { f: '=SUM($B$2:B5)/$B$7', v: 0.963636, fa: PCT }],
        ['Otro', { v: 4, fa: NUM }, { f: '=B6/$B$7', v: 0.036364, fa: PCT }, { f: '=SUM($B$2:B6)/$B$7', v: 1, fa: PCT }],
        [TOT('Total'), TF('=SUM(B2:B6)', 110, NUM), '', ''],
      ],
    }]),
  },
  {
    id: 'capacity-plan', title: 'Plan de capacidad', description: 'Demanda vs capacidad y utilización por recurso.', category: 'Manufactura / MES', accent: '#0ea5e9',
    build: () => buildBook([{
      name: 'Capacidad', freeze: true,
      widths: { 0: 130, 1: 110, 2: 110, 3: 100, 4: 100 },
      rows: [
        [H('Recurso / Línea'), H('Demanda (h)', 'r'), H('Capacidad (h)', 'r'), H('Utilización', 'r'), H('Holgura (h)', 'r')],
        ['Línea 1 (SMT)', { v: 168, fa: NUM }, { v: 200, fa: NUM }, { f: '=B2/C2', v: 0.84, fa: PCT }, { f: '=C2-B2', v: 32, fa: NUM }],
        ['Línea 2 (Ensamble)', { v: 190, fa: NUM }, { v: 200, fa: NUM }, { f: '=B3/C3', v: 0.95, fa: PCT }, { f: '=C3-B3', v: 10, fa: NUM }],
        ['Prueba funcional', { v: 210, fa: NUM }, { v: 200, fa: NUM }, { f: '=B4/C4', v: 1.05, fa: PCT }, { f: '=C4-B4', v: -10, fa: NUM }],
        [TOT('Total'), TF('=SUM(B2:B4)', 568, NUM), TF('=SUM(C2:C4)', 600, NUM), TF('=B5/C5', 0.946667, PCT), TF('=C5-B5', 32, NUM)],
      ],
    }]),
  },
  {
    id: 'maintenance-log', title: 'Bitácora de mantenimiento', description: 'Órdenes, tipo, MTTR y estatus.', category: 'Manufactura / MES', accent: '#f59e0b',
    build: () => buildBook([{
      name: 'Mantenimiento', freeze: true,
      widths: { 0: 90, 1: 130, 2: 110, 3: 90, 4: 90, 5: 100, 6: 100 },
      rows: [
        [H('Orden'), H('Equipo'), H('Tipo'), H('Inicio'), H('Fin'), H('MTTR (h)', 'r'), H('Estatus')],
        ['MNT-001', 'Horno reflujo', 'Preventivo', '2026-06-15', '2026-06-15', { v: 2.5, fa: '0.0' }, 'Cerrada'],
        ['MNT-002', 'Pick & Place L1', 'Correctivo', '2026-06-16', '', { v: 0, fa: '0.0' }, 'Abierta'],
        ['', '', '', '', '', { v: 0, fa: '0.0' }, ''],
        [TOT('MTTR prom.'), '', '', '', '', TF('=AVERAGE(F2:F3)', 1.25, '0.0'), ''],
      ],
    }]),
  },
  {
    id: 'downtime', title: 'Bitácora de paros (Andon)', description: 'Eventos de paro, duración y % del total para Pareto.', category: 'Manufactura / MES', accent: '#ef4444',
    build: () => buildBook([{
      name: 'Paros', freeze: true,
      widths: { 0: 100, 1: 70, 2: 120, 3: 200, 4: 80, 5: 110 },
      rows: [
        [H('Fecha'), H('Línea'), H('Categoría'), H('Causa'), H('Min', 'r'), H('% del total', 'r')],
        ['2026-06-16', 'L1', 'Material', 'Faltante en línea', { v: 42, fa: NUM }, { f: '=E2/$E$6', v: 0.365217, fa: PCT }],
        ['2026-06-16', 'L1', 'Máquina', 'Falla pick & place', { v: 30, fa: NUM }, { f: '=E3/$E$6', v: 0.260870, fa: PCT }],
        ['2026-06-16', 'L1', 'Cambio', 'Setup de modelo', { v: 25, fa: NUM }, { f: '=E4/$E$6', v: 0.217391, fa: PCT }],
        ['2026-06-16', 'L1', 'Calidad', 'Defecto de soldadura', { v: 18, fa: NUM }, { f: '=E5/$E$6', v: 0.156522, fa: PCT }],
        [TOT('Total'), '', '', '', TF('=SUM(E2:E5)', 115, NUM), TF('=SUM(F2:F5)', 1, PCT)],
      ],
    }]),
  },

  {
    id: 'bom-costing', title: 'BOM Costing', description: 'Explosión de costo estándar: consumo, scrap, compra y make/buy.', category: 'Manufactura / MES', accent: '#0f766e',
    build: () => buildBook([{
      name: 'BOM Costing', freeze: true,
      widths: { 0: 120, 1: 220, 2: 80, 3: 90, 4: 90, 5: 100, 6: 110, 7: 90 },
      rows: [
        [H('Nivel'), H('Componente'), H('Tipo'), H('Qty/BOM', 'r'), H('Scrap %', 'r'), H('Costo U.', 'r'), H('Costo ext.', 'r'), H('Fuente')],
        ['0', 'AXOS-ASSY-1000 Ensamble final', 'Make', { v: 1, fa: '0.00' }, { v: 0, fa: PCT }, { v: 0, fa: MONEY }, { v: 0, fa: MONEY }, 'Producción'],
        ['1', 'PCB-DRV-01 Tarjeta controladora', 'Buy', { v: 1, fa: '0.00' }, { v: 0.02, fa: PCT }, { v: 12.5, fa: MONEY }, { f: '=D3*(1+E3)*F3', v: 12.75, fa: MONEY }, 'Inventario'],
        ['1', 'HARNESS-08 Arnés 8 pines', 'Buy', { v: 2, fa: '0.00' }, { v: 0.01, fa: PCT }, { v: 3.2, fa: MONEY }, { f: '=D4*(1+E4)*F4', v: 6.464, fa: MONEY }, 'Proveedor'],
        ['1', 'LABOR-ASSY Mano de obra', 'Make', { v: 0.35, fa: '0.00' }, { v: 0, fa: PCT }, { v: 28, fa: MONEY }, { f: '=D5*(1+E5)*F5', v: 9.8, fa: MONEY }, 'Ruta'],
        ['1', 'OH-SMT Overhead SMT', 'Make', { v: 0.18, fa: '0.00' }, { v: 0, fa: PCT }, { v: 45, fa: MONEY }, { f: '=D6*(1+E6)*F6', v: 8.1, fa: MONEY }, 'Centro costo'],
        [TOT('Costo estándar'), '', '', '', '', '', { b: true, bg: '#ecfdf5', fc: '#065f46', f: '=SUM(G3:G6)', v: 37.114, fa: MONEY }, ''],
        [TOT('Margen objetivo'), '', '', '', '', { v: 0.32, fa: PCT }, { b: true, bg: '#f1f5f9', f: '=G7/(1-F8)', v: 54.579, fa: MONEY }, 'Precio sugerido'],
      ],
    }]),
  },
  {
    id: 'oee-calculator', title: 'OEE Calculator', description: 'Calculadora de disponibilidad, rendimiento, calidad y pérdidas por turno.', category: 'Manufactura / MES', accent: '#16a34a',
    build: () => buildBook([{
      name: 'OEE Calculator', freeze: true,
      widths: { 0: 210, 1: 110, 2: 110, 3: 140 },
      rows: [
        [H('Entrada'), H('Valor', 'r'), H('Unidad'), H('Notas')],
        ['Tiempo planificado', { v: 480, fa: NUM }, 'min', 'Duración de turno'],
        ['Paros no planeados', { v: 55, fa: NUM }, 'min', 'Andon / mantenimiento'],
        ['Tiempo operativo', { f: '=B2-B3', v: 425, fa: NUM }, 'min', ''],
        ['Ciclo ideal', { v: 0.85, fa: '0.00' }, 'min/pza', 'Tiempo estándar'],
        ['Producción total', { v: 470, fa: NUM }, 'pzas', 'Buenas + scrap'],
        ['Piezas buenas', { v: 452, fa: NUM }, 'pzas', 'Liberadas por calidad'],
        [TOT('Disponibilidad'), { b: true, bg: '#ecfdf5', fc: '#065f46', f: '=B4/B2', v: 0.885417, fa: PCT }, '', 'Tiempo operativo / planificado'],
        [TOT('Rendimiento'), { b: true, bg: '#eff6ff', fc: '#1d4ed8', f: '=B5*B6/B4', v: 0.94, fa: PCT }, '', 'Ciclo ideal × total / operativo'],
        [TOT('Calidad'), { b: true, bg: '#fefce8', fc: '#a16207', f: '=B7/B6', v: 0.961702, fa: PCT }, '', 'Buenas / total'],
        [TOT('OEE'), { b: true, bg: '#dcfce7', fc: '#166534', f: '=B8*B9*B10', v: 0.800567, fa: PCT }, '', 'A × R × Q'],
      ],
    }]),
  },
  {
    id: 'inventory-abc', title: 'Inventory ABC', description: 'Clasificación ABC por valor anual de consumo e inventario conectado.', category: 'Manufactura / MES', accent: '#0891b2',
    build: () => buildBook([{
      name: 'Inventory ABC', freeze: true,
      widths: { 0: 120, 1: 190, 2: 100, 3: 110, 4: 120, 5: 120, 6: 70 },
      rows: [
        [H('SKU / NP'), H('Descripción'), H('Consumo anual', 'r'), H('Costo U.', 'r'), H('Valor anual', 'r'), H('% acumulado', 'r'), H('Clase')],
        ['PCB-DRV-01', 'Tarjeta controladora', { v: 5200, fa: NUM }, { v: 12.5, fa: MONEY }, { f: '=C2*D2', v: 65000, fa: MONEY }, { f: '=SUM($E$2:E2)/$E$7', v: 0.646, fa: PCT }, 'A'],
        ['MCU-STM32', 'Microcontrolador', { v: 5000, fa: NUM }, { v: 4.1, fa: MONEY }, { f: '=C3*D3', v: 20500, fa: MONEY }, { f: '=SUM($E$2:E3)/$E$7', v: 0.85, fa: PCT }, 'A'],
        ['HARNESS-08', 'Arnés 8 pines', { v: 7400, fa: NUM }, { v: 1.7, fa: MONEY }, { f: '=C4*D4', v: 12580, fa: MONEY }, { f: '=SUM($E$2:E4)/$E$7', v: 0.975, fa: PCT }, 'B'],
        ['LABEL-QA', 'Etiqueta QA', { v: 8500, fa: NUM }, { v: 0.12, fa: MONEY }, { f: '=C5*D5', v: 1020, fa: MONEY }, { f: '=SUM($E$2:E5)/$E$7', v: 0.985, fa: PCT }, 'C'],
        ['SCREW-M3', 'Tornillo M3', { v: 30000, fa: NUM }, { v: 0.05, fa: MONEY }, { f: '=C6*D6', v: 1500, fa: MONEY }, { f: '=SUM($E$2:E6)/$E$7', v: 1, fa: PCT }, 'C'],
        [TOT('Total'), '', '', '', TF('=SUM(E2:E6)', 100600, MONEY), '', ''],
      ],
    }]),
  },
  {
    id: 'supplier-scorecard', title: 'Supplier Scorecard', description: 'OTD, calidad, costo y respuesta ponderados por proveedor.', category: 'Manufactura / MES', accent: '#7c3aed',
    build: () => buildBook([{
      name: 'Supplier Scorecard', freeze: true,
      widths: { 0: 170, 1: 90, 2: 90, 3: 90, 4: 90, 5: 100, 6: 90 },
      rows: [
        [H('Proveedor'), H('OTD', 'r'), H('Calidad', 'r'), H('Costo', 'r'), H('Respuesta', 'r'), H('Score', 'r'), H('Estatus')],
        ['North Components', { v: 0.96, fa: PCT }, { v: 0.985, fa: PCT }, { v: 0.91, fa: PCT }, { v: 0.94, fa: PCT }, { f: '=B2*0.35+C2*0.35+D2*0.15+E2*0.15', v: 0.95625, fa: PCT }, 'Preferente'],
        ['Acme Electronics', { v: 0.88, fa: PCT }, { v: 0.965, fa: PCT }, { v: 0.94, fa: PCT }, { v: 0.82, fa: PCT }, { f: '=B3*0.35+C3*0.35+D3*0.15+E3*0.15', v: 0.90925, fa: PCT }, 'Aprobado'],
        ['Fasteners MX', { v: 0.78, fa: PCT }, { v: 0.92, fa: PCT }, { v: 0.97, fa: PCT }, { v: 0.75, fa: PCT }, { f: '=B4*0.35+C4*0.35+D4*0.15+E4*0.15', v: 0.853, fa: PCT }, 'Plan mejora'],
        [TOT('Pesos'), { v: 0.35, fa: PCT }, { v: 0.35, fa: PCT }, { v: 0.15, fa: PCT }, { v: 0.15, fa: PCT }, TF('=SUM(B5:E5)', 1, PCT), ''],
      ],
    }]),
  },


  // ── Negocio ──────────────────────────────────────────────────────────────────
  {
    id: 'budget', title: 'Presupuesto mensual', description: 'Presupuesto vs real con diferencia y totales.', category: 'Negocio', accent: '#2563eb',
    build: () => buildBook([{
      name: 'Presupuesto', freeze: true,
      widths: { 0: 160, 1: 120, 2: 120, 3: 120 },
      rows: [
        [H('Categoría'), H('Presupuesto', 'r'), H('Real', 'r'), H('Diferencia', 'r')],
        ['Ingresos', { v: 0, fa: MONEY }, { v: 0, fa: MONEY }, { f: '=C2-B2', v: 0, fa: MONEY }],
        ['Vivienda', { v: 0, fa: MONEY }, { v: 0, fa: MONEY }, { f: '=C3-B3', v: 0, fa: MONEY }],
        ['Alimentación', { v: 0, fa: MONEY }, { v: 0, fa: MONEY }, { f: '=C4-B4', v: 0, fa: MONEY }],
        ['Transporte', { v: 0, fa: MONEY }, { v: 0, fa: MONEY }, { f: '=C5-B5', v: 0, fa: MONEY }],
        ['Otros', { v: 0, fa: MONEY }, { v: 0, fa: MONEY }, { f: '=C6-B6', v: 0, fa: MONEY }],
        [TOT('Total'), TF('=SUM(B2:B6)', 0, MONEY), TF('=SUM(C2:C6)', 0, MONEY), TF('=SUM(D2:D6)', 0, MONEY)],
      ],
    }]),
  },
  {
    id: 'inventory', title: 'Inventario', description: 'Artículos, cantidades, precio y valor total.', category: 'Negocio', accent: '#2563eb',
    build: () => buildBook([{
      name: 'Inventario', freeze: true,
      widths: { 0: 200, 1: 110, 2: 90, 3: 100, 4: 110 },
      rows: [
        [H('Artículo'), H('SKU'), H('Cantidad', 'r'), H('Precio', 'r'), H('Total', 'r')],
        ['', '', { v: 0, fa: NUM }, { v: 0, fa: MONEY }, { f: '=C2*D2', v: 0, fa: MONEY }],
        ['', '', { v: 0, fa: NUM }, { v: 0, fa: MONEY }, { f: '=C3*D3', v: 0, fa: MONEY }],
        ['', '', { v: 0, fa: NUM }, { v: 0, fa: MONEY }, { f: '=C4*D4', v: 0, fa: MONEY }],
        [TOT('Total'), '', '', '', TF('=SUM(E2:E4)', 0, MONEY)],
      ],
    }]),
  },
  {
    id: 'tracker', title: 'Seguimiento de tareas', description: 'Tareas, responsable, fecha y estado.', category: 'Negocio', accent: '#2563eb',
    build: () => buildBook([{
      name: 'Tareas', freeze: true,
      widths: { 0: 240, 1: 140, 2: 110, 3: 110 },
      rows: [
        [H('Tarea'), H('Responsable'), H('Fecha límite'), H('Estado')],
        ['', '', '', 'Pendiente'],
        ['', '', '', 'Pendiente'],
        ['', '', '', 'Pendiente'],
      ],
    }]),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SLIDES (painted with Fabric — real palettes, backgrounds, hierarchy)
// ─────────────────────────────────────────────────────────────────────────────
interface Palette {
  id: string;
  bg: string;       // slide background
  panel: string;    // surface / card panel
  ink: string;      // primary text
  sub: string;      // muted / secondary text
  accent: string;   // brand accent
  accent2: string;  // secondary accent (variety / second column)
  onAccent: string; // text drawn on top of the accent colour
  font: string;
}

// Aligned to the editor's SLIDE_THEMES slots where it helps theme-remapping, but
// each template renders its literal colours regardless of the active theme.
const P_CORP: Palette = { id: 'corp', bg: '#ffffff', panel: '#eef2ff', ink: '#0f172a', sub: '#64748b', accent: '#2563eb', accent2: '#1e40af', onAccent: '#ffffff', font: 'sans-serif' };
const P_DARK: Palette = { id: 'dark', bg: '#0f172a', panel: '#1e293b', ink: '#f8fafc', sub: '#94a3b8', accent: '#38bdf8', accent2: '#818cf8', onAccent: '#0f172a', font: 'sans-serif' };
const P_MIN: Palette = { id: 'min', bg: '#ffffff', panel: '#f4f4f5', ink: '#18181b', sub: '#71717a', accent: '#0a0a0a', accent2: '#52525b', onAccent: '#ffffff', font: 'sans-serif' };
const P_IND: Palette = { id: 'ind', bg: '#0f1115', panel: '#1b1f27', ink: '#f3f4f6', sub: '#9ca3af', accent: '#f59e0b', accent2: '#ea580c', onAccent: '#111827', font: 'sans-serif' };

interface Kit {
  W: number; H: number; p: Palette;
  slide: (draw: (c: any) => void) => any;
  bgSlide: (bg: string, draw: (c: any) => void) => any;
  text: (t: string, o?: any) => any;
  rect: (o: any) => any;
  circ: (o: any) => any;
  line: (pts: number[], o?: any) => any;
  tri: (o: any) => any;
  poly: (pts: { x: number; y: number }[], o?: any) => any;
}

type Paint = (k: Kit) => any;

async function renderDeck(p: Palette, paints: Paint[]): Promise<any> {
  const fabric = await import('fabric');
  const { StaticCanvas, Textbox, Rect, Circle, Line, Triangle, Polygon } = fabric as any;
  const W = 960, H = 540;
  const newSlide = (bg: string, draw: (c: any) => void) => {
    const c = new StaticCanvas(document.createElement('canvas'), { width: W, height: H, backgroundColor: bg });
    draw(c);
    c.renderAll();
    const json = c.toJSON();
    c.dispose();
    return json;
  };
  const kit: Kit = {
    W, H, p,
    slide: (draw) => newSlide(p.bg, draw),
    bgSlide: (bg, draw) => newSlide(bg, draw),
    text: (t, o = {}) => new Textbox(t, { fontFamily: p.font, fill: p.ink, ...o }),
    rect: (o) => new Rect(o),
    circ: (o) => new Circle(o),
    line: (pts, o = {}) => new Line(pts, o),
    tri: (o) => new Triangle(o),
    poly: (pts, o = {}) => new Polygon(pts, o),
  };
  const slides: any[] = [];
  for (const paint of paints) slides.push(paint(kit));
  return { version: 2, slides };
}

// Small uppercase "eyebrow" (accent square + tracked label) used across layouts.
function eyebrow(c: any, k: Kit, x: number, y: number, label: string, color?: string) {
  const col = color ?? k.p.accent;
  c.add(k.rect({ left: x, top: y + 2, width: 22, height: 6, fill: col, rx: 3, ry: 3 }));
  c.add(k.text(label.toUpperCase(), { left: x + 32, top: y - 5, width: 760, fontSize: 14, fill: col, fontWeight: 'bold', charSpacing: 140 }));
}
// Evenly spread n items across a row → [{ x, w }].
function spread(left: number, total: number, n: number, gap: number) {
  const w = (total - gap * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => ({ x: left + i * (w + gap), w }));
}
const bulletText = (items: string[]) => items.map((b) => '•   ' + b).join('\n');

// ── Layout builders (palette comes from the kit) ─────────────────────────────
interface CoverOpts { variant?: 'band' | 'split' | 'minimal'; eyebrow?: string; title: string; subtitle?: string; footer?: string }
const cover = (o: CoverOpts): Paint => (k) => {
  const p = k.p; const v = o.variant ?? 'band';
  if (v === 'split') {
    return k.slide((c) => {
      c.add(k.rect({ left: 0, top: 0, width: 360, height: 540, fill: p.accent }));
      c.add(k.circ({ left: -90, top: 360, radius: 150, fill: p.accent2, opacity: 0.45 }));
      if (o.eyebrow) c.add(k.text(o.eyebrow.toUpperCase(), { left: 48, top: 60, width: 280, fontSize: 14, fill: p.onAccent, fontWeight: 'bold', charSpacing: 160, opacity: 0.85 }));
      c.add(k.rect({ left: 48, top: 110, width: 64, height: 8, fill: p.onAccent, rx: 4, ry: 4, opacity: 0.9 }));
      c.add(k.text(o.title, { left: 410, top: 180, width: 500, fontSize: 52, fontWeight: 'bold', fill: p.ink, lineHeight: 1.05 }));
      if (o.subtitle) c.add(k.text(o.subtitle, { left: 410, top: 320, width: 500, fontSize: 24, fill: p.sub }));
      if (o.footer) c.add(k.text(o.footer, { left: 410, top: 470, width: 500, fontSize: 16, fill: p.sub }));
    });
  }
  if (v === 'minimal') {
    return k.slide((c) => {
      c.add(k.rect({ left: 80, top: 196, width: 4, height: 150, fill: p.accent }));
      if (o.eyebrow) c.add(k.text(o.eyebrow.toUpperCase(), { left: 108, top: 188, width: 760, fontSize: 14, fill: p.sub, fontWeight: 'bold', charSpacing: 200 }));
      c.add(k.text(o.title, { left: 106, top: 218, width: 720, fontSize: 60, fontWeight: 'bold', fill: p.ink, lineHeight: 1.04 }));
      if (o.subtitle) c.add(k.text(o.subtitle, { left: 108, top: 330, width: 700, fontSize: 22, fill: p.sub }));
      if (o.footer) c.add(k.text(o.footer, { left: 108, top: 470, width: 700, fontSize: 15, fill: p.sub, charSpacing: 40 }));
    });
  }
  // band (default)
  return k.slide((c) => {
    c.add(k.circ({ left: 700, top: -160, radius: 260, fill: p.accent, opacity: 0.12 }));
    c.add(k.circ({ left: 560, top: -60, radius: 120, fill: p.accent2, opacity: 0.10 }));
    if (o.eyebrow) eyebrow(c, k, 80, 150, o.eyebrow);
    c.add(k.text(o.title, { left: 78, top: 196, width: 720, fontSize: 58, fontWeight: 'bold', fill: p.ink, lineHeight: 1.05 }));
    if (o.subtitle) c.add(k.text(o.subtitle, { left: 80, top: 320, width: 700, fontSize: 24, fill: p.sub }));
    c.add(k.rect({ left: 0, top: 506, width: 960, height: 34, fill: p.accent }));
    if (o.footer) c.add(k.text(o.footer, { left: 80, top: 456, width: 800, fontSize: 16, fill: p.sub }));
  });
};

const agenda = (o: { title?: string; items: string[] }): Paint => (k) => {
  const p = k.p;
  return k.slide((c) => {
    eyebrow(c, k, 64, 66, 'Agenda');
    c.add(k.text(o.title ?? 'Agenda', { left: 62, top: 90, width: 600, fontSize: 42, fontWeight: 'bold', fill: p.ink }));
    const top = 178; const step = Math.min(62, (520 - top) / o.items.length + 6);
    o.items.slice(0, 6).forEach((it, i) => {
      const y = top + i * step;
      c.add(k.circ({ left: 64, top: y, radius: 18, fill: p.panel }));
      c.add(k.text(String(i + 1), { left: 64, top: y + 6, width: 36, fontSize: 18, fontWeight: 'bold', fill: p.accent, textAlign: 'center' }));
      c.add(k.text(it, { left: 120, top: y + 4, width: 760, fontSize: 24, fill: p.ink }));
    });
  });
};

const section = (o: { index?: string; kicker?: string; title: string; subtitle?: string }): Paint => (k) => {
  const p = k.p;
  return k.bgSlide(p.accent, (c) => {
    c.add(k.circ({ left: 640, top: 200, radius: 300, fill: p.onAccent, opacity: 0.06 }));
    if (o.index) c.add(k.text(o.index, { left: 70, top: 120, width: 400, fontSize: 200, fontWeight: 'bold', fill: p.onAccent, opacity: 0.18 }));
    if (o.kicker) c.add(k.text(o.kicker.toUpperCase(), { left: 80, top: 250, width: 760, fontSize: 16, fill: p.onAccent, fontWeight: 'bold', charSpacing: 180, opacity: 0.85 }));
    c.add(k.text(o.title, { left: 78, top: 280, width: 800, fontSize: 56, fontWeight: 'bold', fill: p.onAccent }));
    if (o.subtitle) c.add(k.text(o.subtitle, { left: 80, top: 372, width: 760, fontSize: 22, fill: p.onAccent, opacity: 0.85 }));
  });
};

const content = (o: { kicker?: string; title: string; bullets: string[] }): Paint => (k) => {
  const p = k.p;
  return k.slide((c) => {
    c.add(k.rect({ left: 64, top: 70, width: 54, height: 8, fill: p.accent, rx: 4, ry: 4 }));
    if (o.kicker) c.add(k.text(o.kicker.toUpperCase(), { left: 64, top: 92, width: 800, fontSize: 14, fill: p.accent, fontWeight: 'bold', charSpacing: 140 }));
    c.add(k.text(o.title, { left: 62, top: o.kicker ? 116 : 100, width: 832, fontSize: 38, fontWeight: 'bold', fill: p.ink }));
    c.add(k.text(bulletText(o.bullets), { left: 66, top: 196, width: 828, fontSize: 24, fill: p.sub, lineHeight: 1.7 }));
  });
};

const twoCol = (o: { title: string; left: { h: string; items: string[] }; right: { h: string; items: string[] } }): Paint => (k) => {
  const p = k.p;
  return k.slide((c) => {
    c.add(k.rect({ left: 64, top: 70, width: 54, height: 8, fill: p.accent, rx: 4, ry: 4 }));
    c.add(k.text(o.title, { left: 62, top: 98, width: 832, fontSize: 38, fontWeight: 'bold', fill: p.ink }));
    const cols = spread(64, 832, 2, 32);
    [o.left, o.right].forEach((col, i) => {
      const { x, w } = cols[i];
      c.add(k.rect({ left: x, top: 188, width: w, height: 300, fill: p.panel, rx: 16, ry: 16 }));
      c.add(k.rect({ left: x, top: 188, width: 6, height: 300, fill: i === 0 ? p.accent : p.accent2, rx: 3, ry: 3 }));
      c.add(k.text(col.h, { left: x + 28, top: 212, width: w - 52, fontSize: 22, fontWeight: 'bold', fill: p.ink }));
      c.add(k.text(bulletText(col.items), { left: x + 28, top: 262, width: w - 52, fontSize: 19, fill: p.sub, lineHeight: 1.6 }));
    });
  });
};

const comparison = (o: { title: string; a: { h: string; items: string[] }; b: { h: string; items: string[] } }): Paint => (k) => {
  const p = k.p;
  return k.slide((c) => {
    c.add(k.text(o.title, { left: 62, top: 64, width: 832, fontSize: 36, fontWeight: 'bold', fill: p.ink, textAlign: 'center' }));
    const cols = spread(64, 832, 2, 32);
    const tones = [p.accent, p.accent2];
    [o.a, o.b].forEach((col, i) => {
      const { x, w } = cols[i];
      c.add(k.rect({ left: x, top: 150, width: w, height: 338, fill: p.panel, rx: 18, ry: 18 }));
      c.add(k.rect({ left: x, top: 150, width: w, height: 64, fill: tones[i], rx: 18, ry: 18 }));
      c.add(k.rect({ left: x, top: 196, width: w, height: 18, fill: tones[i] }));
      c.add(k.text(col.h, { left: x, top: 170, width: w, fontSize: 24, fontWeight: 'bold', fill: p.onAccent, textAlign: 'center' }));
      c.add(k.text(bulletText(col.items), { left: x + 28, top: 240, width: w - 52, fontSize: 19, fill: p.ink, lineHeight: 1.7 }));
    });
  });
};

const quote = (o: { quote: string; author: string; role?: string }): Paint => (k) => {
  const p = k.p;
  return k.bgSlide(p.id === 'corp' || p.id === 'min' ? p.panel : p.bg, (c) => {
    c.add(k.text('“', { left: 70, top: 40, width: 200, fontSize: 200, fontWeight: 'bold', fill: p.accent, opacity: 0.3 }));
    c.add(k.text(o.quote, { left: 120, top: 170, width: 720, fontSize: 34, fontStyle: 'italic', fill: p.ink, lineHeight: 1.35, textAlign: 'center' }));
    c.add(k.rect({ left: 440, top: 420, width: 80, height: 4, fill: p.accent, rx: 2, ry: 2 }));
    c.add(k.text(o.author, { left: 130, top: 440, width: 700, fontSize: 22, fontWeight: 'bold', fill: p.ink, textAlign: 'center' }));
    if (o.role) c.add(k.text(o.role, { left: 130, top: 474, width: 700, fontSize: 17, fill: p.sub, textAlign: 'center' }));
  });
};

const team = (o: { title?: string; members: { name: string; role: string; initials: string }[] }): Paint => (k) => {
  const p = k.p;
  return k.slide((c) => {
    c.add(k.rect({ left: 64, top: 70, width: 54, height: 8, fill: p.accent, rx: 4, ry: 4 }));
    c.add(k.text(o.title ?? 'Equipo', { left: 62, top: 98, width: 832, fontSize: 38, fontWeight: 'bold', fill: p.ink }));
    const n = Math.min(4, o.members.length);
    const cols = spread(64, 832, n, 28);
    o.members.slice(0, n).forEach((m, i) => {
      const { x, w } = cols[i]; const cx = x + w / 2;
      c.add(k.rect({ left: x, top: 196, width: w, height: 280, fill: p.panel, rx: 16, ry: 16 }));
      c.add(k.circ({ left: cx - 46, top: 226, radius: 46, fill: p.accent }));
      c.add(k.text(m.initials, { left: cx - 46, top: 256, width: 92, fontSize: 34, fontWeight: 'bold', fill: p.onAccent, textAlign: 'center' }));
      c.add(k.text(m.name, { left: x + 12, top: 342, width: w - 24, fontSize: 21, fontWeight: 'bold', fill: p.ink, textAlign: 'center' }));
      c.add(k.text(m.role, { left: x + 12, top: 376, width: w - 24, fontSize: 16, fill: p.sub, textAlign: 'center' }));
    });
  });
};

const timeline = (o: { title: string; steps: { label: string; desc?: string }[] }): Paint => (k) => {
  const p = k.p;
  return k.slide((c) => {
    c.add(k.rect({ left: 64, top: 70, width: 54, height: 8, fill: p.accent, rx: 4, ry: 4 }));
    c.add(k.text(o.title, { left: 62, top: 98, width: 832, fontSize: 38, fontWeight: 'bold', fill: p.ink }));
    const n = Math.min(5, o.steps.length);
    const cols = spread(80, 800, n, 0);
    const y = 290;
    c.add(k.line([100, y, 860, y], { stroke: p.panel, strokeWidth: 6 }));
    o.steps.slice(0, n).forEach((s, i) => {
      const cx = cols[i].x + cols[i].w / 2;
      c.add(k.circ({ left: cx - 26, top: y - 26, radius: 26, fill: p.accent }));
      c.add(k.text(String(i + 1), { left: cx - 26, top: y - 16, width: 52, fontSize: 22, fontWeight: 'bold', fill: p.onAccent, textAlign: 'center' }));
      c.add(k.text(s.label, { left: cx - 86, top: 200, width: 172, fontSize: 18, fontWeight: 'bold', fill: p.ink, textAlign: 'center' }));
      if (s.desc) c.add(k.text(s.desc, { left: cx - 86, top: 340, width: 172, fontSize: 14, fill: p.sub, textAlign: 'center', lineHeight: 1.3 }));
    });
  });
};

const kpis = (o: { title: string; metrics: { value: string; label: string; note?: string }[] }): Paint => (k) => {
  const p = k.p;
  return k.slide((c) => {
    c.add(k.rect({ left: 64, top: 70, width: 54, height: 8, fill: p.accent, rx: 4, ry: 4 }));
    c.add(k.text(o.title, { left: 62, top: 98, width: 832, fontSize: 38, fontWeight: 'bold', fill: p.ink }));
    const n = Math.min(4, o.metrics.length);
    const cols = spread(64, 832, n, 26);
    o.metrics.slice(0, n).forEach((m, i) => {
      const { x, w } = cols[i];
      c.add(k.rect({ left: x, top: 200, width: w, height: 230, fill: p.panel, rx: 18, ry: 18 }));
      c.add(k.rect({ left: x + 26, top: 224, width: 40, height: 6, fill: p.accent, rx: 3, ry: 3 }));
      c.add(k.text(m.value, { left: x + 16, top: 250, width: w - 32, fontSize: 64, fontWeight: 'bold', fill: p.accent, textAlign: 'left' }));
      c.add(k.text(m.label, { left: x + 26, top: 348, width: w - 44, fontSize: 19, fontWeight: 'bold', fill: p.ink }));
      if (m.note) c.add(k.text(m.note, { left: x + 26, top: 384, width: w - 44, fontSize: 14, fill: p.sub }));
    });
  });
};

const closing = (o: { title?: string; subtitle?: string; contact?: string }): Paint => (k) => {
  const p = k.p;
  return k.bgSlide(p.bg, (c) => {
    c.add(k.circ({ left: 690, top: 320, radius: 260, fill: p.accent, opacity: 0.12 }));
    c.add(k.text(o.title ?? 'Gracias', { left: 78, top: 200, width: 800, fontSize: 76, fontWeight: 'bold', fill: p.ink }));
    c.add(k.rect({ left: 82, top: 318, width: 90, height: 8, fill: p.accent, rx: 4, ry: 4 }));
    if (o.subtitle) c.add(k.text(o.subtitle, { left: 80, top: 344, width: 760, fontSize: 24, fill: p.sub }));
    if (o.contact) c.add(k.text(o.contact, { left: 80, top: 452, width: 760, fontSize: 18, fill: p.sub }));
  });
};

// Full theme showcase deck: every key layout, one palette.
function fullDeck(p: Palette, name: string, accentVariant: 'band' | 'split' | 'minimal'): Paint[] {
  return [
    cover({ variant: accentVariant, eyebrow: name, title: 'Título de la\npresentación', subtitle: 'Subtítulo descriptivo en una línea', footer: 'Presentador · Área · ' + new Date().getFullYear() }),
    agenda({ items: ['Contexto y objetivos', 'Situación actual', 'Propuesta', 'Plan e impacto', 'Próximos pasos'] }),
    section({ index: '01', kicker: 'Sección', title: 'Contexto', subtitle: 'De qué trata esta parte de la presentación' }),
    content({ kicker: 'Punto clave', title: 'Título de contenido', bullets: ['Primera idea de apoyo, clara y concreta.', 'Segunda idea con un dato que la respalde.', 'Tercera idea que cierra el argumento.'] }),
    twoCol({ title: 'Dos perspectivas', left: { h: 'Hoy', items: ['Punto A', 'Punto B', 'Punto C'] }, right: { h: 'Mañana', items: ['Mejora 1', 'Mejora 2', 'Mejora 3'] } }),
    comparison({ title: 'Comparación', a: { h: 'Opción A', items: ['Ventaja 1', 'Ventaja 2', 'Costo / tiempo'] }, b: { h: 'Opción B', items: ['Ventaja 1', 'Ventaja 2', 'Costo / tiempo'] } }),
    kpis({ title: 'Resultados', metrics: [{ value: '+24%', label: 'Crecimiento', note: 'vs. trimestre anterior' }, { value: '98%', label: 'Calidad', note: 'FPY' }, { value: '1.4M', label: 'Unidades', note: 'producidas' }, { value: '12d', label: 'Lead time', note: 'promedio' }] }),
    timeline({ title: 'Proceso', steps: [{ label: 'Descubrir', desc: 'Investigación' }, { label: 'Definir', desc: 'Alcance' }, { label: 'Diseñar', desc: 'Solución' }, { label: 'Entregar', desc: 'Implementar' }] }),
    quote({ quote: 'Una cita memorable que resume el mensaje central de la presentación.', author: 'Nombre Apellido', role: 'Cargo · Empresa' }),
    team({ members: [{ name: 'Nombre 1', role: 'Rol / Área', initials: 'N1' }, { name: 'Nombre 2', role: 'Rol / Área', initials: 'N2' }, { name: 'Nombre 3', role: 'Rol / Área', initials: 'N3' }] }),
    closing({ title: 'Gracias', subtitle: 'Preguntas y comentarios', contact: 'nombre@empresa.com · empresa.com' }),
  ];
}

const SLIDE_TEMPLATES: TemplateDef[] = [
  { id: 'blank', title: 'En blanco', description: 'Presentación vacía.', category: 'General', accent: '#64748b', build: () => null },

  // ── Mazos completos por tema (todos los layouts) ─────────────────────────────
  { id: 'deck-corp', title: 'Corporativo · Mazo completo', description: 'Tema azul corporativo: 11 diapositivas con todos los layouts.', category: 'Mazos por tema', accent: P_CORP.accent, build: () => renderDeck(P_CORP, fullDeck(P_CORP, 'Corporativo', 'band')) },
  { id: 'deck-dark', title: 'Medianoche · Mazo elegante', description: 'Tema oscuro elegante: portada partida y 11 layouts.', category: 'Mazos por tema', accent: P_DARK.accent, build: () => renderDeck(P_DARK, fullDeck(P_DARK, 'Medianoche', 'split')) },
  { id: 'deck-min', title: 'Minimal · Mazo limpio', description: 'Tema minimal monocromo con mucho aire.', category: 'Mazos por tema', accent: P_MIN.accent, build: () => renderDeck(P_MIN, fullDeck(P_MIN, 'Minimal', 'minimal')) },
  { id: 'deck-ind', title: 'Industrial · Mazo de planta', description: 'Tema industrial (acero + ámbar) para piso y operaciones.', category: 'Mazos por tema', accent: P_IND.accent, build: () => renderDeck(P_IND, fullDeck(P_IND, 'Industrial', 'band')) },

  // ── Presentaciones de negocio (mazos por caso de uso) ────────────────────────
  {
    id: 'proposal-deck', title: 'Propuesta comercial', description: 'Portada, problema, solución, precios y cierre.', category: 'Presentaciones de negocio', accent: P_CORP.accent,
    build: () => renderDeck(P_CORP, [
      cover({ variant: 'band', eyebrow: 'Propuesta', title: 'Propuesta\ncomercial', subtitle: 'Preparada para [Cliente]', footer: 'Tu empresa · ' + new Date().toLocaleDateString('es-ES') }),
      content({ kicker: 'El reto', title: 'El problema', bullets: ['Dolor principal del cliente.', 'Costo de no resolverlo.', 'Por qué ahora.'] }),
      content({ kicker: 'Nuestra respuesta', title: 'La solución', bullets: ['Qué entregamos.', 'Cómo funciona.', 'Qué lo hace distinto.'] }),
      kpis({ title: 'Impacto esperado', metrics: [{ value: '-30%', label: 'Costos', note: 'estimado' }, { value: '2x', label: 'Velocidad' }, { value: '99%', label: 'Calidad' }] }),
      twoCol({ title: 'Inversión y alcance', left: { h: 'Incluye', items: ['Entregable 1', 'Entregable 2', 'Soporte'] }, right: { h: 'Inversión', items: ['Fase 1 — $0', 'Fase 2 — $0', 'Total — $0'] } }),
      closing({ title: '¿Avanzamos?', subtitle: 'Firma y devuelve para iniciar', contact: 'ventas@empresa.com' }),
    ]),
  },
  {
    id: 'qbr-deck', title: 'Revisión trimestral (QBR)', description: 'Agenda, KPIs, logros, riesgos y plan.', category: 'Presentaciones de negocio', accent: P_DARK.accent,
    build: () => renderDeck(P_DARK, [
      cover({ variant: 'split', eyebrow: 'QBR', title: 'Revisión\ntrimestral', subtitle: 'Q_ · 20__', footer: 'Equipo · Cuenta' }),
      agenda({ items: ['Resultados del trimestre', 'Logros', 'Riesgos y bloqueos', 'Plan del próximo trimestre'] }),
      kpis({ title: 'Resultados', metrics: [{ value: '112%', label: 'Meta', note: 'alcanzada' }, { value: '+18%', label: 'Crecimiento' }, { value: '4.7', label: 'CSAT', note: '/5' }, { value: '−9%', label: 'Churn' }] }),
      timeline({ title: 'Plan del trimestre', steps: [{ label: 'Mes 1', desc: 'Cimientos' }, { label: 'Mes 2', desc: 'Escala' }, { label: 'Mes 3', desc: 'Optimización' }] }),
      content({ kicker: 'Atención', title: 'Riesgos y bloqueos', bullets: ['Riesgo 1 — mitigación.', 'Riesgo 2 — mitigación.', 'Dependencia externa.'] }),
      closing({ title: 'Gracias', subtitle: 'Preguntas', contact: 'success@empresa.com' }),
    ]),
  },
  {
    id: 'kpi-deck', title: 'Reporte de KPIs', description: 'Tablero de métricas con bloques grandes.', category: 'Presentaciones de negocio', accent: P_CORP.accent,
    build: () => renderDeck(P_CORP, [
      cover({ variant: 'minimal', eyebrow: 'Tablero', title: 'Reporte de\nindicadores', subtitle: 'Periodo: ____', footer: new Date().toLocaleDateString('es-ES') }),
      kpis({ title: 'Indicadores clave', metrics: [{ value: '85%', label: 'OEE', note: 'meta 80%' }, { value: '99.1%', label: 'FPY' }, { value: '1.2M', label: 'Unidades' }, { value: '12', label: 'NCR', note: 'abiertas' }] }),
      twoCol({ title: 'Detalle', left: { h: 'A favor', items: ['Métrica sube', 'Métrica estable', 'Meta cumplida'] }, right: { h: 'A vigilar', items: ['Métrica baja', 'Riesgo X', 'Acción Y'] } }),
      closing({ title: 'Gracias', subtitle: 'Datos al cierre del periodo' }),
    ]),
  },
  {
    id: 'casestudy-deck', title: 'Caso de éxito', description: 'Cliente, reto, solución, resultados y cita.', category: 'Presentaciones de negocio', accent: P_MIN.accent,
    build: () => renderDeck(P_MIN, [
      cover({ variant: 'minimal', eyebrow: 'Caso de éxito', title: '[Cliente]', subtitle: 'Cómo logramos [resultado]', footer: 'Caso de éxito · 20__' }),
      content({ kicker: 'Contexto', title: 'El reto', bullets: ['Situación inicial.', 'Restricciones.', 'Objetivo.'] }),
      content({ kicker: 'Qué hicimos', title: 'La solución', bullets: ['Enfoque.', 'Implementación.', 'Acompañamiento.'] }),
      kpis({ title: 'Resultados', metrics: [{ value: '3x', label: 'Productividad' }, { value: '-45%', label: 'Defectos' }, { value: '6 sem', label: 'Implementación' }] }),
      quote({ quote: 'El equipo entendió nuestro proceso y entregó resultados medibles.', author: 'Cliente Satisfecho', role: 'Director de Operaciones' }),
      closing({ title: 'Gracias', subtitle: '¿Hablamos de tu caso?', contact: 'hola@empresa.com' }),
    ]),
  },
  {
    id: 'kickoff-deck', title: 'Kickoff de proyecto', description: 'Objetivos, equipo, plan y acuerdos.', category: 'Presentaciones de negocio', accent: P_CORP.accent,
    build: () => renderDeck(P_CORP, [
      cover({ variant: 'band', eyebrow: 'Kickoff', title: 'Arranque de\nproyecto', subtitle: '[Nombre del proyecto]', footer: 'Fecha de inicio · ' + new Date().toLocaleDateString('es-ES') }),
      content({ kicker: 'Norte', title: 'Objetivos', bullets: ['Objetivo 1 (medible).', 'Objetivo 2 (medible).', 'Definición de éxito.'] }),
      team({ title: 'Equipo del proyecto', members: [{ name: 'Líder', role: 'Project Lead', initials: 'PL' }, { name: 'Producto', role: 'PM', initials: 'PM' }, { name: 'Ingeniería', role: 'Tech Lead', initials: 'TL' }, { name: 'Calidad', role: 'QA', initials: 'QA' }] }),
      timeline({ title: 'Plan de alto nivel', steps: [{ label: 'Descubrir', desc: 'Sem 1-2' }, { label: 'Construir', desc: 'Sem 3-8' }, { label: 'Probar', desc: 'Sem 9' }, { label: 'Lanzar', desc: 'Sem 10' }] }),
      closing({ title: '¡A trabajar!', subtitle: 'Acuerdos y siguientes pasos' }),
    ]),
  },

  // ── Planta / Operaciones ─────────────────────────────────────────────────────
  {
    id: 'production-review', title: 'Revisión de producción', description: 'OEE, comparación de turnos y proceso (industrial).', category: 'Planta / Operaciones', accent: P_IND.accent,
    build: () => renderDeck(P_IND, [
      cover({ variant: 'band', eyebrow: 'Operaciones', title: 'Revisión de\nproducción', subtitle: 'Línea ____ · Semana ____', footer: 'Planta · ' + new Date().toLocaleDateString('es-ES') }),
      kpis({ title: 'Tablero del piso', metrics: [{ value: '83%', label: 'OEE', note: 'meta 80%' }, { value: '110', label: 'Defectos', note: 'PPM' }, { value: '96%', label: 'Adherencia' }, { value: '2.5h', label: 'Downtime' }] }),
      comparison({ title: 'Comparación de turnos', a: { h: 'Turno 1', items: ['OEE 85%', 'Scrap 1.2%', 'Andons: 4'] }, b: { h: 'Turno 2', items: ['OEE 80%', 'Scrap 1.8%', 'Andons: 7'] } }),
      timeline({ title: 'Proceso de la línea', steps: [{ label: 'SMT', desc: 'Colocación' }, { label: 'Reflujo', desc: 'Soldadura' }, { label: 'Ensamble', desc: 'Manual' }, { label: 'Prueba', desc: 'Funcional' }, { label: 'Empaque', desc: 'Packout' }] }),
      content({ kicker: 'Acciones', title: 'Plan de mejora', bullets: ['Reducir changeover en estación 3.', 'Atacar top-1 de Pareto (soldadura fría).', 'Mantenimiento preventivo del horno.'] }),
      closing({ title: 'Gracias', subtitle: 'Seguridad primero · 5S todos los días' }),
    ]),
  },


  {
    id: 'daily-production-meeting', title: 'Daily Production Meeting', description: 'Visual aid diario: seguridad, plan vs real, paros, calidad y acciones.', category: 'Planta / Operaciones', accent: P_IND.accent,
    build: () => renderDeck(P_IND, [
      cover({ variant: 'band', eyebrow: 'Daily Production Meeting', title: 'Reunión diaria de\nproducción', subtitle: 'Planta ____ · Línea ____ · Turno ____', footer: new Date().toLocaleDateString('es-ES') }),
      agenda({ title: 'Cadencia de 15 minutos', items: ['Seguridad y 5S', 'Plan vs real', 'Paros / Andon', 'Calidad y scrap', 'Faltantes y acciones'] }),
      kpis({ title: 'Pulso del turno', metrics: [{ value: '0', label: 'Incidentes', note: 'seguridad' }, { value: '96%', label: 'Plan vs real', note: 'adherencia' }, { value: '83%', label: 'OEE', note: 'meta 80%' }, { value: '2.5h', label: 'Downtime', note: 'acumulado' }] }),
      comparison({ title: 'Plan vs real por turno', a: { h: 'Turno actual', items: ['Plan: 1,250 uds', 'Real: 1,198 uds', 'Gap: -52 uds'] }, b: { h: 'Top barreras', items: ['Material: 42 min', 'Cambio: 25 min', 'Calidad: 18 min'] } }),
      content({ kicker: 'Calidad', title: 'Defectos y contención', bullets: ['Top defecto: soldadura fría — 48 piezas.', 'Contención: sorteo 100% en WIP de línea 1.', 'Dueño: Calidad de piso · cierre hoy 14:00.'] }),
      twoCol({ title: 'Acciones del día', left: { h: 'Hoy', items: ['Cerrar falta de material CONN-8P.', 'Verificar parámetro de horno.', 'Actualizar ayuda visual estación 30.'] }, right: { h: 'Escalar', items: ['Riesgo de OT para WO-00042.', 'Tooling pendiente de mantenimiento.', 'Cliente visita viernes.'] } }),
      closing({ title: 'Go / No-Go', subtitle: 'Acuerdos, responsables y hora de verificación', contact: 'Seguridad primero · Calidad en la fuente' }),
    ]),
  },
  {
    id: 'executive-ops-review', title: 'Executive Ops Review', description: 'Revisión ejecutiva: KPIs, riesgos, finanzas operativas y decisiones.', category: 'Planta / Operaciones', accent: P_DARK.accent,
    build: () => renderDeck(P_DARK, [
      cover({ variant: 'split', eyebrow: 'Executive Ops Review', title: 'Executive\nOps Review', subtitle: 'Semana ____ · Planta ____', footer: 'Confidencial · ' + new Date().toLocaleDateString('es-ES') }),
      agenda({ title: 'Agenda ejecutiva', items: ['Scorecard operativo', 'Riesgos y decisiones', 'Capacidad / demanda', 'Calidad y cliente', 'Finanzas operativas'] }),
      kpis({ title: 'Scorecard', metrics: [{ value: '84%', label: 'OEE', note: '+4 pp vs plan' }, { value: '98.7%', label: 'OTD', note: 'cliente' }, { value: '−6%', label: 'Costo unit.', note: 'vs forecast' }, { value: '3', label: 'Riesgos', note: 'requieren decisión' }] }),
      twoCol({ title: 'Riesgos y decisiones', left: { h: 'Riesgos', items: ['Capacidad de prueba al 105%.', 'Proveedor crítico con atraso.', 'Scrap elevado en modelo A.'] }, right: { h: 'Decisiones', items: ['Aprobar turno extra sábado.', 'Liberar compra expedita.', 'Priorizar kaizen de prueba.'] } }),
      timeline({ title: 'Roadmap de recuperación', steps: [{ label: 'Hoy', desc: 'Contención' }, { label: 'Semana 1', desc: 'Capacidad' }, { label: 'Semana 2', desc: 'Proveedor' }, { label: 'Semana 3', desc: 'Costo' }] }),
      closing({ title: 'Decisiones requeridas', subtitle: 'Validar responsables y fecha de cierre antes de salir' }),
    ]),
  },
  {
    id: 'quality-review', title: 'Quality Review', description: 'Revisión de calidad: FPY, PPM, NCR/CAPA, Pareto y acciones.', category: 'Planta / Operaciones', accent: '#ef4444',
    build: () => renderDeck(P_CORP, [
      cover({ variant: 'minimal', eyebrow: 'Quality Review', title: 'Revisión de\ncalidad', subtitle: 'Modelo ____ · Cliente ____ · Periodo ____', footer: new Date().toLocaleDateString('es-ES') }),
      kpis({ title: 'Indicadores de calidad', metrics: [{ value: '99.1%', label: 'FPY' }, { value: '110', label: 'PPM' }, { value: '7', label: 'NCR abiertas' }, { value: '2', label: 'CAPA vencidas' }] }),
      content({ kicker: 'Pareto', title: 'Top defectos', bullets: ['Soldadura fría — 44% del total.', 'Componente faltante — 28% del total.', 'Polaridad invertida — 16% del total.'] }),
      twoCol({ title: 'Contención vs causa raíz', left: { h: 'Contención', items: ['Sorteo 100% lote afectado.', 'Bloqueo de material sospechoso.', 'Alerta a estaciones 20/30.'] }, right: { h: 'Causa raíz', items: ['Perfil térmico fuera de ventana.', 'Poka-yoke deshabilitado.', 'Entrenamiento incompleto turno 2.'] } }),
      timeline({ title: 'Plan CAPA', steps: [{ label: 'D3', desc: 'Contener' }, { label: 'D4', desc: 'Causa raíz' }, { label: 'D5', desc: 'PCA' }, { label: 'D6', desc: 'Validar' }, { label: 'D7', desc: 'Prevenir' }] }),
      closing({ title: 'Cierre de calidad', subtitle: 'Criterio de salida: evidencia, efectividad y actualización documental' }),
    ]),
  },
  {
    id: 'launch-readiness', title: 'Launch Readiness', description: 'Readiness de lanzamiento: APQP, materiales, línea, calidad y riesgos.', category: 'Planta / Operaciones', accent: '#16a34a',
    build: () => renderDeck(P_IND, [
      cover({ variant: 'band', eyebrow: 'Launch Readiness', title: 'Preparación de\nlanzamiento', subtitle: 'Programa ____ · Gate ____', footer: 'NPI / Operaciones · ' + new Date().toLocaleDateString('es-ES') }),
      kpis({ title: 'Gate readiness', metrics: [{ value: '92%', label: 'APQP' }, { value: '100%', label: 'BOM liberado' }, { value: '87%', label: 'Tooling' }, { value: '4', label: 'Open risks' }] }),
      comparison({ title: 'Readiness por frente', a: { h: 'Listo', items: ['BOM y rutas liberadas.', 'FAI planificado.', 'Capacidad base confirmada.'] }, b: { h: 'Pendiente', items: ['Fixture de prueba final.', 'PPAP proveedor B.', 'Ayuda visual estación 40.'] } }),
      timeline({ title: 'Hitos de lanzamiento', steps: [{ label: 'EVT', desc: 'Validación ingeniería' }, { label: 'DVT', desc: 'Diseño' }, { label: 'PVT', desc: 'Proceso' }, { label: 'SOP', desc: 'Arranque' }] }),
      content({ kicker: 'Riesgos', title: 'Top launch risks', bullets: ['Capacidad de prueba insuficiente en ramp-up.', 'Material crítico con lead time extendido.', 'Instrucciones visuales pendientes de aprobación.'] }),
      closing({ title: 'Gate decision', subtitle: 'Go / Conditional Go / No-Go con responsables y fechas' }),
    ]),
  },
  {
    id: 'customer-business-review', title: 'Customer Business Review', description: 'CBR: desempeño, valor entregado, oportunidades y próximos pasos.', category: 'Presentaciones de negocio', accent: P_CORP.accent,
    build: () => renderDeck(P_CORP, [
      cover({ variant: 'band', eyebrow: 'Customer Business Review', title: 'Customer\nBusiness Review', subtitle: '[Cliente] · Periodo ____', footer: 'Cuenta · ' + new Date().toLocaleDateString('es-ES') }),
      agenda({ title: 'Agenda CBR', items: ['Resumen ejecutivo', 'Desempeño operativo', 'Valor entregado', 'Riesgos / soporte', 'Roadmap conjunto'] }),
      kpis({ title: 'Desempeño de cuenta', metrics: [{ value: '98.7%', label: 'OTD' }, { value: '99.2%', label: 'Calidad' }, { value: '$1.4M', label: 'Valor' }, { value: '4.8', label: 'Satisfacción' }] }),
      twoCol({ title: 'Valor y oportunidades', left: { h: 'Valor entregado', items: ['Reducción de lead time.', 'Mejora de FPY.', 'Visibilidad semanal de riesgos.'] }, right: { h: 'Oportunidades', items: ['Forecast colaborativo.', 'VMI / kanban cliente.', 'Automatización de reportes.'] } }),
      timeline({ title: 'Roadmap conjunto', steps: [{ label: 'Q1', desc: 'Estabilizar' }, { label: 'Q2', desc: 'Optimizar' }, { label: 'Q3', desc: 'Escalar' }, { label: 'Q4', desc: 'Innovar' }] }),
      closing({ title: 'Próximos pasos', subtitle: 'Confirmar owners, fechas y métricas de éxito', contact: 'account@empresa.com' }),
    ]),
  },

  // ── Diapositivas sueltas (inicio rápido por layout) ──────────────────────────
  { id: 'one-cover-corp', title: 'Portada corporativa', description: 'Una portada azul lista para editar.', category: 'Diapositivas sueltas', accent: P_CORP.accent, build: () => renderDeck(P_CORP, [cover({ variant: 'band', eyebrow: 'Presentación', title: 'Título de la\npresentación', subtitle: 'Subtítulo · Autor', footer: new Date().getFullYear().toString() })]) },
  { id: 'one-cover-dark', title: 'Portada medianoche', description: 'Portada oscura con panel de acento.', category: 'Diapositivas sueltas', accent: P_DARK.accent, build: () => renderDeck(P_DARK, [cover({ variant: 'split', eyebrow: 'Presentación', title: 'Título de la\npresentación', subtitle: 'Subtítulo · Autor', footer: new Date().getFullYear().toString() })]) },
  { id: 'one-cover-ind', title: 'Portada industrial', description: 'Portada acero + ámbar para planta.', category: 'Diapositivas sueltas', accent: P_IND.accent, build: () => renderDeck(P_IND, [cover({ variant: 'band', eyebrow: 'Operaciones', title: 'Título de la\npresentación', subtitle: 'Línea · Turno', footer: new Date().getFullYear().toString() })]) },
  { id: 'one-section', title: 'Sección divisoria', description: 'Diapositiva divisoria a color con número.', category: 'Diapositivas sueltas', accent: P_CORP.accent, build: () => renderDeck(P_CORP, [section({ index: '01', kicker: 'Sección', title: 'Título de la sección', subtitle: 'Descripción breve' })]) },
  { id: 'one-kpis', title: 'Tablero de métricas', description: 'Cuatro KPIs con número grande (industrial).', category: 'Diapositivas sueltas', accent: P_IND.accent, build: () => renderDeck(P_IND, [kpis({ title: 'Indicadores', metrics: [{ value: '85%', label: 'OEE' }, { value: '99%', label: 'FPY' }, { value: '110', label: 'PPM' }, { value: '2.5h', label: 'Downtime' }] })]) },
  { id: 'one-quote', title: 'Cita destacada', description: 'Cita grande centrada (medianoche).', category: 'Diapositivas sueltas', accent: P_DARK.accent, build: () => renderDeck(P_DARK, [quote({ quote: 'Una cita memorable que captura la idea central.', author: 'Nombre Apellido', role: 'Cargo · Empresa' })]) },
  { id: 'one-team', title: 'Diapositiva de equipo', description: 'Tarjetas de equipo con iniciales.', category: 'Diapositivas sueltas', accent: P_CORP.accent, build: () => renderDeck(P_CORP, [team({ members: [{ name: 'Nombre 1', role: 'Rol', initials: 'N1' }, { name: 'Nombre 2', role: 'Rol', initials: 'N2' }, { name: 'Nombre 3', role: 'Rol', initials: 'N3' }, { name: 'Nombre 4', role: 'Rol', initials: 'N4' }] })]) },
  { id: 'one-closing', title: 'Cierre / Gracias', description: 'Diapositiva de cierre con contacto.', category: 'Diapositivas sueltas', accent: P_CORP.accent, build: () => renderDeck(P_CORP, [closing({ title: 'Gracias', subtitle: 'Preguntas y comentarios', contact: 'nombre@empresa.com · empresa.com' })]) },
  { id: 'one-agenda', title: 'Agenda', description: 'Lista de agenda numerada.', category: 'Diapositivas sueltas', accent: P_CORP.accent, build: () => renderDeck(P_CORP, [agenda({ items: ['Contexto y objetivos', 'Situación actual', 'Propuesta', 'Plan e impacto', 'Próximos pasos'] })]) },
  { id: 'one-content', title: 'Contenido (título + viñetas)', description: 'Diapositiva de contenido con viñetas.', category: 'Diapositivas sueltas', accent: P_MIN.accent, build: () => renderDeck(P_MIN, [content({ kicker: 'Punto clave', title: 'Título de contenido', bullets: ['Primera idea de apoyo.', 'Segunda idea con un dato.', 'Tercera idea que cierra.'] })]) },
  { id: 'one-twocol', title: 'Dos columnas', description: 'Dos paneles de contenido lado a lado.', category: 'Diapositivas sueltas', accent: P_CORP.accent, build: () => renderDeck(P_CORP, [twoCol({ title: 'Dos perspectivas', left: { h: 'Columna A', items: ['Punto 1', 'Punto 2', 'Punto 3'] }, right: { h: 'Columna B', items: ['Punto 1', 'Punto 2', 'Punto 3'] } })]) },
  { id: 'one-timeline', title: 'Timeline / Proceso', description: 'Línea de tiempo con etapas numeradas.', category: 'Diapositivas sueltas', accent: P_IND.accent, build: () => renderDeck(P_IND, [timeline({ title: 'Proceso', steps: [{ label: 'Etapa 1', desc: 'Descripción' }, { label: 'Etapa 2', desc: 'Descripción' }, { label: 'Etapa 3', desc: 'Descripción' }, { label: 'Etapa 4', desc: 'Descripción' }] })]) },
];

export const TEMPLATES: Record<DocType, TemplateDef[]> = {
  doc: DOC_TEMPLATES,
  sheet: SHEET_TEMPLATES,
  slides: SLIDE_TEMPLATES,
};

/** Stable category order per type (for the gallery's grouped view). */
export const TEMPLATE_CATEGORIES: Record<DocType, string[]> = {
  doc: ['General', 'Formales', 'Calidad y planta'],
  sheet: ['General', 'Manufactura / MES', 'Negocio'],
  slides: ['General', 'Mazos por tema', 'Presentaciones de negocio', 'Planta / Operaciones', 'Diapositivas sueltas'],
};
