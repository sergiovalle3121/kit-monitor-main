import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentSequence } from './entities/document-sequence.entity';
import { DocumentNumberingService } from './document-numbering.service';
import { NumberingController } from './numbering.controller';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';

/**
 * Central document-numbering (folios) capability — build once, used everywhere.
 * Other modules import this module and inject {@link DocumentNumberingService}
 * to obtain folios (e.g. `allocate('PURCHASE_ORDER')`).
 */
@Module({
  imports: [TypeOrmModule.forFeature([DocumentSequence]), EventLedgerModule],
  controllers: [NumberingController],
  providers: [DocumentNumberingService],
  exports: [DocumentNumberingService],
})
export class NumberingModule {}
