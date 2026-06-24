import {
  lifePercent,
  remainingShots,
  isNearEol,
  isToolStatus,
  calibrationStatus,
  daysUntil,
} from './tool-life';

describe('tooling life helpers', () => {
  it('computes life percent consumed', () => {
    expect(lifePercent(50000, 100000)).toBe(50);
    expect(lifePercent(0, 100000)).toBe(0);
    expect(lifePercent(150000, 100000)).toBe(100); // capped
    expect(lifePercent(10, 0)).toBe(0); // no rated life
  });

  it('computes remaining shots', () => {
    expect(remainingShots(30000, 100000)).toBe(70000);
    expect(remainingShots(120000, 100000)).toBe(0);
  });

  it('flags near end-of-life at the threshold', () => {
    expect(isNearEol(80000, 100000)).toBe(true);
    expect(isNearEol(79000, 100000)).toBe(false); // 79.0% < 80%
    expect(isNearEol(50000, 100000, 50)).toBe(true);
  });

  it('validates tool statuses', () => {
    expect(isToolStatus('IN_USE')).toBe(true);
    expect(isToolStatus('NOPE')).toBe(false);
  });

  describe('calibration status', () => {
    const now = new Date('2026-06-23T12:00:00Z');

    it('is NONE without a next date', () => {
      expect(calibrationStatus(null, 30, now)).toBe('NONE');
      expect(calibrationStatus(undefined, 30, now)).toBe('NONE');
    });

    it('is OVERDUE when the next date is in the past', () => {
      expect(calibrationStatus(new Date('2026-06-01'), 30, now)).toBe('OVERDUE');
    });

    it('is DUE_SOON within the window', () => {
      expect(calibrationStatus(new Date('2026-07-10'), 30, now)).toBe('DUE_SOON');
    });

    it('is VALID comfortably beyond the window', () => {
      expect(calibrationStatus(new Date('2026-12-01'), 30, now)).toBe('VALID');
    });

    it('computes whole days until a date', () => {
      expect(daysUntil(new Date('2026-06-25'), now)).toBe(2);
      expect(daysUntil(new Date('2026-06-20'), now)).toBe(-3);
      expect(daysUntil(null, now)).toBeNull();
    });
  });
});
