/**
 * Changeover / SMED lifecycle — the model-to-model setup window on a line.
 *
 * OPEN ─▶ IN_PROGRESS ─▶ COMPLETED   (clock runs from start→complete = changeover time)
 *   │          │
 *   └──────────┴──▶ CANCELLED        (aborted from any non-terminal state)
 *
 * OPEN lets the team stage the setup checklist (internal SMED prep) before the
 * line stops; IN_PROGRESS is the line-down window (the downtime clock); COMPLETED
 * stamps the measured changeover time. Pure + side-effect free.
 */

export type ChangeoverStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export const CHANGEOVER_STATUSES: ChangeoverStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

const TRANSITIONS: Record<ChangeoverStatus, ChangeoverStatus[]> = {
  OPEN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function nextStates(from: ChangeoverStatus): ChangeoverStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function canTransition(
  from: ChangeoverStatus,
  to: ChangeoverStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(status: ChangeoverStatus): boolean {
  return (TRANSITIONS[status]?.length ?? 0) === 0;
}

export function assertTransition(
  from: ChangeoverStatus,
  to: ChangeoverStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `No se puede mover el changeover de ${from} a ${to}. ` +
        `Permitido: ${nextStates(from).join(', ') || '(ninguno — terminal)'}.`,
    );
  }
}

/** One setup step on the changeover checklist. */
export interface ChangeoverChecklistItem {
  /** Stable key (e.g. 'load_program', 'mount_feeders'). */
  key: string;
  label: string;
  done: boolean;
  doneBy?: string | null;
  doneAt?: string | null;
}

/** Whether every checklist item is done (vacuously true when empty). */
export function checklistComplete(items: ChangeoverChecklistItem[]): boolean {
  return (items ?? []).every((i) => i.done);
}

/** Items still pending — used to explain why a changeover can't complete yet. */
export function pendingItems(items: ChangeoverChecklistItem[]): string[] {
  return (items ?? []).filter((i) => !i.done).map((i) => i.label || i.key);
}
