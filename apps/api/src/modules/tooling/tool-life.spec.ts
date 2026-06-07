import {
  lifePercent,
  remainingShots,
  isNearEol,
  isToolStatus,
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
});
