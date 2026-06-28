/* eslint-disable @typescript-eslint/no-explicit-any */
import { AXOS_FORMULA_CATALOG } from '@/components/office/sheets/industrialFormulaCatalog';
import { colName, rawOf } from './sheetOps';

export interface FormulaAuditEntry {
  sheetIndex: number;
  sheetName: string;
  address: string;
  formula: string;
  functions: string[];
  volatile: boolean;
  externalReference: boolean;
  unknownAxosFunctions: string[];
}

export interface FormulaAuditResult {
  formulas: FormulaAuditEntry[];
  total: number;
  volatile: number;
  externalReferences: number;
  axosFunctions: number;
  unknownAxosFunctions: string[];
}

const VOLATILE = new Set(['NOW', 'TODAY', 'RAND', 'RANDBETWEEN', 'OFFSET', 'INDIRECT']);
const AXOS_KNOWN = new Set(AXOS_FORMULA_CATALOG.map((f) => f.name));

function formulaOfCell(cd: any): string | null {
  const v = cd?.v;
  if (v && typeof v === 'object' && typeof v.f === 'string' && v.f.trim()) return v.f.trim();
  const raw = rawOf(cd);
  return typeof raw === 'string' && raw.trim().startsWith('=') ? raw.trim() : null;
}

export function functionsInFormula(formula: string): string[] {
  const found = new Set<string>();
  const re = /([A-Za-z_][A-Za-z0-9_.]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(formula))) found.add(m[1].toUpperCase());
  return [...found].sort();
}

export function auditWorkbookFormulas(content: any): FormulaAuditResult {
  const sheets = Array.isArray(content) ? content : (Array.isArray(content?.sheets) ? content.sheets : []);
  const formulas: FormulaAuditEntry[] = [];
  const unknown = new Set<string>();
  for (let si = 0; si < sheets.length; si++) {
    const sheet = sheets[si];
    const sheetName = String(sheet?.name || `Hoja ${si + 1}`);
    for (const cd of sheet?.celldata ?? []) {
      const formula = formulaOfCell(cd);
      if (!formula) continue;
      const fns = functionsInFormula(formula);
      const unknownAxosFunctions = fns.filter((fn) => fn.startsWith('AXOS_') && !AXOS_KNOWN.has(fn));
      unknownAxosFunctions.forEach((fn) => unknown.add(fn));
      formulas.push({
        sheetIndex: si,
        sheetName,
        address: `${colName(cd.c)}${cd.r + 1}`,
        formula,
        functions: fns,
        volatile: fns.some((fn) => VOLATILE.has(fn)),
        externalReference: /\[[^\]]+\]|https?:\/\//i.test(formula),
        unknownAxosFunctions,
      });
    }
  }
  return {
    formulas,
    total: formulas.length,
    volatile: formulas.filter((f) => f.volatile).length,
    externalReferences: formulas.filter((f) => f.externalReference).length,
    axosFunctions: formulas.filter((f) => f.functions.some((fn) => fn.startsWith('AXOS_'))).length,
    unknownAxosFunctions: [...unknown].sort(),
  };
}

export function formatFormulaAuditSummary(result: FormulaAuditResult): string {
  const unknown = result.unknownAxosFunctions.length ? `\nAXOS desconocidas: ${result.unknownAxosFunctions.join(', ')}` : '';
  return `Fórmulas: ${result.total}\nVolátiles: ${result.volatile}\nReferencias externas: ${result.externalReferences}\nFórmulas AXOS: ${result.axosFunctions}${unknown}`;
}
