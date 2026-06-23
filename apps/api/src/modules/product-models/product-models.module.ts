import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductModel } from './entities/product-model.entity';
import { ProductModelsService } from './product-models.service';
import { ProductModelsController } from './product-models.controller';
import { NumberingModule } from '../numbering/numbering.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { NpiModule } from '../npi/npi.module';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

/**
 * Product/Model master (NPI · Engineering) — the backbone that gives every
 * `model` string across BOM, planning and process routing a canonical record.
 * Self-contained, additive; consumes the central numbering service for folios.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ProductModel]),
    NumberingModule,
    EventLedgerModule,
    NpiModule,
  ],
  controllers: [ProductModelsController],
  providers: [
    ProductModelsService,
    provideTenantScopedRepository(ProductModel),
  ],
  exports: [ProductModelsService],
})
export class ProductModelsModule {}
