import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SfQualityHold } from './entities/sf-quality-hold.entity';
import { SfConsumptionEvent } from '../operator-terminal/entities/sf-consumption-event.entity';
import { FloorQualityService } from './floor-quality.service';
import { FloorQualityController } from './floor-quality.controller';
import { NumberingModule } from '../numbering/numbering.module';
import { ProductionPlanModule } from '../production-plan/production-plan.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

/**
 * Floor quality — hold / MRB / disposition (Block F). A hold blocks the WO's
 * consumption (via the plan's quality-clear flag) and shipment. Reads the
 * immutable consumption ledger (read-only) for where-used containment.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SfQualityHold, SfConsumptionEvent]),
    NumberingModule,
    ProductionPlanModule,
    EventLedgerModule,
  ],
  controllers: [FloorQualityController],
  providers: [FloorQualityService, provideTenantScopedRepository(SfQualityHold)],
  exports: [FloorQualityService],
})
export class FloorQualityModule {}
