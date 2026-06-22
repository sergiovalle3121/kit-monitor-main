import {
  asLiveChannel,
  channelForEvent,
  LIVE_CHANNELS,
  sanitizeChannels,
  toLiveEvent,
  zeroChannelCounts,
} from './live-channel';
import { LedgerEvent } from '../event-ledger/entities/ledger-event.entity';

describe('live-channel routing', () => {
  describe('channelForEvent', () => {
    it('routes any ANDON action to the andon channel (even under PRODUCTION)', () => {
      expect(channelForEvent('PRODUCTION', 'SF_ANDON_MATERIAL')).toBe('andon');
      expect(channelForEvent('PRODUCTION', 'SF_ANDON_SAFETY')).toBe('andon');
      expect(channelForEvent('SYSTEM', 'ANDON_RAISED')).toBe('andon');
    });

    it('routes downtime/OEE telemetry to the oee channel', () => {
      expect(channelForEvent('PRODUCTION', 'SF_DOWNTIME_OPENED')).toBe('oee');
      expect(channelForEvent('PRODUCTION', 'SF_DOWNTIME_CLOSED')).toBe('oee');
      expect(channelForEvent('PRODUCTION', 'SF_OEE_RECOMPUTED')).toBe('oee');
    });

    it('routes the QUALITY domain (and SF_QUALITY actions) to quality', () => {
      expect(channelForEvent('QUALITY', 'SF_QUALITY_HOLD_CREATED')).toBe('quality');
      expect(channelForEvent('QUALITY', 'SF_QUALITY_HOLD_CLOSED')).toBe('quality');
      expect(channelForEvent('PRODUCTION', 'SF_QUALITY_REINSPECT')).toBe('quality');
    });

    it('routes the MATERIALS domain (and staging/replenish) to materials', () => {
      expect(channelForEvent('MATERIALS', 'SF_STAGING_CONFIRMED')).toBe('materials');
      expect(channelForEvent('MATERIALS', 'SF_REPLENISH_RAISED')).toBe('materials');
      expect(channelForEvent('SYSTEM', 'SF_STAGING_SHORTAGE')).toBe('materials');
    });

    it('routes remaining production-domain events to production', () => {
      expect(channelForEvent('PRODUCTION', 'SF_WO_PUBLISHED')).toBe('production');
      expect(channelForEvent('PRODUCTION', 'SF_WO_TRANSITIONED')).toBe('production');
      expect(channelForEvent('PRODUCTION', 'SF_PRODUCTION_CONFIRMED')).toBe('production');
    });

    it('returns null for non-floor events (skipped, not broadcast)', () => {
      expect(channelForEvent('SHIPPING', 'ASN_CREATED')).toBeNull();
      expect(channelForEvent('ENGINEERING', 'ECO_RELEASED')).toBeNull();
      expect(channelForEvent('SYSTEM', 'USER_LOGIN')).toBeNull();
      expect(channelForEvent(null, null)).toBeNull();
      expect(channelForEvent(undefined, undefined)).toBeNull();
    });

    it('is case-insensitive on domain and action', () => {
      expect(channelForEvent('production', 'sf_andon_help')).toBe('andon');
      expect(channelForEvent('quality', 'whatever')).toBe('quality');
    });
  });

  describe('sanitizeChannels / asLiveChannel', () => {
    it('keeps only known channels and dedupes', () => {
      expect(sanitizeChannels(['andon', 'oee', 'andon', 'bogus', 7])).toEqual([
        'andon',
        'oee',
      ]);
    });
    it('returns [] for non-arrays', () => {
      expect(sanitizeChannels('andon')).toEqual([]);
      expect(sanitizeChannels(undefined)).toEqual([]);
    });
    it('asLiveChannel narrows correctly', () => {
      expect(asLiveChannel('quality')).toBe('quality');
      expect(asLiveChannel('nope')).toBeNull();
      expect(asLiveChannel(123)).toBeNull();
    });
  });

  describe('toLiveEvent', () => {
    it('projects a light DTO and ISO timestamp, never leaking unmapped fields', () => {
      const when = new Date('2026-06-16T10:00:00.000Z');
      const ev = {
        id: 'e1',
        domain: 'QUALITY',
        action: 'SF_QUALITY_HOLD_CREATED',
        referenceType: 'SF_QUALITY_HOLD',
        referenceId: 'h1',
        line: 'L1',
        workOrder: 'WO-1',
        model: 'M-1',
        plant: 'P1',
        actorName: 'jane@axos',
        tenantId: 'acme',
        timestamp: when,
        context: { secret: 'x' },
      } as unknown as LedgerEvent;

      const dto = toLiveEvent(ev, 'quality');
      expect(dto).toEqual({
        id: 'e1',
        channel: 'quality',
        domain: 'QUALITY',
        action: 'SF_QUALITY_HOLD_CREATED',
        referenceType: 'SF_QUALITY_HOLD',
        referenceId: 'h1',
        line: 'L1',
        workOrder: 'WO-1',
        model: 'M-1',
        plant: 'P1',
        actorName: 'jane@axos',
        tenantId: 'acme',
        timestamp: when.toISOString(),
      });
      expect((dto as unknown as Record<string, unknown>).context).toBeUndefined();
    });

    it('tolerates a string timestamp and null optionals', () => {
      const ev = {
        id: 'e2',
        domain: 'MATERIALS',
        action: 'SF_REPLENISH_RAISED',
        timestamp: '2026-06-16T11:00:00.000Z',
      } as unknown as LedgerEvent;
      const dto = toLiveEvent(ev, 'materials');
      expect(dto.timestamp).toBe('2026-06-16T11:00:00.000Z');
      expect(dto.line).toBeNull();
      expect(dto.tenantId).toBeNull();
    });
  });

  it('LIVE_CHANNELS + zeroChannelCounts stay in sync', () => {
    expect([...LIVE_CHANNELS].sort()).toEqual(
      Object.keys(zeroChannelCounts()).sort(),
    );
    expect(Object.values(zeroChannelCounts()).every((v) => v === 0)).toBe(true);
  });
});
