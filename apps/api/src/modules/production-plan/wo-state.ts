/**
 * Work-order lifecycle on the published plan.
 *
 * RELEASED ─▶ STAGED ─▶ IN_EXECUTION ─▶ COMPLETED
 *    │           │            │
 *    └───────────┴────────────┴─▶ CANCELLED   (state-allowed; service blocks unsafe cancels)
 *    ▲           │
 *    └───────────┘  (material pulled back: STAGED → RELEASED)
 *
 * LIBERADO → MONTADO → EN EJECUCIÓN → COMPLETADO. Pure + side-effect free.
 */

export type WorkOrderStatus =
  | 'RELEASED'
  | 'STAGED'
  | 'IN_EXECUTION'
  | 'COMPLETED'
  | 'CANCELLED';

export const WORK_ORDER_STATUSES: WorkOrderStatus[] = [
  'RELEASED',
  'STAGED',
  'IN_EXECUTION',
  'COMPLETED',
  'CANCELLED',
];

const TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  RELEASED: ['STAGED', 'IN_EXECUTION', 'CANCELLED'],
  STAGED: ['IN_EXECUTION', 'RELEASED', 'CANCELLED'],
  IN_EXECUTION: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function nextStates(from: WorkOrderStatus): WorkOrderStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function canTransition(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(status: WorkOrderStatus): boolean {
  return (TRANSITIONS[status]?.length ?? 0) === 0;
}

export function assertTransition(from: WorkOrderStatus, to: WorkOrderStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `No se puede mover la WO de ${from} a ${to}. ` +
        `Permitido: ${nextStates(from).join(', ') || '(ninguno — terminal)'}.`,
    );
  }
}
