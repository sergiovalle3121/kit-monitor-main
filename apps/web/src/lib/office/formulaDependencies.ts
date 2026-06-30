/* eslint-disable @typescript-eslint/no-explicit-any */
import { colName, rawOf } from './sheetOps';

export interface FormulaDependencyNode {
  id: string;
  sheetIndex: number;
  sheetName: string;
  address: string;
  formula: string;
  dependencies: string[];
  precedents: string[];
}

export interface FormulaDependencyGraph {
  nodes: FormulaDependencyNode[];
  edges: { from: string; to: string }[];
  cycles: string[][];
  externalReferences: string[];
  missingReferences: string[];
}

export interface FormulaRecalculationPlan {
  order: string[];
  blockedByCycles: string[];
  missingReferences: string[];
  ready: boolean;
}

export interface FormulaRecalculationCellRef {
  id: string;
  sheetIndex: number;
  sheetName: string;
  address: string;
  label: string;
  formula: string;
}

export interface FormulaRecalculationDiagnostics {
  totalFormulas: number;
  precedentReferences: number;
  formulaToFormulaEdges: number;
  recalculableFormulas: number;
  blockedFormulas: number;
  cycleCount: number;
  missingReferenceCount: number;
  externalReferenceCount: number;
  ready: boolean;
  orderedCells: FormulaRecalculationCellRef[];
  blockedCells: FormulaRecalculationCellRef[];
  cycles: string[][];
  missingReferences: string[];
  externalReferences: string[];
  warnings: string[];
}

interface RefToken { sheetName?: string; address: string; rangeEnd?: string }

function formulaOfCell(cd: any): string | null {
  const v = cd?.v;
  if (v && typeof v === 'object' && typeof v.f === 'string' && v.f.trim()) return v.f.trim();
  const raw = rawOf(cd);
  return typeof raw === 'string' && raw.trim().startsWith('=') ? raw.trim() : null;
}

function stripStrings(formula: string): string {
  return formula.replace(/"(?:""|[^"])*"/g, '""');
}

function normalizeSheetName(name: string): string {
  return name.replace(/^'|'$/g, '').replace(/''/g, "'");
}

function cellKey(sheetIndex: number, address: string): string {
  return `${sheetIndex}!${address.toUpperCase().replace(/\$/g, '')}`;
}

function parseA1(address: string): { r: number; c: number } | null {
  const match = /^\$?([A-Z]{1,3})\$?(\d+)$/i.exec(address.trim());
  if (!match) return null;
  let c = 0;
  for (const ch of match[1].toUpperCase()) c = c * 26 + (ch.charCodeAt(0) - 64);
  return { r: Number(match[2]) - 1, c: c - 1 };
}

function expandRange(start: string, end?: string): string[] {
  const a = parseA1(start);
  const b = parseA1(end || start);
  if (!a || !b) return [];
  const out: string[] = [];
  for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++) {
    for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) out.push(`${colName(c)}${r + 1}`);
  }
  return out;
}

function refsInFormula(formula: string): { refs: RefToken[]; external: string[] } {
  let clean = stripStrings(formula);
  const refs: RefToken[] = [];
  const external = new Set<string>();
  const externalWorkbookRe = /\[[^\]]+\](?:'[^']+'|[A-Za-z_][\w .-]*)!\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?/g;
  clean = clean.replace(externalWorkbookRe, (match) => {
    external.add(match);
    return ' ';
  });
  const rangeRe = /((?:'[^']+'|[A-Za-z_][\w .-]*)!)?(\$?[A-Z]{1,3}\$?\d+)\s*:\s*(\$?[A-Z]{1,3}\$?\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = rangeRe.exec(clean))) {
    if (/\[[^\]]+\]/.test(m[0])) external.add(m[0]);
    refs.push({ sheetName: m[1] ? normalizeSheetName(m[1].slice(0, -1)) : undefined, address: m[2], rangeEnd: m[3] });
  }
  const withoutRanges = clean.replace(rangeRe, ' ');
  const cellRe = /((?:'[^']+'|[A-Za-z_][\w .-]*)!)?(\$?[A-Z]{1,3}\$?\d+)/g;
  while ((m = cellRe.exec(withoutRanges))) {
    if (/\[[^\]]+\]/.test(m[0])) external.add(m[0]);
    refs.push({ sheetName: m[1] ? normalizeSheetName(m[1].slice(0, -1)) : undefined, address: m[2] });
  }
  for (const url of clean.match(/https?:\/\/[^\s),]+/gi) ?? []) external.add(url);
  return { refs, external: [...external].sort() };
}

