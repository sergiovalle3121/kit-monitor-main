import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SfConsumptionEvent } from './entities/sf-consumption-event.entity';
import { SfFloorEvent } from './entities/sf-floor-event.entity';
import { Certification } from '../people/entities/certification.entity';
import { OperatorTerminalService } from './operator-terminal.service';
import { OperatorTerminalController } from './operator-terminal.controller';
import { SapAdapter } from './sap-adapter';
import { LineEngineeringModule } from '../line-engineering/line-engineering.module';
import { ProductionPlanModule } from '../production-plan/production-plan.module';
import { MaterialStagingModule } from '../material-staging/material-staging.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

/**
 * Operator terminal (Block D) — unifies the floor: IE layout (A) tells it what to
 * build and the expected NP (poka-yoke) + use factor (backflush); the plan (B)
 * gives the WO, consumption mode and serial control; staging (C) provides live
 * material decrement; people certifications gate by skill. SAP 261 is stubbed.
 *
 * Certification is read-only here (skill gate) — a second forFeature is harmless
 * and keeps people untouched.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SfConsumptionEvent, SfFloorEvent, Certification]),
    LineEngineeringModule,
    ProductionPlanModule,
    MaterialStagingModule,
    EventLedgerModule,
  ],
  controllers: [OperatorTerminalController],
  providers: [
    OperatorTerminalService,
    SapAdapter,
    provideTenantScopedRepository(SfConsumptionEvent),
    provideTenantScopedRepository(SfFloorEvent),
  ],
  exports: [OperatorTerminalService],
})
export class OperatorTerminalModule {}
