import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpenseReport } from './entities/expense-report.entity';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { NumberingModule } from '../numbering/numbering.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

/**
 * Expenses / travel reimbursement (FIN / AP). Self-contained additive area
 * (employee denormalized) that consumes the central numbering service for folios.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ExpenseReport]),
    NumberingModule,
    EventLedgerModule,
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService, provideTenantScopedRepository(ExpenseReport)],
  exports: [ExpensesService],
})
export class ExpensesModule {}
