/**
 * Pure, side-effect-free formatting for layout approval events (Fase 50).
 *
 * Approving or submitting a layout writes an event to the audit ledger. Until
 * now that event only carried the new status, so the history could say "approved"
 * but not "approved AT WHAT QUALITY". This formats the approval event — now
 * stamped with the health scorecard grade/score and open blocker count at
 * sign-off time — into the Spanish title + detail the timeline shows, making
 * every sign-off traceable to the state of the layout when it happened.
 *
 * Kept pure so the wording can be unit-tested without a database or a ledger.
 */

const STATUS_LABEL: Record<string, string> = {
  draft: 'borrador',
  in_review: 'en revisión',
  approved: 'aprobado',
};

export interface ApprovalAfterState {
  status?: unknown;
  /** Scorecard grade stamped at sign-off (A–D), when computed. */
  grade?: unknown;
  /** Scorecard score 0..100 stamped at sign-off, when computed. */
  score?: unknown;
  /** Number of hard blockers open at sign-off, when computed. */
  blockers?: unknown;
}

/** Format an approval ledger after-state into the timeline's title + detail. */
export function approvalEventDetail(after: ApprovalAfterState | null | undefined): {
  title: string;
  detail: string;
} {
  const a = after ?? {};
  const status = String(a.status ?? '').toLowerCase();
  const label = STATUS_LABEL[status] ?? (status || '—');
  const title = `Cambió aprobación a ${label}`;

  const grade = typeof a.grade === 'string' && a.grade ? a.grade : '';
  const scoreNum = Number(a.score);
  const score = Number.isFinite(scoreNum) ? Math.round(scoreNum) : null;
  const blockers = Math.max(0, Math.floor(Number(a.blockers) || 0));

  const parts: string[] = [];
  if (grade) parts.push(score !== null ? `grado ${grade} · ${score}/100` : `grado ${grade}`);
  if (grade && blockers > 0) parts.push(`${blockers} bloqueo${blockers === 1 ? '' : 's'}`);

  return { title, detail: parts.join(' · ') };
}
