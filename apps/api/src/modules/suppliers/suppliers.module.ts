import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Supplier } from './entities/supplier.entity';
import { SCAR } from './entities/scar.entity';
import { SupplierContact } from './entities/supplier-contact.entity';
import { SupplierCertification } from './entities/supplier-certification.entity';
import { SupplierApprovedPart } from './entities/supplier-approved-part.entity';
import { ErpSupplierPrice } from '../erp-core/entities/erp-supplier-price.entity';
import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller';
import { SuppliersAlertsService } from './suppliers-alerts.service';
import { SuppliersAlertsTask } from './suppliers-alerts.task';
import { IQCInspection } from '../quality/entities/iqc-inspection.entity';
import { PurchaseOrder } from '../procurement/entities/purchase-order.entity';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { GovernanceModule } from '../governance/governance.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Supplier,
      SCAR,
      IQCInspection,
      SupplierContact,
      SupplierCertification,
      SupplierApprovedPart,
      ErpSupplierPrice,
      // Read-only: OTD is derived from received purchase orders (procurement).
      PurchaseOrder,
    ]),
    EventLedgerModule,
    GovernanceModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [SuppliersController],
  providers: [SuppliersService, SuppliersAlertsService, SuppliersAlertsTask],
  exports: [SuppliersService],
})
export class SuppliersModule {}
