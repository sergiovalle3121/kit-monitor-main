import { LedgerEvent } from '../event-ledger/entities/ledger-event.entity';

/**
 * Live floor channels — the real-time spine groups domain events into the five
 * streams the "Piso en Vivo" board cares about. This is the ONLY place the
 * routing rules live, so the gateway, the poller and the snapshot agree.
 *
 * Pure functions, zero I/O — unit-tested in `live-channel.spec.ts`.
 */
export type LiveChannel =
  | 'andon'
  | 'production'
  | 'quality'
  | 'oee'
  | 'materials';

export const LIVE_CHANNELS: readonly LiveChannel[] = [
  'andon',
  'production',
  'quality',
  'oee',
  'materials',
] as const;

const CHANNEL_SET = new Set<string>(LIVE_CHANNELS);

/** Narrow an arbitrary string to a known channel (or null). */
export function asLiveChannel(value: unknown): LiveChannel | null {
  return typeof value === 'string' && CHANNEL_SET.has(value)
    ? (value as LiveChannel)
    : null;
}

/** Sanitize a client-supplied channel list to the known set (deduped). */
export function sanitizeChannels(input: unknown): LiveChannel[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<LiveChannel>();
  for (const v of input) {
    const ch = asLiveChannel(v);
    if (ch) out.add(ch);
  }
  return Array.from(out);
}

/**
 * Map a ledger event (domain + action) to a live channel, or `null` when the
 * event is not floor-relevant (e.g. SYSTEM/ENGINEERING/SHIPPING or generic CRUD
 * recorded by the event-ledger interceptor). Only the five floor streams are
 * broadcast; everything else is skipped.
 *
 * Order matters: andon and downtime/OEE telemetry are carved out of the broad
 * PRODUCTION domain BEFORE the generic production fallback.
 */
export function channelForEvent(
  domain: string | null | undefined,
  action: string | null | undefined,
): LiveChannel | null {
  const a = (action ?? '').toUpperCase();
  const d = (domain ?? '').toUpperCase();

  // Andon (line stopped / call for help) — highest signal on the floor.
  if (a.includes('ANDON')) return 'andon';
  // Availability telemetry: downtime open/close + any explicit OEE event.
  if (a.includes('DOWNTIME') || a.includes('OEE')) return 'oee';
  // Quality holds / MRB / dispositions.
  if (d === 'QUALITY' || a.startsWith('SF_QUALITY')) return 'quality';
  // Material staging + e-kanban replenishment.
  if (d === 'MATERIALS' || a.startsWith('SF_STAGING') || a.startsWith('SF_REPLENISH'))
    return 'materials';
  // Everything else in the production domain (WO published/transitioned, units confirmed).
  if (d === 'PRODUCTION') return 'production';

  return null;
}

/** Light transport shape broadcast to clients — never leaks the full entity. */
export interface LiveEvent {
  id: string;
  channel: LiveChannel;
  domain: string;
  action: string;
  referenceType: string | null;
  referenceId: string | null;
  line: string | null;
  workOrder: string | null;
  model: string | null;
  plant: string | null;
  actorName: string | null;
  tenantId: string | null;
  timestamp: string;
}

/** Project a ledger row into the wire DTO for the given (already-resolved) channel. */
export function toLiveEvent(ev: LedgerEvent, channel: LiveChannel): LiveEvent {
  return {
    id: ev.id,
    channel,
    domain: ev.domain,
    action: ev.action,
    referenceType: ev.referenceType ?? null,
    referenceId: ev.referenceId ?? null,
    line: ev.line ?? null,
    workOrder: ev.workOrder ?? null,
    model: ev.model ?? null,
    plant: ev.plant ?? null,
    actorName: ev.actorName ?? null,
    tenantId: ev.tenantId ?? null,
    timestamp:
      ev.timestamp instanceof Date
        ? ev.timestamp.toISOString()
        : new Date(ev.timestamp ?? Date.now()).toISOString(),
  };
}

/** Zeroed per-channel counter map. */
export function zeroChannelCounts(): Record<LiveChannel, number> {
  return { andon: 0, production: 0, quality: 0, oee: 0, materials: 0 };
}
