'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Search } from 'lucide-react';

interface Fn { name: string; syntax: string; desc: string }
const CATEGORIES: { label: string; fns: Fn[] }[] = [
  { label: 'Matemáticas', fns: [
    { name: 'SUM', syntax: 'SUM(rango)', desc: 'Suma todos los números de un rango.' },
    { name: 'PRODUCT', syntax: 'PRODUCT(rango)', desc: 'Multiplica los números de un rango.' },
    { name: 'SUMIF', syntax: 'SUMIF(rango; criterio; [rango_suma])', desc: 'Suma las celdas que cumplen un criterio.' },
    { name: 'ROUND', syntax: 'ROUND(número; decimales)', desc: 'Redondea a un número de decimales.' },
    { name: 'ABS', syntax: 'ABS(número)', desc: 'Valor absoluto.' },
    { name: 'SQRT', syntax: 'SQRT(número)', desc: 'Raíz cuadrada.' },
    { name: 'POWER', syntax: 'POWER(base; exponente)', desc: 'Eleva un número a una potencia.' },
    { name: 'MOD', syntax: 'MOD(número; divisor)', desc: 'Resto de una división.' },
  ] },
  { label: 'Estadística', fns: [
    { name: 'AVERAGE', syntax: 'AVERAGE(rango)', desc: 'Promedio aritmético.' },
    { name: 'MAX', syntax: 'MAX(rango)', desc: 'Valor máximo.' },
    { name: 'MIN', syntax: 'MIN(rango)', desc: 'Valor mínimo.' },
    { name: 'COUNT', syntax: 'COUNT(rango)', desc: 'Cuenta celdas numéricas.' },
    { name: 'COUNTA', syntax: 'COUNTA(rango)', desc: 'Cuenta celdas no vacías.' },
    { name: 'COUNTIF', syntax: 'COUNTIF(rango; criterio)', desc: 'Cuenta celdas que cumplen un criterio.' },
    { name: 'MEDIAN', syntax: 'MEDIAN(rango)', desc: 'Mediana.' },
    { name: 'STDEV', syntax: 'STDEV(rango)', desc: 'Desviación estándar (muestra).' },
  ] },
  { label: 'Lógica', fns: [
    { name: 'IF', syntax: 'IF(prueba; si_verdadero; si_falso)', desc: 'Devuelve un valor u otro según una condición.' },
    { name: 'IFS', syntax: 'IFS(prueba1; valor1; …)', desc: 'Evalúa varias condiciones en orden.' },
    { name: 'AND', syntax: 'AND(cond1; cond2; …)', desc: 'Verdadero si TODAS se cumplen.' },
    { name: 'OR', syntax: 'OR(cond1; cond2; …)', desc: 'Verdadero si ALGUNA se cumple.' },
    { name: 'NOT', syntax: 'NOT(cond)', desc: 'Invierte un valor lógico.' },
    { name: 'IFERROR', syntax: 'IFERROR(valor; valor_si_error)', desc: 'Captura errores de fórmula.' },
  ] },
  { label: 'Texto', fns: [
    { name: 'CONCATENATE', syntax: 'CONCATENATE(texto1; texto2; …)', desc: 'Une textos.' },
    { name: 'LEFT', syntax: 'LEFT(texto; n)', desc: 'Primeros n caracteres.' },
    { name: 'RIGHT', syntax: 'RIGHT(texto; n)', desc: 'Últimos n caracteres.' },
    { name: 'MID', syntax: 'MID(texto; inicio; n)', desc: 'Extrae n caracteres desde una posición.' },
    { name: 'LEN', syntax: 'LEN(texto)', desc: 'Longitud del texto.' },
    { name: 'UPPER', syntax: 'UPPER(texto)', desc: 'Convierte a mayúsculas.' },
    { name: 'LOWER', syntax: 'LOWER(texto)', desc: 'Convierte a minúsculas.' },
    { name: 'TRIM', syntax: 'TRIM(texto)', desc: 'Quita espacios sobrantes.' },
  ] },
  { label: 'Fecha y hora', fns: [
    { name: 'TODAY', syntax: 'TODAY()', desc: 'Fecha actual.' },
    { name: 'NOW', syntax: 'NOW()', desc: 'Fecha y hora actual.' },
    { name: 'YEAR', syntax: 'YEAR(fecha)', desc: 'Año de una fecha.' },
    { name: 'MONTH', syntax: 'MONTH(fecha)', desc: 'Mes de una fecha.' },
    { name: 'DAY', syntax: 'DAY(fecha)', desc: 'Día de una fecha.' },
    { name: 'DATE', syntax: 'DATE(año; mes; día)', desc: 'Construye una fecha.' },
  ] },
  { label: 'Búsqueda', fns: [
    { name: 'VLOOKUP', syntax: 'VLOOKUP(buscar; tabla; col; [exacto])', desc: 'Busca en vertical y devuelve una columna.' },
    { name: 'HLOOKUP', syntax: 'HLOOKUP(buscar; tabla; fila; [exacto])', desc: 'Busca en horizontal.' },
    { name: 'INDEX', syntax: 'INDEX(rango; fila; columna)', desc: 'Valor por posición.' },
    { name: 'MATCH', syntax: 'MATCH(buscar; rango; [tipo])', desc: 'Posición de un valor en un rango.' },
    { name: 'LOOKUP', syntax: 'LOOKUP(buscar; vector_busqueda; vector_resultado)', desc: 'Búsqueda simple.' },
  ] },
];

/** Asistente de funciones por categoría (motor de Fortune-Sheet, nombres EN). */
export function SheetFunctionWizard({ onInsert, onClose }: { onInsert: (formula: string) => void; onClose: () => void }) {
  const [cat, setCat] = useState(0);
  const [q, setQ] = useState('');
  const all = CATEGORIES.flatMap((c) => c.fns);
  const list = q.trim()
    ? all.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()) || f.desc.toLowerCase().includes(q.toLowerCase()))
    : CATEGORIES[cat].fns;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl h-[560px] max-h-[88vh] rounded-3xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-5 h-14 border-b border-black/5 dark:border-white/10 flex-shrink-0">
          <h2 className="text-lg font-bold">Insertar función</h2>
          <div className="ml-auto relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar función…"
              className="h-9 w-56 text-sm rounded-xl bg-gray-100 dark:bg-white/10 pl-8 pr-3 outline-none focus:ring-2 ring-emerald-500/40" />
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 min-h-0 flex">
          {!q.trim() && (
            <div className="w-44 flex-shrink-0 border-r border-black/5 dark:border-white/10 overflow-y-auto p-2">
              {CATEGORIES.map((c, i) => (
                <button key={c.label} onClick={() => setCat(i)}
                  className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${i === cat ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold' : 'hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300'}`}>
                  {c.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {list.map((f) => (
              <div key={f.name} className="rounded-xl border border-black/5 dark:border-white/10 p-3 hover:border-emerald-400 transition-colors">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{f.name}</code>
                  <code className="text-[11px] text-gray-400">{f.syntax}</code>
                  <button onClick={() => onInsert(`=${f.name}(`)}
                    className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg bg-black dark:bg-white text-white dark:text-black hover:opacity-90">Insertar</button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{f.desc}</p>
              </div>
            ))}
            {!list.length && <p className="text-sm text-gray-400 text-center py-10">Sin resultados.</p>}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
