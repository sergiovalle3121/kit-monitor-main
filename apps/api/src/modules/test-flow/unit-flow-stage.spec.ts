import {
  destinationForResult,
  isRouted,
  stageForResult,
  UNIT_FLOW_STAGES,
} from './unit-flow-stage';

describe('unit-flow-stage', () => {
  it('routes a PASS to packaging and a FAIL to disposition', () => {
    expect(stageForResult('PASS')).toBe('READY_FOR_PACKAGING');
    expect(stageForResult('FAIL')).toBe('IN_DISPOSITION');
    expect(destinationForResult('PASS')).toBe('PACKAGING');
    expect(destinationForResult('FAIL')).toBe('DISPOSITION');
  });

  it('treats only the post-test stages as routed', () => {
    expect(isRouted('AWAITING_TEST')).toBe(false);
    expect(isRouted('READY_FOR_PACKAGING')).toBe(true);
    expect(isRouted('IN_DISPOSITION')).toBe(true);
  });

  it('exposes the three stages of the weave', () => {
    expect(UNIT_FLOW_STAGES).toEqual([
      'AWAITING_TEST',
      'READY_FOR_PACKAGING',
      'IN_DISPOSITION',
    ]);
  });
});
