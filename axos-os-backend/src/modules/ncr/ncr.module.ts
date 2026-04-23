import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NCR } from './entities/ncr.entity';
import { NcrService } from './ncr.service';
import { NcrController } from './ncr.controller';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NCR]),
    EventLedgerModule,
  ],
  controllers: [NcrController],
  providers: [NcrService],
  exports: [NcrService],
})
export class NcrModule {}
