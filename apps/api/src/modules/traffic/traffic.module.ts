import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Carrier } from './entities/carrier.entity';
import { Vehicle } from './entities/vehicle.entity';
import { Driver } from './entities/driver.entity';
import { LoadingDock } from './entities/loading-dock.entity';
import { DockAppointment } from './entities/dock-appointment.entity';
import { TrafficService } from './traffic.service';
import { TrafficController } from './traffic.controller';
import { TrafficAlertsService } from './traffic-alerts.service';
import { TrafficAlertsTask } from './traffic-alerts.task';
import { TrafficAppointmentsService } from './traffic-appointments.service';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * Traffic (Tráfico) — logistics master data (carriers, vehicles, drivers, docks)
 * for the EMS shipping suite. Additive, tenant-scoped, prefixed tables
 * (`traffic_*`). Exports TrafficService so the outbound spine can resolve and
 * status-flip units/drivers/docks during transport assignment. The alerts
 * producer (TrafficAlertsService + cron) deposits dock-overstay avisos in the
 * notification mailbox, and TrafficAppointmentsService runs the dock-appointment
 * (citas) scheduling + gate log — all best-effort, additive, traffic-only.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Carrier,
      Vehicle,
      Driver,
      LoadingDock,
      DockAppointment,
    ]),
    UsersModule,
    NotificationsModule,
  ],
  controllers: [TrafficController],
  providers: [
    TrafficService,
    TrafficAlertsService,
    TrafficAlertsTask,
    TrafficAppointmentsService,
  ],
  exports: [TrafficService, TrafficAlertsService, TrafficAppointmentsService],
})
export class TrafficModule {}
