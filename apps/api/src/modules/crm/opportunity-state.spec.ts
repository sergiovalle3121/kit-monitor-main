import {
  canTransition,
  assertTransition,
  isTerminal,
  nextStates,
  defaultProbability,
  OpportunityStatus,
} from './opportunity-state';

describe('CRM opportunity state machine', () => {
  it('allows the sales pipeline path', () => {
    expect(canTransition('LEAD', 'QUALIFIED')).toBe(true);
    expect(canTransition('QUALIFIED', 'PROPOSAL')).toBe(true);
    expect(canTransition('PROPOSAL', 'WON')).toBe(true);
  });

  it('allows losing from any open stage', () => {
    expect(canTransition('LEAD', 'LOST')).toBe(true);
    expect(canTransition('QUALIFIED', 'LOST')).toBe(true);
    expect(canTransition('PROPOSAL', 'LOST')).toBe(true);
  });

  it('forbids illegal jumps', () => {
    expect(canTransition('LEAD', 'WON')).toBe(false);
    expect(canTransition('WON', 'PROPOSAL')).toBe(false);
  });

  it('treats WON and LOST as terminal', () => {
    (['WON', 'LOST'] as OpportunityStatus[]).forEach((s) => {
      expect(isTerminal(s)).toBe(true);
      expect(nextStates(s)).toHaveLength(0);
    });
  });

  it('exposes default probabilities per stage', () => {
    expect(defaultProbability('LEAD')).toBe(10);
    expect(defaultProbability('PROPOSAL')).toBe(60);
    expect(defaultProbability('WON')).toBe(100);
  });

  it('assertTransition throws on illegal moves', () => {
    expect(() => assertTransition('WON', 'LEAD')).toThrow(
      /Cannot move an opportunity/,
    );
    expect(() => assertTransition('LEAD', 'QUALIFIED')).not.toThrow();
  });
});
