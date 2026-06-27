import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

import { WorkOrderExecution } from './entities/work-order-execution.entity';
import { ExecutionStep } from './entities/execution-step.entity';
import { ExecutionStepMaterial } from './entities/execution-step-material.entity';
import { ExecutionEvent } from './entities/execution-event.entity';
import { StationIncident } from './entities/station-incident.entity';
import { AndonCall } from './entities/andon-call.entity';
import { MesDowntime } from './entities/mes-downtime.entity';
import { StationAssignment } from './entities/station-assignment.entity';

import { Plan } from '../plans/entities/plan.entity';
import { Kit } from '../kits/entities/kit.entity';
import { KitMaterial } from '../kit-materials/entities/kit-material.entity';
import { ProcessStep } from '../process-routing/entities/process-step.entity';
import { ProcessStepMaterial } from '../process-routing/entities/process-step-material.entity';

import { MesExecutionService } from './mes-execution.service';
import { MesExecutionController } from './mes-execution.controller';

import { SignalModule } from '../../common/gateway/signal.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { InventoryModule } from '../inventory/inventory.module';
import { MaterialRequestsModule } from '../material-requests/material-requests.module';
import { VisualAidsModule } from '../visual-aids/visual-aids.module';
import { GovernanceModule } from '../governance/governance.module';
import { TestFlowModule } from '../test-flow/test-flow.module';
import { PeopleModule } from '../people/people.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkOrderExecution,
      ExecutionStep,
      ExecutionStepMaterial,
      ExecutionEvent,
      StationIncident,
      AndonCall,
      MesDowntime,
      StationAssignment,
      Plan,
      Kit,
      KitMaterial,
      ProcessStep,
      ProcessStepMaterial,
    ]),
    SignalModule,
    EventLedgerModule,
    InventoryModule,
    MaterialRequestsModule,
    VisualAidsModule,
    GovernanceModule, // provides AuditService required by PermissionsGuard
    TestFlowModule, // Eslabón 1: hand finished serials off to the Pruebas queue
    PeopleModule, // Gate operador↔estación (read-only) para el modo bloqueo opcional
  ],
  controllers: [MesExecutionController],
  providers: [
    MesExecutionService,
    provideTenantScopedRepository(WorkOrderExecution),
    provideTenantScopedRepository(ExecutionStep),
    provideTenantScopedRepository(ExecutionStepMaterial),
    provideTenantScopedRepository(ExecutionEvent),
    provideTenantScopedRepository(StationIncident),
    provideTenantScopedRepository(AndonCall),
    provideTenantScopedRepository(MesDowntime),
    provideTenantScopedRepository(StationAssignment),
  ],
  exports: [MesExecutionService],
})
export class MesExecutionModule {}
