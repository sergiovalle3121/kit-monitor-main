/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de Consolidar datos — PURA:
 *   cd apps/web && npx tsx src/components/office/sheets/consolidate.spec.ts
 */
import { consolidateByPosition, consolidateByCategory } from './consolidate';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

// ── Por posición: suma celda a celda ─────────────────────────────────────────
{
  const t1 = [[1, 2], [3, 4]];
  const t2 = [[10, 20], [30, 40]];
  eq(consolidateByPosition([t1, t2], 'sum'), [[11, 22], [33, 44]], 'posición: suma');
  eq(consolidateByPosition([t1, t2], 'average'), [[5.5, 11], [16.5, 22]], 'posición: promedio');
  eq(consolidateByPosition([t1, t2], 'max'), [[10, 20], [30, 40]], 'posición: máximo');
}
// Formas distintas → rellena con el tamaño mayor.
{
  const t1 = [[1, 1, 1]];
  const t2 = [[2, 2], [2, 2]];
  eq(consolidateByPosition([t1, t2], 'sum'), [[3, 3, 1], [2, 2, '']], 'posición: formas distintas');
}

// ── Por categoría: alinea por etiquetas ──────────────────────────────────────
{
  // Tabla 1: filas Ana/Luis, columnas Q1/Q2.  Tabla 2: filas Luis/Marta, columnas Q1/Q3 (orden distinto).
  const t1 = [['', 'Q1', 'Q2'], ['Ana', 10, 20], ['Luis', 5, 5]];
  const t2 = [['', 'Q1', 'Q3'], ['Luis', 100, 1], ['Marta', 7, 7]];
  const r = consolidateByCategory([t1, t2], 'sum');
  eq(r[0], ['', 'Q1', 'Q2', 'Q3'], 'categoría: cabeceras unidas');
  eq(r[1], ['Ana', 10, 20, ''], 'categoría: fila Ana (solo en t1)');
  eq(r[2], ['Luis', 105, 5, 1], 'categoría: Luis suma Q1 de ambas tablas (5+100)');
  eq(r[3], ['Marta', 7, '', 7], 'categoría: fila Marta (solo en t2)');
}
// Categoría con promedio.
{
  const t1 = [['', 'V'], ['x', 10]];
  const t2 = [['', 'V'], ['x', 20]];
  eq(consolidateByCategory([t1, t2], 'average'), [['', 'V'], ['x', 15]], 'categoría: promedio de x');
}

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ consolidate: ${passed}/${total} aserciones verdes.`);
