/* eslint-disable @typescript-eslint/no-explicit-any */

import { assessDocCompatibility } from './docCompatibility';
import { summarizeTrackedChanges } from './trackChangesSummary';

export type ReleaseCheckStatus = 'pass' | 'warning' | 'blocker';

export interface ReleaseCheck {
  id: string;
  label: string;
  detail: string;
  status: ReleaseCheckStatus;
}

export interface ReleaseReadinessReport {
  ready: boolean;
  score: number;
  blockers: number;
  warnings: number;
  checks: ReleaseCheck[];
}

const REQUIRED_DOC_PROPS = [
  ['documentNumber', 'No. documento'],
  ['revision', 'Revisión'],
  ['owner', 'Dueño'],
  ['department', 'Departamento'],
] as const;

function docProps(content: any): Record<string, string> {
  return content?.attrs?.docProps && typeof content.attrs.docProps === 'object' ? content.attrs.docProps : {};
}

function countCommentMarks(content: any) {
  let total = 0;
  let open = 0;
  const seen = new Set<string>();
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node.marks)) {
      for (const mark of node.marks) {
        if (mark?.type !== 'comment') continue;
        const id = String(mark.attrs?.commentId || `${total}:${node.text || ''}`);
        if (seen.has(id)) continue;
        seen.add(id);
        total += 1;
        if (!mark.attrs?.resolved) open += 1;
      }
    }
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(content);
  return { total, open };
}

export function assessReleaseReadiness(content: any, unresolvedServerComments = 0): ReleaseReadinessReport {
  const compatibility = assessDocCompatibility(content);
  const tracked = summarizeTrackedChanges(content);
  const comments = countCommentMarks(content);
  const props = docProps(content);
  const checks: ReleaseCheck[] = [];

  const missingProps = REQUIRED_DOC_PROPS.filter(([key]) => !String(props[key] || '').trim()).map(([, label]) => label);
  checks.push({
    id: 'doc-props',
    label: 'Metadatos controlados',
    status: missingProps.length ? 'blocker' : 'pass',
    detail: missingProps.length ? `Faltan campos obligatorios: ${missingProps.join(', ')}.` : 'Documento, revisión, dueño y departamento están definidos.',
  });

  checks.push({
    id: 'track-changes',
    label: 'Control de cambios cerrado',
    status: tracked.total ? 'blocker' : 'pass',
    detail: tracked.total ? `Hay ${tracked.total} redlines pendientes por aceptar o rechazar.` : 'No hay inserciones/eliminaciones sugeridas pendientes.',
  });

  const openComments = Math.max(comments.open, unresolvedServerComments);
  checks.push({
    id: 'comments',
    label: 'Comentarios resueltos',
    status: openComments ? 'warning' : 'pass',
    detail: openComments ? `Hay ${openComments} comentarios abiertos. Resolver o justificar antes de liberar.` : 'No se detectaron comentarios abiertos en el documento.',
  });

  checks.push({
    id: 'compatibility',
    label: 'Preflight de exportación',
    status: compatibility.totals.critical ? 'blocker' : compatibility.totals.warning ? 'warning' : 'pass',
    detail: compatibility.totals.critical
      ? `Hay ${compatibility.totals.critical} riesgos críticos de exportación.`
      : compatibility.totals.warning
        ? `Hay ${compatibility.totals.warning} advertencias de exportación que requieren validación visual.`
        : 'Sin riesgos críticos o advertencias de exportación.',
  });

  const blockers = checks.filter((check) => check.status === 'blocker').length;
  const warnings = checks.filter((check) => check.status === 'warning').length;
  const score = Math.max(0, 100 - blockers * 25 - warnings * 10);

  return {
    ready: blockers === 0,
    score,
    blockers,
    warnings,
    checks,
  };
}
