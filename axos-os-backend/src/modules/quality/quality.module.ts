import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QualityHold } from './entities/quality-hold.entity';
import { QuarantineTransfer } from './entities/quarantine-transfer.entity';
import { Disposition } from './entities/disposition.entity';
import { CAPA } from './entities/capa.entity';
import { IQCInspection } from './entities/iqc-inspection.entity';
import { FinalInspection } from './entities/final-inspection.entity';
import { QualityService } from './quality.service';
import { QualityController } from './quality.controller';
import { InventoryPosition } from '../inventory/entities/inventory-position.entity';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { InventoryModule } from '../inventory/inventory.module';
import { NcrModule } from '../ncr/ncr.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { GovernanceModule } from '../governance/governance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      QualityHold, 
      QuarantineTransfer, 
      Disposition, 
      CAPA, 
      IQCInspection, 
      FinalInspection,
      InventoryPosition
    ]),
    EventLedgerModule,
    InventoryModule,
    NcrModule,
    SuppliersModule,
    GovernanceModule,
  ],
  controllers: [QualityController],
  providers: [QualityService],
  exports: [QualityService],
})
export class QualityModule {}
