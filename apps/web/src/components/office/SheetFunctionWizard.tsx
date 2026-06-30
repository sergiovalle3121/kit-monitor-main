'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Search, CornerDownLeft, Braces } from 'lucide-react';
import { AXOS_FORMULA_CATALOG } from './sheets/industrialFormulaCatalog';

interface Arg { name: string; desc: string; optional?: boolean }
interface Fn { name: string; syntax: string; desc: string; args: Arg[] }

const A = (name: string, desc: string, optional = false): Arg => ({ name, desc, optional });

const CATEGORIES: { label: string; fns: Fn[] }[] = [
  { label: 'AXOS Industrial', fns: AXOS_FORMULA_CATALOG },
  { label: 'Matemáticas', fns: [
    { name: 'SUM', syntax: 'SUM(núm1; …)', desc: 'Suma todos los números de un rango.', args: [A('núm1', 'Primer número o rango a sumar.'), A('núm2', 'Más números o rangos.', true)] },
    { name: 'SUMIF', syntax: 'SUMIF(rango; criterio; [rango_suma])', desc: 'Suma las celdas que cumplen un criterio.', args: [A('rango', 'Rango evaluado.'), A('criterio', 'Condición, p. ej. ">100".'), A('rango_suma', 'Celdas a sumar si difieren del rango.', true)] },
    { name: 'SUMIFS', syntax: 'SUMIFS(rango_suma; rango1; crit1; …)', desc: 'Suma con varios criterios.', args: [A('rango_suma', 'Celdas a sumar.'), A('rango1', 'Primer rango de criterio.'), A('crit1', 'Primer criterio.')] },
    { name: 'SUMPRODUCT', syntax: 'SUMPRODUCT(rango1; rango2; …)', desc: 'Suma de los productos de rangos correspondientes.', args: [A('rango1', 'Primer rango.'), A('rango2', 'Segundo rango.', true)] },
    { name: 'PRODUCT', syntax: 'PRODUCT(núm1; …)', desc: 'Multiplica los números.', args: [A('núm1', 'Primer número o rango.')] },
    { name: 'ROUND', syntax: 'ROUND(número; decimales)', desc: 'Redondea a un número de decimales.', args: [A('número', 'Valor a redondear.'), A('decimales', 'Cantidad de decimales.')] },
    { name: 'ROUNDUP', syntax: 'ROUNDUP(número; decimales)', desc: 'Redondea hacia arriba.', args: [A('número', 'Valor.'), A('decimales', 'Decimales.')] },
    { name: 'ROUNDDOWN', syntax: 'ROUNDDOWN(número; decimales)', desc: 'Redondea hacia abajo.', args: [A('número', 'Valor.'), A('decimales', 'Decimales.')] },
    { name: 'CEILING', syntax: 'CEILING(número; múltiplo)', desc: 'Redondea al múltiplo superior.', args: [A('número', 'Valor.'), A('múltiplo', 'Múltiplo de redondeo.')] },
    { name: 'FLOOR', syntax: 'FLOOR(número; múltiplo)', desc: 'Redondea al múltiplo inferior.', args: [A('número', 'Valor.'), A('múltiplo', 'Múltiplo.')] },
    { name: 'INT', syntax: 'INT(número)', desc: 'Parte entera (redondeo hacia abajo).', args: [A('número', 'Valor.')] },
    { name: 'ABS', syntax: 'ABS(número)', desc: 'Valor absoluto.', args: [A('número', 'Valor.')] },
    { name: 'SQRT', syntax: 'SQRT(número)', desc: 'Raíz cuadrada.', args: [A('número', 'Valor ≥ 0.')] },
    { name: 'POWER', syntax: 'POWER(base; exponente)', desc: 'Eleva un número a una potencia.', args: [A('base', 'Base.'), A('exponente', 'Exponente.')] },
    { name: 'MOD', syntax: 'MOD(número; divisor)', desc: 'Resto de una división.', args: [A('número', 'Dividendo.'), A('divisor', 'Divisor.')] },
    { name: 'SUBTOTAL', syntax: 'SUBTOTAL(función; rango)', desc: 'Agrega ignorando otros subtotales (1=AVG,9=SUM…).', args: [A('función', 'Código 1–11.'), A('rango', 'Rango.')] },
  ] },
  { label: 'Estadística', fns: [
    { name: 'AVERAGE', syntax: 'AVERAGE(núm1; …)', desc: 'Promedio aritmético.', args: [A('núm1', 'Número o rango.')] },
    { name: 'AVERAGEIF', syntax: 'AVERAGEIF(rango; criterio; [rango_prom])', desc: 'Promedio condicional.', args: [A('rango', 'Rango evaluado.'), A('criterio', 'Condición.'), A('rango_prom', 'Celdas a promediar.', true)] },
    { name: 'COUNT', syntax: 'COUNT(rango)', desc: 'Cuenta celdas numéricas.', args: [A('rango', 'Rango.')] },
    { name: 'COUNTA', syntax: 'COUNTA(rango)', desc: 'Cuenta celdas no vacías.', args: [A('rango', 'Rango.')] },
    { name: 'COUNTIF', syntax: 'COUNTIF(rango; criterio)', desc: 'Cuenta celdas que cumplen un criterio.', args: [A('rango', 'Rango.'), A('criterio', 'Condición.')] },
    { name: 'COUNTIFS', syntax: 'COUNTIFS(rango1; crit1; …)', desc: 'Cuenta con varios criterios.', args: [A('rango1', 'Primer rango.'), A('crit1', 'Primer criterio.')] },
    { name: 'MAX', syntax: 'MAX(rango)', desc: 'Valor máximo.', args: [A('rango', 'Rango.')] },
    { name: 'MIN', syntax: 'MIN(rango)', desc: 'Valor mínimo.', args: [A('rango', 'Rango.')] },
    { name: 'MAXIFS', syntax: 'MAXIFS(rango_máx; rango1; crit1; …)', desc: 'Máximo con varios criterios.', args: [A('rango_máx', 'Celdas para el máximo.'), A('rango1', 'Primer rango de criterio.'), A('crit1', 'Primer criterio.')] },
    { name: 'MINIFS', syntax: 'MINIFS(rango_mín; rango1; crit1; …)', desc: 'Mínimo con varios criterios.', args: [A('rango_mín', 'Celdas para el mínimo.'), A('rango1', 'Primer rango de criterio.'), A('crit1', 'Primer criterio.')] },
    { name: 'MEDIAN', syntax: 'MEDIAN(rango)', desc: 'Mediana.', args: [A('rango', 'Rango.')] },
    { name: 'MODE', syntax: 'MODE(rango)', desc: 'Valor más frecuente.', args: [A('rango', 'Rango.')] },
    { name: 'STDEV', syntax: 'STDEV(rango)', desc: 'Desviación estándar (muestra).', args: [A('rango', 'Rango.')] },
    { name: 'VAR', syntax: 'VAR(rango)', desc: 'Varianza (muestra).', args: [A('rango', 'Rango.')] },
    { name: 'LARGE', syntax: 'LARGE(rango; k)', desc: 'k-ésimo valor más grande.', args: [A('rango', 'Rango.'), A('k', 'Posición.')] },
    { name: 'SMALL', syntax: 'SMALL(rango; k)', desc: 'k-ésimo valor más pequeño.', args: [A('rango', 'Rango.'), A('k', 'Posición.')] },
    { name: 'RANK', syntax: 'RANK(número; rango; [orden])', desc: 'Posición de un valor en una lista.', args: [A('número', 'Valor.'), A('rango', 'Lista.'), A('orden', '0=desc, 1=asc.', true)] },
    { name: 'PERCENTILE', syntax: 'PERCENTILE(rango; k)', desc: 'Percentil k (0–1).', args: [A('rango', 'Rango.'), A('k', 'Fracción 0–1.')] },
  ] },
  { label: 'Lógica', fns: [
    { name: 'IF', syntax: 'IF(prueba; si_verdadero; si_falso)', desc: 'Devuelve un valor u otro según una condición.', args: [A('prueba', 'Condición lógica.'), A('si_verdadero', 'Resultado si se cumple.'), A('si_falso', 'Resultado si no.', true)] },
    { name: 'IFS', syntax: 'IFS(prueba1; valor1; …)', desc: 'Evalúa varias condiciones en orden.', args: [A('prueba1', 'Primera condición.'), A('valor1', 'Valor si se cumple.')] },
    { name: 'IFERROR', syntax: 'IFERROR(valor; valor_si_error)', desc: 'Captura errores de fórmula.', args: [A('valor', 'Expresión.'), A('valor_si_error', 'Alternativa si hay error.')] },
    { name: 'AND', syntax: 'AND(cond1; …)', desc: 'Verdadero si TODAS se cumplen.', args: [A('cond1', 'Condición.')] },
    { name: 'OR', syntax: 'OR(cond1; …)', desc: 'Verdadero si ALGUNA se cumple.', args: [A('cond1', 'Condición.')] },
    { name: 'NOT', syntax: 'NOT(cond)', desc: 'Invierte un valor lógico.', args: [A('cond', 'Valor lógico.')] },
    { name: 'XOR', syntax: 'XOR(cond1; …)', desc: 'O exclusivo.', args: [A('cond1', 'Condición.')] },
    { name: 'SWITCH', syntax: 'SWITCH(expr; caso1; val1; …; [def])', desc: 'Compara una expresión con casos.', args: [A('expr', 'Expresión.'), A('caso1', 'Valor a comparar.'), A('val1', 'Resultado.')] },
    { name: 'LET', syntax: 'LET(nombre1; valor1; …; cálculo)', desc: 'Define nombres locales y los usa en el cálculo final (evita repetir subexpresiones).', args: [A('nombre1', 'Nombre de la variable.'), A('valor1', 'Valor o expresión que nombra.'), A('cálculo', 'Expresión final que usa los nombres.')] },
  ] },
  { label: 'Texto', fns: [
    { name: 'CONCATENATE', syntax: 'CONCATENATE(texto1; …)', desc: 'Une textos.', args: [A('texto1', 'Texto o referencia.')] },
    { name: 'TEXTJOIN', syntax: 'TEXTJOIN(sep; ignorar_vacías; texto1; …)', desc: 'Une textos con separador.', args: [A('sep', 'Separador.'), A('ignorar_vacías', 'VERDADERO/FALSO.'), A('texto1', 'Texto o rango.')] },
    { name: 'LEFT', syntax: 'LEFT(texto; n)', desc: 'Primeros n caracteres.', args: [A('texto', 'Cadena.'), A('n', 'Número de caracteres.')] },
    { name: 'RIGHT', syntax: 'RIGHT(texto; n)', desc: 'Últimos n caracteres.', args: [A('texto', 'Cadena.'), A('n', 'Número de caracteres.')] },
    { name: 'MID', syntax: 'MID(texto; inicio; n)', desc: 'Extrae n caracteres desde una posición.', args: [A('texto', 'Cadena.'), A('inicio', 'Posición inicial.'), A('n', 'Número de caracteres.')] },
    { name: 'LEN', syntax: 'LEN(texto)', desc: 'Longitud del texto.', args: [A('texto', 'Cadena.')] },
    { name: 'UPPER', syntax: 'UPPER(texto)', desc: 'Mayúsculas.', args: [A('texto', 'Cadena.')] },
    { name: 'LOWER', syntax: 'LOWER(texto)', desc: 'Minúsculas.', args: [A('texto', 'Cadena.')] },
    { name: 'PROPER', syntax: 'PROPER(texto)', desc: 'Primera letra de cada palabra en mayúscula.', args: [A('texto', 'Cadena.')] },
    { name: 'TRIM', syntax: 'TRIM(texto)', desc: 'Quita espacios sobrantes.', args: [A('texto', 'Cadena.')] },
    { name: 'SUBSTITUTE', syntax: 'SUBSTITUTE(texto; viejo; nuevo; [n])', desc: 'Reemplaza texto por otro.', args: [A('texto', 'Cadena.'), A('viejo', 'Texto a reemplazar.'), A('nuevo', 'Texto nuevo.'), A('n', 'Ocurrencia.', true)] },
    { name: 'FIND', syntax: 'FIND(buscar; dentro; [inicio])', desc: 'Posición de un texto (sensible a mayúsculas).', args: [A('buscar', 'Texto a buscar.'), A('dentro', 'Cadena.'), A('inicio', 'Posición inicial.', true)] },
    { name: 'TEXT', syntax: 'TEXT(valor; formato)', desc: 'Convierte un número a texto con formato.', args: [A('valor', 'Número.'), A('formato', 'Código, p. ej. "0.00%".')] },
    { name: 'VALUE', syntax: 'VALUE(texto)', desc: 'Convierte texto a número.', args: [A('texto', 'Texto numérico.')] },
    { name: 'REPT', syntax: 'REPT(texto; veces)', desc: 'Repite un texto.', args: [A('texto', 'Cadena.'), A('veces', 'Repeticiones.')] },
    { name: 'TEXTBEFORE', syntax: 'TEXTBEFORE(texto; delim; [instancia])', desc: 'Texto antes de un delimitador (instancia negativa = desde el final).', args: [A('texto', 'Cadena.'), A('delim', 'Delimitador (uno o varios).'), A('instancia', 'Ocurrencia, por defecto 1.', true)] },
    { name: 'TEXTAFTER', syntax: 'TEXTAFTER(texto; delim; [instancia])', desc: 'Texto después de un delimitador.', args: [A('texto', 'Cadena.'), A('delim', 'Delimitador (uno o varios).'), A('instancia', 'Ocurrencia, por defecto 1.', true)] },
    { name: 'TEXTSPLIT', syntax: 'TEXTSPLIT(texto; col; [fila])', desc: 'Divide el texto en una matriz por delimitadores.', args: [A('texto', 'Cadena.'), A('col', 'Delimitador de columnas.'), A('fila', 'Delimitador de filas.', true)] },
    { name: 'ARRAYTOTEXT', syntax: 'ARRAYTOTEXT(matriz; [formato])', desc: 'Convierte una matriz/rango a texto.', args: [A('matriz', 'Rango o matriz.'), A('formato', '0 conciso, 1 estricto.', true)] },
  ] },
  { label: 'Matrices dinámicas', fns: [
    { name: 'UNIQUE', syntax: 'UNIQUE(rango; [por_col]; [solo_una_vez])', desc: 'Valores o filas distintos (combínala con SUM, COUNT, TEXTJOIN…).', args: [A('rango', 'Rango o matriz.'), A('por_col', 'VERDADERO compara columnas.', true), A('solo_una_vez', 'Solo los que aparecen una vez.', true)] },
    { name: 'SORT', syntax: 'SORT(rango; [índice]; [orden]; [por_col])', desc: 'Ordena un rango (asc/desc) por una columna.', args: [A('rango', 'Rango o matriz.'), A('índice', 'Columna por la que ordenar.', true), A('orden', '1 asc, -1 desc.', true), A('por_col', 'Ordenar columnas.', true)] },
    { name: 'SORTBY', syntax: 'SORTBY(rango; por1; [orden1]; …)', desc: 'Ordena un rango según otros vectores.', args: [A('rango', 'Rango a ordenar.'), A('por1', 'Vector de ordenación.'), A('orden1', '1 asc, -1 desc.', true)] },
    { name: 'FILTER', syntax: 'FILTER(rango; máscara; [si_vacío])', desc: 'Conserva filas donde la máscara (rango de 1/0 o V/F) es verdadera.', args: [A('rango', 'Rango a filtrar.'), A('máscara', 'Rango de verdadero/falso o 1/0.'), A('si_vacío', 'Valor si nada coincide.', true)] },
    { name: 'SEQUENCE', syntax: 'SEQUENCE(filas; [cols]; [inicio]; [paso])', desc: 'Matriz de números consecutivos.', args: [A('filas', 'Número de filas.'), A('cols', 'Número de columnas.', true), A('inicio', 'Primer valor.', true), A('paso', 'Incremento.', true)] },
    { name: 'TAKE', syntax: 'TAKE(rango; filas; [cols])', desc: 'Primeras/últimas filas y columnas (negativo = desde el final).', args: [A('rango', 'Rango o matriz.'), A('filas', 'Cuántas filas tomar.'), A('cols', 'Cuántas columnas.', true)] },
    { name: 'DROP', syntax: 'DROP(rango; filas; [cols])', desc: 'Descarta filas/columnas del inicio o del final.', args: [A('rango', 'Rango o matriz.'), A('filas', 'Filas a descartar.'), A('cols', 'Columnas a descartar.', true)] },
    { name: 'TRANSPOSE', syntax: 'TRANSPOSE(rango)', desc: 'Intercambia filas por columnas.', args: [A('rango', 'Rango o matriz.')] },
    { name: 'VSTACK', syntax: 'VSTACK(a; b; …)', desc: 'Apila rangos verticalmente.', args: [A('a', 'Primer rango o matriz.'), A('b', 'Más rangos.', true)] },
    { name: 'HSTACK', syntax: 'HSTACK(a; b; …)', desc: 'Apila rangos horizontalmente.', args: [A('a', 'Primer rango o matriz.'), A('b', 'Más rangos.', true)] },
    { name: 'TOCOL', syntax: 'TOCOL(rango; [ignorar])', desc: 'Aplana un rango a una sola columna.', args: [A('rango', 'Rango o matriz.'), A('ignorar', '1 vacíos, 2 errores, 3 ambos.', true)] },
    { name: 'TOROW', syntax: 'TOROW(rango; [ignorar])', desc: 'Aplana un rango a una sola fila.', args: [A('rango', 'Rango o matriz.'), A('ignorar', '1 vacíos, 2 errores, 3 ambos.', true)] },
    { name: 'CHOOSEROWS', syntax: 'CHOOSEROWS(rango; fila1; …)', desc: 'Devuelve las filas indicadas (negativo = desde el final).', args: [A('rango', 'Rango o matriz.'), A('fila1', 'Número de fila.')] },
    { name: 'CHOOSECOLS', syntax: 'CHOOSECOLS(rango; col1; …)', desc: 'Devuelve las columnas indicadas.', args: [A('rango', 'Rango o matriz.'), A('col1', 'Número de columna.')] },
    { name: 'EXPAND', syntax: 'EXPAND(rango; filas; [cols]; [relleno])', desc: 'Aumenta la matriz a un tamaño con relleno.', args: [A('rango', 'Rango o matriz.'), A('filas', 'Filas totales.'), A('cols', 'Columnas totales.', true), A('relleno', 'Valor de relleno.', true)] },
    { name: 'WRAPROWS', syntax: 'WRAPROWS(vector; ancho; [relleno])', desc: 'Envuelve un vector en filas de un ancho.', args: [A('vector', 'Vector de valores.'), A('ancho', 'Valores por fila.'), A('relleno', 'Relleno final.', true)] },
    { name: 'WRAPCOLS', syntax: 'WRAPCOLS(vector; alto; [relleno])', desc: 'Envuelve un vector en columnas de un alto.', args: [A('vector', 'Vector de valores.'), A('alto', 'Valores por columna.'), A('relleno', 'Relleno final.', true)] },
  ] },
  { label: 'Texto avanzado (Regex)', fns: [
    { name: 'REGEXTEST', syntax: 'REGEXTEST(texto; patrón; [sin_may])', desc: '¿El texto coincide con la expresión regular?', args: [A('texto', 'Cadena.'), A('patrón', 'Expresión regular.'), A('sin_may', '1 = ignora mayúsculas.', true)] },
    { name: 'REGEXEXTRACT', syntax: 'REGEXEXTRACT(texto; patrón; [modo])', desc: 'Extrae coincidencias (0 primera, 1 todas, 2 grupos).', args: [A('texto', 'Cadena.'), A('patrón', 'Expresión regular.'), A('modo', '0/1/2.', true)] },
    { name: 'REGEXREPLACE', syntax: 'REGEXREPLACE(texto; patrón; reemplazo; [ocurrencia])', desc: 'Reemplaza coincidencias (admite $1 grupos).', args: [A('texto', 'Cadena.'), A('patrón', 'Expresión regular.'), A('reemplazo', 'Texto de reemplazo.'), A('ocurrencia', '0 = todas.', true)] },
  ] },
  { label: 'Lambda y orden superior', fns: [
    { name: 'LAMBDA', syntax: 'LAMBDA(parám1; …; cálculo)(arg1; …)', desc: 'Función anónima: defínela e invócala al instante (o pásala a MAP/REDUCE…).', args: [A('parám1', 'Nombre del primer parámetro.'), A('cálculo', 'Expresión que usa los parámetros.'), A('arg1', 'Valor con el que se invoca.', true)] },
    { name: 'MAP', syntax: 'MAP(matriz; …; LAMBDA(x; cálculo))', desc: 'Aplica la lambda a cada elemento (combínala con SUM/INDEX).', args: [A('matriz', 'Rango o matriz de entrada.'), A('LAMBDA', 'LAMBDA(x; …) aplicada a cada elemento.')] },
    { name: 'REDUCE', syntax: 'REDUCE(inicial; matriz; LAMBDA(acc; v; cálculo))', desc: 'Pliega la matriz a un único valor (suma/producto/concatenación…).', args: [A('inicial', 'Acumulador inicial.'), A('matriz', 'Rango a recorrer.'), A('LAMBDA', 'LAMBDA(acc; v; …).')] },
    { name: 'SCAN', syntax: 'SCAN(inicial; matriz; LAMBDA(acc; v; cálculo))', desc: 'Como REDUCE pero devuelve los acumulados intermedios.', args: [A('inicial', 'Acumulador inicial.'), A('matriz', 'Rango a recorrer.'), A('LAMBDA', 'LAMBDA(acc; v; …).')] },
    { name: 'BYROW', syntax: 'BYROW(matriz; LAMBDA(fila; cálculo))', desc: 'Un resultado por fila (p. ej. SUM de cada fila).', args: [A('matriz', 'Rango o matriz.'), A('LAMBDA', 'LAMBDA(fila; …), p. ej. SUM(fila).')] },
    { name: 'BYCOL', syntax: 'BYCOL(matriz; LAMBDA(col; cálculo))', desc: 'Un resultado por columna.', args: [A('matriz', 'Rango o matriz.'), A('LAMBDA', 'LAMBDA(col; …), p. ej. MAX(col).')] },
    { name: 'MAKEARRAY', syntax: 'MAKEARRAY(filas; cols; LAMBDA(i; j; cálculo))', desc: 'Genera una matriz; i y j son los índices (1-based).', args: [A('filas', 'Número de filas.'), A('cols', 'Número de columnas.'), A('LAMBDA', 'LAMBDA(i; j; …).')] },
  ] },
  { label: 'Fecha y hora', fns: [
    { name: 'TODAY', syntax: 'TODAY()', desc: 'Fecha actual.', args: [] },
    { name: 'NOW', syntax: 'NOW()', desc: 'Fecha y hora actual.', args: [] },
    { name: 'DATE', syntax: 'DATE(año; mes; día)', desc: 'Construye una fecha.', args: [A('año', 'Año.'), A('mes', 'Mes.'), A('día', 'Día.')] },
    { name: 'YEAR', syntax: 'YEAR(fecha)', desc: 'Año de una fecha.', args: [A('fecha', 'Fecha.')] },
    { name: 'MONTH', syntax: 'MONTH(fecha)', desc: 'Mes de una fecha.', args: [A('fecha', 'Fecha.')] },
    { name: 'DAY', syntax: 'DAY(fecha)', desc: 'Día de una fecha.', args: [A('fecha', 'Fecha.')] },
    { name: 'WEEKDAY', syntax: 'WEEKDAY(fecha; [tipo])', desc: 'Día de la semana.', args: [A('fecha', 'Fecha.'), A('tipo', 'Convención.', true)] },
    { name: 'EDATE', syntax: 'EDATE(fecha; meses)', desc: 'Suma meses a una fecha.', args: [A('fecha', 'Fecha base.'), A('meses', 'Meses a sumar.')] },
    { name: 'EOMONTH', syntax: 'EOMONTH(fecha; meses)', desc: 'Último día del mes desplazado.', args: [A('fecha', 'Fecha.'), A('meses', 'Desplazamiento.')] },
    { name: 'DATEDIF', syntax: 'DATEDIF(inicio; fin; unidad)', desc: 'Diferencia entre fechas ("d","m","y").', args: [A('inicio', 'Fecha inicial.'), A('fin', 'Fecha final.'), A('unidad', '"d", "m" o "y".')] },
    { name: 'NETWORKDAYS', syntax: 'NETWORKDAYS(inicio; fin; [festivos])', desc: 'Días laborables entre fechas.', args: [A('inicio', 'Fecha inicial.'), A('fin', 'Fecha final.'), A('festivos', 'Rango de festivos.', true)] },
  ] },
  { label: 'Búsqueda', fns: [
    { name: 'VLOOKUP', syntax: 'VLOOKUP(buscar; tabla; col; [exacto])', desc: 'Busca en vertical y devuelve una columna.', args: [A('buscar', 'Valor a buscar.'), A('tabla', 'Rango de búsqueda.'), A('col', 'Columna a devolver.'), A('exacto', 'FALSO = exacto.', true)] },
    { name: 'HLOOKUP', syntax: 'HLOOKUP(buscar; tabla; fila; [exacto])', desc: 'Busca en horizontal.', args: [A('buscar', 'Valor.'), A('tabla', 'Rango.'), A('fila', 'Fila a devolver.'), A('exacto', 'FALSO = exacto.', true)] },
    { name: 'INDEX', syntax: 'INDEX(rango; fila; [columna])', desc: 'Valor por posición.', args: [A('rango', 'Rango.'), A('fila', 'Número de fila.'), A('columna', 'Número de columna.', true)] },
    { name: 'MATCH', syntax: 'MATCH(buscar; rango; [tipo])', desc: 'Posición de un valor en un rango.', args: [A('buscar', 'Valor.'), A('rango', 'Vector.'), A('tipo', '0 = exacto.', true)] },
    { name: 'XLOOKUP', syntax: 'XLOOKUP(buscar; rango_buscado; rango_devuelto; [si_no_existe])', desc: 'Búsqueda moderna en cualquier dirección, exacta por defecto.', args: [A('buscar', 'Valor a buscar.'), A('rango_buscado', 'Vector donde buscar.'), A('rango_devuelto', 'Vector a devolver.'), A('si_no_existe', 'Valor si no se encuentra.', true)] },
    { name: 'XMATCH', syntax: 'XMATCH(buscar; rango_buscado; [modo])', desc: 'Posición de un valor (exacto por defecto).', args: [A('buscar', 'Valor.'), A('rango_buscado', 'Vector.'), A('modo', '0 = exacto.', true)] },
    { name: 'CHOOSE', syntax: 'CHOOSE(índice; valor1; …)', desc: 'Elige un valor por índice.', args: [A('índice', 'Posición.'), A('valor1', 'Primer valor.')] },
    { name: 'OFFSET', syntax: 'OFFSET(ref; filas; cols; [alto]; [ancho])', desc: 'Referencia desplazada.', args: [A('ref', 'Celda base.'), A('filas', 'Desplazamiento de filas.'), A('cols', 'Desplazamiento de columnas.')] },
    { name: 'INDIRECT', syntax: 'INDIRECT(texto_ref)', desc: 'Referencia a partir de texto.', args: [A('texto_ref', 'Referencia como texto.')] },
  ] },
  { label: 'Financieras', fns: [
    { name: 'PMT', syntax: 'PMT(tasa; nper; va; [vf]; [tipo])', desc: 'Pago periódico de un préstamo.', args: [A('tasa', 'Tasa por periodo.'), A('nper', 'Número de periodos.'), A('va', 'Valor actual (préstamo).'), A('vf', 'Valor futuro.', true), A('tipo', '0=fin, 1=inicio.', true)] },
    { name: 'FV', syntax: 'FV(tasa; nper; pago; [va]; [tipo])', desc: 'Valor futuro de una inversión.', args: [A('tasa', 'Tasa por periodo.'), A('nper', 'Periodos.'), A('pago', 'Pago por periodo.')] },
    { name: 'PV', syntax: 'PV(tasa; nper; pago; [vf]; [tipo])', desc: 'Valor actual.', args: [A('tasa', 'Tasa.'), A('nper', 'Periodos.'), A('pago', 'Pago por periodo.')] },
    { name: 'NPV', syntax: 'NPV(tasa; valor1; …)', desc: 'Valor actual neto de flujos.', args: [A('tasa', 'Tasa de descuento.'), A('valor1', 'Flujos de caja.')] },
    { name: 'IRR', syntax: 'IRR(valores; [estimación])', desc: 'Tasa interna de retorno.', args: [A('valores', 'Rango de flujos.'), A('estimación', 'Valor inicial.', true)] },
    { name: 'RATE', syntax: 'RATE(nper; pago; va; [vf]; [tipo])', desc: 'Tasa por periodo.', args: [A('nper', 'Periodos.'), A('pago', 'Pago.'), A('va', 'Valor actual.')] },
    { name: 'NPER', syntax: 'NPER(tasa; pago; va; [vf]; [tipo])', desc: 'Número de periodos.', args: [A('tasa', 'Tasa.'), A('pago', 'Pago.'), A('va', 'Valor actual.')] },
    { name: 'IPMT', syntax: 'IPMT(tasa; periodo; nper; va; [vf]; [tipo])', desc: 'Parte de intereses de un pago.', args: [A('tasa', 'Tasa por periodo.'), A('periodo', 'Periodo (1…nper).'), A('nper', 'Periodos.'), A('va', 'Valor actual.')] },
    { name: 'PPMT', syntax: 'PPMT(tasa; periodo; nper; va; [vf]; [tipo])', desc: 'Parte de capital de un pago.', args: [A('tasa', 'Tasa.'), A('periodo', 'Periodo.'), A('nper', 'Periodos.'), A('va', 'Valor actual.')] },
    { name: 'CUMIPMT', syntax: 'CUMIPMT(tasa; nper; va; ini; fin; tipo)', desc: 'Intereses acumulados entre dos periodos.', args: [A('tasa', 'Tasa.'), A('nper', 'Periodos.'), A('va', 'Préstamo.'), A('ini', 'Periodo inicial.'), A('fin', 'Periodo final.'), A('tipo', '0=fin, 1=inicio.')] },
    { name: 'XNPV', syntax: 'XNPV(tasa; valores; fechas)', desc: 'VAN con fechas irregulares.', args: [A('tasa', 'Tasa de descuento.'), A('valores', 'Flujos de caja.'), A('fechas', 'Fechas de cada flujo.')] },
    { name: 'XIRR', syntax: 'XIRR(valores; fechas; [estimación])', desc: 'TIR con fechas irregulares.', args: [A('valores', 'Flujos.'), A('fechas', 'Fechas.'), A('estimación', 'Valor inicial.', true)] },
    { name: 'SLN', syntax: 'SLN(coste; residual; vida)', desc: 'Amortización lineal.', args: [A('coste', 'Coste inicial.'), A('residual', 'Valor residual.'), A('vida', 'Años de vida útil.')] },
    { name: 'DB', syntax: 'DB(coste; residual; vida; periodo; [mes])', desc: 'Amortización por saldo fijo.', args: [A('coste', 'Coste.'), A('residual', 'Residual.'), A('vida', 'Vida útil.'), A('periodo', 'Periodo.')] },
    { name: 'DDB', syntax: 'DDB(coste; residual; vida; periodo; [factor])', desc: 'Amortización por saldo doble decreciente.', args: [A('coste', 'Coste.'), A('residual', 'Residual.'), A('vida', 'Vida útil.'), A('periodo', 'Periodo.')] },
    { name: 'SYD', syntax: 'SYD(coste; residual; vida; periodo)', desc: 'Amortización por suma de dígitos.', args: [A('coste', 'Coste.'), A('residual', 'Residual.'), A('vida', 'Vida útil.'), A('periodo', 'Periodo.')] },
    { name: 'EFFECT', syntax: 'EFFECT(tasa_nominal; nper)', desc: 'Tasa efectiva anual.', args: [A('tasa_nominal', 'Tasa nominal.'), A('nper', 'Periodos de capitalización al año.')] },
    { name: 'NOMINAL', syntax: 'NOMINAL(tasa_efectiva; nper)', desc: 'Tasa nominal anual.', args: [A('tasa_efectiva', 'Tasa efectiva.'), A('nper', 'Periodos al año.')] },
    { name: 'PRICE', syntax: 'PRICE(liq; venc; tasa; rdto; amort; frec; [base])', desc: 'Precio por 100 € de un bono con cupón.', args: [A('liq', 'Fecha de liquidación.'), A('venc', 'Fecha de vencimiento.'), A('tasa', 'Tasa del cupón.'), A('rdto', 'Rendimiento.'), A('amort', 'Amortización por 100.'), A('frec', 'Cupones/año (1,2,4).')] },
    { name: 'YIELD', syntax: 'YIELD(liq; venc; tasa; precio; amort; frec; [base])', desc: 'Rendimiento de un bono con cupón.', args: [A('liq', 'Liquidación.'), A('venc', 'Vencimiento.'), A('tasa', 'Tasa del cupón.'), A('precio', 'Precio por 100.'), A('amort', 'Amortización.'), A('frec', 'Cupones/año.')] },
    { name: 'DURATION', syntax: 'DURATION(liq; venc; cupón; rdto; frec; [base])', desc: 'Duración de Macaulay de un bono.', args: [A('liq', 'Liquidación.'), A('venc', 'Vencimiento.'), A('cupón', 'Tasa del cupón.'), A('rdto', 'Rendimiento.'), A('frec', 'Cupones/año.')] },
    { name: 'MDURATION', syntax: 'MDURATION(liq; venc; cupón; rdto; frec; [base])', desc: 'Duración modificada de un bono.', args: [A('liq', 'Liquidación.'), A('venc', 'Vencimiento.'), A('cupón', 'Tasa del cupón.'), A('rdto', 'Rendimiento.'), A('frec', 'Cupones/año.')] },
    { name: 'COUPNUM', syntax: 'COUPNUM(liq; venc; frec; [base])', desc: 'Número de cupones hasta el vencimiento.', args: [A('liq', 'Liquidación.'), A('venc', 'Vencimiento.'), A('frec', 'Cupones/año.')] },
    { name: 'DISC', syntax: 'DISC(liq; venc; precio; amort; [base])', desc: 'Tasa de descuento de un valor.', args: [A('liq', 'Liquidación.'), A('venc', 'Vencimiento.'), A('precio', 'Precio.'), A('amort', 'Amortización.')] },
    { name: 'ACCRINTM', syntax: 'ACCRINTM(emisión; liq; tasa; nominal; [base])', desc: 'Interés acumulado al vencimiento.', args: [A('emisión', 'Fecha de emisión.'), A('liq', 'Liquidación.'), A('tasa', 'Tasa.'), A('nominal', 'Valor nominal.')] },
    { name: 'DOLLARDE', syntax: 'DOLLARDE(precio_fracc; fracción)', desc: 'Convierte precio fraccionario a decimal.', args: [A('precio_fracc', 'Precio fraccionario.'), A('fracción', 'Denominador.')] },
    { name: 'DOLLARFR', syntax: 'DOLLARFR(precio_dec; fracción)', desc: 'Convierte precio decimal a fraccionario.', args: [A('precio_dec', 'Precio decimal.'), A('fracción', 'Denominador.')] },
  ] },
  { label: 'Base de datos', fns: [
    { name: 'DSUM', syntax: 'DSUM(base; campo; criterios)', desc: 'Suma un campo de las filas que cumplen los criterios.', args: [A('base', 'Rango con encabezados.'), A('campo', 'Nombre o índice de columna.'), A('criterios', 'Rango de criterios.')] },
    { name: 'DCOUNT', syntax: 'DCOUNT(base; campo; criterios)', desc: 'Cuenta celdas numéricas que cumplen los criterios.', args: [A('base', 'Rango con encabezados.'), A('campo', 'Columna.'), A('criterios', 'Criterios.')] },
    { name: 'DCOUNTA', syntax: 'DCOUNTA(base; campo; criterios)', desc: 'Cuenta celdas no vacías que cumplen.', args: [A('base', 'Rango.'), A('campo', 'Columna.'), A('criterios', 'Criterios.')] },
    { name: 'DAVERAGE', syntax: 'DAVERAGE(base; campo; criterios)', desc: 'Promedia un campo de las filas que cumplen.', args: [A('base', 'Rango.'), A('campo', 'Columna.'), A('criterios', 'Criterios.')] },
    { name: 'DMAX', syntax: 'DMAX(base; campo; criterios)', desc: 'Máximo de un campo bajo criterios.', args: [A('base', 'Rango.'), A('campo', 'Columna.'), A('criterios', 'Criterios.')] },
    { name: 'DMIN', syntax: 'DMIN(base; campo; criterios)', desc: 'Mínimo de un campo bajo criterios.', args: [A('base', 'Rango.'), A('campo', 'Columna.'), A('criterios', 'Criterios.')] },
    { name: 'DGET', syntax: 'DGET(base; campo; criterios)', desc: 'Extrae el único valor que cumple (o #NUM!/#VALUE!).', args: [A('base', 'Rango.'), A('campo', 'Columna.'), A('criterios', 'Criterios.')] },
    { name: 'DPRODUCT', syntax: 'DPRODUCT(base; campo; criterios)', desc: 'Producto de un campo bajo criterios.', args: [A('base', 'Rango.'), A('campo', 'Columna.'), A('criterios', 'Criterios.')] },
    { name: 'DSTDEV', syntax: 'DSTDEV(base; campo; criterios)', desc: 'Desviación estándar (muestra) bajo criterios.', args: [A('base', 'Rango.'), A('campo', 'Columna.'), A('criterios', 'Criterios.')] },
    { name: 'DVAR', syntax: 'DVAR(base; campo; criterios)', desc: 'Varianza (muestra) bajo criterios.', args: [A('base', 'Rango.'), A('campo', 'Columna.'), A('criterios', 'Criterios.')] },
  ] },
  { label: 'Estadística avanzada', fns: [
    { name: 'STDEV.S', syntax: 'STDEV.S(rango)', desc: 'Desviación estándar de una muestra.', args: [A('rango', 'Rango.')] },
    { name: 'VAR.S', syntax: 'VAR.S(rango)', desc: 'Varianza de una muestra.', args: [A('rango', 'Rango.')] },
    { name: 'MODE.SNGL', syntax: 'MODE.SNGL(rango)', desc: 'Valor más frecuente.', args: [A('rango', 'Rango.')] },
    { name: 'PERCENTILE.INC', syntax: 'PERCENTILE.INC(rango; k)', desc: 'Percentil k (0–1), interpolado.', args: [A('rango', 'Rango.'), A('k', 'Fracción 0–1.')] },
    { name: 'QUARTILE.INC', syntax: 'QUARTILE.INC(rango; cuartil)', desc: 'Cuartil (0–4).', args: [A('rango', 'Rango.'), A('cuartil', '0=mín…4=máx.')] },
    { name: 'RANK.EQ', syntax: 'RANK.EQ(número; rango; [orden])', desc: 'Posición de un valor (empates con el mismo rango).', args: [A('número', 'Valor.'), A('rango', 'Lista.'), A('orden', '0=desc, 1=asc.', true)] },
    { name: 'CORREL', syntax: 'CORREL(rango1; rango2)', desc: 'Coeficiente de correlación.', args: [A('rango1', 'Primer rango.'), A('rango2', 'Segundo rango.')] },
    { name: 'SLOPE', syntax: 'SLOPE(conocido_y; conocido_x)', desc: 'Pendiente de la recta de regresión.', args: [A('conocido_y', 'Valores y.'), A('conocido_x', 'Valores x.')] },
    { name: 'INTERCEPT', syntax: 'INTERCEPT(conocido_y; conocido_x)', desc: 'Intersección de la recta de regresión.', args: [A('conocido_y', 'Valores y.'), A('conocido_x', 'Valores x.')] },
    { name: 'FORECAST.LINEAR', syntax: 'FORECAST.LINEAR(x; conocido_y; conocido_x)', desc: 'Predice y por regresión lineal.', args: [A('x', 'Punto a predecir.'), A('conocido_y', 'Valores y.'), A('conocido_x', 'Valores x.')] },
    { name: 'TREND', syntax: 'TREND(conocido_y; [conocido_x]; [nueva_x])', desc: 'Predice valores por tendencia lineal (matriz).', args: [A('conocido_y', 'Valores y.'), A('conocido_x', 'Valores x.', true), A('nueva_x', 'x a predecir.', true)] },
    { name: 'GROWTH', syntax: 'GROWTH(conocido_y; [conocido_x]; [nueva_x])', desc: 'Predice por tendencia exponencial (matriz).', args: [A('conocido_y', 'Valores y > 0.'), A('conocido_x', 'Valores x.', true), A('nueva_x', 'x a predecir.', true)] },
    { name: 'NORM.DIST', syntax: 'NORM.DIST(x; media; desv; acum)', desc: 'Distribución normal (densidad o acumulada).', args: [A('x', 'Valor.'), A('media', 'Media.'), A('desv', 'Desviación.'), A('acum', 'VERDADERO=acumulada.')] },
    { name: 'NORM.INV', syntax: 'NORM.INV(prob; media; desv)', desc: 'Inversa de la normal.', args: [A('prob', 'Probabilidad.'), A('media', 'Media.'), A('desv', 'Desviación.')] },
    { name: 'T.DIST.2T', syntax: 'T.DIST.2T(x; g_libertad)', desc: 't de Student, dos colas.', args: [A('x', 'Valor ≥ 0.'), A('g_libertad', 'Grados de libertad.')] },
    { name: 'T.INV.2T', syntax: 'T.INV.2T(prob; g_libertad)', desc: 'Inversa de la t de dos colas.', args: [A('prob', 'Probabilidad.'), A('g_libertad', 'Grados de libertad.')] },
    { name: 'CHISQ.DIST.RT', syntax: 'CHISQ.DIST.RT(x; g_libertad)', desc: 'χ², cola derecha.', args: [A('x', 'Valor.'), A('g_libertad', 'Grados de libertad.')] },
    { name: 'CHISQ.INV.RT', syntax: 'CHISQ.INV.RT(prob; g_libertad)', desc: 'Inversa de χ² cola derecha.', args: [A('prob', 'Probabilidad.'), A('g_libertad', 'Grados de libertad.')] },
    { name: 'F.DIST.RT', syntax: 'F.DIST.RT(x; gl1; gl2)', desc: 'Distribución F, cola derecha.', args: [A('x', 'Valor.'), A('gl1', 'g.l. del numerador.'), A('gl2', 'g.l. del denominador.')] },
    { name: 'GAMMA.DIST', syntax: 'GAMMA.DIST(x; alfa; beta; acum)', desc: 'Distribución gamma.', args: [A('x', 'Valor.'), A('alfa', 'Forma.'), A('beta', 'Escala.'), A('acum', 'VERDADERO=acumulada.')] },
    { name: 'BETA.DIST', syntax: 'BETA.DIST(x; alfa; beta; acum; [A]; [B])', desc: 'Distribución beta.', args: [A('x', 'Valor.'), A('alfa', 'Parámetro α.'), A('beta', 'Parámetro β.'), A('acum', 'VERDADERO=acumulada.')] },
    { name: 'BINOM.DIST', syntax: 'BINOM.DIST(éxitos; ensayos; prob; acum)', desc: 'Distribución binomial.', args: [A('éxitos', 'Nº de éxitos.'), A('ensayos', 'Nº de ensayos.'), A('prob', 'Probabilidad de éxito.'), A('acum', 'VERDADERO=acumulada.')] },
    { name: 'POISSON.DIST', syntax: 'POISSON.DIST(x; media; acum)', desc: 'Distribución de Poisson.', args: [A('x', 'Nº de eventos.'), A('media', 'Media esperada.'), A('acum', 'VERDADERO=acumulada.')] },
    { name: 'HYPGEOM.DIST', syntax: 'HYPGEOM.DIST(éxito_m; n_m; éxito_p; n_p; acum)', desc: 'Distribución hipergeométrica.', args: [A('éxito_m', 'Éxitos en la muestra.'), A('n_m', 'Tamaño de la muestra.'), A('éxito_p', 'Éxitos en la población.'), A('n_p', 'Tamaño de la población.')] },
    { name: 'CONFIDENCE.T', syntax: 'CONFIDENCE.T(alfa; desv; tamaño)', desc: 'Intervalo de confianza con la t de Student.', args: [A('alfa', 'Nivel de significación.'), A('desv', 'Desviación estándar.'), A('tamaño', 'Tamaño de la muestra.')] },
  ] },
  { label: 'Ingeniería y matrices', fns: [
    { name: 'MMULT', syntax: 'MMULT(matriz1; matriz2)', desc: 'Producto matricial (devuelve una matriz).', args: [A('matriz1', 'Primera matriz.'), A('matriz2', 'Segunda matriz.')] },
    { name: 'MINVERSE', syntax: 'MINVERSE(matriz)', desc: 'Matriz inversa.', args: [A('matriz', 'Matriz cuadrada.')] },
    { name: 'MDETERM', syntax: 'MDETERM(matriz)', desc: 'Determinante de una matriz.', args: [A('matriz', 'Matriz cuadrada.')] },
    { name: 'MUNIT', syntax: 'MUNIT(dimensión)', desc: 'Matriz identidad n×n.', args: [A('dimensión', 'Tamaño n.')] },
    { name: 'CONVERT', syntax: 'CONVERT(número; de; a)', desc: 'Convierte entre unidades de medida.', args: [A('número', 'Valor.'), A('de', 'Unidad origen ("km", "lbm"…).'), A('a', 'Unidad destino.')] },
    { name: 'BASE', syntax: 'BASE(número; base; [longitud])', desc: 'Convierte un número a otra base (2–36).', args: [A('número', 'Valor entero.'), A('base', 'Base 2–36.'), A('longitud', 'Relleno mínimo.', true)] },
    { name: 'DECIMAL', syntax: 'DECIMAL(texto; base)', desc: 'Convierte texto en una base a número decimal.', args: [A('texto', 'Representación.'), A('base', 'Base 2–36.')] },
    { name: 'DEC2HEX', syntax: 'DEC2HEX(número; [dígitos])', desc: 'Decimal a hexadecimal.', args: [A('número', 'Valor.'), A('dígitos', 'Dígitos.', true)] },
    { name: 'HEX2DEC', syntax: 'HEX2DEC(texto)', desc: 'Hexadecimal a decimal.', args: [A('texto', 'Hex.')] },
    { name: 'BITAND', syntax: 'BITAND(número1; número2)', desc: 'Y a nivel de bits.', args: [A('número1', 'Primer entero.'), A('número2', 'Segundo entero.')] },
    { name: 'BITOR', syntax: 'BITOR(número1; número2)', desc: 'O a nivel de bits.', args: [A('número1', 'Primer entero.'), A('número2', 'Segundo entero.')] },
    { name: 'COMPLEX', syntax: 'COMPLEX(real; imaginario; [sufijo])', desc: 'Construye un número complejo.', args: [A('real', 'Parte real.'), A('imaginario', 'Parte imaginaria.'), A('sufijo', '"i" o "j".', true)] },
    { name: 'IMSUM', syntax: 'IMSUM(complejo1; …)', desc: 'Suma de números complejos.', args: [A('complejo1', 'Primer complejo.')] },
    { name: 'IMPRODUCT', syntax: 'IMPRODUCT(complejo1; …)', desc: 'Producto de complejos.', args: [A('complejo1', 'Primer complejo.')] },
    { name: 'IMABS', syntax: 'IMABS(complejo)', desc: 'Módulo de un número complejo.', args: [A('complejo', 'Número complejo.')] },
    { name: 'GCD', syntax: 'GCD(número1; …)', desc: 'Máximo común divisor.', args: [A('número1', 'Primer entero.')] },
    { name: 'LCM', syntax: 'LCM(número1; …)', desc: 'Mínimo común múltiplo.', args: [A('número1', 'Primer entero.')] },
    { name: 'DELTA', syntax: 'DELTA(número1; [número2])', desc: '1 si los números son iguales, 0 si no.', args: [A('número1', 'Primer número.'), A('número2', 'Segundo número.', true)] },
    { name: 'GESTEP', syntax: 'GESTEP(número; [umbral])', desc: '1 si número ≥ umbral, 0 si no.', args: [A('número', 'Valor.'), A('umbral', 'Umbral.', true)] },
  ] },
];