export function buildFormulaDependencyGraph(content: any): FormulaDependencyGraph {
  const sheets = Array.isArray(content) ? content : (Array.isArray(content?.sheets) ? content.sheets : []);
  const sheetIndexByName = new Map<string, number>();
  sheets.forEach((sheet: any, i: number) => sheetIndexByName.set(String(sheet?.name || `Hoja ${i + 1}`).toLowerCase(), i));

  const formulaById = new Map<string, FormulaDependencyNode>();
  const missing = new Set<string>();
  const external = new Set<string>();

  for (let si = 0; si < sheets.length; si++) {
    const sheet = sheets[si];
    const sheetName = String(sheet?.name || `Hoja ${si + 1}`);
    for (const cd of sheet?.celldata ?? []) {
      const formula = formulaOfCell(cd);
      if (!formula) continue;
      const address = `${colName(cd.c)}${cd.r + 1}`;
      const id = cellKey(si, address);
      formulaById.set(id, { id, sheetIndex: si, sheetName, address, formula, dependencies: [], precedents: [] });
    }
  }

  const edges: { from: string; to: string }[] = [];
  for (const node of formulaById.values()) {
    const found = refsInFormula(node.formula);
    found.external.forEach((ref) => external.add(ref));
    const deps = new Set<string>();
    const refs = new Set<string>();
    for (const ref of found.refs) {
      const refSheetIndex = ref.sheetName ? sheetIndexByName.get(ref.sheetName.toLowerCase()) : node.sheetIndex;
      if (refSheetIndex == null) { missing.add(`${ref.sheetName}!${ref.address}`); continue; }
      for (const address of expandRange(ref.address, ref.rangeEnd)) {
        refs.add(cellKey(refSheetIndex, address));
        const dep = formulaById.get(cellKey(refSheetIndex, address));
        if (dep) deps.add(dep.id);
      }
    }
    node.precedents = [...refs].sort();
    node.dependencies = [...deps].sort();
    for (const dep of node.dependencies) edges.push({ from: node.id, to: dep });
  }

  return {
    nodes: [...formulaById.values()].sort((a, b) => a.id.localeCompare(b.id)),
    edges: edges.sort((a, b) => `${a.from}:${a.to}`.localeCompare(`${b.from}:${b.to}`)),
    cycles: findCycles(formulaById),
    externalReferences: [...external].sort(),
    missingReferences: [...missing].sort(),
  };
}

function findCycles(nodes: Map<string, FormulaDependencyNode>): string[][] {
  const cycles = new Set<string>();
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];

  const visit = (id: string) => {
    if (visiting.has(id)) {
      const i = path.indexOf(id);
      if (i >= 0) cycles.add(JSON.stringify([...path.slice(i), id]));
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    path.push(id);
    for (const dep of nodes.get(id)?.dependencies ?? []) visit(dep);
    path.pop();
    visiting.delete(id);
    visited.add(id);
  };

  for (const id of nodes.keys()) visit(id);
  return [...cycles].map((cycle) => JSON.parse(cycle)).sort((a, b) => a.join('>').localeCompare(b.join('>')));
}

export function buildFormulaRecalculationPlan(graph: FormulaDependencyGraph): FormulaRecalculationPlan {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const blocked = new Set(graph.cycles.flat());
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const order: string[] = [];

  const visit = (id: string) => {
    if (blocked.has(id) || visited.has(id) || visiting.has(id)) return;
    visiting.add(id);
    for (const dep of byId.get(id)?.dependencies ?? []) visit(dep);
    visiting.delete(id);
    visited.add(id);
    order.push(id);
  };

  for (const node of graph.nodes) visit(node.id);
  return {
    order,
    blockedByCycles: [...blocked].sort(),
    missingReferences: [...graph.missingReferences],
    ready: blocked.size === 0 && graph.missingReferences.length === 0,
  };
}

