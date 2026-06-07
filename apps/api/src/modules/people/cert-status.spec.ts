import { certStatus, daysToExpiry } from './cert-status';

describe('certification status helpers', () => {
  const now = new Date('2026-06-07T00:00:00Z');

  it('returns NO_EXPIRY when there is no expiry date', () => {
    expect(certStatus(null, now)).toBe('NO_EXPIRY');
    expect(daysToExpiry(null, now)).toBeNull();
  });

  it('returns VALID well before expiry', () => {
    expect(certStatus('2026-12-31', now)).toBe('VALID');
  });

  it('returns EXPIRING within the warning window', () => {
    expect(certStatus('2026-06-20', now)).toBe('EXPIRING'); // 13 days out
  });

  it('returns EXPIRED after the date', () => {
    expect(certStatus('2026-05-01', now)).toBe('EXPIRED');
  });

  it('computes days to expiry', () => {
    expect(daysToExpiry('2026-06-17', now)).toBe(10);
    expect(daysToExpiry('2026-05-28', now)).toBe(-10);
  });
});
