import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SfChangeover } from './entities/sf-changeover.entity';
import { ChangeoverService } from './changeover.service';
import { ChangeoverController } from './changeover.controller';
import { NumberingModule } from '../numbering/numbering.module';
import { ProductionPlanModule } from '../production-plan/production-plan.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

/**
 * Changeover / SMED (block changeover). Self-contained, additive. Injects the
 * production-plan service (read-only) to enrich the incoming WO's model/folio.
 * The measured changeover time is recorded as downtime category 'changeover'
 * (B1 OEE contract) via the event ledger. Prefixed table `sf_changeovers`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SfChangeover]),
    NumberingModule,
    ProductionPlanModule,
    EventLedgerModule,
  ],
  controllers: [ChangeoverController],
  providers: [ChangeoverService, provideTenantScopedRepository(SfChangeover)],
  exports: [ChangeoverService],
})
export class ChangeoverModule {}
