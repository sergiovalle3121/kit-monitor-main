import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NpiProject } from './entities/npi-project.entity';
import { NpiGate } from './entities/npi-gate.entity';
import { NpiReadinessSnapshot } from './entities/npi-readiness-snapshot.entity';
import { ProductModel } from '../product-models/entities/product-model.entity';
import { VisualAid } from '../visual-aids/entities/visual-aid.entity';
import { SfWorkOrder } from '../production-plan/entities/sf-work-order.entity';
import { SfFai } from '../fai/entities/sf-fai.entity';
import { SupplierApprovedPart } from '../suppliers/entities/supplier-approved-part.entity';
import { NpiService } from './npi.service';
import { NpiReadinessScanService } from './npi-readiness-scan.service';
import { NpiReadinessScanTask } from './npi-readiness-scan.task';
import { NpiController } from './npi.controller';
import { BomModule } from '../bom/bom.module';
import { LineEngineeringModule } from '../line-engineering/line-engineering.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

/**
 * NPI — phase-gate orchestration + an ADVISORY readiness aggregator. Owns only
 * the additive `npi_project` / `npi_gate` tables; it reads BOM, FAI, line
 * balance and AVL signals from their owning modules (read-only) and never
 * mutates them, blocks them, or activates a product-model. Couples to other
 * modules only by reading their entity/service.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      NpiProject,
      NpiGate,
      NpiReadinessSnapshot,
      // Read-only: resolve the canonical ProductModel id for a model number.
      // No coupling to ProductModelsModule (avoids a cycle) — entity only.
      ProductModel,
      // Read-only advisory dependency signals (visual aids, production WOs).
      VisualAid,
      SfWorkOrder,
      SfFai,
      SupplierApprovedPart,
    ]),
    BomModule,
    LineEngineeringModule,
    EventLedgerModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [NpiController],
  providers: [
    NpiService,
    NpiReadinessScanService,
    NpiReadinessScanTask,
    provideTenantScopedRepository(NpiProject),
    provideTenantScopedRepository(NpiGate),
    provideTenantScopedRepository(NpiReadinessSnapshot),
  ],
  exports: [NpiService, NpiReadinessScanService],
})
export class NpiModule {}
