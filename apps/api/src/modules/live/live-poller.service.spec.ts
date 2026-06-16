import { LivePollerService } from './live-poller.service';
import { LiveGateway } from './live.gateway';
import { LedgerEvent } from '../event-ledger/entities/ledger-event.entity';
import type { Repository } from 'typeorm';

/**
 * Tests the read-only cursor: the first ingest PRIMES the baseline without
 * replaying history; subsequent ingests emit only NEW, floor-relevant rows
 * exactly once (same-timestamp dedupe); non-floor rows are skipped.
 */
describe('LivePollerService (cursor + emission)', () => {
  let gateway: { broadcastEvent: jest.Mock };
  let repo: { find: jest.Mock };
  let poller: LivePollerService;

  beforeEach(() => {
    gateway = { broadcastEvent: jest.fn() };
    repo = { find: jest.fn() };
    poller = new LivePollerService(
      repo as unknown as Repository<LedgerEvent>,
      gateway as unknown as LiveGateway,
    );
  });

  // rows are passed newest-first (DESC), as the repo returns them.
  const ev = (
    id: string,
    iso: string,
    domain: string,
    action: string,
    extra: Partial<LedgerEvent> = {},
  ): LedgerEvent =>
    ({
      id,
      timestamp: new Date(iso),
      domain,
      action,
      tenantId: null,
      ...extra,
    }) as unknown as LedgerEvent;

  it('primes on first ingest without emitting any history', () => {
    poller.ingest([
      ev('b', '2026-06-16T10:00:02.000Z', 'PRODUCTION', 'SF_WO_PUBLISHED'),
      ev('a', '2026-06-16T10:00:01.000Z', 'QUALITY', 'SF_QUALITY_HOLD_CREATED'),
    ]);
    expect(gateway.broadcastEvent).not.toHaveBeenCalled();
  });

  it('emits only rows newer than the primed cursor, routed to their channel + tenant', () => {
    poller.ingest([
      ev('a', '2026-06-16T10:00:01.000Z', 'PRODUCTION', 'SF_WO_PUBLISHED'),
    ]);
    expect(gateway.broadcastEvent).not.toHaveBeenCalled();

    poller.ingest([
      ev('c', '2026-06-16T10:00:03.000Z', 'PRODUCTION', 'SF_ANDON_MATERIAL', {
        tenantId: 'acme',
        line: 'L1',
      }),
      ev('b', '2026-06-16T10:00:02.000Z', 'MATERIALS', 'SF_REPLENISH_RAISED'),
      ev('a', '2026-06-16T10:00:01.000Z', 'PRODUCTION', 'SF_WO_PUBLISHED'),
    ]);

    expect(gateway.broadcastEvent).toHaveBeenCalledTimes(2);
    // emitted in ascending order: b (materials/default) then c (andon/acme)
    expect(gateway.broadcastEvent).toHaveBeenNthCalledWith(
      1,
      'default',
      'materials',
      expect.objectContaining({ id: 'b', channel: 'materials' }),
    );
    expect(gateway.broadcastEvent).toHaveBeenNthCalledWith(
      2,
      'acme',
      'andon',
      expect.objectContaining({ id: 'c', channel: 'andon', line: 'L1' }),
    );
  });

  it('does not re-emit an already-seen row at the same max timestamp', () => {
    poller.ingest([ev('a', '2026-06-16T10:00:01.000Z', 'PRODUCTION', 'X')]);
    // new event at t2
    poller.ingest([
      ev('b', '2026-06-16T10:00:02.000Z', 'PRODUCTION', 'SF_WO_PUBLISHED'),
      ev('a', '2026-06-16T10:00:01.000Z', 'PRODUCTION', 'X'),
    ]);
    expect(gateway.broadcastEvent).toHaveBeenCalledTimes(1);

    // same page again on the next poll → no duplicate
    poller.ingest([
      ev('b', '2026-06-16T10:00:02.000Z', 'PRODUCTION', 'SF_WO_PUBLISHED'),
      ev('a', '2026-06-16T10:00:01.000Z', 'PRODUCTION', 'X'),
    ]);
    expect(gateway.broadcastEvent).toHaveBeenCalledTimes(1);
  });

  it('emits a second distinct row that shares the same (max) timestamp', () => {
    poller.ingest([ev('seed', '2026-06-16T10:00:00.000Z', 'PRODUCTION', 'X')]);
    poller.ingest([
      ev('b', '2026-06-16T10:00:05.000Z', 'PRODUCTION', 'SF_WO_PUBLISHED'),
      ev('seed', '2026-06-16T10:00:00.000Z', 'PRODUCTION', 'X'),
    ]);
    expect(gateway.broadcastEvent).toHaveBeenCalledTimes(1);

    // a sibling event recorded at the exact same ms as 'b' arrives next poll
    poller.ingest([
      ev('b2', '2026-06-16T10:00:05.000Z', 'QUALITY', 'SF_QUALITY_HOLD_CREATED'),
      ev('b', '2026-06-16T10:00:05.000Z', 'PRODUCTION', 'SF_WO_PUBLISHED'),
    ]);
    expect(gateway.broadcastEvent).toHaveBeenCalledTimes(2);
    expect(gateway.broadcastEvent).toHaveBeenLastCalledWith(
      'default',
      'quality',
      expect.objectContaining({ id: 'b2' }),
    );
  });

  it('skips non-floor events entirely', () => {
    poller.ingest([ev('a', '2026-06-16T10:00:01.000Z', 'SYSTEM', 'SEED')]);
    poller.ingest([
      ev('b', '2026-06-16T10:00:02.000Z', 'SHIPPING', 'ASN_CREATED'),
      ev('a', '2026-06-16T10:00:01.000Z', 'SYSTEM', 'SEED'),
    ]);
    expect(gateway.broadcastEvent).not.toHaveBeenCalled();
  });

  it('treats an empty ledger as a valid primed baseline', () => {
    poller.ingest([]);
    poller.ingest([
      ev('a', '2026-06-16T10:00:01.000Z', 'PRODUCTION', 'SF_WO_PUBLISHED'),
    ]);
    // first non-empty page after an empty prime is treated as new → emitted
    expect(gateway.broadcastEvent).toHaveBeenCalledTimes(1);
  });

  it('poll() swallows repository errors (never crashes the interval)', async () => {
    repo.find.mockRejectedValue(new Error('relation does not exist'));
    await expect(poller.poll()).resolves.toBeUndefined();
    expect(gateway.broadcastEvent).not.toHaveBeenCalled();
  });

  it('poll() reads the ledger DESC with a bounded page and ingests', async () => {
    repo.find.mockResolvedValue([]);
    await poller.poll();
    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({ order: { timestamp: 'DESC' } }),
    );
  });
});
