import {
  allWithinTolerance,
  assertTransition,
  canTransition,
  evaluateMeasurement,
  evaluateMeasurements,
  isTerminal,
  nextStates,
} from './fai-state';

describe('fai-state', () => {
  it('allows PENDING → PASS and PENDING → FAIL only', () => {
    expect(canTransition('PENDING', 'PASS')).toBe(true);
    expect(canTransition('PENDING', 'FAIL')).toBe(true);
    expect(canTransition('PASS', 'FAIL')).toBe(false);
    expect(canTransition('FAIL', 'PASS')).toBe(false);
  });

  it('PASS and FAIL are terminal', () => {
    expect(isTerminal('PASS')).toBe(true);
    expect(isTerminal('FAIL')).toBe(true);
    expect(isTerminal('PENDING')).toBe(false);
    expect(nextStates('PENDING')).toEqual(['PASS', 'FAIL']);
  });

  it('assertTransition throws on an illegal move', () => {
    expect(() => assertTransition('PASS', 'PENDING')).toThrow(
      /No se puede mover/,
    );
  });

  it('evaluates a measurement against inclusive spec limits', () => {
    expect(
      evaluateMeasurement({
        characteristic: 'H',
        lsl: 9.8,
        usl: 10.2,
        actual: 10.0,
      }),
    ).toBe(true);
    expect(
      evaluateMeasurement({
        characteristic: 'H',
        lsl: 9.8,
        usl: 10.2,
        actual: 9.8,
      }),
    ).toBe(true); // inclusive
    expect(
      evaluateMeasurement({
        characteristic: 'H',
        lsl: 9.8,
        usl: 10.2,
        actual: 10.3,
      }),
    ).toBe(false);
    expect(
      evaluateMeasurement({
        characteristic: 'H',
        lsl: 9.8,
        usl: 10.2,
        actual: 9.7,
      }),
    ).toBe(false);
  });

  it('treats null limits as unbounded and non-finite actuals as fail', () => {
    expect(
      evaluateMeasurement({ characteristic: 'X', usl: 5, actual: -100 }),
    ).toBe(true); // no lower bound
    expect(
      evaluateMeasurement({ characteristic: 'X', lsl: 0, actual: 100 }),
    ).toBe(true); // no upper bound
    expect(evaluateMeasurement({ characteristic: 'X', actual: NaN })).toBe(
      false,
    );
  });

  it('stamps pass flags and reports overall tolerance', () => {
    const stamped = evaluateMeasurements([
      { characteristic: 'A', lsl: 0, usl: 10, actual: 5 },
      { characteristic: 'B', lsl: 0, usl: 10, actual: 11 },
    ]);
    expect(stamped[0].pass).toBe(true);
    expect(stamped[1].pass).toBe(false);
    expect(allWithinTolerance(stamped)).toBe(false);
    expect(
      allWithinTolerance([{ characteristic: 'A', lsl: 0, usl: 10, actual: 5 }]),
    ).toBe(true);
    expect(allWithinTolerance([])).toBe(true); // vacuously true
  });
});
