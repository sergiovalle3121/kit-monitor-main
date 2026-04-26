import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shipment } from './entities/shipment.entity';
import { ShipmentItem } from './entities/shipment-item.entity';
import { PackingList } from './entities/packing-list.entity';
import { ShippingService } from './shipping.service';
import { ShippingController } from './shipping.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { GovernanceModule } from '../governance/governance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Shipment, ShipmentItem, PackingList]),
    InventoryModule,
    GovernanceModule,
  ],
  controllers: [ShippingController],
  providers: [ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
