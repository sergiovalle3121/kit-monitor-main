import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerEvent } from './entities/ledger-event.entity';
import { EventLedgerService } from './event-ledger.service';

@Module({
  imports: [TypeOrmModule.forFeature([LedgerEvent])],
  providers: [EventLedgerService],
  exports: [EventLedgerService],
})
export class EventLedgerModule {}
