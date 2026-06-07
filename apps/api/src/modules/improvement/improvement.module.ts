import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImprovementInitiative } from './entities/improvement-initiative.entity';
import { ImprovementService } from './improvement.service';
import { ImprovementController } from './improvement.controller';
import { NumberingModule } from '../numbering/numbering.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

/**
 * Continuous Improvement / OpEx (Kaizen, Lean, Six Sigma). Self-contained,
 * additive area that consumes the central numbering service for folios.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ImprovementInitiative]),
    NumberingModule,
    EventLedgerModule,
  ],
  controllers: [ImprovementController],
  providers: [
    ImprovementService,
    provideTenantScopedRepository(ImprovementInitiative),
  ],
  exports: [ImprovementService],
})
export class ImprovementModule {}
