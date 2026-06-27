import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shipment } from './entities/shipment.entity';
import { ShipmentItem } from './entities/shipment-item.entity';
import { PackingList } from './entities/packing-list.entity';
import { ShippingService } from './shipping.service';
import { ShippingController } from './shipping.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { GovernanceModule } from '../governance/governance.module';
import { NumberingModule } from '../numbering/numbering.module';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Shipment, ShipmentItem, PackingList]),
    InventoryModule,
    GovernanceModule,
    NumberingModule,
  ],
  controllers: [ShippingController],
  providers: [
    ShippingService,
    provideTenantScopedRepository(Shipment),
    provideTenantScopedRepository(ShipmentItem),
    provideTenantScopedRepository(PackingList),
  ],
  exports: [ShippingService]
})
export class ShippingModule {}
