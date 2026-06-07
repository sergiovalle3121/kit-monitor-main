import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asset } from './entities/asset.entity';
import { MaintenanceOrder } from './entities/maintenance-order.entity';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceController } from './maintenance.controller';
import { NumberingModule } from '../numbering/numbering.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';

/**
 * Maintenance / TPM (CMMS): assets + maintenance work orders. Self-contained,
 * additive area that consumes the central numbering service for order folios.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Asset, MaintenanceOrder]),
    NumberingModule,
    EventLedgerModule,
  ],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
