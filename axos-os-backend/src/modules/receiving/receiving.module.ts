import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReceivingEvent } from './entities/receiving-event.entity';
import { ReceivingService } from './receiving.service';
import { ReceivingController } from './receiving.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReceivingEvent]),
    InventoryModule,
    EventLedgerModule
  ],
  controllers: [ReceivingController],
  providers: [ReceivingService],
})
export class ReceivingModule {}
