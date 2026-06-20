import { Module } from '@nestjs/common';
import { PurchasePlanningService } from './purchase-planning.service';
import { PurchasePlanningController } from './purchase-planning.controller';
import { MrpModule } from '../mrp/mrp.module';
import { MaterialMasterModule } from '../material-master/material-master.module';
import { ProcurementModule } from '../procurement/procurement.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';

/**
 * Purchase planning — closes the loop MRP → procurement. Reuses MrpService
 * (net requirements), MaterialMasterService (preferred AVL supplier) and
 * ProcurementService (PO creation). No new tables.
 */
@Module({
  imports: [MrpModule, MaterialMasterModule, ProcurementModule, EventLedgerModule],
  controllers: [PurchasePlanningController],
  providers: [PurchasePlanningService],
  exports: [PurchasePlanningService],
})
export class PurchasePlanningModule {}
