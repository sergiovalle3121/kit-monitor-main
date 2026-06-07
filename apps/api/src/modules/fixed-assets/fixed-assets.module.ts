import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FixedAsset } from './entities/fixed-asset.entity';
import { FixedAssetsService } from './fixed-assets.service';
import { FixedAssetsController } from './fixed-assets.controller';
import { NumberingModule } from '../numbering/numbering.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';

/**
 * Fixed Assets / depreciation (FIN). Self-contained additive area that consumes
 * the central numbering service for asset folios.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([FixedAsset]),
    NumberingModule,
    EventLedgerModule,
  ],
  controllers: [FixedAssetsController],
  providers: [FixedAssetsService],
  exports: [FixedAssetsService],
})
export class FixedAssetsModule {}
