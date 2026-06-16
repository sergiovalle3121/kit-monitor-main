import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SfWorkOrder } from './entities/sf-work-order.entity';
import { ProductionPlanService } from './production-plan.service';
import { ProductionPlanController } from './production-plan.controller';
import { NumberingModule } from '../numbering/numbering.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { LineEngineeringModule } from '../line-engineering/line-engineering.module';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

/**
 * Plan publication wall + work orders (Block B). Self-contained, additive.
 * Exports its service so Staging (C), the Operator Terminal (D) and Floor
 * Quality (F) can read/flip WO readiness and increment completion live.
 *
 * Imports LineEngineeringModule (Block A) to reuse its capacity calculator for
 * the per-line CRP load (read-only; no entities touched).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SfWorkOrder]),
    NumberingModule,
    EventLedgerModule,
    LineEngineeringModule,
  ],
  controllers: [ProductionPlanController],
  providers: [
    ProductionPlanService,
    provideTenantScopedRepository(SfWorkOrder),
  ],
  exports: [ProductionPlanService],
})
export class ProductionPlanModule {}