/** Asistente de funciones por categoría con ayuda de argumentos e inserción guiada. */
export function SheetFunctionWizard({ onInsert, onClose }: { onInsert: (formula: string) => void; onClose: () => void }) {
  const [cat, setCat] = useState(0);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const all = useMemo(() => CATEGORIES.flatMap((c) => c.fns), []);
  const list = q.trim()
    ? all.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()) || f.desc.toLowerCase().includes(q.toLowerCase()))
    : CATEGORIES[cat].fns;
  const selFn = all.find((f) => f.name === sel) ?? null;
  const template = (f: Fn) => `=${f.name}(${f.args.map((a) => a.name).join('; ')})`;
  const total = all.length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl h-[580px] max-h-[90vh] rounded-3xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-5 h-14 border-b border-black/5 dark:border-white/10 flex-shrink-0">
          <h2 className="text-lg font-bold">Insertar función</h2>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">{total} funciones</span>
          <div className="ml-auto relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setSel(null); }} placeholder="Buscar función…"
              className="h-9 w-56 text-sm rounded-xl bg-gray-100 dark:bg-white/10 pl-8 pr-3 outline-none focus:ring-2 ring-emerald-500/40" />
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 min-h-0 flex">
          {!q.trim() && (
            <div className="w-44 flex-shrink-0 border-r border-black/5 dark:border-white/10 overflow-y-auto p-2">
              {CATEGORIES.map((c, i) => (
                <button key={c.label} onClick={() => { setCat(i); setSel(null); }}
                  className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${i === cat ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold' : 'hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300'}`}>
                  {c.label} <span className="text-gray-500 dark:text-gray-400 text-[11px]">{c.fns.length}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-w-0">
            {list.map((f) => (
              <button key={f.name} onClick={() => setSel(f.name)}
                className={`w-full text-left rounded-xl border p-2.5 transition-colors ${sel === f.name ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-500/10' : 'border-black/5 dark:border-white/10 hover:border-emerald-300'}`}>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{f.name}</code>
                  <code className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{f.syntax}</code>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{f.desc}</p>
              </button>
            ))}
            {!list.length && <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-10">Sin resultados.</p>}
          </div>
          {selFn && (
            <div className="w-64 flex-shrink-0 border-l border-black/5 dark:border-white/10 overflow-y-auto p-3 space-y-2 bg-gray-50/60 dark:bg-white/[0.03]">
              <code className="text-base font-bold text-emerald-600 dark:text-emerald-400">{selFn.name}</code>
              <code className="block text-[11px] text-gray-500 break-words">{selFn.syntax}</code>
              <p className="text-xs text-gray-600 dark:text-gray-300">{selFn.desc}</p>
              {selFn.args.length > 0 && (
                <div className="space-y-1 border-t border-black/5 dark:border-white/10 pt-2">
                  <p className="text-[11px] font-semibold text-gray-500">Argumentos</p>
                  {selFn.args.map((a) => (
                    <div key={a.name} className="text-[11px]">
                      <span className="font-mono font-semibold">{a.name}</span>{a.optional && <span className="text-gray-500 dark:text-gray-400"> (opcional)</span>}
                      <span className="text-gray-500"> — {a.desc}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-1.5 pt-1">
                <button onClick={() => onInsert(`=${selFn.name}(`)}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-black dark:bg-white text-white dark:text-black hover:opacity-90">
                  <CornerDownLeft className="w-3.5 h-3.5" /> Insertar <code className="font-mono">={selFn.name}(</code>
                </button>
                {selFn.args.length > 0 && (
                  <button onClick={() => onInsert(template(selFn))}
                    className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-gray-300 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10">
                    <Braces className="w-3.5 h-3.5" /> Insertar plantilla
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
