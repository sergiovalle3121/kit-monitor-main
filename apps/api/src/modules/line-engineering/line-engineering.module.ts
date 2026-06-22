import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SfLineStation } from './entities/sf-line-station.entity';
import { SfModelLine } from './entities/sf-model-line.entity';
import { SfLineLayout } from './entities/sf-line-layout.entity';
import { LineEngineeringService } from './line-engineering.service';
import { LineEngineeringController } from './line-engineering.controller';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

/**
 * Industrial Engineering — line disposition (Block A). Self-contained, additive.
 * Exports its service so Material Staging (C) and the Operator Terminal (D) can
 * expand a model into station-by-station requirements (NP + use factor + aid).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SfLineStation, SfModelLine, SfLineLayout]),
    EventLedgerModule,
  ],
  controllers: [LineEngineeringController],
  providers: [
    LineEngineeringService,
    provideTenantScopedRepository(SfLineStation),
    provideTenantScopedRepository(SfModelLine),
    provideTenantScopedRepository(SfLineLayout),
  ],
  exports: [LineEngineeringService],
})
export class LineEngineeringModule {}
