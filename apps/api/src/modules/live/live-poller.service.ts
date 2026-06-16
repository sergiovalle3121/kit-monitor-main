import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LedgerEvent } from '../event-ledger/entities/ledger-event.entity';
import { LiveGateway } from './live.gateway';
import { channelForEvent, toLiveEvent } from './live-channel';

/** Poll cadence. The board is "breathing", not a hot loop — a few seconds is plenty. */
export const LIVE_POLL_MS = 2500;
/** Safety cap on rows scanned per tick (a real floor never bursts this fast). */
const SCAN_LIMIT = 200;

/**
 * LivePollerService
 *
 * The real-time SOURCE: it tails the existing Event Ledger from an in-memory
 * cursor and hands each NEW, floor-relevant event to the LiveGateway. It is
 * strictly READ-ONLY — it injects the `LedgerEvent` repository for `find` only,
 * never the EventLedgerService, and never writes. ZERO new tables.
 *
 * Cursor: `{ cursorTs, seen }` lives only in memory. The first poll PRIMES the
 * cursor to the newest existing row WITHOUT emitting (history belongs to the REST
 * snapshot), so only events created after boot are streamed. `seen` dedupes rows
 * that share the max timestamp across consecutive polls.
 */
@Injectable()
export class LivePollerService {
  private readonly logger = new Logger(LivePollerService.name);

  /** Epoch ms of the newest event already accounted for. */
  private cursorTs = 0;
  /** Ids already emitted at exactly `cursorTs` (same-timestamp dedupe). */
  private seen = new Set<string>();
  /** Until primed we only establish the baseline; we never replay history. */
  private primed = false;
  /** Guards against overlapping ticks if a poll runs long. */
  private polling = false;

  constructor(
    @InjectRepository(LedgerEvent)
    private readonly ledger: Repository<LedgerEvent>,
    private readonly gateway: LiveGateway,
  ) {}

  @Interval('live:ledger-poll', LIVE_POLL_MS)
  async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      const rows = await this.ledger.find({
        order: { timestamp: 'DESC' },
        take: SCAN_LIMIT,
      });
      this.ingest(rows);
    } catch (err) {
      // Table not ready yet (early boot) or a transient read error — never crash
      // the interval; the next tick retries.
      this.logger.debug(`live poll skipped: ${(err as Error)?.message}`);
    } finally {
      this.polling = false;
    }
  }

  /**
   * Process a DESC page of ledger rows: prime on first run, otherwise emit every
   * row newer than the cursor. Pure w.r.t. the gateway (easy to unit-test).
   */
  ingest(rowsDesc: LedgerEvent[]): void {
    if (rowsDesc.length === 0) {
      this.primed = true; // empty ledger: baseline is "nothing yet"
      return;
    }
    const asc = [...rowsDesc].reverse();

    if (!this.primed) {
      const newest = asc[asc.length - 1];
      this.cursorTs = this.ts(newest);
      this.seen = new Set(
        asc.filter((r) => this.ts(r) === this.cursorTs).map((r) => r.id),
      );
      this.primed = true;
      return;
    }

    for (const ev of asc) {
      const ts = this.ts(ev);
      if (ts < this.cursorTs) continue;
      if (ts === this.cursorTs && this.seen.has(ev.id)) continue;

      this.emit(ev);

      if (ts > this.cursorTs) {
        this.cursorTs = ts;
        this.seen = new Set([ev.id]);
      } else {
        this.seen.add(ev.id);
      }
    }
  }

  private emit(ev: LedgerEvent): void {
    const channel = channelForEvent(ev.domain, ev.action);
    if (!channel) return; // not a floor channel → skip
    const tenantId = ev.tenantId ?? 'default';
    try {
      this.gateway.broadcastEvent(tenantId, channel, toLiveEvent(ev, channel));
    } catch (err) {
      this.logger.debug(`live emit failed: ${(err as Error)?.message}`);
    }
  }

  private ts(ev: LedgerEvent): number {
    const t = ev.timestamp as unknown;
    return t instanceof Date ? t.getTime() : new Date(t as string).getTime();
  }
}
