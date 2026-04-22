import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerEvent } from './entities/ledger-event.entity';
import { EventLedgerService } from './event-ledger.service';

import { EventLedgerController } from './event-ledger.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LedgerEvent])],
  controllers: [EventLedgerController],
  providers: [EventLedgerService],
  exports: [EventLedgerService],
})
export class EventLedgerModule {}
