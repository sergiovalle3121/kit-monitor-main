import { parseRange } from './charts';

export type SheetCommentAnchor =
  | { type: 'sheet'; sheetId?: string; sheetName?: string }
  | { type: 'cell'; sheetId?: string; sheetName?: string; cell: string }
  | { type: 'range'; sheetId?: string; sheetName?: string; range: string }
  | { type: 'table'; sheetId?: string; sheetName?: string; tableId: string }
  | { type: 'pivot'; sheetId?: string; sheetName?: string; pivotId: string }
  | { type: 'chart'; sheetId?: string; sheetName?: string; chartId: string };

export interface SheetGovernanceEvent {
  id: string;
  type: 'comment.created' | 'comment.replied' | 'comment.resolved' | 'comment.reopened' | 'comment.deleted' | 'protection.enabled' | 'protection.disabled' | 'range.locked' | 'range.unlocked' | 'share.reviewed' | 'approval.requested';
  label: string;
  severity: 'info' | 'warning' | 'critical';
  at: string;
  actor?: string;
  target?: string;
}

export interface WorkbookGovernanceSummary {
  openComments: number;
  assignedComments: number;
  protectedSheets: number;
  protectedRanges: number;
  connectorLocks: number;
  unresolvedCriticalFindings: number;
  healthLabel: 'governed' | 'review' | 'open';
}

export function anchorForSelection(sheetName: string | undefined, range: string): SheetCommentAnchor {
  const normalized = normalizeRangeRef(range);
  if (!normalized) return { type: 'sheet', sheetName };
  if (!normalized.includes(':')) return { type: 'cell', sheetName, cell: normalized };
  const [a, b] = normalized.split(':');
  return a === b ? { type: 'cell', sheetName, cell: a } : { type: 'range', sheetName, range: normalized };
}

export function labelForAnchor(anchor: SheetCommentAnchor): string {
  const prefix = anchor.sheetName ? `${anchor.sheetName}!` : '';
  if (anchor.type === 'sheet') return anchor.sheetName || 'Hoja';
  if (anchor.type === 'cell') return `${prefix}${anchor.cell}`;
  if (anchor.type === 'range') return `${prefix}${anchor.range}`;
  if (anchor.type === 'table') return `${prefix}Tabla ${anchor.tableId}`;
  if (anchor.type === 'pivot') return `${prefix}Pivot ${anchor.pivotId}`;
  return `${prefix}Chart ${anchor.chartId}`;
}

export function normalizeRangeRef(range: string): string {
  const clean = String(range ?? '').trim().toUpperCase().replace(/\$/g, '');
  if (!clean) return '';
  const parsed = parseRange(clean);
  if (!parsed) return clean;
  const col = (n: number) => {
    let s = ''; let x = n + 1;
    while (x > 0) { const r = (x - 1) % 26; s = String.fromCharCode(65 + r) + s; x = Math.floor((x - 1) / 26); }
    return s;
  };
  const a = `${col(parsed.c1)}${parsed.r1 + 1}`;
  const b = `${col(parsed.c2)}${parsed.r2 + 1}`;
  return a === b ? a : `${a}:${b}`;
}

export function mentionsOf(text: string): string[] {
  return [...new Set((String(text ?? '').match(/@[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|@[\w.-]+/g) ?? [])
    .map((m) => m.slice(1).trim().toLowerCase())
    .filter(Boolean))];
}

export function assignedFromText(text: string): string | null {
  const match = String(text ?? '').match(/(?:assign|asignar|owner|responsable)\s*[:=]\s*@?([\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|[\w.-]+)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

type GovernanceSheet = { axosProtection?: { sheetLocked?: boolean; ranges?: Array<{ connectorId?: string | null; range?: string }> } };
type GovernanceComment = { id?: string; resolved?: boolean; parentId?: string | null; assignedTo?: string | null };
type GovernanceFinding = { severity?: string };

export function summarizeWorkbookGovernance(input: { sheets?: GovernanceSheet[]; comments?: GovernanceComment[]; healthFindings?: GovernanceFinding[] }): WorkbookGovernanceSummary {
  const sheets = input.sheets ?? [];
  const comments = input.comments ?? [];
  const protectedRanges = sheets.reduce((n, s) => n + (Array.isArray(s?.axosProtection?.ranges) ? s.axosProtection.ranges.length : 0), 0);
  const protectedSheets = sheets.filter((s) => !!s?.axosProtection?.sheetLocked).length;
  const connectorLocks = sheets.reduce((n, s) => n + (Array.isArray(s?.axosProtection?.ranges) ? s.axosProtection.ranges.filter((r) => r.connectorId).length : 0), 0);
  const openComments = comments.filter((c) => !c.resolved && !c.parentId).length;
  const assignedComments = comments.filter((c) => !c.resolved && !!c.assignedTo).length;
  const unresolvedCriticalFindings = (input.healthFindings ?? []).filter((f) => f.severity === 'critical' || f.severity === 'high').length;
  const healthLabel = protectedSheets + protectedRanges + connectorLocks > 0 && openComments === 0 ? 'governed' : (openComments || unresolvedCriticalFindings ? 'review' : 'open');
  return { openComments, assignedComments, protectedSheets, protectedRanges, connectorLocks, unresolvedCriticalFindings, healthLabel };
}

export function governanceEvent(type: SheetGovernanceEvent['type'], target: string, actor = 'AXOS', at = new Date()): SheetGovernanceEvent {
  const labels: Record<SheetGovernanceEvent['type'], string> = {
    'comment.created': 'Comentario creado', 'comment.replied': 'Respuesta agregada', 'comment.resolved': 'Comentario resuelto', 'comment.reopened': 'Comentario reabierto', 'comment.deleted': 'Comentario eliminado',
    'protection.enabled': 'Protección de hoja activada', 'protection.disabled': 'Protección de hoja desactivada', 'range.locked': 'Rango bloqueado', 'range.unlocked': 'Rango desbloqueado', 'share.reviewed': 'Permisos revisados', 'approval.requested': 'Aprobación solicitada',
  };
  const severity: SheetGovernanceEvent['severity'] = type.includes('protection') || type.includes('range') ? 'critical' : type.includes('deleted') ? 'warning' : 'info';
  return { id: `sge_${at.getTime().toString(36)}`, type, label: labels[type], severity, at: at.toISOString(), actor, target };
}
