/* eslint-disable @typescript-eslint/no-explicit-any */
/** Spec de las secciones del mazo. npx tsx src/components/office/slides/sections.spec.ts */
import { groupSlidesBySection, sectionTitleAt, isSectionStart, setSectionAt, removeSectionAt, sectionCount } from './sections';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

// Agrupar: tramo inicial sin nombre + dos secciones.
eq(
  groupSlidesBySection(5, [null, null, 'B', null, 'C']),
  [{ title: null, start: 0, slides: [0, 1] }, { title: 'B', start: 2, slides: [2, 3] }, { title: 'C', start: 4, slides: [4] }],
  'agrupa tramo nulo + B + C',
);
// Primera diapositiva con nombre.
eq(groupSlidesBySection(3, ['Intro', null, null]), [{ title: 'Intro', start: 0, slides: [0, 1, 2] }], 'sección desde la primera');
// Sin secciones → un grupo nulo.
eq(groupSlidesBySection(2, []), [{ title: null, start: 0, slides: [0, 1] }], 'sin secciones → grupo nulo');

// Título activo.
eq(sectionTitleAt(['Intro', null, 'B', null], 3), 'B', 'título activo en 3 = B');
eq(sectionTitleAt(['Intro', null], 1), 'Intro', 'hereda de la anterior');
eq(sectionTitleAt([null, null], 1), null, 'sin nombre → null');

// ¿Inicia sección?
eq(isSectionStart(['A', null], 0), true, 'inicia en 0');
eq(isSectionStart(['A', null], 1), false, 'no inicia en 1');

// setSectionAt: poner, rellenar, recortar, vaciar.
eq(setSectionAt([null, null, null], 1, 'Mid', 3), [null, 'Mid', null], 'pone Mid en 1');
eq(setSectionAt([], 2, 'X'), [null, null, 'X'], 'rellena hasta el índice');
eq(setSectionAt([null], 0, '  Hola  '), ['Hola'], 'recorta el nombre');
eq(setSectionAt(['A'], 0, '   '), [null], 'nombre vacío → null');

// Quitar y contar.
eq(removeSectionAt(['A', 'B'], 1), ['A', null], 'quita la sección de 1');
eq(sectionCount(['A', null, 'B']), 2, 'cuenta 2 secciones');
eq(sectionCount([null, null]), 0, 'cuenta 0');

console.log(`\nSECTIONS SPEC: ${passed} OK, ${fails.length} fallos`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} fallos`); }
console.log('✓ Todas las aserciones de secciones pasan.');
