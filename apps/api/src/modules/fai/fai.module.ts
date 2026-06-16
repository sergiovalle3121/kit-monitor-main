import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SfFai } from './entities/sf-fai.entity';
import { FaiService } from './fai.service';
import { FaiController } from './fai.controller';
import { NumberingModule } from '../numbering/numbering.module';
import { ProductionPlanModule } from '../production-plan/production-plan.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

/**
 * FAI / first-piece inspection (block E). Self-contained, additive. Injects the
 * production-plan service to free a WO's first-piece gate on approval
 * (setFaiApproved). Reuses the central FAI folio. Prefixed table `sf_fai`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SfFai]),
    NumberingModule,
    ProductionPlanModule,
    EventLedgerModule,
  ],
  controllers: [FaiController],
  providers: [FaiService, provideTenantScopedRepository(SfFai)],
  exports: [FaiService],
})
export class FaiModule {}
