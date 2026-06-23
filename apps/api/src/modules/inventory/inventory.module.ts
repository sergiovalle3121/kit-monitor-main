import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryPosition } from './entities/inventory-position.entity';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { MaterialMaster } from './entities/material-master.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { EnterpriseCampusModule } from '../enterprise-campus/enterprise-campus.module';
import { EnterpriseWarehouse } from '../enterprise-campus/entities/enterprise-warehouse.entity';
import { WarehouseTask } from './entities/warehouse-task.entity';
import { WarehouseService } from './warehouse.service';
import { WarehouseController } from './warehouse.controller';
import { ReplenishmentRule } from './entities/replenishment-rule.entity';
import { ReplenishmentService } from './replenishment.service';
import { ReplenishmentController } from './replenishment.controller';
import { MaterialReturn } from './entities/material-return.entity';
import { ReturnsService } from './returns.service';
import { WarehouseAlertsService } from './warehouse-alerts.service';
import { WarehouseAlertsTask } from './warehouse-alerts.task';
import { GovernanceModule } from '../governance/governance.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MaterialStagingModule } from '../material-staging/material-staging.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryPosition,
      InventoryMovement,
      MaterialMaster,
      EnterpriseWarehouse,
      WarehouseTask,
      ReplenishmentRule,
      MaterialReturn,
    ]),
    EnterpriseCampusModule,
    GovernanceModule,
    UsersModule,
    NotificationsModule,
    MaterialStagingModule,
  ],
  controllers: [InventoryController, WarehouseController, ReplenishmentController],
  providers: [InventoryService, WarehouseService, ReplenishmentService, ReturnsService, WarehouseAlertsService, WarehouseAlertsTask],
  exports: [InventoryService, WarehouseService, ReplenishmentService, ReturnsService, WarehouseAlertsService],
})
export class InventoryModule {}