function formulaCellRef(node: FormulaDependencyNode): FormulaRecalculationCellRef {
  return {
    id: node.id,
    sheetIndex: node.sheetIndex,
    sheetName: node.sheetName,
    address: node.address,
    label: `${node.sheetName}!${node.address}`,
    formula: node.formula,
  };
}

export function buildFormulaRecalculationDiagnostics(content: any): FormulaRecalculationDiagnostics {
  const graph = buildFormulaDependencyGraph(content);
  const plan = buildFormulaRecalculationPlan(graph);
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const orderedCells = plan.order
    .map((id) => byId.get(id))
    .filter((node): node is FormulaDependencyNode => !!node)
    .map(formulaCellRef);
  const blockedCells = plan.blockedByCycles
    .map((id) => byId.get(id))
    .filter((node): node is FormulaDependencyNode => !!node)
    .map(formulaCellRef);
  const warnings: string[] = [];
  if (!graph.nodes.length) warnings.push('No hay formulas para planear recalculo.');
  if (graph.cycles.length) warnings.push(`${graph.cycles.length} ciclo(s) bloquean formulas dependientes.`);
  if (graph.missingReferences.length) warnings.push(`${graph.missingReferences.length} referencia(s) apuntan a hojas faltantes.`);
  if (graph.externalReferences.length) warnings.push(`${graph.externalReferences.length} referencia(s) externas requieren revision antes de publicar.`);
  if (!warnings.length) warnings.push('Plan de recalculo listo: las dependencias de formulas tienen orden seguro.');
  return {
    totalFormulas: graph.nodes.length,
    precedentReferences: graph.nodes.reduce((sum, node) => sum + node.precedents.length, 0),
    formulaToFormulaEdges: graph.edges.length,
    recalculableFormulas: orderedCells.length,
    blockedFormulas: blockedCells.length,
    cycleCount: graph.cycles.length,
    missingReferenceCount: graph.missingReferences.length,
    externalReferenceCount: graph.externalReferences.length,
    ready: plan.ready,
    orderedCells,
    blockedCells,
    cycles: graph.cycles,
    missingReferences: graph.missingReferences,
    externalReferences: graph.externalReferences,
    warnings,
  };
}

export function formatFormulaRecalculationDiagnostics(diagnostics: FormulaRecalculationDiagnostics): string {
  const status = diagnostics.ready ? 'listo' : 'requiere revision';
  const lines = [
    `Plan de recalculo: ${status}`,
    `${diagnostics.totalFormulas} formula(s), ${diagnostics.formulaToFormulaEdges} enlace(s) formula-a-formula, ${diagnostics.precedentReferences} precedente(s).`,
    `${diagnostics.recalculableFormulas} formula(s) con orden seguro; ${diagnostics.blockedFormulas} bloqueada(s) por ciclos.`,
  ];
  if (diagnostics.missingReferenceCount) lines.push(`Referencias faltantes: ${diagnostics.missingReferences.join(', ')}`);
  if (diagnostics.externalReferenceCount) lines.push(`Referencias externas: ${diagnostics.externalReferences.join(', ')}`);
  if (diagnostics.blockedCells.length) lines.push(`Bloqueadas: ${diagnostics.blockedCells.slice(0, 8).map((cell) => cell.label).join(', ')}`);
  if (diagnostics.orderedCells.length) lines.push(`Primeras a recalcular: ${diagnostics.orderedCells.slice(0, 10).map((cell) => cell.label).join(', ')}`);
  lines.push(...diagnostics.warnings.map((warning) => `- ${warning}`));
  return lines.join('\n');
}

export function formatFormulaDependencySummary(graph: FormulaDependencyGraph): string {
  const plan = buildFormulaRecalculationPlan(graph);
  return `Dependencias: ${graph.nodes.length} fórmula(s), ${graph.edges.length} enlace(s), ${graph.cycles.length} ciclo(s), ${graph.externalReferences.length} referencia(s) externa(s), ${graph.missingReferences.length} referencia(s) faltante(s), plan ${plan.ready ? 'listo' : 'bloqueado'}.`;
}
