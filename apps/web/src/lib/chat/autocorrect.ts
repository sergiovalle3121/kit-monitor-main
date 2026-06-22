/**
 * Autocorrector + autocompletado de texto para el composer del chat.
 *
 * - `autocorrectText`: se aplica AL ENVIAR (no mientras escribes, para no pelear
 *   con el usuario). Corrige abreviaturas/errores comunes (ES/EN), capitaliza el
 *   inicio de cada frase y normaliza espacios.
 * - `getWordCompletions`: sugiere cómo terminar la palabra que estás tecleando,
 *   a partir de un diccionario de términos del dominio (manufactura/ERP) + común.
 */

/** Errores/abreviaturas frecuentes → forma correcta (clave en minúsculas). */
const CORRECTIONS: Record<string, string> = {
  q: 'que',
  xq: 'porque',
  pq: 'porque',
  tmb: 'también',
  tambien: 'también',
  porfa: 'por favor',
  porfavor: 'por favor',
  xfa: 'por favor',
  grax: 'gracias',
  d: 'de',
  x: 'por',
  asi: 'así',
  mas: 'más',
  esta: 'está',
  estan: 'están',
  aqui: 'aquí',
  alli: 'allí',
  ahi: 'ahí',
  dia: 'día',
  rapido: 'rápido',
  numero: 'número',
  facil: 'fácil',
  ultimo: 'último',
  proximo: 'próximo',
  tipico: 'típico',
  maquina: 'máquina',
  produccion: 'producción',
  inspeccion: 'inspección',
  fabricacion: 'fabricación',
  almacen: 'almacén',
  articulo: 'artículo',
  codigo: 'código',
  enviame: 'envíame',
  reviso: 'revisó',
  pdf: 'PDF',
  erp: 'ERP',
  mrp: 'MRP',
  oc: 'OC',
  ok: 'OK',
  // Inglés común
  teh: 'the',
  recieve: 'receive',
  adress: 'address',
  occured: 'occurred',
  seperate: 'separate',
  definately: 'definitely',
  dont: "don't",
  cant: "can't",
  im: "I'm",
  ive: "I've",
  thats: "that's",
};

/** ¿La palabra empieza con mayúscula? (para preservar al corregir). */
function isCapitalized(word: string): boolean {
  return (
    word.length > 0 &&
    word[0] === word[0].toUpperCase() &&
    word[0] !== word[0].toLowerCase()
  );
}

function applyCase(replacement: string, original: string): string {
  if (original === original.toUpperCase() && original.length > 1) {
    return replacement.toUpperCase();
  }
  if (isCapitalized(original)) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/** Tokens que NO se deben corregir: URLs, @menciones y :shortcodes:. */
const PROTECTED_RE = /(https?:\/\/[^\s]+|@[a-zA-Z0-9._-]+|:[a-z0-9_+-]+:)/g;
const WORD_RE = /[A-Za-zÁÉÍÓÚáéíóúÑñÜü']+/g;
const SENTENCE_RE = /([.!?¡¿]\s+)([a-záéíóúñü])/g;

/**
 * Corrige el texto completo. Conservador: solo toca palabras del diccionario,
 * capitaliza inicios de frase y normaliza espacios. Divide el texto por tokens
 * protegidos (URLs/@menciones/:emojis:) y solo procesa los segmentos normales,
 * así nunca altera un enlace ni una mención.
 */
export function autocorrectText(input: string): string {
  if (!input) return input;

  // split con UN grupo de captura → los índices impares son tokens protegidos.
  const parts = input.split(PROTECTED_RE);
  const processed = parts.map((seg, i) => {
    if (i % 2 === 1) return seg; // token protegido: intacto
    let text = seg.replace(WORD_RE, (word) => {
      const fix = CORRECTIONS[word.toLowerCase()];
      return fix ? applyCase(fix, word) : word;
    });
    text = text.replace(/[ \t]{2,}/g, ' ');
    text = text.replace(SENTENCE_RE, (_m, pre, ch) => pre + ch.toUpperCase());
    return text;
  });

  let result = processed.join('');
  // Capitaliza la primera letra del mensaje completo.
  result = result.replace(
    /^(\s*)([a-záéíóúñü])/,
    (_m, pre, ch) => pre + ch.toUpperCase(),
  );
  return result;
}

/**
 * Diccionario para autocompletar palabras. Términos del dominio (manufactura,
 * ERP, calidad, logística) + palabras comunes en español de negocio.
 */
const DICTIONARY: string[] = [
  // Dominio / operación
  'producción', 'inventario', 'almacén', 'calidad', 'inspección', 'mantenimiento',
  'planeación', 'programa', 'orden', 'órdenes', 'material', 'materiales', 'lote',
  'serial', 'estación', 'línea', 'ensamble', 'empaque', 'embarque', 'recepción',
  'requisición', 'cotización', 'proveedor', 'cliente', 'pedido', 'factura',
  'remisión', 'devolución', 'rechazo', 'aprobado', 'pendiente', 'urgente',
  'prioridad', 'capacidad', 'eficiencia', 'merma', 'desperdicio', 'retrabajo',
  'tolerancia', 'especificación', 'dibujo', 'plano', 'revisión', 'firmar',
  'autorización', 'presupuesto', 'costo', 'consumo', 'disponible', 'faltante',
  'surtido', 'kit', 'reabasto', 'traspaso', 'ubicación', 'anaquel',
  'báscula', 'etiqueta', 'escaneo', 'trazabilidad', 'genealogía', 'auditoría',
  'incidencia', 'hallazgo', 'corrección', 'preventiva', 'correctiva', 'seguridad',
  'capacitación', 'turno', 'operador', 'supervisor', 'ingeniería', 'herramental',
  // Conectores / comunes de negocio
  'gracias', 'favor', 'confirmar', 'confirmado', 'revisar', 'enviar', 'enviado',
  'recibir', 'recibido', 'avanzar', 'terminar', 'terminado', 'comenzar',
  'pendientes', 'reunión', 'mañana', 'temprano', 'disponibilidad',
  'actualización', 'actualizar', 'reporte', 'documento', 'archivo', 'adjunto',
  'mensaje', 'responder', 'respuesta', 'pregunta', 'problema', 'solución',
  'entonces', 'porque', 'también', 'cuando', 'mientras', 'después', 'antes',
];

const COMPLETION_RE = /([A-Za-zÁÉÍÓÚáéíóúÑñÜü]{2,})$/;

/**
 * Dado el borrador completo y la posición del cursor, devuelve la palabra en
 * curso y sugerencias para completarla. Vacío si no aplica (palabra corta, en
 * medio de @mención o :emoji:, etc.).
 */
export function getWordCompletions(
  draft: string,
  caret: number,
  limit = 5,
): { partial: string; start: number; suggestions: string[] } {
  const upto = draft.slice(0, caret);
  const m = COMPLETION_RE.exec(upto);
  if (!m) return { partial: '', start: caret, suggestions: [] };
  const partial = m[1];
  const start = caret - partial.length;
  // No sugerir si justo antes hay @ o : (lo maneja otro autocompletado).
  const before = draft[start - 1];
  if (before === '@' || before === ':') {
    return { partial: '', start: caret, suggestions: [] };
  }
  const lower = partial.toLowerCase();
  const cap = isCapitalized(partial);
  const suggestions: string[] = [];
  for (const w of DICTIONARY) {
    if (w === lower) continue; // ya está completa
    if (w.startsWith(lower)) {
      suggestions.push(cap ? w.charAt(0).toUpperCase() + w.slice(1) : w);
      if (suggestions.length >= limit) break;
    }
  }
  return { partial, start, suggestions };
}
