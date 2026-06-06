import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// FIN entities
import { ErpAccount } from './entities/erp-account.entity';
import { ErpCostCenter } from './entities/erp-cost-center.entity';
import { ErpFiscalPeriod } from './entities/erp-fiscal-period.entity';
import { ErpPostingRule } from './entities/erp-posting-rule.entity';
import { ErpJournalEntry } from './entities/erp-journal-entry.entity';
import { ErpJournalLine } from './entities/erp-journal-line.entity';
import { ErpInvoice } from './entities/erp-invoice.entity';
import { ErpInvoiceLine } from './entities/erp-invoice-line.entity';
import { ErpPayment } from './entities/erp-payment.entity';

// MM entities
import { ErpMaterialValuation } from './entities/erp-material-valuation.entity';
import { ErpValuationLayer } from './entities/erp-valuation-layer.entity';
import { ErpSupplierPrice } from './entities/erp-supplier-price.entity';
import { ErpPurchaseRequisition } from './entities/erp-purchase-requisition.entity';
import { ErpPurchaseOrder } from './entities/erp-purchase-order.entity';
import { ErpPurchaseOrderLine } from './entities/erp-purchase-order-line.entity';

// Reused entities (read/validate — owned by other modules)
import { MaterialMaster } from '../inventory/entities/material-master.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';

import { ErpSeedService } from './services/erp-seed.service';
import { ErpFinService } from './services/erp-fin.service';
import { ErpMmService } from './services/erp-mm.service';
import { ErpFinController } from './controllers/erp-fin.controller';
import { ErpMmController } from './controllers/erp-mm.controller';

import { SignalModule } from '../../common/gateway/signal.module';
import { GovernanceModule } from '../governance/governance.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // FIN
      ErpAccount,
      ErpCostCenter,
      ErpFiscalPeriod,
      ErpPostingRule,
      ErpJournalEntry,
      ErpJournalLine,
      ErpInvoice,
      ErpInvoiceLine,
      ErpPayment,
      // MM
      ErpMaterialValuation,
      ErpValuationLayer,
      ErpSupplierPrice,
      ErpPurchaseRequisition,
      ErpPurchaseOrder,
      ErpPurchaseOrderLine,
      // reused
      MaterialMaster,
      Supplier,
    ]),
    SignalModule,
    GovernanceModule, // provides AuditService required by PermissionsGuard
    InventoryModule, // provides InventoryService for goods receipt/issue
  ],
  controllers: [ErpFinController, ErpMmController],
  providers: [ErpSeedService, ErpFinService, ErpMmService],
  exports: [ErpFinService, ErpMmService],
})
export class ErpCoreModule {}
