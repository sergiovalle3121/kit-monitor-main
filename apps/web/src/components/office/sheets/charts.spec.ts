/* eslint-disable @typescript-eslint/no-explicit-any */
/** Spec del constructor de datos de gráficas. npx tsx src/components/office/sheets/charts.spec.ts */
import { buildChartData, chartJsType, seriesLabels, usesSecondaryAxis, type ChartConfig } from '@/lib/office/charts';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };
const cell = (r: number, c: number, v: any) => ({ r, c, v: { v, m: String(v), ct: { fa: 'General', t: typeof v === 'number' ? 'n' : 's' } } });

const sheet: any = { celldata: [
  cell(0, 0, 'Mes'), cell(0, 1, 'Ventas'), cell(0, 2, 'Margen'),
  cell(1, 0, 'Ene'), cell(1, 1, 100), cell(1, 2, 0.2),
  cell(2, 0, 'Feb'), cell(2, 1, 200), cell(2, 2, 0.5),
] };
const base = { id: 'x', title: '', range: 'A1:C3', sheetIndex: 0 };

// seriesLabels
eq(seriesLabels(sheet, 'A1:C3'), ['Ventas', 'Margen'], 'seriesLabels = cabeceras de columnas 2..n');

// Barras
{
  const d = buildChartData(sheet, { ...base, type: 'bar' } as ChartConfig);
  eq(d.labels, ['Ene', 'Feb'], 'labels');
  eq(d.datasets.length, 2, '2 series');
  eq(d.datasets[0].data, [100, 200], 'serie Ventas');
  eq(d.datasets[0].yAxisID, 'y', 'eje primario por defecto');
}

// Combo + eje secundario
{
  const cfg = { ...base, type: 'combo', series: [{ type: 'bar' }, { type: 'line', axis: 'y1' }] } as ChartConfig;
  const d = buildChartData(sheet, cfg);
  eq(d.datasets[0].type, 'bar', 'serie 0 = barra');
  eq(d.datasets[1].type, 'line', 'serie 1 = línea');
  eq(d.datasets[1].yAxisID, 'y1', 'serie 1 en eje secundario');
  ok(usesSecondaryAxis(cfg), 'usesSecondaryAxis true');
}

// Celda no numérica en una columna de datos → 0 (no NaN)
{
  const bad: any = { celldata: [cell(0, 0, 'M'), cell(0, 1, 'V'), cell(1, 0, 'Ene'), cell(1, 1, 'abc'), cell(2, 0, 'Feb'), cell(2, 1, 7)] };
  const d = buildChartData(bad, { ...base, type: 'bar' } as ChartConfig);
  eq(d.datasets[0].data[0], 0, 'celda "abc" → 0');
  eq(d.datasets[0].data[1], 7, 'celda numérica intacta');
}

// Color por serie
{
  const d = buildChartData(sheet, { ...base, type: 'bar', series: [{ color: '#123456' }] } as ChartConfig);
  eq(d.datasets[0].borderColor, '#123456', 'color de serie personalizado');
}

// Burbuja (X, Y, Tamaño)
{
  const bub: any = { celldata: [
    cell(0, 0, 'X'), cell(0, 1, 'Y'), cell(0, 2, 'Size'),
    cell(1, 0, 1), cell(1, 1, 2), cell(1, 2, 10),
    cell(2, 0, 3), cell(2, 1, 4), cell(2, 2, 20),
  ] };
  const d = buildChartData(bub, { ...base, type: 'bubble' } as ChartConfig);
  eq(d.datasets[0].data[0].x, 1, 'burbuja x0');
  eq(d.datasets[0].data[0].y, 2, 'burbuja y0');
  eq(d.datasets[0].data[0].r, 4, 'burbuja r min = 4');
  eq(d.datasets[0].data[1].r, 24, 'burbuja r max = 24');
}


// Pareto ordena la primera serie y agrega acumulado % en eje secundario.
{
  const d = buildChartData(sheet, { ...base, type: 'pareto' } as ChartConfig);
  eq(d.labels, ['Feb', 'Ene'], 'pareto ordena categorías desc');
  eq(d.datasets[0].data, [200, 100], 'pareto valores desc');
  eq(d.datasets[1].data, [66.7, 100], 'pareto acumulado %');
  ok(usesSecondaryAxis({ ...base, type: 'pareto' } as ChartConfig), 'pareto usa eje secundario');
}

// Gauge usa dona semicircular con valor/restante.
{
  const d = buildChartData(sheet, { ...base, type: 'gauge' } as ChartConfig);
  eq(chartJsType('gauge'), 'doughnut', 'gauge se renderiza como doughnut');
  eq(d.datasets[0].data, [100, 0], 'gauge limita el primer valor a 100');
}

console.log(`\nCHARTS SPEC: ${passed} OK, ${fails.length} fallos`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} fallos`); }
console.log('✓ Todas las aserciones de gráficas pasan.');
