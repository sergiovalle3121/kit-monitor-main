import { Module } from '@nestjs/common';
import { ProductCostingService } from './product-costing.service';
import { ProductCostingController } from './product-costing.controller';
import { BomTreeModule } from '../bom-tree/bom-tree.module';
import { RoutingModule } from '../routing/routing.module';
import { MaterialMasterModule } from '../material-master/material-master.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';

/**
 * Product costing — standard cost roll-up over the ERP core (BOM + routing +
 * material master). No new tables; computed on demand, can persist the unit
 * standard cost back onto the material. Reuses the three core services.
 */
@Module({
  imports: [BomTreeModule, RoutingModule, MaterialMasterModule, EventLedgerModule],
  controllers: [ProductCostingController],
  providers: [ProductCostingService],
  exports: [ProductCostingService],
})
export class ProductCostingModule {}
