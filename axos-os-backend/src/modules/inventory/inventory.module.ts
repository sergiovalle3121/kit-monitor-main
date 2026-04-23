import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryPosition } from './entities/inventory-position.entity';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { MaterialMaster } from './entities/material-master.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { EnterpriseCampusModule } from '../enterprise-campus/enterprise-campus.module';
import { EnterpriseWarehouse } from '../enterprise-campus/entities/enterprise-warehouse.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryPosition,
      InventoryMovement,
      MaterialMaster,
      EnterpriseWarehouse
    ]),
    EnterpriseCampusModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
