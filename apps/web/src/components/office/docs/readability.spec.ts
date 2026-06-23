/* eslint-disable @typescript-eslint/no-explicit-any */
/** Legibilidad (Flesch / Fernández-Huerta). npx tsx src/components/office/docs/readability.spec.ts */
import {
  syllablesEs, syllablesEn, isSpanish, analyzeText,
  fernandezHuerta, fleschReadingEase, fleschKincaidGrade, readability,
} from './readability';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => {
  const ok = typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 0.05 : String(a) === String(b);
  if (ok) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`);
};

// ── Sílabas en inglés (heurística estándar, palabras comunes) ──
eq(syllablesEn('the'), 1, 'the=1'); eq(syllablesEn('cat'), 1, 'cat=1'); eq(syllablesEn('dog'), 1, 'dog=1');
eq(syllablesEn('hello'), 2, 'hello=2'); eq(syllablesEn('table'), 2, 'table=2'); eq(syllablesEn('apple'), 2, 'apple=2');
eq(syllablesEn('running'), 2, 'running=2'); eq(syllablesEn('water'), 2, 'water=2'); eq(syllablesEn('paper'), 2, 'paper=2');
eq(syllablesEn('computer'), 3, 'computer=3'); eq(syllablesEn('banana'), 3, 'banana=3'); eq(syllablesEn('education'), 4, 'education=4');
eq(syllablesEn(''), 0, 'vacío=0');

// ── Sílabas en español ──
eq(syllablesEs('hola'), 2, 'hola=2'); eq(syllablesEs('casa'), 2, 'casa=2'); eq(syllablesEs('murciélago'), 4, 'murciélago=4 (mur-cié-la-go)');
eq(syllablesEs('sol'), 1, 'sol=1'); eq(syllablesEs('computadora'), 5, 'computadora=5');

// ── Detección de idioma ──
eq(isSpanish('El niño come una manzana en el árbol.'), true, 'ES con ñ/acento/artículos');
eq(isSpanish('The quick brown fox jumps over the lazy dog.'), false, 'EN');
eq(isSpanish('Esta es una prueba con palabras que son más comunes en español.'), true, 'ES por stopwords');

// ── Fórmulas con valores conocidos ──
// "The cat sat on the mat." → 6 palabras, 1 frase, 6 sílabas. FRE=206.835−1.015·6−84.6·1=116.145→clamp 100.
{ const s = analyzeText('The cat sat on the mat.'); eq(s.words, 6, 'palabras=6'); eq(s.sentences, 1, 'frases=1'); eq(s.syllablesEn, 6, 'sílabas EN=6');
  eq(fleschReadingEase(6, 1, 6), 100, 'FRE clamp a 100'); }
// Caso medio controlado: 20 palabras, 2 frases (10 ppf), 30 sílabas (1.5 spw).
// FRE = 206.835 − 1.015·10 − 84.6·1.5 = 206.835 − 10.15 − 126.9 = 69.785 → 70.
eq(fleschReadingEase(20, 2, 30), 70, 'FRE caso medio');
// FK grade = 0.39·10 + 11.8·1.5 − 15.59 = 3.9 + 17.7 − 15.59 = 6.01 → 6.0.
eq(fleschKincaidGrade(20, 2, 30), 6.0, 'FK grade caso medio');
// Fernández-Huerta: 20 palabras, 2 frases, 40 sílabas (2 spw). 206.84 − 60·2 − 1.02·10 = 206.84−120−10.2=76.64→77.
eq(fernandezHuerta(20, 2, 40), 77, 'Fernández-Huerta caso medio');

// Bordes: texto vacío.
{ const s = analyzeText(''); eq(s.words, 0, 'vacío palabras=0'); eq(fleschReadingEase(0, 0, 0), 0, 'FRE vacío=0'); }

// ── Integración readability(): elige esquema por idioma ──
{ const r = readability('The quick brown fox jumps over the lazy dog near the river.');
  eq(r.scheme, 'en', 'esquema EN'); eq(typeof r.grade, 'number', 'EN trae grade'); }
{ const r = readability('El veloz murciélago hindú comía feliz cardillo y kiwi.');
  eq(r.scheme, 'es', 'esquema ES'); eq(r.grade, undefined, 'ES sin grade'); }

if (fails.length) { console.log(`❌ ${passed}/${passed + fails.length}`); for (const f of fails) console.log('  - ' + f); process.exit(1); }
else console.log(`✅ ${passed}/${passed}`);
