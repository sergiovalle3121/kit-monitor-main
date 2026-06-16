import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SfDowntimeEvent } from './entities/sf-downtime-event.entity';
import { SfHxhTarget } from './entities/sf-hxh-target.entity';
import { SfConsumptionEvent } from '../operator-terminal/entities/sf-consumption-event.entity';
import { SfQualityHold } from '../floor-quality/entities/sf-quality-hold.entity';
import { OeeService } from './oee.service';
import { OeeController } from './oee.controller';
import { ProductionPlanModule } from '../production-plan/production-plan.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

/**
 * OEE / shop-floor metrics (Block H) — the plant-manager metric. Owns two new,
 * additive, prefixed tables: `sf_downtime_events` (Availability) and
 * `sf_hxh_target` (the hour-by-hour meta). The REAL output, scrap and ideal
 * cycle are READ from the existing shop-floor records (consumption ledger, quality
 * holds, work orders) — never re-counted. Exposes a Control-Tower OEE/output feed.
 *
 * `SfConsumptionEvent` and `SfQualityHold` are registered here read-only (a second
 * `forFeature` is harmless) so operator-terminal (D) and floor-quality (F) stay
 * untouched.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      SfDowntimeEvent,
      SfHxhTarget,
      SfConsumptionEvent,
      SfQualityHold,
    ]),
    ProductionPlanModule,
    EventLedgerModule,
  ],
  controllers: [OeeController],
  providers: [
    OeeService,
    provideTenantScopedRepository(SfDowntimeEvent),
    provideTenantScopedRepository(SfHxhTarget),
  ],
  exports: [OeeService],
})
export class OeeModule {}
