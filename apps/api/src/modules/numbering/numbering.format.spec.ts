import {
  pad,
  formatDocumentNumber,
  computePeriodKey,
  validatePattern,
  isResetPolicy,
} from './numbering.format';

describe('numbering format helpers', () => {
  describe('pad', () => {
    it('left-pads to the requested width', () => {
      expect(pad(7, 4)).toBe('0007');
      expect(pad(1234, 4)).toBe('1234');
    });
    it('never truncates a value wider than the pad width', () => {
      expect(pad(123456, 4)).toBe('123456');
    });
    it('clamps a non-positive width to 1', () => {
      expect(pad(5, 0)).toBe('5');
    });
  });

  describe('formatDocumentNumber', () => {
    // June 7 2026, constructed with local components so date-token assertions
    // are timezone-independent (format reads the same local accessors).
    const date = new Date(2026, 5, 7);

    it('renders prefix, year and zero-padded sequence', () => {
      expect(
        formatDocumentNumber({
          pattern: '{PREFIX}-{YYYY}-{SEQ}',
          prefix: 'WO',
          seq: 42,
          padding: 6,
          date,
        }),
      ).toBe('WO-2026-000042');
    });

    it('supports YY / MM / DD tokens', () => {
      expect(
        formatDocumentNumber({
          pattern: '{PREFIX}{YY}{MM}{DD}-{SEQ}',
          prefix: 'CC',
          seq: 3,
          padding: 4,
          date,
        }),
      ).toBe('CC260607-0003');
    });

    it('leaves unknown tokens untouched so typos are visible', () => {
      expect(
        formatDocumentNumber({
          pattern: '{PREFIX}-{NOPE}-{SEQ}',
          prefix: 'X',
          seq: 1,
          padding: 2,
          date,
        }),
      ).toBe('X-{NOPE}-01');
    });
  });

  describe('computePeriodKey', () => {
    const date = new Date(2026, 5, 7); // June 2026 (local)
    it('returns null for NEVER', () => {
      expect(computePeriodKey('NEVER', date)).toBeNull();
    });
    it('returns the year for YEARLY', () => {
      expect(computePeriodKey('YEARLY', date)).toBe('2026');
    });
    it('returns year-month for MONTHLY', () => {
      expect(computePeriodKey('MONTHLY', date)).toBe('2026-06');
    });
  });

  describe('validatePattern', () => {
    it('accepts a pattern containing {SEQ} and known tokens', () => {
      expect(validatePattern('{PREFIX}-{YYYY}-{SEQ}').valid).toBe(true);
    });
    it('rejects a pattern without {SEQ}', () => {
      const res = validatePattern('{PREFIX}-{YYYY}');
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/\{SEQ\}/);
    });
    it('rejects unknown tokens', () => {
      const res = validatePattern('{PREFIX}-{FOO}-{SEQ}');
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/FOO/);
    });
    it('rejects empty input', () => {
      expect(validatePattern('').valid).toBe(false);
    });
  });

  describe('isResetPolicy', () => {
    it('recognises valid policies', () => {
      expect(isResetPolicy('YEARLY')).toBe(true);
      expect(isResetPolicy('MONTHLY')).toBe(true);
      expect(isResetPolicy('NEVER')).toBe(true);
    });
    it('rejects anything else', () => {
      expect(isResetPolicy('DAILY')).toBe(false);
      expect(isResetPolicy(null)).toBe(false);
    });
  });
});
