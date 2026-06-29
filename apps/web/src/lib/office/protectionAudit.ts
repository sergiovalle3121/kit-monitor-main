/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ProtectionAuditRange {
  sheetIndex: number;
  sheetName: string;
  range: string;
  locked: boolean;
  connectorId?: string;
  connectorType?: string;
}

export interface ProtectionAudit {
  sheetLocks: number;
  ranges: ProtectionAuditRange[];
  lockedRanges: number;
  connectorRanges: number;
  unprotectedConnectors: { id: string; type: string; label: string; sheetIndex: number; range: string }[];
}

export function auditWorkbookProtection(content: any): ProtectionAudit {
  const sheets = Array.isArray(content) ? content : Array.isArray(content?.sheets) ? content.sheets : [];
  const connectors = Array.isArray(content?.connectors) ? content.connectors : [];
  const ranges: ProtectionAuditRange[] = [];
  let sheetLocks = 0;
  sheets.forEach((sheet: any, sheetIndex: number) => {
    const protection = sheet?.axosProtection;
    if (protection?.sheetLocked) sheetLocks++;
    for (const range of protection?.ranges ?? []) {
      ranges.push({
        sheetIndex,
        sheetName: sheet?.name ?? `Hoja ${sheetIndex + 1}`,
        range: String(range.range ?? ''),
        locked: range.locked !== false,
        connectorId: range.connectorId,
        connectorType: range.connectorType,
      });
    }
  });
  const unprotectedConnectors = connectors.filter((connector: any) => {
    const sheet = sheets[connector.sheetIndex];
    if (sheet?.axosProtection?.sheetLocked) return false;
    return !ranges.some((range) => range.sheetIndex === connector.sheetIndex && range.range === connector.range && range.locked && range.connectorId === connector.id);
  }).map((connector: any) => ({ id: connector.id, type: connector.type, label: connector.label, sheetIndex: connector.sheetIndex, range: connector.range }));
  return {
    sheetLocks,
    ranges,
    lockedRanges: ranges.filter((range) => range.locked).length,
    connectorRanges: ranges.filter((range) => range.connectorId).length,
    unprotectedConnectors,
  };
}

export function formatProtectionAudit(audit: ProtectionAudit): string {
  const lines = [`Protección: ${audit.sheetLocks} hoja(s) bloqueadas · ${audit.lockedRanges} rango(s) bloqueados · ${audit.connectorRanges} rango(s) de conectores`];
  if (audit.unprotectedConnectors.length) lines.push(...audit.unprotectedConnectors.map((connector) => `Conector sin protección: ${connector.label} ${connector.range}`));
  return lines.join('\n');
}
