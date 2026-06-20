import { Module } from '@nestjs/common';
import { ImportDataService } from './import-data.service';
import { ImportDataController } from './import-data.controller';
import { MaterialMasterModule } from '../material-master/material-master.module';
import { BomTreeModule } from '../bom-tree/bom-tree.module';
import { RoutingModule } from '../routing/routing.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { NotConfiguredFeedAdapter } from './external-feed.adapter';
import { EXTERNAL_FEED_ADAPTER } from './external-feed.token';

/**
 * Data import (SAP migration). Orchestrates Material Master + BOM + Routing
 * imports by reusing their services (no duplicate persistence). Sources: CSV/
 * Excel (parsed file), SQL staging rows, and an IDoc/API skeleton adapter.
 * No new tables — writes through the existing mm_/bom_/rt_ services.
 */
@Module({
  imports: [
    MaterialMasterModule,
    BomTreeModule,
    RoutingModule,
    EventLedgerModule,
  ],
  controllers: [ImportDataController],
  providers: [
    ImportDataService,
    NotConfiguredFeedAdapter,
    { provide: EXTERNAL_FEED_ADAPTER, useExisting: NotConfiguredFeedAdapter },
  ],
  exports: [ImportDataService],
})
export class ImportDataModule {}
