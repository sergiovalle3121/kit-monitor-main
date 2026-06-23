import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Carrier } from './entities/carrier.entity';
import { Vehicle } from './entities/vehicle.entity';
import { Driver } from './entities/driver.entity';
import { LoadingDock } from './entities/loading-dock.entity';
import { TrafficService } from './traffic.service';
import { TrafficController } from './traffic.controller';
import { TrafficAlertsService } from './traffic-alerts.service';
import { TrafficAlertsTask } from './traffic-alerts.task';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * Traffic (Tráfico) — logistics master data (carriers, vehicles, drivers, docks)
 * for the EMS shipping suite. Additive, tenant-scoped, prefixed tables
 * (`traffic_*`). Exports TrafficService so the outbound spine can resolve and
 * status-flip units/drivers/docks during transport assignment. The alerts
 * producer (TrafficAlertsService + cron) deposits dock-overstay avisos in the
 * notification mailbox — best-effort, additive, traffic-only.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Carrier, Vehicle, Driver, LoadingDock]),
    UsersModule,
    NotificationsModule,
  ],
  controllers: [TrafficController],
  providers: [TrafficService, TrafficAlertsService, TrafficAlertsTask],
  exports: [TrafficService, TrafficAlertsService],
})
export class TrafficModule {}
