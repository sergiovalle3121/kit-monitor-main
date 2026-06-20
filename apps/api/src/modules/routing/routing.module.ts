import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RtRouting } from './entities/rt-routing.entity';
import { RtOperation } from './entities/rt-operation.entity';
import { RtOperationMaterial } from './entities/rt-operation-material.entity';
import { RoutingService } from './routing.service';
import { RoutingController } from './routing.controller';
import { MaterialMasterModule } from '../material-master/material-master.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

/**
 * Routing (Engineering / IE) — `rt_routing` + `rt_operation` + the BOM bridge
 * `rt_operation_material`. Additive, prefixed tables, coexisting with the legacy
 * `process_steps` routing. Reuses the Material Master service for lookups.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([RtRouting, RtOperation, RtOperationMaterial]),
    MaterialMasterModule,
    EventLedgerModule,
  ],
  controllers: [RoutingController],
  providers: [
    RoutingService,
    provideTenantScopedRepository(RtRouting),
    provideTenantScopedRepository(RtOperation),
    provideTenantScopedRepository(RtOperationMaterial),
  ],
  exports: [RoutingService],
})
export class RoutingModule {}
