import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NCR } from './entities/ncr.entity';
import { NcrService } from './ncr.service';
import { NcrController } from './ncr.controller';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { GovernanceModule } from '../governance/governance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NCR]),
    EventLedgerModule,
    GovernanceModule,
  ],
  controllers: [NcrController],
  providers: [NcrService],
  exports: [NcrService],
})
export class NcrModule {}
