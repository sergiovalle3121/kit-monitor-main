import { Module } from '@nestjs/common';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { SemanticModule } from '../semantic/semantic.module';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

/**
 * Conversational-analytics + decision layer over the Event Ledger and semantic
 * model — chartable, narrated insights (trends, breakdowns), object-centric
 * drill-down and what-if projection, for the Intelligence Center UI and CIDE.
 * Pure read-only.
 */
@Module({
  imports: [EventLedgerModule, SemanticModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
