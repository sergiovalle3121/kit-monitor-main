import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SfStaging } from './entities/sf-staging.entity';
import { SfReplenishCall } from './entities/sf-replenish-call.entity';
import { MaterialStagingService } from './material-staging.service';
import { MaterialStagingController } from './material-staging.controller';
import { LineEngineeringModule } from '../line-engineering/line-engineering.module';
import { ProductionPlanModule } from '../production-plan/production-plan.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

/**
 * Material staging + e-kanban replenishment (Block C). Bridges IE line layout (A)
 * and the published plan (B): expands a WO into station-by-station kits, blocks
 * readiness on shortages, and exposes consumeStaged() for the operator terminal's
 * live backflush. Exports its service so the Operator Terminal (D) can consume.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SfStaging, SfReplenishCall]),
    LineEngineeringModule,
    ProductionPlanModule,
    EventLedgerModule,
  ],
  controllers: [MaterialStagingController],
  providers: [
    MaterialStagingService,
    provideTenantScopedRepository(SfStaging),
    provideTenantScopedRepository(SfReplenishCall),
  ],
  exports: [MaterialStagingService],
})
export class MaterialStagingModule {}
