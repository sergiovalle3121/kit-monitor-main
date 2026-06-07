import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Receipt } from './entities/receipt.entity';
import { InboundService } from './inbound.service';
import { InboundController } from './inbound.controller';
import { NumberingModule } from '../numbering/numbering.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';

/**
 * Inbound / Receiving + IQC (Recibo). Self-contained additive area (supplier/PO
 * denormalized) that consumes the central numbering service for receipt folios.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Receipt]),
    NumberingModule,
    EventLedgerModule,
  ],
  controllers: [InboundController],
  providers: [InboundService],
  exports: [InboundService],
})
export class InboundModule {}
