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

import { ErpSeedService } from './services/erp-seed.service';
import { ErpFinService } from './services/erp-fin.service';
import { ErpFinController } from './controllers/erp-fin.controller';

import { SignalModule } from '../../common/gateway/signal.module';
import { GovernanceModule } from '../governance/governance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpAccount,
      ErpCostCenter,
      ErpFiscalPeriod,
      ErpPostingRule,
      ErpJournalEntry,
      ErpJournalLine,
      ErpInvoice,
      ErpInvoiceLine,
      ErpPayment,
    ]),
    SignalModule,
    GovernanceModule, // provides AuditService required by PermissionsGuard
  ],
  controllers: [ErpFinController],
  providers: [ErpSeedService, ErpFinService],
  exports: [ErpFinService],
})
export class ErpCoreModule {}
