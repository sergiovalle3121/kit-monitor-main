import {
  APPOINTMENT_DIRECTIONS,
  APPOINTMENT_STATUSES,
  assertAppointmentTransition,
  canTransitionAppointment,
  isAppointmentLate,
  isAppointmentTerminal,
  nextAppointmentStates,
} from './traffic-appointment.rules';

describe('traffic-appointment.rules — vocabularies', () => {
  it('exposes stable vocabularies', () => {
    expect(APPOINTMENT_STATUSES).toEqual([
      'scheduled',
      'arrived',
      'completed',
      'cancelled',
      'no_show',
    ]);
    expect(APPOINTMENT_DIRECTIONS).toEqual(['inbound', 'outbound']);
  });
});

describe('traffic-appointment.rules — state machine', () => {
  it('allows the gate flow and blocks skips', () => {
    expect(canTransitionAppointment('scheduled', 'arrived')).toBe(true);
    expect(canTransitionAppointment('scheduled', 'cancelled')).toBe(true);
    expect(canTransitionAppointment('scheduled', 'no_show')).toBe(true);
    expect(canTransitionAppointment('scheduled', 'completed')).toBe(false); // no se salta arrived
    expect(canTransitionAppointment('arrived', 'completed')).toBe(true);
    expect(canTransitionAppointment('completed', 'arrived')).toBe(false);
  });

  it('knows terminal states + next states', () => {
    expect(isAppointmentTerminal('completed')).toBe(true);
    expect(isAppointmentTerminal('cancelled')).toBe(true);
    expect(isAppointmentTerminal('no_show')).toBe(true);
    expect(isAppointmentTerminal('scheduled')).toBe(false);
    expect(nextAppointmentStates('arrived')).toEqual([
      'completed',
      'cancelled',
    ]);
  });

  it('asserts illegal transitions', () => {
    expect(() => assertAppointmentTransition('completed', 'arrived')).toThrow(
      /No se puede mover/,
    );
    expect(() =>
      assertAppointmentTransition('scheduled', 'arrived'),
    ).not.toThrow();
  });
});

describe('traffic-appointment.rules — late detection', () => {
  it('flags only still-scheduled past-due appointments', () => {
    expect(
      isAppointmentLate({
        status: 'scheduled',
        scheduledAt: new Date(Date.now() - 60_000),
      }),
    ).toBe(true);
    expect(
      isAppointmentLate({
        status: 'scheduled',
        scheduledAt: new Date(Date.now() + 60_000),
      }),
    ).toBe(false);
    expect(
      isAppointmentLate({
        status: 'arrived',
        scheduledAt: new Date(Date.now() - 60_000),
      }),
    ).toBe(false);
    expect(isAppointmentLate({ status: 'scheduled', scheduledAt: null })).toBe(
      false,
    );
  });
});
