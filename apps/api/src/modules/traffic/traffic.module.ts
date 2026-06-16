import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Carrier } from './entities/carrier.entity';
import { Vehicle } from './entities/vehicle.entity';
import { Driver } from './entities/driver.entity';
import { LoadingDock } from './entities/loading-dock.entity';
import { TrafficService } from './traffic.service';
import { TrafficController } from './traffic.controller';

/**
 * Traffic (Tráfico) — logistics master data (carriers, vehicles, drivers, docks)
 * for the EMS shipping suite. Additive, tenant-scoped, prefixed tables
 * (`traffic_*`). Exports TrafficService so the outbound spine can resolve and
 * status-flip units/drivers/docks during transport assignment.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Carrier, Vehicle, Driver, LoadingDock])],
  controllers: [TrafficController],
  providers: [TrafficService],
  exports: [TrafficService],
})
export class TrafficModule {}
