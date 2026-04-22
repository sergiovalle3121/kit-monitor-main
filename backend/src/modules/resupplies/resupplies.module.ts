import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Resupply } from './entities/resupply.entity';
import { KitMaterial } from '../kit-materials/entities/kit-material.entity';
import { ResuppliesService } from './resupplies.service';
import { ResuppliesController } from './resupplies.controller';

import { EventLedgerModule } from '../event-ledger/event-ledger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Resupply, KitMaterial]),
    EventLedgerModule
  ],
  controllers: [ResuppliesController],
  providers: [ResuppliesService],
  exports: [ResuppliesService],
})
export class ResuppliesModule {}
