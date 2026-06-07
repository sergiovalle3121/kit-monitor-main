import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shipment } from './entities/shipment.entity';
import { OutboundService } from './outbound.service';
import { OutboundController } from './outbound.controller';
import { NumberingModule } from '../numbering/numbering.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';

/**
 * Logistics / Outbound (Embarque): finished-goods shipments + ASN. Self-contained
 * additive area (customer denormalized) that consumes the central numbering
 * service for shipment and ASN folios. Does not touch the legacy shipping module.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Shipment]),
    NumberingModule,
    EventLedgerModule,
  ],
  controllers: [OutboundController],
  providers: [OutboundService],
  exports: [OutboundService],
})
export class OutboundModule {}
