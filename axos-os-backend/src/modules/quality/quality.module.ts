import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QualityHold } from './entities/quality-hold.entity';
import { QualityService } from './quality.service';
import { QualityController } from './quality.controller';
import { InventoryPosition } from '../inventory/entities/inventory-position.entity';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([QualityHold, InventoryPosition]),
    EventLedgerModule,
  ],
  controllers: [QualityController],
  providers: [QualityService],
  exports: [QualityService],
})
export class QualityModule {}
