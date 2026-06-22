/**
 * Referencias estructuradas de Excel (`Tabla[Columna]`, `Tabla[#Todo]`, `Tabla[#Encabezados]`).
 *
 * Como `LET` (§31), se resuelven por **preprocesado de cadena** antes del parser: cada
 * `Nombre[…]` se sustituye por su rango A1 (calificado con la hoja). Una tabla con nombre vive en
 * el contenido del libro; `SheetEditor` mantiene un **registro** global (`setTableRegistry`) que
 * el parche de `parse` consulta. Puro y testeable (la expansión no toca el DOM).
 *
 * Formas soportadas: `T[Col]` (datos de una columna), `T[]`/`T[#Datos]` (cuerpo de datos),
 * `T[#Encabezados]`/`T[#Headers]` (fila de cabecera), `T[#Todo]`/`T[#All]` (cabecera + datos),
 * y `T[[Col con espacios]]` / `T[[#Todo]]`. (La forma `T[@Col]` de «esta fila» no se soporta:
 * el preprocesado no conoce la fila del cursor.)
 */

export interface TableDef { name: string; sheetName: string; r1: number; c1: number; r2: number; c2: number; headers: string[] }

let REGISTRY: TableDef[] = [];
/** Registra las tablas con nombre del libro (lo llama el editor cuando cambian las hojas). */
export function setTableRegistry(tables: TableDef[]): void { REGISTRY = Array.isArray(tables) ? tables : []; }
export function getTableRegistry(): TableDef[] { return REGISTRY; }

function colName(c: number): string { let s = ''; c += 1; while (c > 0) { const r = (c - 1) % 26; s = String.fromCharCode(65 + r) + s; c = Math.floor((c - 1) / 26); } return s; }
const quoteSheet = (sn: string) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(sn) ? sn : `'${sn.replace(/'/g, "''")}'`);

/** Rango A1 (calificado con la hoja) para una especificación dentro de los corchetes. */
function rangeFor(t: TableDef, spec: string): string | null {
  const sh = `${quoteSheet(t.sheetName)}!`;
  const s = spec.trim().replace(/^\[|\]$/g, '').trim(); // admite [[...]]
  const lower = s.toLowerCase();
  const headerRow = t.r1 + 1; // 1-based
  const dataTop = t.r1 + 2, dataBot = t.r2 + 1;
  if (s === '' || lower === '#datos' || lower === '#data') return `${sh}${colName(t.c1)}${dataTop}:${colName(t.c2)}${dataBot}`;
  if (lower === '#encabezados' || lower === '#headers') return `${sh}${colName(t.c1)}${headerRow}:${colName(t.c2)}${headerRow}`;
  if (lower === '#todo' || lower === '#all') return `${sh}${colName(t.c1)}${headerRow}:${colName(t.c2)}${dataBot}`;
  // Nombre de columna (sin distinguir mayúsculas/espacios sobrantes).
  const idx = t.headers.findIndex((h) => h.trim().toLowerCase() === s.toLowerCase());
  if (idx >= 0) { const col = colName(t.c1 + idx); return `${sh}${col}${dataTop}:${col}${dataBot}`; }
  return null;
}

/** Expande todas las referencias estructuradas de `formula` usando `tables` (o el registro). */
export function expandStructuredRefs(formula: string, tables: TableDef[] = REGISTRY): string {
  if (typeof formula !== 'string' || !tables.length || formula.indexOf('[') < 0) return formula;
  let out = ''; let i = 0; let inStr = false;
  while (i < formula.length) {
    const ch = formula[i];
    if (inStr) { out += ch; if (ch === '"') { if (formula[i + 1] === '"') { out += '"'; i += 2; continue; } inStr = false; } i++; continue; }
    if (ch === '"') { inStr = true; out += ch; i++; continue; }
    // ¿Identificador seguido de «[»?
    const m = /^([A-Za-z_][A-Za-z0-9_.]*)\[/.exec(formula.slice(i));
    const prev = out[out.length - 1];
    if (m && !(prev != null && /[A-Za-z0-9_.$!]/.test(prev))) {
      const name = m[1];
      const t = tables.find((x) => x.name.toLowerCase() === name.toLowerCase());
      if (t) {
        // Extrae el contenido de corchetes equilibrando un nivel de anidamiento ([[...]]).
        let j = i + name.length; // en «[»
        let depth = 0; const start = j;
        for (; j < formula.length; j++) { const c = formula[j]; if (c === '[') depth++; else if (c === ']') { depth--; if (depth === 0) { j++; break; } } }
        const inner = formula.slice(start + 1, j - 1);
        const rng = rangeFor(t, inner);
        if (rng) { out += rng; i = j; continue; }
      }
    }
    out += ch; i++;
  }
  return out;
}
