import {
  computePpm, computeOtd, computeScarResponsiveness, ppmToScore, certScore,
  buildComposite, selectAndRankForPart, candidatePerfScore, monthlyTrend,
} from './scorecard-math';

/**
 * Pure-logic coverage for the derived supplier scorecard. These replace the old
 * typed-in `otd_pct` / `ppm` and the for-part lookup with honest math over the
 * real records (incoming inspections + received purchase orders).
 */
describe('supplier scorecard math', () => {
  // ── PPM derived from iqc_inspections ─────────────────────────────────────────
  describe('computePpm (PPM from IQC inspections)', () => {
    it('derives PPM = Σ defects / Σ inspected × 1e6', () => {
      const inspections = [
        { sampleSize: 4000, defectsFound: 8 }, // lot 1
        { sampleSize: 6000, defectsFound: 27 }, // lot 2
      ]; // 35 / 10000 = 3500 ppm
      const r = computePpm(inspections);
      expect(r.ppm).toBe(3500);
      expect(r.inspected).toBe(10000);
      expect(r.defects).toBe(35);
      expect(r.lots).toBe(2);
      expect(r.source).toBe('derived');
    });

    it('ignores lots with no sample size (cannot form a rate)', () => {
      const r = computePpm([
        { sampleSize: 1000, defectsFound: 1 },
        { sampleSize: 0, defectsFound: 5 },
        { sampleSize: null, defectsFound: 9 },
      ]);
      expect(r.inspected).toBe(1000);
      expect(r.defects).toBe(1);
      expect(r.ppm).toBe(1000);
    });

    it('falls back to the manual field and tags it when there is no IQC data', () => {
      const r = computePpm([], 250);
      expect(r.ppm).toBe(250);
      expect(r.source).toBe('manual');
    });

    it('returns null source=none with neither IQC data nor a manual value', () => {
      expect(computePpm([]).source).toBe('none');
      expect(computePpm([]).ppm).toBeNull();
    });

    it('windows by inspection date when sinceMs is given', () => {
      const recent = new Date('2026-06-01T00:00:00Z');
      const old = new Date('2024-01-01T00:00:00Z');
      const since = new Date('2026-01-01T00:00:00Z').getTime();
      const r = computePpm(
        [
          { sampleSize: 1000, defectsFound: 1, createdAt: recent },
          { sampleSize: 1000, defectsFound: 500, createdAt: old }, // excluded
        ],
        null,
        since,
      );
      expect(r.inspected).toBe(1000);
      expect(r.defects).toBe(1);
      expect(r.ppm).toBe(1000);
    });
  });

  // ── for-part: only APPROVED, ranked by performance ───────────────────────────
  describe('selectAndRankForPart (who supplies this part?)', () => {
    const candidates = [
      { id: 'A', approvalStatus: 'APPROVED', otdPct: 99, ppm: 50, unitPrice: 1.2 }, // top performer
      { id: 'B', approvalStatus: 'APPROVED', otdPct: 80, ppm: 1500, unitPrice: 0.9 }, // worse perf, cheaper
      { id: 'P', approvalStatus: 'PENDING', otdPct: 100, ppm: 0, unitPrice: 0.5 }, // excluded
      { id: 'D', approvalStatus: 'DISQUALIFIED', otdPct: 100, ppm: 0, unitPrice: 0.1 }, // excluded
    ];

    it('returns only APPROVED sources', () => {
      const ranked = selectAndRankForPart(candidates);
      expect(ranked.map((c) => c.id)).toEqual(['A', 'B']);
      expect(ranked.some((c) => c.approvalStatus !== 'APPROVED')).toBe(false);
    });

    it('orders by performance (OTD + incoming quality), best first', () => {
      const ranked = selectAndRankForPart(candidates);
      expect(ranked[0].id).toBe('A');
      expect(candidatePerfScore(candidates[0])).toBeGreaterThan(candidatePerfScore(candidates[1]));
    });

    it('breaks performance ties by lower price then shorter lead time', () => {
      const tie = [
        { id: 'hi', approvalStatus: 'APPROVED', otdPct: 95, ppm: 100, unitPrice: 5, leadTimeDays: 20 },
        { id: 'lo', approvalStatus: 'APPROVED', otdPct: 95, ppm: 100, unitPrice: 3, leadTimeDays: 30 },
      ];
      expect(selectAndRankForPart(tie).map((c) => c.id)).toEqual(['lo', 'hi']);
    });

    it('returns empty when no source is approved', () => {
      expect(selectAndRankForPart([{ approvalStatus: 'PENDING' }])).toEqual([]);
    });
  });

  // ── OTD derived from received POs ────────────────────────────────────────────
  describe('computeOtd (OTD from received purchase orders)', () => {
    const d = (s: string) => new Date(s);
    it('counts a PO on-time when received on/before the promised date', () => {
      const r = computeOtd([
        { status: 'RECEIVED', promisedDate: d('2026-06-10'), receivedDate: d('2026-06-09') }, // on time
        { status: 'CLOSED', promisedDate: d('2026-06-10'), receivedDate: d('2026-06-15') }, // late
        { status: 'RECEIVED', requiredDate: d('2026-06-10'), receivedDate: d('2026-06-10') }, // on time (required fallback)
      ]);
      expect(r.eligible).toBe(3);
      expect(r.onTime).toBe(2);
      expect(r.late).toBe(1);
      expect(r.otdPct).toBeCloseTo(66.7, 1);
      expect(r.source).toBe('derived');
    });

    it('skips POs that are not received or lack the dates, falling back to manual', () => {
      const r = computeOtd([{ status: 'ISSUED', promisedDate: d('2026-06-10') }], 92);
      expect(r.source).toBe('manual');
      expect(r.otdPct).toBe(92);
    });
  });

  // ── Composite grade ──────────────────────────────────────────────────────────
  describe('buildComposite (A/B/C grade)', () => {
    it('renormalizes weights over only the components we can measure', () => {
      const onlyOtd = buildComposite({ otdScore: 98, ppmScore: null, scarScore: null, certScore: null });
      expect(onlyOtd.composite).toBe(98);
      expect(onlyOtd.grade).toBe('A');
    });

    it('grades a strong supplier A and a weak one C', () => {
      expect(buildComposite({ otdScore: 99, ppmScore: ppmToScore(20), scarScore: 100, certScore: 100 }).grade).toBe('A');
      expect(buildComposite({ otdScore: 70, ppmScore: ppmToScore(4000), scarScore: 40, certScore: 50 }).grade).toBe('C');
    });

    it('is NA when nothing can be measured', () => {
      expect(buildComposite({ otdScore: null, ppmScore: null, scarScore: null, certScore: null }).grade).toBe('NA');
    });
  });

  describe('helpers', () => {
    it('ppmToScore maps 0→100 and ≥5000→0', () => {
      expect(ppmToScore(0)).toBe(100);
      expect(ppmToScore(5000)).toBe(0);
      expect(ppmToScore(null)).toBeNull();
    });

    it('certScore is the share of current certs', () => {
      expect(certScore([{ status: 'VALID' }, { status: 'EXPIRING' }, { status: 'EXPIRED' }])).toBe(67);
      expect(certScore([])).toBeNull();
    });

    it('computeScarResponsiveness measures on-time closure', () => {
      const r = computeScarResponsiveness([
        { status: 'closed', createdAt: new Date('2026-01-01'), closedAt: new Date('2026-01-10'), dueDate: new Date('2026-01-15') },
        { status: 'closed', createdAt: new Date('2026-01-01'), closedAt: new Date('2026-02-20'), dueDate: new Date('2026-01-15') },
        { status: 'open' },
      ]);
      expect(r.open).toBe(1);
      expect(r.closed).toBe(2);
      expect(r.closedOnTime).toBe(1);
      expect(r.onTimeRate).toBe(50);
    });

    it('monthlyTrend buckets OTD and PPM into recent months', () => {
      const now = new Date('2026-06-15T00:00:00Z');
      const t = monthlyTrend(
        [{ status: 'RECEIVED', promisedDate: new Date('2026-06-10'), receivedDate: new Date('2026-06-09') }],
        [{ sampleSize: 1000, defectsFound: 2, createdAt: new Date('2026-06-05') }],
        now,
        6,
      );
      expect(t).toHaveLength(6);
      const june = t[t.length - 1];
      expect(june.otdPct).toBe(100);
      expect(june.ppm).toBe(2000);
    });
  });
});
