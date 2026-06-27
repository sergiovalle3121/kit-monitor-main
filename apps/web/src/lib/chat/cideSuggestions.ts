/**
 * Context-aware starter prompts for CIDE.
 *
 * The chat is reachable from every dashboard page, so when it opens we tailor
 * the suggested questions to the module the user is currently on (e.g. on
 * /dashboard/quality we offer defect/yield questions). This is a pure mapping —
 * no extra inference cost — and falls back to a generic set off the dashboard or
 * on an unmapped module.
 */

/** Generic starters, used off-module or as a fallback. */
export const GENERIC_SUGGESTIONS = [
  '¿Cómo va la planta hoy?',
  '¿Qué cambió en producción en las últimas 24 h?',
  '¿Cómo está el inventario?',
  'Muéstrame el estado de resultados',
];

/** Per-module starters, keyed by the first segment after /dashboard/. */
const BY_MODULE: Record<string, string[]> = {
  inventory: [
    '¿Qué materiales están por debajo del punto de reorden?',
    '¿Cuál es el valor total del inventario actual?',
    '¿Qué SKUs acumulan más días de inventario?',
  ],
  materials: [
    '¿Qué materiales tienen faltante para las órdenes abiertas?',
    '¿Cuál es el consumo de materiales de esta semana?',
    '¿Qué lotes están próximos a caducar?',
  ],
  mrp: [
    '¿Qué órdenes de compra sugiere el MRP esta semana?',
    '¿Dónde hay riesgo de quiebre de material?',
    '¿Qué demanda está sin cubrir en el horizonte?',
  ],
  planning: [
    '¿Qué planes están atrasados respecto a su fecha objetivo?',
    '¿Cómo está la carga de las líneas esta semana?',
    '¿Qué cuellos de botella ves en el plan actual?',
  ],
  'production-plan': [
    '¿Qué órdenes de producción están en riesgo de no cumplir?',
    '¿Cómo va el avance del plan de producción?',
    '¿Qué líneas están sobrecargadas?',
  ],
  production: [
    '¿Cómo va la producción hoy vs. el plan?',
    '¿Qué órdenes están detenidas y por qué?',
    '¿Cuál es el OEE por línea esta semana?',
  ],
  quality: [
    '¿Cuáles son los principales defectos de esta semana?',
    '¿Cómo va el first-pass yield por línea?',
    '¿Qué tendencia tiene el scrap respecto al mes pasado?',
  ],
  'floor-quality': [
    '¿Qué defectos se están registrando en piso ahora?',
    '¿Qué estaciones concentran más rechazos?',
    '¿Cómo va el yield del turno actual?',
  ],
  lab: [
    '¿Qué pruebas de laboratorio están pendientes?',
    '¿Qué resultados salieron fuera de especificación?',
    '¿Cómo va la carga del laboratorio?',
  ],
  maintenance: [
    '¿Qué órdenes de mantenimiento están vencidas?',
    '¿Qué activos tienen más paros no planeados?',
    '¿Qué mantenimientos preventivos tocan esta semana?',
  ],
  ehs: [
    '¿Qué incidentes de seguridad hay abiertos?',
    '¿Qué áreas concentran más incidentes?',
    '¿Qué CAPAs de EHS están por vencer?',
  ],
  tooling: [
    '¿Qué herramentales están en uso ahora?',
    '¿Qué herramentales están por calibrar?',
    '¿Qué herramentales están fuera de servicio?',
  ],
  rma: [
    '¿Qué devoluciones (RMA) están abiertas?',
    '¿Qué clientes tienen más RMA?',
    '¿Qué motivos de devolución son más frecuentes?',
  ],
  'fixed-assets': [
    '¿Qué activos fijos hay por categoría?',
    '¿Qué activos están por depreciarse?',
    '¿Cuál es el valor de los activos fijos?',
  ],
  shipping: [
    '¿Qué embarques están programados para hoy?',
    '¿Qué pedidos están en riesgo de no salir a tiempo?',
    '¿Cómo va el cumplimiento de entregas (OTD)?',
  ],
  outbound: [
    '¿Qué embarques salen hoy?',
    '¿Qué pedidos están listos para despacho?',
    '¿Cómo va el OTD de la semana?',
  ],
  receiving: [
    '¿Qué recepciones están pendientes hoy?',
    '¿Qué material llegó pero no se ha inspeccionado?',
    '¿Qué proveedores tienen entregas atrasadas?',
  ],
  inbound: [
    '¿Qué entregas entrantes se esperan hoy?',
    '¿Qué órdenes de compra están por recibir?',
    '¿Qué material está retenido en recepción?',
  ],
  suppliers: [
    '¿Qué proveedores tienen peor desempeño de entrega?',
    '¿Qué órdenes de compra están atrasadas?',
    '¿Cómo va la calidad de material por proveedor?',
  ],
  procurement: [
    '¿Qué órdenes de compra están pendientes de aprobación?',
    '¿Cuál es el gasto de compras del mes?',
    '¿Qué proveedores concentran más gasto?',
  ],
  finance: [
    'Muéstrame el estado de resultados del mes',
    '¿Cómo va el flujo de caja?',
    '¿Cuáles son los principales gastos del periodo?',
  ],
  expenses: [
    '¿Cuáles son los principales gastos del mes?',
    '¿Qué gastos crecieron respecto al mes pasado?',
    '¿Qué centros de costo gastan más?',
  ],
  crm: [
    '¿Qué oportunidades están por cerrar este mes?',
    '¿Cómo va el pipeline de ventas?',
    '¿Qué clientes concentran más ingresos?',
  ],
  customers: [
    '¿Qué clientes concentran más ventas?',
    '¿Qué pedidos de clientes están en riesgo?',
    '¿Cómo va el OTD por cliente?',
  ],
  genealogy: [
    '¿Qué trazabilidad tiene este número de serie?',
    '¿Qué lotes de material se usaron en esta orden?',
    '¿Dónde se usó este lote de componente?',
  ],
  intelligence: [
    '¿Qué tendencias destacan en la operación esta semana?',
    '¿Dónde hay desviaciones que requieran atención?',
    'Dame un resumen ejecutivo de la planta',
  ],
  'control-tower': [
    'Dame un resumen del estado de la operación ahora',
    '¿Qué alertas críticas hay abiertas?',
    '¿Qué métricas están fuera de objetivo?',
  ],
  forecast: [
    '¿Cómo se compara el pronóstico con la demanda real?',
    '¿Qué productos tienen mayor desviación de pronóstico?',
    '¿Cómo va la precisión del forecast?',
  ],
  metrics: [
    '¿Qué KPIs están fuera de su objetivo?',
    '¿Qué métricas mejoraron respecto al mes pasado?',
    'Dame un resumen de los indicadores clave',
  ],
};

/** Suggested starter questions for the given dashboard path. */
export function suggestionsFor(pathname?: string | null): string[] {
  if (!pathname) return GENERIC_SUGGESTIONS;
  const match = pathname.match(/\/dashboard\/([^/?#]+)/);
  const key = match?.[1] ?? '';
  return BY_MODULE[key] ?? GENERIC_SUGGESTIONS;
}
