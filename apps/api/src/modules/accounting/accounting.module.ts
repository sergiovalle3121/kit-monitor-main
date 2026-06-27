import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { AccountingService } from './accounting.service';
import { AccountingController } from './accounting.controller';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction])],
  providers: [AccountingService, provideTenantScopedRepository(Transaction)],
  exports: [AccountingService],
  controllers: [AccountingController],
})
export class AccountingModule {}
