import {
  addInterval,
  computeNextDueDate,
  pmDueStatus,
  PM_FREQUENCY_TYPES,
} from './pm-frequency';

describe('pm-frequency (scheduling math)', () => {
  it('adds days / weeks / months', () => {
    const base = new Date('2026-01-10T00:00:00');
    expect(addInterval(base, 'DAYS', 5).getDate()).toBe(15);
    expect(addInterval(base, 'WEEKS', 2).getDate()).toBe(24);
    const m = addInterval(base, 'MONTHS', 2);
    expect(m.getMonth()).toBe(2); // March (0-based)
    expect(m.getDate()).toBe(10);
  });

  it('clamps month overflow to the end of the target month', () => {
    // 31-Jan + 1 month → 28-Feb (2026 is not a leap year).
    const base = new Date('2026-01-31T00:00:00');
    const next = addInterval(base, 'MONTHS', 1);
    expect(next.getMonth()).toBe(1); // February
    expect(next.getDate()).toBe(28);
  });

  it('treats frequency value as at least 1', () => {
    const base = new Date('2026-01-10T00:00:00');
    expect(addInterval(base, 'DAYS', 0).getDate()).toBe(11);
    expect(computeNextDueDate(base, 'DAYS', 3).getDate()).toBe(13);
  });

  it('classifies the due-date semaphore', () => {
    const now = new Date('2026-06-23T12:00:00').getTime();
    const days = (n: number) => new Date(now + n * 86_400_000);
    expect(pmDueStatus(days(-1), now)).toBe('OVERDUE');
    expect(pmDueStatus(days(3), now, 7)).toBe('DUE_SOON');
    expect(pmDueStatus(days(30), now, 7)).toBe('OK');
    expect(pmDueStatus(null, now)).toBe('OK');
  });

  it('exposes the supported frequency types', () => {
    expect(PM_FREQUENCY_TYPES).toEqual(['DAYS', 'WEEKS', 'MONTHS']);
  });
});
