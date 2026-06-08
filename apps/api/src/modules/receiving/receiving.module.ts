import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReceivingEvent } from './entities/receiving-event.entity';
import { EnterpriseWarehouse } from '../enterprise-campus/entities/enterprise-warehouse.entity';
import { ReceivingService } from './receiving.service';
import { ReceivingController } from './receiving.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { GovernanceModule } from '../governance/governance.module';
import { NumberingModule } from '../numbering/numbering.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReceivingEvent, EnterpriseWarehouse]),
    InventoryModule,
    EventLedgerModule,
    GovernanceModule,
    NumberingModule,
  ],
  controllers: [ReceivingController],
  providers: [ReceivingService],
})
export class ReceivingModule {}
