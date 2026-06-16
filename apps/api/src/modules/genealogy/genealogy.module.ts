import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SfGenealogyLink } from './entities/sf-genealogy-link.entity';
import { SfGenealogyShipment } from './entities/sf-genealogy-shipment.entity';
import { SfConsumptionEvent } from '../operator-terminal/entities/sf-consumption-event.entity';
import { GenealogyService } from './genealogy.service';
import { GenealogyController } from './genealogy.controller';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

/**
 * Genealogy — cradle-to-grave traceability (Block I). Derives AS-BUILT and
 * WHERE-USED from the immutable shop-floor consumption ledger (read-only),
 * enriched by the additive `sf_genealogy_index` and `sf_genealogy_shipment`
 * tables. Couples to other modules only by reading their entity (no service /
 * schema changes), so it never touches the source tables.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      SfGenealogyLink,
      SfGenealogyShipment,
      SfConsumptionEvent,
    ]),
    EventLedgerModule,
  ],
  controllers: [GenealogyController],
  providers: [
    GenealogyService,
    provideTenantScopedRepository(SfGenealogyLink),
    provideTenantScopedRepository(SfGenealogyShipment),
  ],
  exports: [GenealogyService],
})
export class GenealogyModule {}
