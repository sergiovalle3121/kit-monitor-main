import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NpiProject } from './entities/npi-project.entity';
import { NpiGate } from './entities/npi-gate.entity';
import { SfFai } from '../fai/entities/sf-fai.entity';
import { SupplierApprovedPart } from '../suppliers/entities/supplier-approved-part.entity';
import { NpiService } from './npi.service';
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
    provideTenantScopedRepository(NpiProject),
    provideTenantScopedRepository(NpiGate),
  ],
  exports: [NpiService],
})
export class NpiModule {}
