import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CycleCount } from './entities/cycle-count.entity';
import { CycleCountsService } from './cycle-counts.service';
import { CycleCountsController } from './cycle-counts.controller';
import { NumberingModule } from '../numbering/numbering.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';

/**
 * Cycle Counts (inventory accuracy). Self-contained additive area that consumes
 * the central numbering service for count folios.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([CycleCount]),
    NumberingModule,
    EventLedgerModule,
  ],
  controllers: [CycleCountsController],
  providers: [CycleCountsService],
  exports: [CycleCountsService],
})
export class CycleCountsModule {}
