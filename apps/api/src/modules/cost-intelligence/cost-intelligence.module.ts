import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinWoCostSnapshot } from './entities/fin-wo-cost-snapshot.entity';
import { SfConsumptionEvent } from '../operator-terminal/entities/sf-consumption-event.entity';
import { SfQualityHold } from '../floor-quality/entities/sf-quality-hold.entity';
import { MaterialMaster } from '../inventory/entities/material-master.entity';
import { CostIntelligenceService } from './cost-intelligence.service';
import { CostIntelligenceController } from './cost-intelligence.controller';
import { ProductionPlanModule } from '../production-plan/production-plan.module';
import { LineEngineeringModule } from '../line-engineering/line-engineering.module';
import { CostRollupModule } from '../cost-rollup/cost-rollup.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

/**
 * Cost intelligence (Block M) — connects the floor to money, live. 100% additive:
 * one new prefixed table (`fin_wo_cost_snapshot`); everything else is logic over
 * existing data. Reads the immutable consumption ledger, quality holds and the
 * material master read-only; injects the exported plan / line-engineering /
 * cost-rollup services (no legacy module is modified).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      FinWoCostSnapshot,
      SfConsumptionEvent,
      SfQualityHold,
      MaterialMaster,
    ]),
    ProductionPlanModule,
    LineEngineeringModule,
    CostRollupModule,
    EventLedgerModule,
  ],
  controllers: [CostIntelligenceController],
  providers: [
    CostIntelligenceService,
    provideTenantScopedRepository(FinWoCostSnapshot),
  ],
  exports: [CostIntelligenceService],
})
export class CostIntelligenceModule {}
