import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { LedgerEvent } from '../event-ledger/entities/ledger-event.entity';
import { getJwtSecret } from '../../common/config/jwt-secret';
import { LiveGateway } from './live.gateway';
import { LivePollerService } from './live-poller.service';
import { LiveService } from './live.service';
import { LiveController } from './live.controller';

/**
 * Live floor real-time spine. 100% additive: owns NO tables and touches no
 * existing entity. It registers `LedgerEvent` read-only (a second `forFeature`
 * is harmless — same pattern OEE uses for the shop-floor entities) and tails it
 * from an in-memory cursor (LivePollerService) into the LiveGateway (`/live`
 * namespace). REST seed at GET /live/snapshot.
 *
 * Polling runs via `@Interval` off the global `ScheduleModule.forRoot()` already
 * wired in AppModule — no local schedule import needed.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([LedgerEvent]),
    // Same secret as REST to authenticate the socket handshake.
    JwtModule.register({ secret: getJwtSecret() }),
  ],
  controllers: [LiveController],
  providers: [LiveGateway, LivePollerService, LiveService],
})
export class LiveModule {}
