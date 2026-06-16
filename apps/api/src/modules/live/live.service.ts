import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LedgerEvent } from '../event-ledger/entities/ledger-event.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  channelForEvent,
  LiveChannel,
  LiveEvent,
  LIVE_CHANNELS,
  toLiveEvent,
  zeroChannelCounts,
} from './live-channel';

export interface LiveSnapshot {
  channels: readonly LiveChannel[];
  events: LiveEvent[];
  counts: Record<LiveChannel, number>;
  generatedAt: string;
}

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 200;
/** Over-fetch before filtering to mapped channels so we still fill `limit`. */
const SCAN = 400;

/**
 * LiveService — the REST seed for the board. `getSnapshot` returns the most
 * recent floor-relevant ledger events (the ticker's initial state) plus a quick
 * per-channel activity count. Read-only over the existing ledger; owns no tables.
 *
 * Tenant isolation: when the caller's JWT carries a tenant, the snapshot is
 * scoped to it (matching the gateway's per-tenant rooms); single-tenant callers
 * (no tenant in context) see all rows.
 */
@Injectable()
export class LiveService {
  constructor(
    @InjectRepository(LedgerEvent)
    private readonly ledger: Repository<LedgerEvent>,
    private readonly tenantCtx: TenantContextService,
  ) {}

  async getSnapshot(
    opts: { channels?: LiveChannel[]; limit?: number } = {},
  ): Promise<LiveSnapshot> {
    const limit = clamp(opts.limit ?? DEFAULT_LIMIT, 1, MAX_LIMIT);
    const tenant = this.tenantCtx.getTenantId();
    const rows = await this.ledger.find({
      where: tenant ? { tenantId: tenant } : {},
      order: { timestamp: 'DESC' },
      take: SCAN,
    });

    const wanted = new Set<LiveChannel>(
      opts.channels?.length ? opts.channels : LIVE_CHANNELS,
    );
    const counts = zeroChannelCounts();
    const events: LiveEvent[] = [];
    for (const ev of rows) {
      const channel = channelForEvent(ev.domain, ev.action);
      if (!channel || !wanted.has(channel)) continue;
      counts[channel]++;
      if (events.length < limit) events.push(toLiveEvent(ev, channel));
    }

    return {
      channels: LIVE_CHANNELS,
      events,
      counts,
      generatedAt: new Date().toISOString(),
    };
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.trunc(n) || lo));
}
