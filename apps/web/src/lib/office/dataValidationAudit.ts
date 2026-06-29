/* eslint-disable @typescript-eslint/no-explicit-any */
import { dvSatisfies, rawOf, type DvConfig, type DvEntry, type DvType } from './sheetOps';

export interface DataValidationFinding {
  sheetIndex: number;
  sheetName: string;
  cell: string;
  type: DvType;
  value: string;
  rule: string;
}

export interface DataValidationAudit {
  rules: number;
  invalid: number;
  byType: Partial<Record<DvType, number>>;
  findings: DataValidationFinding[];
}

function colName(n: number): string {
  let s = '';
  for (let x = n + 1; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(((x - 1) % 26) + 65) + s;
  return s;
}

function configFromEntry(entry: DvEntry): DvConfig {
  return {
    type: entry.type as DvType,
    operator: entry.type2 as DvConfig['operator'],
    value1: entry.value1,
    value2: entry.value2,
    prohibitInput: entry.prohibitInput,
    hintText: entry.hintText,
  };
}

function entryRule(entry: DvEntry): string {
  return [entry.type, entry.type2, entry.value1, entry.value2].filter(Boolean).join(' ');
}

export function auditDataValidations(content: any): DataValidationAudit {
  const sheets = Array.isArray(content) ? content : Array.isArray(content?.sheets) ? content.sheets : [];
  const findings: DataValidationFinding[] = [];
  let rules = 0;
  const byType: Partial<Record<DvType, number>> = {};
  sheets.forEach((sheet: any, sheetIndex: number) => {
    const cells = new Map<string, any>((sheet?.celldata ?? []).map((cell: any) => [`${cell.r}_${cell.c}`, cell]));
    for (const [key, entry] of Object.entries((sheet?.dataVerification ?? {}) as Record<string, DvEntry>)) {
      rules++;
      const cfg = configFromEntry(entry);
      byType[cfg.type] = (byType[cfg.type] ?? 0) + 1;
      const [rRaw, cRaw] = key.split('_');
      const r = Number(rRaw);
      const c = Number(cRaw);
      const raw = rawOf(cells.get(key));
      if (dvSatisfies(cfg, raw)) continue;
      findings.push({
        sheetIndex,
        sheetName: sheet?.name ?? `Hoja ${sheetIndex + 1}`,
        cell: `${colName(c)}${r + 1}`,
        type: cfg.type,
        value: String(raw ?? ''),
        rule: entryRule(entry),
      });
    }
  });
  return { rules, invalid: findings.length, byType, findings };
}

export function formatDataValidationAudit(audit: DataValidationAudit): string {
  if (!audit.rules) return 'Sin reglas de validación de datos.';
  if (!audit.invalid) return `${audit.rules} regla(s) de validación · sin valores inválidos visibles.`;
  const samples = audit.findings.slice(0, 8).map((finding) => `${finding.sheetName}!${finding.cell} ${finding.type}: ${finding.value}`);
  return [`${audit.invalid}/${audit.rules} celda(s) con validación inválida`, ...samples].join('\n');
}
