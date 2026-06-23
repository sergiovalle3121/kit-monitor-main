// ─────────────────────────────────────────────────────────────────────────────
// Dock appointments (Citas de andén) — pure domain rules: the scheduling/gate
// state machine + late detection. Side-effect free so the service and the specs
// share ONE source of truth, exactly like outbound/shipment-state.ts. Lives
// beside traffic.rules.ts (master-data vocab) without touching it.
//
//   scheduled ─▶ arrived ─▶ completed
//       │           │
//       ├───────────┴─▶ cancelled
//       └─▶ no_show
// ─────────────────────────────────────────────────────────────────────────────

export type AppointmentDirection = 'inbound' | 'outbound';
export const APPOINTMENT_DIRECTIONS: AppointmentDirection[] = [
  'inbound',
  'outbound',
];

export type AppointmentStatus =
  | 'scheduled'
  | 'arrived'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'scheduled',
  'arrived',
  'completed',
  'cancelled',
  'no_show',
];

const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ['arrived', 'cancelled', 'no_show'],
  arrived: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
};

export function isAppointmentTerminal(status: AppointmentStatus): boolean {
  return TRANSITIONS[status]?.length === 0;
}

export function canTransitionAppointment(
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextAppointmentStates(
  from: AppointmentStatus,
): AppointmentStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function assertAppointmentTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
): void {
  if (!canTransitionAppointment(from, to)) {
    throw new Error(
      `No se puede mover una cita de ${from} a ${to}. ` +
        `Permitido: ${nextAppointmentStates(from).join(', ') || '(ninguno — terminal)'}.`,
    );
  }
}

/**
 * A still-`scheduled` appointment whose planned time is already in the past is
 * "late" (the unit hasn't shown up on time). Drives the yard semáforo/KPI; the
 * no-show transition is a manual decision the coordinator takes.
 */
export function isAppointmentLate(
  appt: { status: AppointmentStatus; scheduledAt: Date | string | null },
  now: number = Date.now(),
): boolean {
  if (appt.status !== 'scheduled' || !appt.scheduledAt) return false;
  const t = new Date(appt.scheduledAt).getTime();
  return !Number.isNaN(t) && t < now;
}
