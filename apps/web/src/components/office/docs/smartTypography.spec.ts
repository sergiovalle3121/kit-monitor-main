/* eslint-disable @typescript-eslint/no-explicit-any */
/** Spec de la tipografía inteligente. npx tsx src/components/office/docs/smartTypography.spec.ts */
import { smartTypography } from '@/lib/office/typography';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (a === b) passed++; else fails.push(`${m}\n     esp ${JSON.stringify(b)}\n     obt ${JSON.stringify(a)}`); };

// Comillas dobles curvas (apertura/cierre por contexto).
eq(smartTypography('"hola"'), '“hola”', 'comillas dobles');
eq(smartTypography('dice ("hola")'), 'dice (“hola”)', 'apertura tras paréntesis');
// Comillas simples y apóstrofo.
eq(smartTypography("'palabra'"), '‘palabra’', 'comillas simples');
eq(smartTypography("don't"), 'don’t', 'apóstrofo en contracción → cierre');
// Puntos suspensivos y raya.
eq(smartTypography('a...b'), 'a…b', 'puntos suspensivos');
eq(smartTypography('a--b'), 'a—b', 'raya em');
// Símbolos.
eq(smartTypography('(c) 2026'), '© 2026', 'copyright');
eq(smartTypography('Marca(R)'), 'Marca®', 'registrado (mayús)');
eq(smartTypography('Producto (tm)'), 'Producto ™', 'marca comercial');
// Fracciones (y no dentro de fechas/números).
eq(smartTypography('1/2 taza'), '½ taza', 'media');
eq(smartTypography('1/4 y 3/4'), '¼ y ¾', 'cuarto y tres cuartos');
eq(smartTypography('el 1/2/2024'), 'el 1/2/2024', 'fecha intacta');
eq(smartTypography('11/2'), '11/2', 'no fracción dentro de número');
// Combinado.
eq(smartTypography('Él dijo "ok"... (c)'), 'Él dijo “ok”… ©', 'combinado');
// Opciones: desactivar comillas.
eq(smartTypography('"x"', { quotes: false }), '"x"', 'comillas desactivadas');
eq(smartTypography('a--b', { dashes: false }), 'a--b', 'rayas desactivadas');
// Sin cambios.
eq(smartTypography('texto normal'), 'texto normal', 'sin puntuación especial → intacto');

console.log(`\nSMART TYPOGRAPHY SPEC: ${passed} OK, ${fails.length} fallos`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} fallos`); }
console.log('✓ Todas las aserciones de tipografía inteligente pasan.');
