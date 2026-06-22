import {
  absenteeismRate,
  annualizedTurnover,
  directIndirectRatio,
  earlyAttritionRate,
  flightRiskScore,
  nineBoxCell,
  performanceBand,
  riskBand,
  spanOfControl,
  staffingRiskScore,
  tenureBand,
  tenureYears,
  timeToFillDays,
} from './hr-analytics';

describe('hr-analytics (workforce math)', () => {
  describe('tenure', () => {
    it('computes tenure in years and bands it', () => {
      const asOf = new Date('2026-06-22');
      expect(tenureYears('2025-06-22', asOf)).toBeCloseTo(1, 1);
      expect(tenureBand(tenureYears('2026-05-22', asOf))).toBe('<3m');
      expect(tenureBand(tenureYears('2025-10-22', asOf))).toBe('3-12m');
      expect(tenureBand(2)).toBe('1-3y');
      expect(tenureBand(4)).toBe('3-5y');
      expect(tenureBand(9)).toBe('5y+');
    });

    it('returns 0 tenure when hireDate is missing', () => {
      expect(tenureYears(null, new Date())).toBe(0);
    });
  });

  describe('turnover & attrition', () => {
    it('annualizes turnover over the window', () => {
      // 5 separations on avg headcount 100 over 365d ≈ 5%
      expect(annualizedTurnover(5, 100, 365)).toBe(5);
      // same 5 over 90 days annualizes higher
      expect(annualizedTurnover(5, 100, 90)).toBeGreaterThan(15);
    });

    it('guards against division by zero', () => {
      expect(annualizedTurnover(3, 0, 365)).toBe(0);
      expect(annualizedTurnover(3, 50, 0)).toBe(0);
    });

    it('computes early attrition (<90d) as % of hires', () => {
      expect(earlyAttritionRate(3, 12)).toBe(25);
      expect(earlyAttritionRate(0, 0)).toBe(0);
    });
  });

  describe('absenteeism & ratios', () => {
    it('computes absenteeism %', () => {
      expect(absenteeismRate(80, 1000)).toBe(8);
      expect(absenteeismRate(10, 0)).toBe(0);
    });

    it('computes direct:indirect ratio and span of control', () => {
      expect(directIndirectRatio(60, 10)).toBe(6);
      expect(directIndirectRatio(5, 0)).toBe(5);
      expect(spanOfControl(48, 6)).toBe(8);
      expect(spanOfControl(10, 0)).toBe(0);
    });
  });

  describe('time to fill', () => {
    it('returns whole days between open and fill', () => {
      expect(timeToFillDays('2026-01-01', '2026-01-31')).toBe(30);
      expect(timeToFillDays('2026-01-01', null)).toBeNull();
    });
  });

  describe('9-box', () => {
    it('maps performance score to band', () => {
      expect(performanceBand(5)).toBe('HIGH');
      expect(performanceBand(3)).toBe('MED');
      expect(performanceBand(1)).toBe('LOW');
    });

    it('places high/high in the Star cell (index 9)', () => {
      const cell = nineBoxCell(5, 'HIGH');
      expect(cell.key).toBe('STAR');
      expect(cell.index).toBe(9);
    });

    it('places low/low in the Risk cell (index 1)', () => {
      const cell = nineBoxCell(1, 'LOW');
      expect(cell.key).toBe('RISK');
      expect(cell.index).toBe(1);
    });

    it('gives every score/potential combo a unique 1..9 index', () => {
      const seen = new Set<number>();
      for (const score of [1, 3, 5]) {
        for (const pot of ['LOW', 'MED', 'HIGH'] as const) {
          seen.add(nineBoxCell(score, pot).index);
        }
      }
      expect(seen.size).toBe(9);
    });
  });

  describe('flight-risk', () => {
    it('flags a new direct-labor hire with absences and low engagement as high risk', () => {
      const r = flightRiskScore({
        tenureYearsValue: 0.1,
        absences90d: 3,
        lateCount90d: 4,
        engagementScore: 40,
        hadRecentReview: false,
        laborType: 'DIRECT',
      });
      expect(r.score).toBeGreaterThanOrEqual(75);
      expect(r.band).toBe('CRITICAL');
      expect(r.drivers.length).toBeGreaterThan(0);
    });

    it('keeps a tenured, engaged indirect employee at low risk', () => {
      const r = flightRiskScore({
        tenureYearsValue: 4,
        absences90d: 0,
        lateCount90d: 0,
        engagementScore: 90,
        hadRecentReview: true,
        laborType: 'INDIRECT',
      });
      expect(r.score).toBeLessThan(25);
      expect(r.band).toBe('LOW');
    });

    it('bounds the score to 0..100', () => {
      const r = flightRiskScore({
        tenureYearsValue: 0,
        absences90d: 20,
        lateCount90d: 20,
        engagementScore: 0,
        hadRecentReview: false,
        laborType: 'DIRECT',
      });
      expect(r.score).toBeLessThanOrEqual(100);
      expect(r.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('staffing-risk (HR → production)', () => {
    it('escalates risk with a big vacancy gap, high turnover and low coverage', () => {
      const r = staffingRiskScore({
        headcount: 20,
        openOpenings: 10,
        attritionRatePct: 60,
        absenteeismRatePct: 9,
        skillCoveragePct: 55,
      });
      expect(r.gapPct).toBeGreaterThan(0);
      expect(['HIGH', 'CRITICAL']).toContain(r.band);
      expect(r.recommendation).not.toBe('Estable');
    });

    it('reports a fully-staffed, low-attrition cell as stable', () => {
      const r = staffingRiskScore({
        headcount: 30,
        openOpenings: 0,
        attritionRatePct: 6,
        absenteeismRatePct: 1,
        skillCoveragePct: 100,
      });
      expect(r.band).toBe('LOW');
      expect(r.recommendation).toBe('Estable');
    });
  });

  describe('riskBand thresholds', () => {
    it('bands scores into LOW/MEDIUM/HIGH/CRITICAL', () => {
      expect(riskBand(10)).toBe('LOW');
      expect(riskBand(30)).toBe('MEDIUM');
      expect(riskBand(60)).toBe('HIGH');
      expect(riskBand(90)).toBe('CRITICAL');
    });
  });
});
