/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AxosConnectorType } from './axosConnectors';

export type AxosConnectorRefreshAuditStatus = 'api' | 'fallback' | 'skipped';

export interface AxosConnectorRefreshAuditEntry {
  id: string;
  connectorId: string;
  connectorType: AxosConnectorType;
  label: string;
  range: string;
  sheetIndex: number;
  status: AxosConnectorRefreshAuditStatus;
  refreshedAt: string;
  source: 'api' | 'local';
  warnings: string[];
  message?: string;
}

export interface AxosConnectorRefreshAuditSummary {
  total: number;
  api: number;
  fallback: number;
  skipped: number;
  warnings: number;
  latestAt: string | null;
}

export const AXOS_CONNECTOR_AUDIT_LIMIT = 50;

function stableAuditId(entry: Omit<AxosConnectorRefreshAuditEntry, 'id'>): string {
  const raw = [entry.connectorId, entry.status, entry.refreshedAt, entry.range].join('|');
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `axca_${(hash >>> 0).toString(36)}`;
}

export function createConnectorRefreshAuditEntry(
  entry: Omit<AxosConnectorRefreshAuditEntry, 'id'>,
): AxosConnectorRefreshAuditEntry {
  return {
    ...entry,
    warnings: entry.warnings.filter(Boolean),
    id: stableAuditId(entry),
  };
}

export function appendConnectorRefreshAudit(
  existing: AxosConnectorRefreshAuditEntry[],
  entries: AxosConnectorRefreshAuditEntry[],
  limit = AXOS_CONNECTOR_AUDIT_LIMIT,
): AxosConnectorRefreshAuditEntry[] {
  const byId = new Map<string, AxosConnectorRefreshAuditEntry>();
  [...entries, ...existing].forEach((entry) => byId.set(entry.id, entry));
  return [...byId.values()]
    .sort((a, b) => Date.parse(b.refreshedAt) - Date.parse(a.refreshedAt))
    .slice(0, Math.max(1, limit));
}

export function summarizeConnectorRefreshAudit(
  entries: AxosConnectorRefreshAuditEntry[],
): AxosConnectorRefreshAuditSummary {
  const latest = entries
    .map((entry) => Date.parse(entry.refreshedAt))
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];
  return {
    total: entries.length,
    api: entries.filter((entry) => entry.status === 'api').length,
    fallback: entries.filter((entry) => entry.status === 'fallback').length,
    skipped: entries.filter((entry) => entry.status === 'skipped').length,
    warnings: entries.filter((entry) => entry.warnings.length > 0).length,
    latestAt: latest ? new Date(latest).toISOString() : null,
  };
}

export function formatConnectorRefreshAuditSummary(summary: AxosConnectorRefreshAuditSummary): string {
  if (!summary.total) return 'Sin historial de refresh AXOS.';
  const parts = [`${summary.total} evento(s) auditados`];
  if (summary.api) parts.push(`${summary.api} API`);
  if (summary.fallback) parts.push(`${summary.fallback} fallback`);
  if (summary.skipped) parts.push(`${summary.skipped} omitidos`);
  if (summary.warnings) parts.push(`${summary.warnings} con warnings`);
  if (summary.latestAt) parts.push(`último ${summary.latestAt}`);
  return parts.join(' · ');
}


function auditCell(value: string | number, bold = false) {
  const isNumber = typeof value === 'number';
  return {
    v: value,
    m: String(value),
    ct: { fa: 'General', t: isNumber ? 'n' : 's' },
    ...(bold ? { bl: 1, bg: '#eef2ff', fc: '#312e81' } : {}),
  };
}

export function buildConnectorAuditSheet(
  entries: AxosConnectorRefreshAuditEntry[],
  order = 0,
  name = 'AXOS Connector Audit',
): { name: string; order: number; row: number; column: number; celldata: any[]; config: Record<string, unknown> } {
  const headers = ['Refreshed at', 'Status', 'Source', 'Connector', 'Type', 'Sheet', 'Range', 'Warnings', 'Message'];
  const celldata: any[] = [];
  headers.forEach((header, c) => celldata.push({ r: 0, c, v: auditCell(header, true) }));
  entries
    .slice()
    .sort((a, b) => Date.parse(b.refreshedAt) - Date.parse(a.refreshedAt))
    .forEach((entry, i) => {
      const row = [
        entry.refreshedAt,
        entry.status,
        entry.source,
        entry.label,
        entry.connectorType,
        entry.sheetIndex + 1,
        entry.range,
        entry.warnings.join(' | '),
        entry.message ?? '',
      ];
      row.forEach((value, c) => celldata.push({ r: i + 1, c, v: auditCell(value) }));
    });
  return {
    name,
    order,
    row: Math.max(25, entries.length + 5),
    column: headers.length + 1,
    celldata,
    config: {
      columnlen: { 0: 190, 1: 90, 2: 90, 3: 180, 4: 170, 5: 70, 6: 90, 7: 260, 8: 260 },
      frozen: { type: 'row' },
    },
  };
}

export function upsertConnectorAuditSheet(
  sheets: any[],
  entries: AxosConnectorRefreshAuditEntry[],
  name = 'AXOS Connector Audit',
): any[] {
  const next = sheets.map((sheet) => ({ ...sheet }));
  const index = next.findIndex((sheet) => sheet?.name === name);
  const order = index >= 0 ? (next[index]?.order ?? index) : next.length;
  const auditSheet = buildConnectorAuditSheet(entries, order, name);
  if (index >= 0) next[index] = { ...next[index], ...auditSheet };
  else next.push(auditSheet);
  return next.map((sheet, i) => ({ ...sheet, order: sheet.order ?? i }));
}
