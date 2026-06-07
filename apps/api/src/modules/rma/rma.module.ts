import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RmaCase } from './entities/rma-case.entity';
import { RmaService } from './rma.service';
import { RmaController } from './rma.controller';
import { NumberingModule } from '../numbering/numbering.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';

/**
 * RMA / customer complaints (Quality). Self-contained additive area (customer
 * denormalized) that consumes the central numbering service for RMA folios.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([RmaCase]),
    NumberingModule,
    EventLedgerModule,
  ],
  controllers: [RmaController],
  providers: [RmaService],
  exports: [RmaService],
})
export class RmaModule {}
