import { Module } from '@nestjs/common';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

/**
 * Conversational-analytics layer over the Event Ledger — chartable, narrated
 * insights (trends, breakdowns) for the Intelligence Center UI and CIDE. Pure
 * read-only; depends only on the ledger (and, transitively, the semantic layer).
 */
@Module({
  imports: [EventLedgerModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
