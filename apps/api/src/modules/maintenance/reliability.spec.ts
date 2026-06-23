import {
  assetReliabilityFrom,
  mtbfHoursFrom,
  mttrHoursFrom,
  type ReliabilityOrderLike,
} from './reliability';

const HOUR = 3_600_000;

describe('reliability (MTTR / MTBF)', () => {
  it('averages repair time of completed orders (MTTR)', () => {
    const t0 = new Date('2026-06-01T00:00:00').getTime();
    const orders: ReliabilityOrderLike[] = [
      // 2 h repair
      {
        status: 'COMPLETED',
        type: 'CORRECTIVE',
        startedAt: new Date(t0),
        completedAt: new Date(t0 + 2 * HOUR),
      },
      // 4 h repair (started never set → falls back to created_at)
      {
        status: 'COMPLETED',
        type: 'PREVENTIVE',
        created_at: new Date(t0),
        completedAt: new Date(t0 + 4 * HOUR),
      },
      // open order: ignored
      { status: 'OPEN', type: 'CORRECTIVE', created_at: new Date(t0) },
    ];
    expect(mttrHoursFrom(orders)).toBe(3); // (2 + 4) / 2
  });

  it('returns null MTTR with no completed orders', () => {
    expect(mttrHoursFrom([{ status: 'OPEN', type: 'CORRECTIVE' }])).toBeNull();
  });

  it('derives MTBF from consecutive corrective failures', () => {
    const t0 = new Date('2026-06-01T00:00:00').getTime();
    const orders: ReliabilityOrderLike[] = [
      { status: 'COMPLETED', type: 'CORRECTIVE', created_at: new Date(t0) },
      {
        status: 'OPEN',
        type: 'CORRECTIVE',
        created_at: new Date(t0 + 10 * HOUR),
      },
      {
        status: 'OPEN',
        type: 'CORRECTIVE',
        created_at: new Date(t0 + 30 * HOUR),
      },
    ];
    // deltas: 10 h and 20 h → mean 15 h
    expect(mtbfHoursFrom(orders)).toBe(15);
  });

  it('returns null MTBF with fewer than two failures', () => {
    expect(
      mtbfHoursFrom([
        { status: 'OPEN', type: 'CORRECTIVE', created_at: new Date() },
      ]),
    ).toBeNull();
  });

  it('consolidates per-asset reliability (failures, downtime, open)', () => {
    const t0 = new Date('2026-06-01T00:00:00').getTime();
    const orders: ReliabilityOrderLike[] = [
      {
        status: 'COMPLETED',
        type: 'CORRECTIVE',
        created_at: new Date(t0),
        startedAt: new Date(t0),
        completedAt: new Date(t0 + 1 * HOUR),
        downtimeMinutes: 60,
      },
      {
        status: 'IN_PROGRESS',
        type: 'CORRECTIVE',
        created_at: new Date(t0 + 5 * HOUR),
        downtimeMinutes: 0,
      },
      {
        status: 'OPEN',
        type: 'PREVENTIVE',
        created_at: new Date(t0 + 6 * HOUR),
        downtimeMinutes: 0,
      },
    ];
    const r = assetReliabilityFrom(orders);
    expect(r.failures).toBe(2); // two corrective
    expect(r.openOrders).toBe(2); // in_progress + open
    expect(r.totalDowntimeMinutes).toBe(60);
    expect(r.mttrHours).toBe(1);
    expect(r.mtbfHours).toBe(5); // single 5 h gap
    expect(r.lastFailureAt).not.toBeNull();
  });
});
