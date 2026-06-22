import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SfLineStation } from './entities/sf-line-station.entity';
import { SfModelLine } from './entities/sf-model-line.entity';
import { SfLineLayout } from './entities/sf-line-layout.entity';
import { LineEngineeringService } from './line-engineering.service';
import { StationStatusService } from './station-status.service';
import { LineEngineeringController } from './line-engineering.controller';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';
import { SfFloorEvent } from '../operator-terminal/entities/sf-floor-event.entity';
import { SfQualityHold } from '../floor-quality/entities/sf-quality-hold.entity';
import { SfReplenishCall } from '../material-staging/entities/sf-replenish-call.entity';
import { SfWorkOrder } from '../production-plan/entities/sf-work-order.entity';

/**
 * Industrial Engineering — line disposition (Block A). Self-contained, additive.
 * Exports its service so Material Staging (C) and the Operator Terminal (D) can
 * expand a model into station-by-station requirements (NP + use factor + aid).
 *
 * The live MES overlay (Fase 3) reads — read-only — a few shop-floor signal
 * tables (floor events / quality holds / replenish calls / work orders) owned by
 * other modules to derive each station's light, without modifying them.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      SfLineStation,
      SfModelLine,
      SfLineLayout,
      SfFloorEvent,
      SfQualityHold,
      SfReplenishCall,
      SfWorkOrder,
    ]),
    EventLedgerModule,
  ],
  controllers: [LineEngineeringController],
  providers: [
    LineEngineeringService,
    StationStatusService,
    provideTenantScopedRepository(SfLineStation),
    provideTenantScopedRepository(SfModelLine),
    provideTenantScopedRepository(SfLineLayout),
    provideTenantScopedRepository(SfFloorEvent),
    provideTenantScopedRepository(SfQualityHold),
    provideTenantScopedRepository(SfReplenishCall),
    provideTenantScopedRepository(SfWorkOrder),
  ],
  exports: [LineEngineeringService],
})
export class LineEngineeringModule {}
