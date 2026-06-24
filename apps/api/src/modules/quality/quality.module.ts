import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QualityHold } from './entities/quality-hold.entity';
import { QuarantineTransfer } from './entities/quarantine-transfer.entity';
import { Disposition } from './entities/disposition.entity';
import { CAPA } from './entities/capa.entity';
import { IQCInspection } from './entities/iqc-inspection.entity';
import { FinalInspection } from './entities/final-inspection.entity';
import { QualityCharacteristic } from './entities/quality-characteristic.entity';
import { QualityMeasurement } from './entities/quality-measurement.entity';
import { QualityService } from './quality.service';
import { QualityController } from './quality.controller';
import { CharacteristicsService } from './spc/characteristics.service';
import { CharacteristicsController } from './spc/characteristics.controller';
import { MeasurementsService } from './spc/measurements.service';
import { MeasurementsController } from './spc/measurements.controller';
import { InventoryPosition } from '../inventory/entities/inventory-position.entity';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { NumberingModule } from '../numbering/numbering.module';
import { InventoryModule } from '../inventory/inventory.module';
import { NcrModule } from '../ncr/ncr.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { GovernanceModule } from '../governance/governance.module';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      QualityHold,
      QuarantineTransfer,
      Disposition,
      CAPA,
      IQCInspection,
      FinalInspection,
      QualityCharacteristic,
      QualityMeasurement,
      InventoryPosition
    ]),
    EventLedgerModule,
    NumberingModule,
    InventoryModule,
    NcrModule,
    SuppliersModule,
    GovernanceModule,
  ],
  controllers: [
    QualityController,
    CharacteristicsController,
    MeasurementsController,
  ],
  providers: [
    QualityService,
    CharacteristicsService,
    MeasurementsService,
    provideTenantScopedRepository(QualityCharacteristic),
    provideTenantScopedRepository(QualityMeasurement),
  ],
  exports: [QualityService, CharacteristicsService, MeasurementsService],
})
export class QualityModule {}
