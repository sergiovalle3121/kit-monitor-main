import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Supplier } from './entities/supplier.entity';
import { SCAR } from './entities/scar.entity';
import { SupplierContact } from './entities/supplier-contact.entity';
import { SupplierCertification } from './entities/supplier-certification.entity';
import { ErpSupplierPrice } from '../erp-core/entities/erp-supplier-price.entity';
import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller';
import { IQCInspection } from '../quality/entities/iqc-inspection.entity';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { GovernanceModule } from '../governance/governance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Supplier,
      SCAR,
      IQCInspection,
      SupplierContact,
      SupplierCertification,
      ErpSupplierPrice,
    ]),
    EventLedgerModule,
    GovernanceModule,
  ],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
