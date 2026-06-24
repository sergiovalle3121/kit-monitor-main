import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asset } from './entities/asset.entity';
import { MaintenanceOrder } from './entities/maintenance-order.entity';
import { MaintenancePmPlan } from './entities/pm-plan.entity';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceController } from './maintenance.controller';
import { MaintenancePmTask } from './maintenance-pm.task';
import { NumberingModule } from '../numbering/numbering.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

/**
 * Maintenance / TPM (CMMS): assets + maintenance work orders + preventive (PM)
 * plans. Self-contained, additive area. Consumes the central numbering service
 * for order folios and the notifications mailbox (best-effort) for PM-due /
 * critical-corrective alerts to admins/planners/supervisors.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Asset, MaintenanceOrder, MaintenancePmPlan]),
    NumberingModule,
    EventLedgerModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [MaintenanceController],
  providers: [MaintenanceService, MaintenancePmTask],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
