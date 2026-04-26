import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryPosition } from './entities/inventory-position.entity';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { MaterialMaster } from './entities/material-master.entity';
import { WarehouseTask } from './entities/warehouse-task.entity';
import { ReplenishmentRule } from './entities/replenishment-rule.entity';
import { EnterpriseWarehouse } from '../enterprise-campus/entities/enterprise-warehouse.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { WarehouseService } from './warehouse.service';
import { WarehouseController } from './warehouse.controller';
import { ReplenishmentService } from './replenishment.service';
import { ReplenishmentController } from './replenishment.controller';
import { EnterpriseCampusModule } from '../enterprise-campus/enterprise-campus.module';
import { GovernanceModule } from '../governance/governance.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryPosition,
      InventoryMovement,
      MaterialMaster,
      EnterpriseWarehouse,
      WarehouseTask,
      ReplenishmentRule,
    ]),
    EnterpriseCampusModule,
    GovernanceModule,
    AccountingModule,
    // TenantModule is @Global — TenantContextService injected automatically.
  ],
  controllers: [
    InventoryController,
    WarehouseController,
    ReplenishmentController,
  ],
  providers: [InventoryService, WarehouseService, ReplenishmentService],
  exports: [InventoryService, WarehouseService, ReplenishmentService],
})
export class InventoryModule {}
