import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { ProcurementService } from './procurement.service';
import { ProcurementController } from './procurement.controller';
import { NumberingModule } from '../numbering/numbering.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';

/**
 * Procurement / Purchasing: purchase orders. Self-contained, additive area that
 * consumes the central numbering service for PO folios. Supplier is denormalized
 * to avoid coupling with the suppliers module.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([PurchaseOrder]),
    NumberingModule,
    EventLedgerModule,
  ],
  controllers: [ProcurementController],
  providers: [ProcurementService],
  exports: [ProcurementService],
})
export class ProcurementModule {}
