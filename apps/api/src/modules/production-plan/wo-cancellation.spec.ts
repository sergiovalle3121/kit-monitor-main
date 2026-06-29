import {
  assertSafeCancellation,
  unsafeCancellationReasons,
} from './wo-cancellation';

describe('wo-cancellation (pure)', () => {
  it('allows cancelling a clean released WO before staging or execution', () => {
    expect(
      unsafeCancellationReasons({
        status: 'RELEASED',
        materialReady: false,
        quantityCompleted: 0,
      }),
    ).toEqual([]);
    expect(() =>
      assertSafeCancellation({
        status: 'RELEASED',
        materialReady: false,
        quantityCompleted: 0,
      }),
    ).not.toThrow();
  });

  it('blocks cancellation once material has been staged', () => {
    expect(
      unsafeCancellationReasons({
        status: 'STAGED',
        materialReady: true,
        quantityCompleted: 0,
      }),
    ).toEqual(['material ya montado']);
    expect(() =>
      assertSafeCancellation({
        status: 'STAGED',
        materialReady: true,
        quantityCompleted: 0,
      }),
    ).toThrow(/material ya montado/);
  });

  it('blocks cancellation after execution has started or quantity was reported', () => {
    expect(
      unsafeCancellationReasons({
        status: 'IN_EXECUTION',
        materialReady: false,
        quantityCompleted: 1,
        startedAt: new Date(),
      }),
    ).toEqual(['ejecucion ya iniciada']);
  });
});
