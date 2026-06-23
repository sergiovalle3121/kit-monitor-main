import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tool } from './entities/tool.entity';
import { ToolCheckout } from './entities/tool-checkout.entity';
import { ToolingService } from './tooling.service';
import { ToolingController } from './tooling.controller';
import { ToolingAlertsTask } from './tooling-alerts.task';
import { NumberingModule } from '../numbering/numbering.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { ProductionPlanModule } from '../production-plan/production-plan.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

/**
 * Tooling / moldes & fixtures (NPI / Process). Área autocontenida y aditiva que
 * consume el numbering central para folios y rastrea la vida en disparos.
 *
 * Referencia (read-only) ProductionPlanService para enriquecer el préstamo a una
 * WO sin tocar SfWorkOrder, y reusa NotificationsService/UsersService para las
 * alertas de EOL y calibración (best-effort, deduplicado). El ScheduleModule
 * global ya habilita el @Cron de ToolingAlertsTask.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Tool, ToolCheckout]),
    NumberingModule,
    EventLedgerModule,
    ProductionPlanModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [ToolingController],
  providers: [ToolingService, ToolingAlertsTask],
  exports: [ToolingService],
})
export class ToolingModule {}
