import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SfWorkOrder } from './entities/sf-work-order.entity';
import { ProductionPlanService } from './production-plan.service';
import { ProductionPlanController } from './production-plan.controller';
import { ProductionPlanReadinessService } from './production-plan-readiness.service';
import { NumberingModule } from '../numbering/numbering.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { LineEngineeringModule } from '../line-engineering/line-engineering.module';
import { BomHeader } from '../bom/entities/bom-header.entity';
import { BomComponent } from '../bom/entities/bom-component.entity';
import { InventoryPosition } from '../inventory/entities/inventory-position.entity';
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
    TypeOrmModule.forFeature([SfWorkOrder, BomHeader, BomComponent, InventoryPosition]),
    NumberingModule,
    EventLedgerModule,
    LineEngineeringModule,
  ],
  controllers: [ProductionPlanController],
  providers: [
    ProductionPlanService,
    ProductionPlanReadinessService,
    provideTenantScopedRepository(SfWorkOrder),
    provideTenantScopedRepository(BomHeader),
    provideTenantScopedRepository(InventoryPosition),
  ],
  exports: [ProductionPlanService],
})
export class ProductionPlanModule {}
